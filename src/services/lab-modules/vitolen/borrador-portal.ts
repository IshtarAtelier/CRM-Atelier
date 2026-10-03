import { prisma } from '../../../lib/db';
import { uploadFile } from '../../../lib/storage';
import type { Actor } from '../../../lib/actor';
import { Borradores } from '../carga/borrador';
import type { PayloadVitolen } from './carga';
import { llenarFormulario } from './llenar';
import { conSesionVitolen, ROBOT_VITOLEN } from './portal';

/**
 * EL ROBOT TRABAJA SOBRE UN BORRADOR: toma uno PREPARADO, entra al portal,
 * llena el formulario hasta antes de "Crear", guarda la captura y lo deja
 * EN_REVISION para que una persona lo mire. Si algo falla, el borrador queda
 * en ERROR con el motivo y se puede volver a preparar.
 *
 * La confirmación (APROBADO → CARGADO) no está automatizada todavía: falta
 * saber si "Crear" ya deja un registro en el portal (docs/vitolen-portal.md).
 * Hasta entonces, lo aprobado lo confirma una persona en el portal.
 */
export const ROBOT_ACTOR_VITOLEN: Actor = { id: null, name: ROBOT_VITOLEN, role: null };

export async function llenarBorradorEnPortal(borradorId: string) {
    const b = await prisma.labOrderDraft.findUnique({ where: { id: borradorId }, select: { id: true, status: true, payload: true } });
    if (!b) throw new Error('El borrador no existe.');
    if (b.status !== 'PREPARADO') throw new Error(`El borrador está ${b.status}: el robot solo llena los PREPARADOS.`);

    try {
        const r = await conSesionVitolen(page => llenarFormulario(page, b.payload as unknown as PayloadVitolen));
        // La captura tiene receta y medidas del cliente: va a storage con una
        // clave que /api/storage/view trata como sensible (exige sesión).
        const guardado = await uploadFile(r.captura, `lab-modulos/vitolen/${b.id}-llenado.png`, 'image/png');
        const screenshotUrl = `/api/storage/view?key=${encodeURIComponent(guardado)}`;
        return await Borradores.enRevision(b.id, ROBOT_ACTOR_VITOLEN, {
            screenshotUrl,
            resumenPortal: { url: r.url, pasos: r.pasos, pendientes: r.pendientes, llenadoEl: new Date().toISOString() },
        });
    } catch (err: any) {
        const motivo = err?.message || String(err);
        await Borradores.error(b.id, ROBOT_ACTOR_VITOLEN, motivo).catch(e => console.error('[lab-modulos] no se pudo marcar el error del borrador:', e));
        throw err;
    }
}
