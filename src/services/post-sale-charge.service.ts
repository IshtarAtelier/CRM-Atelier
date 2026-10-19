import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';

/**
 * REPARTO DEL COSTO DE UN CASO DE POST-VENTA (Ishtar, 19/10/2026: "que todo sea
 * editable… si lo pongo a mi caja sale a caja, si se pone a cliente figura un
 * saldo… que se pueda mitad y mitad").
 *
 * El costo cerrado por el laboratorio se reparte en DOS renglones que suman el
 * costo:
 *   · CAJA: un DEBITO en la caja de una persona (Ishtar = lo cubre Atelier, o
 *     el vendedor que se equivocó). Es el `VendorCashEntry` de `cashEntryId`.
 *   · CLIENTE: `clientCharge`, que SUMA al saldo de la venta
 *     (`Order.postSaleCharge`, leído por `PricingService.calculateOrderFinancials`).
 *     Se cobra con el modal de pagos de la venta —comprobante incluido— y por
 *     eso aparece en la lista de saldos y en caja como cualquier pago.
 * Cualquiera de los dos puede ser $0 (todo a caja, todo al cliente) o los dos
 * tener parte (mitad y mitad).
 *
 * Es EDITABLE: volver a repartir deshace lo anterior (borra el movimiento de
 * caja, igual que la corrección manual de /api/vendor-cash/[id]) y aplica lo
 * nuevo en la misma transacción, así nunca queda un movimiento huérfano ni un
 * caso a medio cambiar. Los pagos que el cliente ya hizo no se tocan: si el
 * cargo baja, quedan como pago de más en la venta, como cualquier cobro de más.
 *
 * NO toca `total` ni `subtotalWithMarkup` de la venta.
 */

export class CargoError extends Error {
    constructor(message: string, public status: number) { super(message); }
}

export interface Reparto {
    /** Caja que absorbe `cajaMonto`. null = la del administrador que reparte (lo cubre Atelier). */
    cajaVendorId: string | null;
    cajaMonto: number;
    clienteMonto: number;
}

/** Lo que hoy tiene repartido un caso (para la pantalla). */
export interface RepartoVigente {
    cajaMonto: number;
    cajaVendorId: string | null;
    cajaVendorName: string | null;
    clienteMonto: number;
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

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

const SELECT_CASO = {
    id: true, cost: true, costSource: true, cashEntryId: true, clientCharge: true, clientChargedAt: true,
    orderId: true, clientId: true, caseType: true, orderLabel: true, newOrderNumber: true,
    client: { select: { name: true } },
} satisfies Prisma.PostSaleCaseSelect;

export class PostSaleChargeService {
    /** Qué tiene repartido hoy el caso. */
    static async repartoVigente(caseId: string): Promise<RepartoVigente> {
        const c = await prisma.postSaleCase.findUnique({ where: { id: caseId }, select: { cashEntryId: true, clientCharge: true, clientChargedAt: true } });
        if (!c) throw new CargoError('Caso no encontrado', 404);
        return PostSaleChargeService.armarVigente(c, c.cashEntryId
            ? await prisma.vendorCashEntry.findUnique({ where: { id: c.cashEntryId }, select: { amount: true, vendorId: true, vendor: { select: { name: true } } } })
            : null);
    }

    /** Mismo cálculo, para quien ya tiene el caso y su movimiento a mano (la ficha del cliente). */
    static armarVigente(
        c: { clientCharge?: number | null; clientChargedAt?: Date | string | null },
        entry: { amount: number; vendorId: string; vendor?: { name: string } | null } | null,
    ): RepartoVigente {
        return {
            cajaMonto: entry ? Math.round(entry.amount) : 0,
            cajaVendorId: entry?.vendorId ?? null,
            cajaVendorName: entry?.vendor?.name ?? null,
            clienteMonto: c.clientChargedAt ? Math.round(c.clientCharge || 0) : 0,
        };
    }

    /**
     * Aplica un reparto (o lo cambia). Con los dos montos en $0 deshace todo y
     * el caso vuelve a "listo para cobrar".
     */
    static async repartir(caseId: string, reparto: Reparto, actor: Actor) {
        const pvCase = await prisma.postSaleCase.findUnique({ where: { id: caseId }, select: SELECT_CASO });
        if (!pvCase) throw new CargoError('Caso no encontrado', 404);
        // El portón del circuito: mientras el costo sea la estimación del
        // vendedor no hay nada que cobrar.
        if (pvCase.costSource !== 'LAB') {
            throw new CargoError('Todavía no está el costo real del laboratorio: falta la factura de alguna de las operaciones del caso.', 409);
        }
        const costo = Math.round(pvCase.cost);
        if (!(costo > 0)) throw new CargoError('El caso no tiene costo que cobrar (sin cargo).', 409);

        const cajaMonto = Math.round(Number(reparto.cajaMonto) || 0);
        const clienteMonto = Math.round(Number(reparto.clienteMonto) || 0);
        if (cajaMonto < 0 || clienteMonto < 0) throw new CargoError('Los montos no pueden ser negativos.', 400);
        const quitar = cajaMonto === 0 && clienteMonto === 0;
        if (!quitar && cajaMonto + clienteMonto !== costo) {
            throw new CargoError(`Los dos renglones tienen que sumar el costo del caso (${fmt(costo)}); suman ${fmt(cajaMonto + clienteMonto)}.`, 400);
        }
        if (clienteMonto > 0 && !pvCase.orderId) {
            throw new CargoError('El caso no tiene una venta asociada: no hay dónde registrar el saldo del cliente.', 409);
        }

        // Caja de destino: la elegida, o la del administrador que reparte.
        let vendor: { id: string; name: string } | null = null;
        if (cajaMonto > 0) {
            const destinoId = reparto.cajaVendorId || actor.id;
            if (!destinoId) throw new CargoError('No se pudo resolver la caja de destino', 400);
            const v = await prisma.user.findUnique({ where: { id: destinoId }, select: { id: true, name: true, role: true } });
            if (!v || v.role === 'OPTICA') throw new CargoError('La caja de destino no es válida', 404);
            vendor = { id: v.id, name: v.name };
        }

        const nombreCaso = [
            'Post venta', pvCase.client?.name, pvCase.caseType,
            pvCase.newOrderNumber ? `OP ${pvCase.newOrderNumber}` : pvCase.orderLabel,
        ].filter(Boolean).join(' · ');

        const antes = await PostSaleChargeService.repartoVigente(caseId);

        await prisma.$transaction(async tx => {
            // 1. Deshacer lo anterior. El `updateMany` con guard es el candado
            //    contra dos clicks: solo uno encuentra el caso en este estado.
            const liberado = await tx.postSaleCase.updateMany({
                where: { id: caseId, cashEntryId: pvCase.cashEntryId, clientChargedAt: pvCase.clientChargedAt },
                data: { cashEntryId: null, clientCharge: null, clientChargedAt: null, clientChargedBy: null },
            });
            if (liberado.count === 0) throw new CargoError('El caso cambió mientras lo editabas. Volvé a abrirlo.', 409);
            if (pvCase.cashEntryId) await tx.vendorCashEntry.deleteMany({ where: { id: pvCase.cashEntryId } });

            // 2. Aplicar lo nuevo.
            let cashEntryId: string | null = null;
            if (vendor && cajaMonto > 0) {
                const entry = await tx.vendorCashEntry.create({
                    data: {
                        vendorId: vendor.id, type: 'DEBITO', amount: cajaMonto,
                        reason: clienteMonto > 0 ? `${nombreCaso} (parte: ${fmt(cajaMonto)} de ${fmt(costo)})` : nombreCaso,
                        category: 'POST_VENTA', createdById: actor.id, createdByName: actor.name,
                    },
                    select: { id: true },
                });
                cashEntryId = entry.id;
            }
            await tx.postSaleCase.update({
                where: { id: caseId },
                data: quitar ? {
                    costConfirmedAt: null, costConfirmedBy: null,
                } : {
                    cashEntryId,
                    clientCharge: clienteMonto > 0 ? clienteMonto : null,
                    clientChargedAt: clienteMonto > 0 ? new Date() : null,
                    clientChargedBy: clienteMonto > 0 ? actor.name : null,
                    // Repartir ES corroborar: el administrador miró el número.
                    costConfirmedAt: new Date(), costConfirmedBy: actor.name,
                },
                select: { id: true },
            });
            if (pvCase.orderId) await sincronizarOrden(tx, pvCase.orderId);

            // 3. Dejar escrito qué pasó, en el caso y en la ficha.
            const partes: string[] = [];
            if (vendor && cajaMonto > 0) partes.push(`${fmt(cajaMonto)} descontado de la caja de ${vendor.name}${reparto.cajaVendorId ? '' : ' (lo cubre Atelier)'}`);
            if (clienteMonto > 0) partes.push(`${fmt(clienteMonto)} al cliente, como saldo de la venta`);
            const habiaAlgo = antes.cajaMonto > 0 || antes.clienteMonto > 0;
            const texto = quitar
                ? `${actor.name} deshizo el reparto del costo (${fmt(costo)}): se borró el descuento de caja y se quitó el saldo del cliente.`
                : `${actor.name} ${habiaAlgo ? 'cambió el reparto del costo' : 'repartió el costo'} (${fmt(costo)}): ${partes.join(' · ')}.`;
            await tx.postSaleNote.create({ data: { caseId, content: texto, createdBy: 'Sistema' } });
            await interaccion(tx, pvCase.clientId, pvCase.caseType, texto, actor);
        });

        await logAudit({
            userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'POST_SALE_CASE', entityId: caseId,
            details: { evento: quitar ? 'reparto_deshecho' : 'reparto_costo', costo, antes, despues: { cajaVendorId: vendor?.id ?? null, cajaVendorName: vendor?.name ?? null, cajaMonto, clienteMonto } },
        });
        return { costo, cajaMonto, clienteMonto, cajaVendorName: vendor?.name ?? null };
    }
}
