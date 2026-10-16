import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';

/**
 * COBRO DE POST-VENTA AL CLIENTE: la alternativa a descontar el costo del caso
 * de una caja. Se carga en el caso y SUMA al saldo de la venta
 * (`Order.postSaleCharge`, leído por `PricingService.calculateOrderFinancials`),
 * así aparece en la lista de saldos, los recordatorios y el filtro "con saldo".
 * Los pagos son los pagos normales de la venta (comprobante, caja y recibo
 * incluidos): el caso solo muestra el cargo y abre el mismo modal de pago.
 *
 * NO toca `total` ni `subtotalWithMarkup`. Un caso se cierra económicamente por
 * UNA de dos vías: `cashEntryId` (se descontó de una caja) o `clientChargedAt`
 * (lo paga el cliente). Nunca las dos.
 */

export class CargoError extends Error {
    constructor(message: string, public status: number) { super(message); }
}

/** Recalcula Order.postSaleCharge desde los casos: la fuente es el caso, no un contador. */
async function sincronizarOrden(tx: Prisma.TransactionClient, orderId: string) {
    const agg = await tx.postSaleCase.aggregate({
        where: { orderId, clientChargedAt: { not: null } },
        _sum: { clientCharge: true },
    });
    const total = Math.round((agg._sum.clientCharge || 0) * 100) / 100;
    await tx.order.update({ where: { id: orderId }, data: { postSaleCharge: total }, select: { id: true } });
    return total;
}

async function interaccion(tx: Prisma.TransactionClient, clientId: string | null, caseType: string | null, texto: string, actor: Actor) {
    if (!clientId) return;
    await tx.interaction.create({
        data: {
            clientId, type: 'NOTE', userId: actor.id, userName: actor.name,
            content: `Post-venta${caseType ? ` (${caseType})` : ''}: ${texto}`,
        },
    });
}

export class PostSaleChargeService {
    /** Pasa el costo cerrado del caso a saldo del cliente (suma al saldo de la venta). */
    static async chargeClient(caseId: string, actor: Actor) {
        const pvCase = await prisma.postSaleCase.findUnique({
            where: { id: caseId },
            select: { id: true, cost: true, costSource: true, cashEntryId: true, clientChargedAt: true, orderId: true, clientId: true, caseType: true },
        });
        if (!pvCase) throw new CargoError('Caso no encontrado', 404);
        if (pvCase.cashEntryId) throw new CargoError('Este caso ya se descontó de una caja.', 409);
        if (pvCase.clientChargedAt) throw new CargoError('Este caso ya está cargado al cliente.', 409);
        if (pvCase.costSource !== 'LAB') {
            throw new CargoError('Todavía no está el costo real del laboratorio: falta la factura de alguna de las operaciones del caso.', 409);
        }
        if (!(pvCase.cost > 0)) throw new CargoError('El caso no tiene costo que cobrar (sin cargo).', 409);
        // El saldo vive en una venta: sin venta (borrada) no hay dónde ponerlo.
        if (!pvCase.orderId) throw new CargoError('El caso no tiene una venta asociada: no hay dónde registrar el saldo.', 409);
        const orderId = pvCase.orderId;
        const monto = Math.round(pvCase.cost);

        const cargosDeLaVenta = await prisma.$transaction(async tx => {
            // Guard contra el doble click: solo gana quien lo encuentra sin cargar.
            const marcado = await tx.postSaleCase.updateMany({
                where: { id: caseId, clientChargedAt: null, cashEntryId: null },
                data: {
                    clientCharge: monto, clientChargedAt: new Date(), clientChargedBy: actor.name,
                    // Como en la imputación a caja: cargarlo ES corroborar el costo.
                    costConfirmedAt: new Date(), costConfirmedBy: actor.name,
                },
            });
            if (marcado.count === 0) throw new CargoError('Este caso ya fue resuelto por otra vía.', 409);
            const cargos = await sincronizarOrden(tx, orderId);
            const texto = `${actor.name} le cargó $${monto.toLocaleString('es-AR')} al cliente (costo del caso de post-venta). Se suma al saldo de la venta.`;
            await tx.postSaleNote.create({ data: { caseId, content: texto, createdBy: 'Sistema' } });
            await interaccion(tx, pvCase.clientId, pvCase.caseType, texto, actor);
            return cargos;
        });
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'POST_SALE_CASE', entityId: caseId,
            details: { evento: 'cargo_al_cliente', orderId, monto, postSaleChargeDeLaVenta: cargosDeLaVenta },
        });
        return { monto, orderId };
    }

    /**
     * Deshace el cargo. No toca los pagos ya cargados: si el cliente ya había
     * pagado, quedan como pago de más en la venta, igual que cualquier cobro de más.
     */
    static async revertClientCharge(caseId: string, actor: Actor) {
        const pvCase = await prisma.postSaleCase.findUnique({
            where: { id: caseId },
            select: { id: true, orderId: true, clientId: true, caseType: true, clientCharge: true, clientChargedAt: true },
        });
        if (!pvCase) throw new CargoError('Caso no encontrado', 404);
        if (!pvCase.clientChargedAt) throw new CargoError('Este caso no tiene un cargo al cliente.', 409);
        await prisma.$transaction(async tx => {
            await tx.postSaleCase.update({
                where: { id: caseId },
                data: { clientCharge: null, clientChargedAt: null, clientChargedBy: null, costConfirmedAt: null, costConfirmedBy: null },
                select: { id: true },
            });
            if (pvCase.orderId) await sincronizarOrden(tx, pvCase.orderId);
            const texto = `${actor.name} anuló el cargo de $${Math.round(pvCase.clientCharge || 0).toLocaleString('es-AR')} al cliente: se quitó del saldo de la venta.`;
            await tx.postSaleNote.create({ data: { caseId, content: texto, createdBy: 'Sistema' } });
            await interaccion(tx, pvCase.clientId, pvCase.caseType, texto, actor);
        });
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'POST_SALE_CASE', entityId: caseId,
            details: { evento: 'cargo_al_cliente_anulado', orderId: pvCase.orderId },
        });
    }
}
