import { prisma } from '../../../lib/db';
import { uploadFile } from '../../../lib/storage';
import type { Actor } from '../../../lib/actor';
import { Borradores, type RastroPortal } from '../carga/borrador';
import { aplicarEstadoEnVenta } from '../estados';
import { conTurno } from '../portal/turno';
import type { PayloadVitolen } from './carga';
import { BorradorInexistenteError, cancelarBorrador, confirmar, ConfirmarNoDisponibleError, crearYLeerResumen, leerBorrador, llenarFormulario, ResumenCambiadoError } from './llenar';
import { conSesionVitolen, LAB_VITOLEN, NOMBRE_VITOLEN, ROBOT_VITOLEN } from './portal';
import { mensajeExistente, pedidoExistenteDelPar } from './existentes';
import { pedidoOrigenDeVitolen } from './origen';
import { rolDeLaPromo, rolesDeLaPromoHoya } from '../../../lib/laboratorios/vitolen-promo';
import { armarFormulario, diferenciasDePayloadVitolen, leerVentaParaCarga } from './carga';
import { cantidadDeArmazones } from '../../../lib/order-frames';
import { resumenComparable } from './resumen';

/**
 * EL ROBOT TRABAJA SOBRE UN BORRADOR DEL CRM, con el flujo real del portal
 * (comprobado el 3/10/2026, docs/vitolen-portal.md):
 *
 *   PREPARADO  → el robot llena el formulario y aprieta "Crear": el portal crea
 *                SU borrador (id propio, "Por Asignar", no figura en el
 *                listado). El id se guarda EN EL ACTO; después la captura del
 *                resumen → EN_REVISION.
 *   APROBADO   → el robot abre ese borrador, comprueba que siga mostrando lo
 *                aprobado y aprieta "Confirmar": el portal asigna el nº de
 *                trabajo → CARGADO, y el nº va a la venta firmado por el robot
 *                y por quien aprobó. Si cambió, vuelve a EN_REVISION. Si falla
 *                otra cosa, queda APROBADO con el motivo y se reintenta (nunca
 *                ERROR: el portal puede haber confirmado).
 *   RECHAZADO  → el robot aprieta "Cancelar" en el portal y verifica que
 *                desapareció. Si no puede, queda anotado para hacerlo a mano.
 *
 * Toda entrada al portal toma el turno como pasada 'robot' (una sola pasada a
 * la vez: el contenedor no aguanta dos Chromium) y espera hasta 4 min si otra
 * pasada está corriendo.
 * Nada se confirma sin la aprobación de una persona (regla de Ishtar).
 */
class ParYaConPedidoError extends Error { constructor(m: string) { super(m); this.name = 'ParYaConPedidoError'; } }
class VentaCambiadaError extends Error { constructor(m: string) { super(m); this.name = 'VentaCambiadaError'; } }

export const ROBOT_ACTOR_VITOLEN: Actor = { id: null, name: ROBOT_VITOLEN, role: null };

export interface ResumenGuardado extends RastroPortal {
    portalDraftId: string;
    url: string;
    texto: string;
    pasos: { campo: string; valor: string }[];
    pendientes: string[];
    llenadoEl: string;
}

const ESPERA_TURNO_MS = 4 * 60_000;

async function enElPortal<T>(tarea: () => Promise<T>): Promise<T> {
    // Pasada 'robot': espera a cualquier pasada en curso (hay una persona en la ficha).
    // Obligatorio: lo que crea o confirma en un portal no corre sin turno (dos
    // robots a la vez serían dos trabajos), igual que Grupo Óptico.
    const r = await conTurno(LAB_VITOLEN, 'robot', tarea, { esperar: true, esperaMaxMs: ESPERA_TURNO_MS, obligatorio: true });
    if (r && typeof r === 'object' && 'skipped' in (r as any) && (r as any).skipped) {
        throw new Error(`El portal de ${NOMBRE_VITOLEN} está ocupado por otra pasada; volvé a intentar en unos minutos.`);
    }
    return r as T;
}

async function guardarCaptura(borradorId: string, sufijo: string, captura: Buffer): Promise<string> {
    // Receta y medidas del cliente: clave que /api/storage/view trata como sensible (exige sesión).
    const guardado = await uploadFile(captura, `lab-modulos/vitolen/${borradorId}-${sufijo}-${Date.now()}.png`, 'image/png');
    return `/api/storage/view?key=${encodeURIComponent(guardado)}`;
}

function rastroDe(b: { resumenPortal: unknown }): ResumenGuardado | null {
    const r = b.resumenPortal as Partial<ResumenGuardado> | null;
    return r && typeof r.portalDraftId === 'string' && r.portalDraftId ? (r as ResumenGuardado) : null;
}

export async function llenarBorradorEnPortal(borradorId: string) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, payload: true, resumenPortal: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'PREPARADO') throw new Error(`El borrador está ${b.status}: el robot solo llena los PREPARADOS.`);
    if (rastroDe(b)) throw new Error(`El borrador ya tiene un pedido en el portal (${rastroDe(b)!.portalDraftId}): no se vuelve a crear.`);

    try {
        const r = await enElPortal(() => conSesionVitolen(async (page) => {
            const llenado = await llenarFormulario(page, b.payload as unknown as PayloadVitolen);
            const resumen = await crearYLeerResumen(page);
            // Apenas existe en el portal, queda anotado: una falla de acá en más
            // no puede terminar en "volver a crear".
            if (resumen.portalDraftId) await Borradores.anotarPortal(b.id, { portalDraftId: resumen.portalDraftId, url: resumen.url });
            return { llenado, resumen };
        }));
        if (!r.resumen.portalDraftId) {
            const capturaUrl = await guardarCaptura(b.id, 'rechazo', r.resumen.captura).catch(() => null);
            const motivo = `El portal rechazó el pedido: ${(r.resumen.rechazo || ['sin detalle']).join(' · ')}${capturaUrl ? ` (captura: ${capturaUrl})` : ''}`;
            await Borradores.error(b.id, ROBOT_ACTOR_VITOLEN, motivo);
            throw new Error(motivo);
        }
        const screenshotUrl = await guardarCaptura(b.id, 'resumen', r.resumen.captura);
        const resumenPortal: ResumenGuardado = {
            portalDraftId: r.resumen.portalDraftId, url: r.resumen.url,
            texto: r.resumen.texto.slice(0, 4000),
            // Lo que se compara al confirmar: ya recortado, nunca truncado.
            textoComparable: resumenComparable(r.resumen.texto),
            pasos: r.llenado.pasos, pendientes: r.llenado.pendientes, llenadoEl: new Date().toISOString(),
        };
        return await Borradores.enRevision(b.id, ROBOT_ACTOR_VITOLEN, { screenshotUrl, resumenPortal });
    } catch (err: any) {
        const motivo = err?.message || String(err);
        if (!/rechazó el pedido/.test(motivo)) {
            const conPortal = await prisma.labOrderDraft.findUnique({ where: { id: b.id }, select: { resumenPortal: true } }).then(x => x && rastroDe(x)).catch(() => null);
            const nota = conPortal ? ` El pedido ${conPortal.portalDraftId} quedó creado en el portal sin confirmar: cancelalo desde la ficha o confirmalo a mano.` : '';
            await Borradores.error(b.id, ROBOT_ACTOR_VITOLEN, motivo + nota).catch(e => console.error('[lab-modulos] no se pudo marcar el error del borrador:', e));
        }
        throw err;
    }
}

/**
 * Tras la aprobación humana: comprueba que el portal siga mostrando lo
 * aprobado, confirma, escribe el nº en la venta (firmado por el robot y por
 * quien aprobó), CARGADO. Reintentable: desde APROBADO nunca va a ERROR.
 */
export async function confirmarBorradorAprobado(borradorId: string) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, orderId: true, pair: true, payload: true, resumenPortal: true, approvedBy: true, screenshotUrl: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'APROBADO') throw new Error(`El borrador está ${b.status}: el robot solo confirma los APROBADOS.`);
    const rastro = rastroDe(b);
    if (!rastro) {
        const motivo = 'El borrador no tiene el id del portal: hay que volver a prepararlo (anulalo y preparalo de nuevo).';
        await Borradores.anotarFalla(b.id, motivo, { soloSi: 'APROBADO' }).catch(() => null);
        throw new Error(motivo);
    }
    const aprobadoPor = b.approvedBy ? { id: rastro.aprobadoPorId ?? null, name: b.approvedBy } : null;
    await Borradores.robotArranca(b.id, `confirmando en el portal desde ${new Date().toISOString()}`);

    try {
        const r = await enElPortal(() => conSesionVitolen(async (page) => {
            // ¿El par recibió pedido por otro camino mientras el borrador esperaba
            // (nº tipeado a mano, seguimiento)? Confirmar sería un segundo trabajo.
            // Los pares se cuentan desde la VENTA (como en analizar), no desde los
            // borradores: con el otro par cargado a mano no hay borrador y "un solo
            // par" le atribuiría ese nº a este.
            const ventaParaPares = await leerVentaParaCarga(b.orderId);
            const pares = Math.max(cantidadDeArmazones(ventaParaPares as any), b.pair);
            const existente = await pedidoExistenteDelPar(b.orderId, b.pair, pares, rastro.portalDraftId);
            if (existente) {
                // Si el nº que tiene el par es el de ESTE borrador (se confirmó y falló lo de
                // después, o lo confirmaron a mano), no es "otro pedido": se sigue y se anota.
                const estado = await leerBorrador(page, rastro.portalDraftId);
                const esElMismo = !!estado.numeroPrevio && estado.numeroPrevio.replace(/\D/g, '') === existente.numero.replace(/\D/g, '');
                if (!esElMismo) throw new ParYaConPedidoError(`${mensajeExistente(existente, b.pair)} El borrador del portal sigue sin confirmar: rechazalo para cancelarlo.`);
            }
            // El rol en la promo (1º / 2º par) tiene que ser el de HOY: si la venta se
            // editó y el par caro ahora es el otro, el pendiente y el pedido origen ya no valen.
            const payload = (b.payload || {}) as Partial<PayloadVitolen>;
            const venta = await leerVentaParaCarga(b.orderId);
            const rolHoy = venta ? rolDeLaPromo(rolesDeLaPromoHoya(venta.items as any), b.pair) : null;
            // La venta de HOY tiene que armar el mismo pedido que se aprobó (receta,
            // diseño, armazón): si la vendedora corrigió un esférico después de
            // preparar, lo que está en el portal es viejo (auditoría de robustez, A3).
            if (venta && payload.od !== undefined) {
                // El pedido origen también se revalida con el de HOY (nunca un anulado ni un reproceso), como en GO.
                const rolesHoy = rolesDeLaPromoHoya(venta.items as any);
                const origenHoy = payload.rolPromo === 'SEGUNDO_PAR' && rolesHoy ? await pedidoOrigenDeVitolen(b.orderId, rolesHoy.conCargo) : null;
                const hoy = armarFormulario(venta, { pair: b.pair, forma: payload.armazon?.forma ?? null, ejeDiagonal: payload.armazon?.ejeDiagonal ?? null, variante: payload.variante ?? null, rolPromo: payload.rolPromo, pedidoOrigen: origenHoy });
                const cambios = diferenciasDePayloadVitolen(payload as PayloadVitolen, hoy.payload);
                if (!hoy.ok || cambios.length) throw new VentaCambiadaError(`La venta cambió después de preparar (${cambios.join(', ') || hoy.faltantes.join(', ')}): rechazá el borrador y volvé a prepararlo. No se confirmó nada.`);
            }
            // Un borrador de antes del 8/10/2026 no guardó rol: no hay con qué comparar.
            if (venta && payload.rolPromo !== undefined && rolHoy !== payload.rolPromo) throw new ParYaConPedidoError(`El lugar de este par en la promo cambió después de aprobar (era ${payload.rolPromo ?? 'sin promo'}, hoy ${rolHoy ?? 'sin promo'}): rechazá el borrador y volvé a prepararlo.`);
            return confirmar(page, rastro.portalDraftId, rastro.textoComparable ?? rastro.texto);
        }));
        const screenshotFinalUrl = await guardarCaptura(b.id, 'confirmado', r.captura).catch(() => null);
        // Primero la venta (nº, estado, aviso), después el borrador: si la venta
        // falla el borrador sigue APROBADO y el reintento vuelve a pasar por acá
        // (confirmar lee el nº ya asignado; aplicarEstadoEnVenta es idempotente).
        await aplicarEstadoEnVenta({
            orderId: b.orderId, lab: LAB_VITOLEN, nombreLab: NOMBRE_VITOLEN, robot: ROBOT_VITOLEN,
            pedidos: [{ portalNumber: r.portalNumber, status: 'INGRESADO', statusRaw: 'Confirmación' }],
            aprobadoPor,
        });
        await Borradores.robotTermino(b.id);
        return await Borradores.cargado(b.id, ROBOT_ACTOR_VITOLEN, { portalNumber: r.portalNumber, screenshotFinalUrl });
    } catch (err: any) {
        if (err instanceof BorradorInexistenteError) {
            // Lo cancelaron a mano en el portal: no hay nada que confirmar; el par se
            // puede preparar de nuevo (auditoría de robustez, A2).
            await Borradores.invalidarPorBorradorDesaparecido(b.id, ROBOT_ACTOR_VITOLEN, `${err.message} Prepará el pedido de nuevo.`)
                .catch(e => console.error('[lab-modulos] no se pudo invalidar el borrador Vitolen desaparecido:', e));
            throw err;
        }
        if (err instanceof ConfirmarNoDisponibleError || err instanceof VentaCambiadaError) {
            // Nada se confirmó: vuelve a revisión con el motivo, para que una persona decida.
            await Borradores.volverARevision(b.id, ROBOT_ACTOR_VITOLEN, { screenshotUrl: b.screenshotUrl ?? '', resumenPortal: rastro, motivo: err.message })
                .catch(e => console.error('[lab-modulos] no se pudo devolver a revisión el borrador Vitolen (queda APROBADO):', e));
            throw err;
        }
        if (err instanceof ParYaConPedidoError) {
            // No se confirmó nada: vuelve a revisión con el motivo para que la persona rechace.
            await Borradores.volverARevision(b.id, ROBOT_ACTOR_VITOLEN, { screenshotUrl: b.screenshotUrl ?? '', resumenPortal: rastro, motivo: err.message })
                .catch(e => console.error('[lab-modulos] no se pudo devolver a revisión el borrador Vitolen (queda APROBADO):', e));
            throw err;
        }
        if (err instanceof ResumenCambiadoError) {
            const screenshotUrl = await guardarCaptura(b.id, 'cambiado', err.captura).catch(() => '');
            await Borradores.volverARevision(b.id, ROBOT_ACTOR_VITOLEN, {
                screenshotUrl,
                resumenPortal: { ...rastro, texto: err.texto.slice(0, 4000), textoComparable: resumenComparable(err.texto), url: err.url, cambiadoEl: new Date().toISOString() },
                motivo: err.message,
            });
            throw err;
        }
        const motivo = err?.message || String(err);
        await Borradores.anotarFalla(b.id, `No se pudo confirmar en el portal: ${motivo}. Reintentar desde la ficha (si el portal ya lo tomó, el robot lee el nº).`, { soloSi: 'APROBADO' })
            .catch(e => console.error('[lab-modulos] no se pudo anotar la falla del borrador:', e));
        throw err;
    }
}

/**
 * Cancela en el portal el borrador de un CRM RECHAZADO o ERROR (el que
 * quedó creado sin confirmar). No cambia el estado del CRM; anota
 * `canceladoEl`, que es lo que vuelve a permitir preparar otro.
 */
export async function cancelarEnPortal(borradorId: string, actor?: Actor): Promise<{ cancelado: boolean; motivo?: string }> {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, error: true, resumenPortal: true, orderId: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'RECHAZADO' && b.status !== 'ERROR') throw new Error(`El borrador está ${b.status}: solo se cancela en el portal un RECHAZADO o un ERROR.`);
    const rastro = rastroDe(b);
    if (!rastro) return { cancelado: false, motivo: 'sin borrador en el portal' };
    if (rastro.canceladoEl || rastro.confirmadoAManoEl) {
        // Confirmado a mano en el portal: el nº tiene que llegar a la venta (antes solo llegaba si el seguimiento lo vinculaba).
        if (rastro.confirmadoAManoNumero) await aplicarEstadoEnVenta({ orderId: b.orderId, lab: LAB_VITOLEN, nombreLab: NOMBRE_VITOLEN, robot: ROBOT_VITOLEN, pedidos: [{ portalNumber: rastro.confirmadoAManoNumero, status: 'INGRESADO', statusRaw: 'Confirmado a mano en el portal' }], aprobadoPor: null }).catch(e => console.error('[lab-modulos] no se pudo anotar en la venta el nº confirmado a mano:', e));
        return { cancelado: true };
    }
    await Borradores.robotArranca(b.id, `cancelando en el portal desde ${new Date().toISOString()}`);
    try {
        const r = await enElPortal(() => conSesionVitolen(page => cancelarBorrador(page, rastro.portalDraftId)));
        if (r.confirmadoAMano) {
            // Alguien lo confirmó a mano en el portal: no se cancela (eso se habla
            // con el laboratorio), queda resuelto con ese nº y la venta lo recibe.
            await Borradores.confirmadoAManoEnPortal(b.id, r.confirmadoAMano, actor);
            const venta = await prisma.labOrderDraft.findUnique({ where: { id: b.id }, select: { orderId: true } });
            if (venta) {
                await aplicarEstadoEnVenta({
                    orderId: venta.orderId, lab: LAB_VITOLEN, nombreLab: NOMBRE_VITOLEN, robot: ROBOT_VITOLEN,
                    pedidos: [{ portalNumber: r.confirmadoAMano, status: 'INGRESADO', statusRaw: 'Confirmación (confirmado a mano en el portal)' }],
                }).catch(e => console.error('[lab-modulos] no se pudo escribir el nº confirmado a mano en la venta:', e));
            }
            return { cancelado: false, motivo: `ya estaba confirmado a mano en el portal con el nº ${r.confirmadoAMano}; quedó anotado en la venta` };
        }
        await Borradores.canceladoEnPortal(b.id, actor);
        return { cancelado: true };
    } catch (err: any) {
        const motivo = err?.message || String(err);
        // Un solo renglón de "no se pudo cancelar": no se acumula con cada clic.
        const base = String(b.error || '').split('\n').filter(l => !/NO se pudo cancelar/.test(l)).join('\n');
        await Borradores.anotarFalla(b.id, `${base}\nNO se pudo cancelar el borrador ${rastro.portalDraftId} en el portal (${motivo}): cancelarlo a mano en ${rastro.url}`.trim()).catch(() => null);
        return { cancelado: false, motivo };
    }
}

/**
 * Volver a mirar el borrador en el portal SIN cambiar de estado: después de
 * que la persona hizo "Modificar" a mano (la promo del 2º par), la captura y el
 * resumen comparable se actualizan y recién entonces se aprueba. Sin esto, la
 * aprobación chocaba siempre con "el pedido cambió" y había que aprobar dos veces.
 */
export async function releerBorradorEnPortal(borradorId: string, actor: Actor) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, resumenPortal: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'EN_REVISION') throw new Error(`El borrador está ${b.status}: solo se relee uno para revisar.`);
    const rastro = rastroDe(b);
    if (!rastro) throw new Error('El borrador no tiene el id del portal: hay que volver a prepararlo.');
    await Borradores.robotArranca(b.id, `releyendo el portal desde ${new Date().toISOString()}`);
    let r: Awaited<ReturnType<typeof leerBorrador>>;
    try { r = await enElPortal(() => conSesionVitolen(page => leerBorrador(page, rastro.portalDraftId))); }
    catch (err: any) { await Borradores.anotarFalla(b.id, `No se pudo releer el portal: ${err?.message || err}`, { soloSi: 'EN_REVISION' }).catch(() => null); throw err; }
    if (r.numeroPrevio) {
        // Lo confirmaron a mano en el portal: queda resuelto con ese nº, como al cancelar.
        await Borradores.confirmadoAManoEnPortal(b.id, r.numeroPrevio, actor);
        throw new Error(`El borrador ya está confirmado en el portal con el nº ${r.numeroPrevio}: rechazalo desde la ficha (con ese motivo) y el nº pasa a la venta; no hay nada más que aprobar acá.`);
    }
    const screenshotUrl = await guardarCaptura(b.id, 'releido', r.captura);
    return Borradores.vistaReleida(b.id, actor, {
        screenshotUrl,
        resumenPortal: { ...rastro, texto: r.texto.slice(0, 4000), textoComparable: resumenComparable(r.texto), url: r.url, releidoEl: new Date().toISOString() },
    });
}
