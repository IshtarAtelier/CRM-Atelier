import { prisma } from '../../../lib/db';
import { uploadFile } from '../../../lib/storage';
import type { Actor } from '../../../lib/actor';
import { Borradores, type RastroPortal } from '../carga/borrador';
import { aplicarEstadoEnVenta } from '../estados';
import { conTurno } from '../portal/turno';
import type { PayloadVitolen } from './carga';
import { cancelarBorrador, confirmar, crearYLeerResumen, llenarFormulario, ResumenCambiadoError } from './llenar';
import { conSesionVitolen, LAB_VITOLEN, NOMBRE_VITOLEN, ROBOT_VITOLEN } from './portal';

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
 * Toda entrada al portal toma el turno (una sola pasada a la vez: el
 * contenedor no aguanta dos Chromium) y espera si el seguimiento está corriendo.
 * Nada se confirma sin la aprobación de una persona (regla de Ishtar).
 */
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
    const r = await conTurno(LAB_VITOLEN, 'rapida', tarea, { esperar: true, esperaMaxMs: ESPERA_TURNO_MS });
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
            portalDraftId: r.resumen.portalDraftId, url: r.resumen.url, texto: r.resumen.texto.slice(0, 8000),
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
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, orderId: true, resumenPortal: true, approvedBy: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'APROBADO') throw new Error(`El borrador está ${b.status}: el robot solo confirma los APROBADOS.`);
    const rastro = rastroDe(b);
    if (!rastro) throw new Error('El borrador no tiene el id del portal: hay que volver a prepararlo.');
    const aprobador = b.approvedBy ? await prisma.user.findFirst({ where: { name: b.approvedBy }, select: { id: true, name: true } }).catch(() => null) : null;

    try {
        const r = await enElPortal(() => conSesionVitolen(page => confirmar(page, rastro.portalDraftId, rastro.texto)));
        const screenshotFinalUrl = await guardarCaptura(b.id, 'confirmado', r.captura).catch(() => null);
        const cargado = await Borradores.cargado(b.id, ROBOT_ACTOR_VITOLEN, { portalNumber: r.portalNumber, screenshotFinalUrl });
        await aplicarEstadoEnVenta({
            orderId: b.orderId, lab: LAB_VITOLEN, nombreLab: NOMBRE_VITOLEN, robot: ROBOT_VITOLEN,
            pedidos: [{ portalNumber: r.portalNumber, status: 'INGRESADO', statusRaw: 'Confirmación' }],
            aprobadoPor: aprobador ?? (b.approvedBy ? { id: null, name: b.approvedBy } : null),
        });
        return cargado;
    } catch (err: any) {
        if (err instanceof ResumenCambiadoError) {
            const screenshotUrl = await guardarCaptura(b.id, 'cambiado', err.captura).catch(() => '');
            await Borradores.volverARevision(b.id, ROBOT_ACTOR_VITOLEN, {
                screenshotUrl,
                resumenPortal: { ...rastro, texto: err.texto.slice(0, 8000), url: err.url, cambiadoEl: new Date().toISOString() },
                motivo: err.message,
            });
            throw err;
        }
        const motivo = err?.message || String(err);
        await Borradores.anotarFalla(b.id, `No se pudo confirmar en el portal: ${motivo}. Reintentar desde la ficha (si el portal ya lo tomó, el robot lee el nº).`)
            .catch(e => console.error('[lab-modulos] no se pudo anotar la falla del borrador:', e));
        throw err;
    }
}

/**
 * Cancela en el portal el borrador de un CRM RECHAZADO o ERROR (el que
 * quedó creado sin confirmar). No cambia el estado del CRM; anota
 * `canceladoEl`, que es lo que vuelve a permitir preparar otro.
 */
export async function cancelarEnPortal(borradorId: string): Promise<{ cancelado: boolean; motivo?: string }> {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, error: true, resumenPortal: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'RECHAZADO' && b.status !== 'ERROR') throw new Error(`El borrador está ${b.status}: solo se cancela en el portal un RECHAZADO o un ERROR.`);
    const rastro = rastroDe(b);
    if (!rastro) return { cancelado: false, motivo: 'sin borrador en el portal' };
    if (rastro.canceladoEl) return { cancelado: true };
    try {
        await enElPortal(() => conSesionVitolen(page => cancelarBorrador(page, rastro.portalDraftId)));
        await Borradores.canceladoEnPortal(b.id);
        return { cancelado: true };
    } catch (err: any) {
        const motivo = err?.message || String(err);
        await Borradores.anotarFalla(b.id, `${b.error || ''}\nNO se pudo cancelar el borrador ${rastro.portalDraftId} en el portal (${motivo}): cancelarlo a mano en ${rastro.url}`.trim()).catch(() => null);
        return { cancelado: false, motivo };
    }
}
