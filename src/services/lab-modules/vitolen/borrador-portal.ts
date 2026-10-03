import { prisma } from '../../../lib/db';
import { uploadFile } from '../../../lib/storage';
import type { Actor } from '../../../lib/actor';
import { Borradores } from '../carga/borrador';
import { aplicarEstadoEnVenta } from '../estados';
import type { PayloadVitolen } from './carga';
import { cancelarBorrador, confirmar, crearYLeerResumen, llenarFormulario } from './llenar';
import { conSesionVitolen, LAB_VITOLEN, NOMBRE_VITOLEN, ROBOT_VITOLEN } from './portal';

/**
 * EL ROBOT TRABAJA SOBRE UN BORRADOR DEL CRM, con el flujo real del portal
 * (comprobado el 3/10/2026, docs/vitolen-portal.md):
 *
 *   PREPARADO  → el robot llena el formulario y aprieta "Crear": el portal crea
 *                SU borrador (id propio, "Por Asignar", no figura en el
 *                listado) y muestra el resumen → captura → EN_REVISION.
 *   APROBADO   → el robot abre ese borrador y aprieta "Confirmar": el portal
 *                asigna el nº de trabajo → CARGADO, y el nº va a la venta.
 *   RECHAZADO  → el robot aprieta "Cancelar" en el portal (el borrador
 *                desaparece). Si no puede, queda anotado para hacerlo a mano.
 *
 * Nada se confirma sin la aprobación de una persona (regla de Ishtar).
 */
export const ROBOT_ACTOR_VITOLEN: Actor = { id: null, name: ROBOT_VITOLEN, role: null };

export interface ResumenGuardado {
    portalDraftId: string;
    url: string;
    texto: string;
    pasos: { campo: string; valor: string }[];
    pendientes: string[];
    llenadoEl: string;
}

async function guardarCaptura(borradorId: string, sufijo: string, captura: Buffer): Promise<string> {
    // Receta y medidas del cliente: clave que /api/storage/view trata como sensible (exige sesión).
    const guardado = await uploadFile(captura, `lab-modulos/vitolen/${borradorId}-${sufijo}.png`, 'image/png');
    return `/api/storage/view?key=${encodeURIComponent(guardado)}`;
}

export async function llenarBorradorEnPortal(borradorId: string) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, payload: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'PREPARADO') throw new Error(`El borrador está ${b.status}: el robot solo llena los PREPARADOS.`);

    try {
        const r = await conSesionVitolen(async (page) => {
            const llenado = await llenarFormulario(page, b.payload as unknown as PayloadVitolen);
            const resumen = await crearYLeerResumen(page);
            return { llenado, resumen };
        });
        if (!r.resumen.portalDraftId) {
            const motivo = `El portal rechazó el pedido: ${(r.resumen.rechazo || ['sin detalle']).join(' · ')}`;
            await guardarCaptura(b.id, 'rechazo', r.resumen.captura).catch(() => null);
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
            await Borradores.error(b.id, ROBOT_ACTOR_VITOLEN, motivo).catch(e => console.error('[lab-modulos] no se pudo marcar el error del borrador:', e));
        }
        throw err;
    }
}

function resumenDe(b: { resumenPortal: unknown }): ResumenGuardado | null {
    const r = b.resumenPortal as Partial<ResumenGuardado> | null;
    return r && typeof r.portalDraftId === 'string' ? (r as ResumenGuardado) : null;
}

/** Tras la aprobación humana: confirma en el portal, escribe el nº en la venta, CARGADO. */
export async function confirmarBorradorAprobado(borradorId: string) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, orderId: true, resumenPortal: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'APROBADO') throw new Error(`El borrador está ${b.status}: el robot solo confirma los APROBADOS.`);
    const resumen = resumenDe(b);
    if (!resumen) throw new Error('El borrador no tiene el id del portal: hay que volver a prepararlo.');

    try {
        const r = await conSesionVitolen(page => confirmar(page, resumen.portalDraftId));
        const screenshotFinalUrl = await guardarCaptura(b.id, 'confirmado', r.captura).catch(() => null);
        const cargado = await Borradores.cargado(b.id, ROBOT_ACTOR_VITOLEN, { portalNumber: r.portalNumber, screenshotFinalUrl });
        await aplicarEstadoEnVenta({
            orderId: b.orderId, lab: LAB_VITOLEN, nombreLab: NOMBRE_VITOLEN, robot: ROBOT_VITOLEN,
            pedidos: [{ portalNumber: r.portalNumber, status: 'INGRESADO', statusRaw: 'Confirmación' }],
        });
        return cargado;
    } catch (err: any) {
        const motivo = err?.message || String(err);
        await Borradores.error(b.id, ROBOT_ACTOR_VITOLEN, motivo).catch(e => console.error('[lab-modulos] no se pudo marcar el error del borrador:', e));
        throw err;
    }
}

/**
 * Tras el rechazo humano: cancela el borrador en el portal. No cambia el
 * estado del CRM (ya es RECHAZADO); si falla, deja el motivo en `error` para
 * que alguien lo cancele a mano.
 */
export async function cancelarBorradorRechazado(borradorId: string): Promise<{ cancelado: boolean; motivo?: string }> {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, error: true, resumenPortal: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'RECHAZADO') throw new Error(`El borrador está ${b.status}: solo se cancela en el portal un RECHAZADO.`);
    const resumen = resumenDe(b);
    if (!resumen) return { cancelado: false, motivo: 'sin borrador en el portal' };
    try {
        await conSesionVitolen(page => cancelarBorrador(page, resumen.portalDraftId));
        return { cancelado: true };
    } catch (err: any) {
        const motivo = err?.message || String(err);
        await prisma.labOrderDraft.update({
            where: { id: b.id },
            data: { error: `${b.error || ''}\nNO se pudo cancelar el borrador ${resumen.portalDraftId} en el portal (${motivo}): cancelarlo a mano en ${resumen.url}`.trim() },
        }).catch(() => null);
        return { cancelado: false, motivo };
    }
}
