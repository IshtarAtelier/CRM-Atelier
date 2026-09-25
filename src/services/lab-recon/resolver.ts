import { prisma } from '../../lib/db';
import { logAudit } from '../../lib/audit';
import type { Actor } from '../../lib/actor';

/**
 * RESOLVER A MANO una entrada de costo de laboratorio, o reabrirla.
 *
 * Pedido de Ishtar del 25/9/2026: los sobrecostos viejos salían en cada
 * reporte semanal para siempre ("quedan eternamente duplicados") y no había
 * forma de decir "esto ya lo reclamé / ya lo acreditaron / es correcto". Ahora
 * se marca acá: queda quién, cuándo y cómo, y la entrada deja de salir en los
 * tres avisos (semanal, lunes, resumen diario). El ESTADO del cruce no cambia
 * —un sobrecosto resuelto sigue siendo un sobrecosto, solo que tratado—, así
 * la pantalla sigue diciendo la verdad.
 *
 * El hallazgo es de la VENTA: el estado se estampa igual en todos los pedidos
 * hermanos (mismo lab, misma venta), así que resolver uno resuelve a todos
 * —si no, el otro par del 2x1 seguía saliendo solo. Los reprocesos de
 * postventa comparten la venta pero son un hallazgo aparte: no se tocan.
 */
export async function resolverEntrada(id: string, resuelto: boolean, nota: string | null, actor: Actor) {
    const entrada = await prisma.labCostEntry.findUnique({
        where: { id },
        select: { id: true, lab: true, labOrderNumber: true, orderId: true, notes: true, status: true, resolvedAt: true },
    });
    if (!entrada) return null;

    const esPostventa = (notes: string | null) => (notes || '').includes('POSTVENTA (caso');
    const hermanos = entrada.orderId && !esPostventa(entrada.notes)
        ? (await prisma.labCostEntry.findMany({
            where: { orderId: entrada.orderId, lab: entrada.lab, id: { not: id } },
            select: { id: true, labOrderNumber: true, notes: true },
        })).filter(h => !esPostventa(h.notes))
        : [];
    const ids = [id, ...hermanos.map(h => h.id)];

    const data = resuelto
        ? { resolvedAt: new Date(), resolvedBy: actor.name, resolvedNote: (nota || '').trim() || null }
        : { resolvedAt: null, resolvedBy: null, resolvedNote: null };
    await prisma.labCostEntry.updateMany({ where: { id: { in: ids } }, data });

    // Firmado: quién lo resolvió y con qué explicación queda en el AuditLog.
    logAudit({
        userId: actor.id, userName: actor.name,
        action: 'UPDATE', entityType: 'LAB_COST_ENTRY', entityId: id,
        details: {
            accion: resuelto ? 'RESUELTO' : 'REABIERTO', nota: data.resolvedNote ?? null,
            lab: entrada.lab, labOrderNumber: entrada.labOrderNumber, status: entrada.status,
            hermanos: hermanos.map(h => h.labOrderNumber),
        },
    }).catch(console.error);

    return { ids, labOrderNumber: entrada.labOrderNumber, hermanos: hermanos.map(h => h.labOrderNumber) };
}
