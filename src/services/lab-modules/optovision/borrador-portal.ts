import type { Page } from 'playwright';
import { prisma } from '../../../lib/db';
import { uploadFile } from '../../../lib/storage';
import { logAudit } from '../../../lib/audit';
import type { Actor } from '../../../lib/actor';
import { Borradores, type RastroPortal } from '../carga/borrador';
import { aplicarEstadoEnVenta } from '../estados';
import { conTurno } from '../portal/turno';
import { puedeCrearPedidosReales } from '../carga/produccion';
import { numerosDeLaVenta, numerosDeOtrosPares as numerosAjenosAlPar } from '../carga/numeros';
import { decidirConAprobado } from '../grupo-optico/decision';
import { conSesionOves, LAB_OPTOVISION, NOMBRE_OPTOVISION, ROBOT_OPTOVISION } from './portal';
import { diferenciasDePlan, huellaDelPlan, planDeCarga, rolesDeLaPromo, type OpcionesCargaOves, type PlanOves } from './carga';
import { leerVentaParaCargaOves } from './venta';
import { abrirFormulario, buscarPorReferencia, capturarFormulario, diferenciasDeFormulario, grabarPedido, llenarFormulario, PedidoRechazadoError, PortalRespondioError, type Llenado } from './llenar';
import { esNumeroOves, numeroDelPrimerPar, pedidoExistenteDelPar } from './existentes';
import { cantidadDeArmazones } from '../../../lib/order-frames';
import { avisarMailDePromo } from './promo-mail';
import type { EstadoEnPortal } from '../contrato';

/**
 * LA CARGA ASISTIDA DE OPTOVISIÓN sobre el borrador del CRM (LabOrderDraft),
 * con el flujo real de OVES (docs/oves-portal.md): no hay borrador en el
 * portal; llenar el formulario es local al navegador y Grabar crea el pedido
 * en el acto (y la óptica solo puede PEDIR la anulación).
 *
 *   PREPARADO  → el robot entra a OVES en SOLO LECTURA, abre el formulario,
 *                lo llena con el plan, lee lo que quedó campo por campo y saca
 *                la captura de la pantalla real → EN_REVISION. Nada sale al
 *                laboratorio.
 *   APROBADO   → el robot comprueba que la venta no cambió desde que se
 *                preparó, vuelve a llenar el formulario (otra sesión), lo
 *                compara con lo aprobado, aprieta Grabar, acepta "CONFIRMA EL
 *                PEDIDO?", lee el nº y lo anota en la venta firmado por el
 *                robot y por quien aprobó → CARGADO. Con los dos pares de una
 *                promo cargados, manda el mail a Optovisión (promo-mail.ts).
 *   RECHAZADO  → nada que deshacer (nunca se mandó).
 *
 * Contra duplicados, lo mismo que Grupo Óptico (grupo-optico/decision.ts): el
 * nº creado se anota en el acto, y antes de grabar se busca en el listado del
 * portal un pedido con la referencia de la venta.
 * Toda entrada al portal toma el turno como pasada 'robot'.
 */
export const ROBOT_ACTOR_OPTOVISION: Actor = { id: null, name: ROBOT_OPTOVISION, role: null };
export const VARIABLE_PERMISO_OVES = 'OVES_PERMITIR_CARGA';

/** Lo que se guarda en el borrador: lo que se aprobó, tal cual. */
export interface PayloadBorradorOves {
    opciones: OpcionesCargaOves;
    plan: PlanOves;
    avisos: string[];
}

export interface RastroOves extends RastroPortal {
    /** Lo que quedó en el formulario al preparar (comparable al confirmar). */
    formulario?: Record<string, string>;
    pasos?: { campo: string; valor: string }[];
    noAplican?: string[];
    reglas?: Llenado['reglas'];
    huella?: string;
    preparadoEl?: string;
    numeroCreado?: string;
    envioIniciadoEl?: string | null;
    etapa?: string;
    respuestaDelPortal?: string;
    diferencias?: string[];
    adoptadoDelPortal?: boolean;
    /** El mail de la promo a Optovisión: cuándo salió (o por qué no). */
    mailPromoEnviadoEl?: string | null;
    mailPromoPendiente?: string | null;
}

const ESPERA_TURNO_MS = 4 * 60_000;
/** Tras un Grabar sin respuesta, cuánto esperar antes de volver a grabar (el portal puede guardarlo tarde). */
const ESPERA_TRAS_ENVIO_INCIERTO_MS = 15 * 60_000;

async function enElPortal<T>(tarea: () => Promise<T>): Promise<T> {
    const r = await conTurno(LAB_OPTOVISION, 'robot', tarea, { esperar: true, esperaMaxMs: ESPERA_TURNO_MS, obligatorio: true });
    if (r && typeof r === 'object' && 'skipped' in (r as any) && (r as any).skipped) {
        throw new Error(`El portal de ${NOMBRE_OPTOVISION} está ocupado por otra pasada; volvé a intentar en unos minutos.`);
    }
    return r as T;
}

async function mezclar(id: string, datos: RastroOves) { await Borradores.anotarRastro(id, datos); }

async function guardarCaptura(borradorId: string, sufijo: string, png: Buffer): Promise<string> {
    // Receta y datos del cliente: clave que /api/storage/view trata como sensible (exige sesión).
    const key = await uploadFile(png, `lab-modulos/optovision/${borradorId}-${sufijo}-${Date.now()}.png`, 'image/png');
    return `/api/storage/view?key=${encodeURIComponent(key)}`;
}

/**
 * Navegador en SOLO LECTURA: se aborta toda petición que grabe en OVES
 * (`opc=grabar` y los RPC que escriben) antes de salir, y se comprueba que el
 * bloqueo esté puesto antes de tocar el formulario. Al final la página se mata
 * (about:blank) antes de levantar el bloqueo.
 */
async function enSoloLectura<T>(page: Page, tarea: (atajadas: string[]) => Promise<T>): Promise<T> {
    const atajadas: string[] = [];
    const ESCRIBE = /opc=(grabar|anular|marcar)|rs=x_(grabarPedido|sendPedido|sendCarrito|borrarProducto|pwdChange|sendCliente)/i;
    const handler = async (route: any) => {
        const q = route.request();
        const u: string = q.url();
        const body = q.postData() || '';
        if ((q.method() !== 'GET' && q.method() !== 'HEAD' && ESCRIBE.test(`${u} ${body}`)) || /opc=grabar/i.test(u)) {
            atajadas.push(u);
            return route.abort('blockedbyclient');
        }
        return route.continue();
    };
    const contexto = page.context();
    await contexto.route('**/*', handler);
    try {
        const paso = await page.evaluate(async () => {
            try { await fetch('include/suggest.php?opc=grabar&prueba=1', { method: 'POST', body: 'lentes=AO', credentials: 'include' }); return true; } catch { return false; }
        });
        if (paso || !atajadas.some(a => /prueba=1/.test(a))) throw new Error(`${NOMBRE_OPTOVISION}: no se pudo poner el navegador en solo lectura; no se toca el formulario.`);
        atajadas.length = 0;
        return await tarea(atajadas);
    } finally {
        await page.goto('about:blank', { waitUntil: 'commit' }).catch(() => null);
        await contexto.unroute('**/*', handler).catch(() => null);
    }
}

/** Arma el plan desde la venta tal como está hoy. */
async function planActual(orderId: string, par: number, opciones: OpcionesCargaOves) {
    const venta = await leerVentaParaCargaOves(orderId);
    if (!venta) throw new Error('La venta no existe.');
    // El nº del 1er par y el cupón se revalidan con lo de HOY: nunca un anulado ni un reproceso.
    const roles = rolesDeLaPromo(venta);
    const origen = roles && par === roles.sinCargo ? await numeroDelPrimerPar(orderId, roles.conCargo) : null;
    return planDeCarga(venta, par, { ...opciones, pedidoOrigen: origen });
}

/** PREPARADO → EN_REVISION. Solo lee el portal. */
export async function prepararEnPortal(borradorId: string) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, orderId: true, pair: true, payload: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'PREPARADO') throw new Error(`El borrador está ${b.status}: el robot solo prepara los PREPARADOS.`);
    const guardado = b.payload as unknown as PayloadBorradorOves;
    return Borradores.conRobot(b.id, `preparando desde ${new Date().toISOString()}`, async () => {
    try {
        const r = await planActual(b.orderId, b.pair, guardado.opciones);
        if (!r.ok) throw new Error(`Faltan datos: ${r.faltantes.join(' · ')}`);
        await mezclar(b.id, { etapa: `esperando turno y entrando a OVES desde ${new Date().toISOString()}` }).catch(() => null);
        const { llenado, captura } = await enElPortal(() => conSesionOves(async (page) => {
            await mezclar(b.id, { etapa: `llenando el formulario de OVES desde ${new Date().toISOString()}` }).catch(() => null);
            return enSoloLectura(page, async () => {
                await abrirFormulario(page, r.plan.clase);
                const llenado = await llenarFormulario(page, r.plan);
                const captura = await capturarFormulario(page);
                return { llenado, captura };
            });
        }));
        const screenshotUrl = await guardarCaptura(b.id, 'revision', captura);
        return await Borradores.enRevision(b.id, ROBOT_ACTOR_OPTOVISION, {
            screenshotUrl,
            resumenPortal: { formulario: llenado.formulario, pasos: llenado.pasos, noAplican: llenado.noAplican, reglas: llenado.reglas, huella: huellaDelPlan(r.plan), preparadoEl: new Date().toISOString() } as RastroOves,
        });
    } catch (err: any) {
        const motivo = err?.message || String(err);
        await Borradores.error(b.id, ROBOT_ACTOR_OPTOVISION, motivo).catch(e => console.error('[lab-modulos] no se pudo marcar el error del borrador Optovisión:', e));
        throw err;
    }
    }, { enEstado: ['PREPARADO'] });
}

class AprobacionInvalidaError extends Error { constructor(m: string) { super(m); this.name = 'AprobacionInvalidaError'; } }
class YaCargadoError extends Error { constructor() { super('ya cargado'); this.name = 'YaCargadoError'; } }
class AdopcionNoVerificadaError extends Error { constructor(m: string) { super(m); this.name = 'AdopcionNoVerificadaError'; } }

async function numerosDeOtrosPares(orderId: string, pair: number): Promise<Set<string>> {
    return numerosAjenosAlPar(await numerosDeLaVenta(LAB_OPTOVISION, orderId, { esNumeroDelLab: esNumeroOves }), pair);
}

/**
 * APROBADO → CARGADO. Reintentable: desde APROBADO solo va a ERROR si el robot
 * comprobó que en el portal no hay pedido (la venta cambió o el portal lo
 * rechazó). El orden es el de Grupo Óptico (auditoría del 3/10/2026):
 *  1. adentro del turno, releer el borrador (otro intento pudo cargarlo);
 *  2. decidir con lo que YA hay (nº creado, pedido del par por otro camino,
 *     pedido en el portal con la referencia de la venta, envío sin respuesta);
 *  3. recién ahí comparar la venta de hoy con lo aprobado, y el formulario
 *     recién llenado con el que se aprobó; si algo cambió, no se graba;
 *  4. grabar, anotar el nº en el acto, captura final, venta, mail de promo.
 */
export async function confirmarBorradorAprobado(borradorId: string, opts: { robot?: string | null } = {}) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, orderId: true, pair: true, payload: true, resumenPortal: true, approvedBy: true, preparedBy: true, portalNumber: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status === 'CARGADO') {
        // Un reintento sobre un CARGADO: si el mail de la promo había quedado pendiente, se vuelve a intentar (idempotente).
        await avisarMailDePromo(b.orderId, ROBOT_ACTOR_OPTOVISION).catch(err => console.error('[lab-modulos] mail de promo Optovisión:', err?.message || err));
        return prisma.labOrderDraft.findUniqueOrThrow({ where: { id: b.id } });
    }
    if (b.status !== 'APROBADO') throw new Error(`El borrador está ${b.status}: el robot solo carga los APROBADOS.`);
    const rastro0 = (b.resumenPortal || {}) as RastroOves;
    if (!rastro0.formulario || !rastro0.huella) {
        const motivo = 'El borrador no tiene el formulario preparado: hay que volver a prepararlo (anulalo y preparalo de nuevo).';
        await Borradores.anotarFalla(b.id, motivo, { soloSi: 'APROBADO' }).catch(() => null);
        throw new Error(motivo);
    }
    const guardado = b.payload as unknown as PayloadBorradorOves;
    const aprobadoPor = b.approvedBy ? { id: rastro0.aprobadoPorId ?? null, name: b.approvedBy } : null;

    return Borradores.conRobot(b.id, `cargando en OVES desde ${new Date().toISOString()}`, async (robot) => {
    if (!rastro0.numeroCreado && !puedeCrearPedidosReales(VARIABLE_PERMISO_OVES)) {
        const motivo = `Este servidor no es producción: no crea pedidos reales en el laboratorio (para probar a propósito: ${VARIABLE_PERMISO_OVES}=1). No se mandó nada`;
        await Borradores.anotarFalla(b.id, `${motivo}.`, { robot }).catch(() => null);
        throw new Error(motivo);
    }
    try {
        const resultado = await enElPortal(() => conSesionOves(async (page) => {
            // 1. Releer adentro del turno.
            const actual = await prisma.labOrderDraft.findUnique({ where: { id: b.id }, select: { status: true, resumenPortal: true } });
            if (actual?.status === 'CARGADO') throw new YaCargadoError();
            if (actual?.status !== 'APROBADO') throw new Error(`El borrador pasó a ${actual?.status} mientras tanto.`);
            const rastroActual = (actual.resumenPortal || {}) as RastroOves;

            // 2. Qué hacer con lo que YA hay (decisión pura, compartida con Grupo Óptico).
            const ventaHoy = await leerVentaParaCargaOves(b.orderId);
            if (!ventaHoy) throw new AprobacionInvalidaError('La venta ya no existe.');
            const pares = cantidadDeArmazones(ventaHoy as any);
            const existente = rastroActual.numeroCreado ? null : await pedidoExistenteDelPar(b.orderId, b.pair, pares);
            const datos = { pair: b.pair, numeroCreado: rastroActual.numeroCreado ?? null, existente, envioIniciadoEl: rastroActual.envioIniciadoEl ?? null, esperaMs: ESPERA_TRAS_ENVIO_INCIERTO_MS };
            let decision = decidirConAprobado(datos);
            if (decision.accion === 'BUSCAR_EN_PORTAL') {
                const ajenos = await numerosDeOtrosPares(b.orderId, b.pair);
                const enPortal = (await buscarPorReferencia(page, guardado.plan.pedinterno)).filter(f => !ajenos.has(f.numero) && !/anulad/i.test(f.estado));
                decision = decidirConAprobado({ ...datos, numeroEnPortal: enPortal[0]?.numero ?? null });
            }
            if (decision.accion === 'INVALIDAR') throw new AprobacionInvalidaError(decision.motivo);
            if (decision.accion === 'ESPERAR') throw new Error(decision.motivo);
            if (decision.accion === 'BUSCAR_EN_PORTAL') throw new Error('la decisión pidió buscar en el portal dos veces (no debería pasar)');
            const adoptado = decision.accion === 'VERIFICAR';
            let numero: string;
            let respuesta = '';
            if (decision.accion !== 'CREAR') {
                numero = decision.numero;
                if (adoptado) {
                    // Un nº ADOPTADO se verifica contra el portal: tiene que estar en el listado con la referencia de esta venta.
                    const enPortal = await buscarPorReferencia(page, guardado.plan.pedinterno);
                    const fila = enPortal.find(f => f.numero === numero);
                    if (!fila) throw new AdopcionNoVerificadaError(`el nº ${numero} que tiene este par no aparece en OVES con la referencia "${guardado.plan.pedinterno}": revisalo en el portal y corregí la venta. No se creó nada`);
                    if (/anulad/i.test(fila.estado)) throw new AdopcionNoVerificadaError(`el pedido ${numero} está anulado en OVES: corregí el nº en la venta y reintentá. No se creó nada`);
                }
            } else {
                // 3. ¿La venta de hoy sigue dando EXACTAMENTE lo aprobado?
                const r = await planActual(b.orderId, b.pair, guardado.opciones);
                if (!r.ok) throw new AprobacionInvalidaError(`La venta ya no arma el pedido (${r.faltantes.join(' · ')}): volvé a prepararlo. No se mandó nada.`);
                const cambios = diferenciasDePlan(guardado.plan, r.plan);
                if (huellaDelPlan(r.plan) !== rastro0.huella || cambios.length) {
                    throw new AprobacionInvalidaError(`La venta cambió después de aprobar (${cambios.join(', ') || 'otro dato'}): volvé a prepararlo para revisar el pedido nuevo. No se mandó nada.`);
                }
                // Se vuelve a llenar el formulario (otra sesión, otro navegador) y tiene que quedar IGUAL que lo que la persona vio.
                await mezclar(b.id, { etapa: `volviendo a llenar el formulario de OVES desde ${new Date().toISOString()}` }).catch(() => null);
                await abrirFormulario(page, r.plan.clase);
                const llenado = await llenarFormulario(page, r.plan);
                const dif = diferenciasDeFormulario(rastro0.formulario!, llenado.formulario);
                if (dif.length) throw new AprobacionInvalidaError(`El formulario de OVES ya no queda como se aprobó (${dif.slice(0, 4).join(' · ')}): volvé a prepararlo. No se mandó nada.`);
                // 4. Grabar: la barrera (atómica en la base) justo antes de aceptar el confirm del portal.
                const grabado = await grabarPedido(page, {
                    antesDeConfirmar: async () => {
                        const sigueAprobado = await Borradores.marcarEnvio(b.id, { esperaMs: ESPERA_TRAS_ENVIO_INCIERTO_MS });
                        if (!sigueAprobado) throw new YaCargadoError();
                    },
                }).catch(async (e) => {
                    // Solo un rechazo del portal PRUEBA que no se creó nada; un error interno o un silencio deja el envío incierto.
                    if (e instanceof PedidoRechazadoError) await mezclar(b.id, { envioIniciadoEl: null }).catch(() => null);
                    throw e;
                });
                numero = grabado.numero;
                respuesta = grabado.respuesta;
            }
            // Anotado en el acto: de acá en más un reintento no vuelve a grabar.
            await mezclar(b.id, { numeroCreado: numero, portalDraftId: numero, respuestaDelPortal: respuesta || undefined, ...(adoptado ? { adoptadoDelPortal: true } : {}) });
            // La pantalla real del pedido YA grabado: la respuesta del portal (y el listado con el nº).
            const capturaFinal = await page.screenshot({ fullPage: true, type: 'png' }).catch(() => null);
            return { numero, capturaFinal, adoptado };
        }));

        const capturaFinalUrl = resultado.capturaFinal ? await guardarCaptura(b.id, 'cargado', resultado.capturaFinal).catch(() => null) : null;
        const diferencias = resultado.adoptado ? ['el pedido ya estaba en OVES (cargado antes, a mano o por un intento anterior): se tomó ese nº sin crear otro'] : [];
        if (diferencias.length) {
            await mezclar(b.id, { diferencias });
            await logAudit({ userId: null, userName: ROBOT_OPTOVISION, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: b.id, details: { lab: LAB_OPTOVISION, numero: resultado.numero, diferencias } }).catch(() => null);
        }
        // Primero la venta (nº, estado, aviso), después el borrador. Con TODOS los pedidos de la venta (el del otro par incluido).
        const otros = await prisma.labOrderDraft.findMany({ where: { orderId: b.orderId, lab: LAB_OPTOVISION, status: 'CARGADO', id: { not: b.id } }, select: { portalNumber: true } });
        const pedidos = new Map<string, { portalNumber: string; status: EstadoEnPortal; statusRaw: string }>();
        for (const o of otros) if (o.portalNumber) pedidos.set(o.portalNumber, { portalNumber: o.portalNumber, status: 'INGRESADO', statusRaw: 'Preparado' });
        pedidos.set(resultado.numero, { portalNumber: resultado.numero, status: 'INGRESADO', statusRaw: 'Preparado' });
        await aplicarEstadoEnVenta({ orderId: b.orderId, lab: LAB_OPTOVISION, nombreLab: NOMBRE_OPTOVISION, robot: ROBOT_OPTOVISION, pedidos: [...pedidos.values()], aprobadoPor });
        const cargado = await Borradores.cargado(b.id, ROBOT_ACTOR_OPTOVISION, { portalNumber: resultado.numero, screenshotFinalUrl: capturaFinalUrl });
        if (diferencias.length) await Borradores.anotarFalla(b.id, `Cargado con el nº ${resultado.numero}, pero: ${diferencias.join(' · ')}.`, { soloSi: 'CARGADO' });
        // Paso 2 del procedimiento de la promo: el mail a Optovisión, cuando los dos pares están cargados.
        await avisarMailDePromo(b.orderId, aprobadoPor ? { id: aprobadoPor.id, name: aprobadoPor.name, role: null } : ROBOT_ACTOR_OPTOVISION).catch(err => console.error('[lab-modulos] mail de promo Optovisión:', err?.message || err));
        return cargado;
    } catch (err: any) {
        if (err instanceof YaCargadoError) return prisma.labOrderDraft.findUniqueOrThrow({ where: { id: b.id } });
        if (err instanceof PedidoRechazadoError) {
            await Borradores.invalidarSinPedido(b.id, ROBOT_ACTOR_OPTOVISION, `El laboratorio no aceptó el pedido (${err.message}). No se creó nada: corregí la venta y volvé a prepararlo.`)
                .catch(e => console.error('[lab-modulos] no se pudo invalidar el borrador Optovisión rechazado (queda APROBADO):', e));
            throw err;
        }
        const motivo = (err?.message || String(err)).replace(/\.+$/, '');
        const rastroAhora = await prisma.labOrderDraft.findUnique({ where: { id: b.id }, select: { resumenPortal: true } }).then(x => (x?.resumenPortal || {}) as RastroOves).catch(() => ({} as RastroOves));
        if (err instanceof AprobacionInvalidaError && !rastroAhora.envioIniciadoEl && !rastroAhora.numeroCreado) {
            await Borradores.invalidarSinPedido(b.id, ROBOT_ACTOR_OPTOVISION, err.message).catch(e => console.error('[lab-modulos] no se pudo invalidar el borrador Optovisión (queda APROBADO):', e));
            throw err;
        }
        const texto = err instanceof AdopcionNoVerificadaError
            ? `${motivo}.`
            : rastroAhora.numeroCreado
            ? `El pedido YA está grabado en OVES con el nº ${rastroAhora.numeroCreado}; falta anotarlo en la venta (${motivo}). Reintentar desde la ficha: NO se crea otro, solo se termina de anotar. No lo cargues a mano.`
            : rastroAhora.envioIniciadoEl || err instanceof PortalRespondioError
                ? `El envío a OVES quedó sin respuesta clara (${motivo}). Reintentar desde la ficha en unos minutos: el robot busca el pedido en el listado del portal antes de grabar otro. No lo cargues a mano.`
                : `No se pudo cargar en OVES: ${motivo}. Reintentar desde la ficha (nunca se duplica: el robot busca el pedido antes de grabarlo).`;
        await Borradores.anotarFalla(b.id, texto, { soloSi: 'APROBADO', robot }).catch(e => console.error('[lab-modulos] no se pudo anotar la falla del borrador Optovisión:', e));
        throw err;
    }
    }, { heredar: opts.robot ?? null, enEstado: ['APROBADO'] });
}
