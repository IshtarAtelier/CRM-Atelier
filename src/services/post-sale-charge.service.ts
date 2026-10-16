import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';

/**
 * COBRO DE POST-VENTA AL CLIENTE: la alternativa a descontar el costo del caso
 * de una caja. El caso mismo lleva el saldo: `clientCharge` (lo que se le cobra)
 * menos sus `PostSalePayment` (lo que ya pagó, cada uno con su comprobante).
 *
 * NO toca la venta: ni su total, ni sus pagos, ni su saldo. Un caso se cierra
 * económicamente por UNA de dos vías: `cashEntryId` (se descontó de una caja) o
 * `clientChargedAt` (lo paga el cliente). Nunca las dos.
 */

export class CargoError extends Error {
    constructor(message: string, public status: number) { super(message); }
}

/** Saldo pendiente de un caso. Única fórmula: la lista de saldos y la ficha leen de acá. */
export function saldoDeCaso(c: { clientCharge?: number | null; clientPayments?: { amount: number }[] | null }): number {
    if (!c.clientCharge) return 0;
    const pagado = (c.clientPayments || []).reduce((a, p) => a + (p.amount || 0), 0);
    return Math.max(0, Math.round(c.clientCharge - pagado));
}

const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO', 'TARJETA', 'OTRO'] as const;

export class PostSaleChargeService {
    /** Pasa el costo cerrado del caso a saldo del cliente. */
    static async chargeClient(caseId: string, actor: Actor) {
        const pvCase = await prisma.postSaleCase.findUnique({
            where: { id: caseId },
            select: { id: true, cost: true, costSource: true, cashEntryId: true, clientChargedAt: true, clientId: true, caseType: true },
        });
        if (!pvCase) throw new CargoError('Caso no encontrado', 404);
        if (pvCase.cashEntryId) throw new CargoError('Este caso ya se descontó de una caja.', 409);
        if (pvCase.clientChargedAt) throw new CargoError('Este caso ya está cargado al cliente.', 409);
        if (pvCase.costSource !== 'LAB') {
            throw new CargoError('Todavía no está el costo real del laboratorio: falta la factura de alguna de las operaciones del caso.', 409);
        }
        if (!(pvCase.cost > 0)) throw new CargoError('El caso no tiene costo que cobrar (sin cargo).', 409);
        const monto = Math.round(pvCase.cost);

        await prisma.$transaction(async tx => {
            const marcado = await tx.postSaleCase.updateMany({
                where: { id: caseId, clientChargedAt: null, cashEntryId: null },
                data: {
                    clientCharge: monto, clientChargedAt: new Date(), clientChargedBy: actor.name,
                    // Como en la imputación a caja: cargarlo ES corroborar el costo.
                    costConfirmedAt: new Date(), costConfirmedBy: actor.name,
                },
            });
            if (marcado.count === 0) throw new CargoError('Este caso ya fue resuelto por otra vía.', 409);
            const texto = `${actor.name} le cargó $${monto.toLocaleString('es-AR')} al cliente (costo del caso de post-venta). Queda como saldo del caso.`;
            await tx.postSaleNote.create({ data: { caseId, content: texto, createdBy: 'Sistema' } });
            await interaccion(tx, pvCase.clientId, pvCase.caseType, texto, actor);
        });
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'POST_SALE_CASE', entityId: caseId,
            details: { evento: 'cargo_al_cliente', monto },
        });
        return { monto };
    }

    /** Registra un pago del cliente contra el saldo del caso. */
    static async addPayment(caseId: string, input: {
        amount: number; method: string; date?: string | null; notes?: string | null; receiptUrl?: string | null;
    }, actor: Actor) {
        const amount = Math.round(Number(input.amount));
        if (!(amount > 0)) throw new CargoError('El importe tiene que ser mayor a cero.', 400);
        if (!(METODOS as readonly string[]).includes(input.method)) throw new CargoError('Forma de pago inválida.', 400);
        if (input.method !== 'EFECTIVO' && !input.receiptUrl) {
            throw new CargoError('Para transferencia o tarjeta es obligatorio cargar el comprobante de pago.', 400);
        }
        if (input.method === 'OTRO' && !input.notes?.trim()) {
            throw new CargoError('En "Otro" hay que escribir cuál fue la forma de pago.', 400);
        }
        const pvCase = await prisma.postSaleCase.findUnique({
            where: { id: caseId },
            select: { id: true, clientCharge: true, clientChargedAt: true, clientId: true, caseType: true, clientPayments: { select: { amount: true } } },
        });
        if (!pvCase) throw new CargoError('Caso no encontrado', 404);
        if (!pvCase.clientChargedAt) throw new CargoError('Este caso no tiene un cargo al cliente.', 409);
        const saldo = saldoDeCaso(pvCase);
        if (amount > saldo) throw new CargoError(`El pago supera el saldo del caso ($${saldo.toLocaleString('es-AR')}).`, 409);

        const date = input.date ? new Date(input.date) : new Date();
        const payment = await prisma.$transaction(async tx => {
            const p = await tx.postSalePayment.create({
                data: {
                    caseId, amount, method: input.method, date,
                    notes: input.notes?.trim() || null, receiptUrl: input.receiptUrl || null,
                    createdById: actor.id, createdByName: actor.name,
                },
            });
            const resto = saldo - amount;
            const texto = `${actor.name} registró un pago del cliente de $${amount.toLocaleString('es-AR')} (${input.method}). ${resto > 0 ? `Saldo: $${resto.toLocaleString('es-AR')}.` : 'Saldo cancelado.'}`;
            await tx.postSaleNote.create({ data: { caseId, content: texto, createdBy: 'Sistema', imageUrl: input.receiptUrl || null } });
            await interaccion(tx, pvCase.clientId, pvCase.caseType, texto, actor);
            return p;
        });
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'CREATE', entityType: 'PAYMENT', entityId: payment.id,
            details: { evento: 'pago_postventa', caseId, amount, method: input.method },
        });
        return payment;
    }

    /** Deshace el cargo. Solo si el cliente todavía no pagó nada. */
    static async revertClientCharge(caseId: string, actor: Actor) {
        const pvCase = await prisma.postSaleCase.findUnique({
            where: { id: caseId },
            select: { id: true, clientId: true, caseType: true, clientCharge: true, clientChargedAt: true, _count: { select: { clientPayments: true } } },
        });
        if (!pvCase) throw new CargoError('Caso no encontrado', 404);
        if (!pvCase.clientChargedAt) throw new CargoError('Este caso no tiene un cargo al cliente.', 409);
        if (pvCase._count.clientPayments > 0) {
            throw new CargoError('El cliente ya registró pagos en este caso: no se puede anular el cargo.', 409);
        }
        await prisma.$transaction(async tx => {
            await tx.postSaleCase.update({
                where: { id: caseId },
                data: { clientCharge: null, clientChargedAt: null, clientChargedBy: null, costConfirmedAt: null, costConfirmedBy: null },
                select: { id: true },
            });
            const texto = `${actor.name} anuló el cargo de $${Math.round(pvCase.clientCharge || 0).toLocaleString('es-AR')} al cliente.`;
            await tx.postSaleNote.create({ data: { caseId, content: texto, createdBy: 'Sistema' } });
            await interaccion(tx, pvCase.clientId, pvCase.caseType, texto, actor);
        });
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'POST_SALE_CASE', entityId: caseId,
            details: { evento: 'cargo_al_cliente_anulado' },
        });
    }
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
