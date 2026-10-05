import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';
import { formatearPrecio } from '@/lib/format-precio';
import { calculateQuoteTotals } from '@/services/PricingService';
import { compararPreciosVigentes, type ComparacionDePrecios } from '@/lib/precios-vigentes';

/**
 * PRESUPUESTOS CON PRECIOS VIEJOS (Ishtar, 5/10/2026).
 *
 * Después de un aumento, los presupuestos ya cargados conservan el precio con
 * el que se cotizaron. Este servicio dice cuáles renglones quedaron viejos,
 * los actualiza si el vendedor lo pide, y deja firmado en la ficha qué se
 * decidió. Una VENTA no se toca nunca: su precio es el que se cerró.
 *
 * Regla: con precios viejos no se cobra ni se pasa a venta. Si hay que
 * respetarle el precio anterior al cliente, se actualiza y un administrador
 * aplica un descuento especial por la diferencia.
 */

const SELECT_PARA_COMPARAR = {
    id: true, orderType: true, clientId: true, createdAt: true, isDeleted: true,
    markup: true, discountCash: true, specialDiscount: true,
    items: {
        orderBy: { id: 'asc' as const },
        select: {
            id: true, productId: true, price: true, quantity: true, eye: true,
            framePosition: true, crystalColorType: true,
            productNameSnapshot: true, productBrandSnapshot: true,
        },
    },
};

const esVenta = (orderType: string | null | undefined) => orderType === 'SALE' || orderType === 'MAYORISTA';
const numero = (id: string) => id.slice(-4).toUpperCase();

async function cargar(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: SELECT_PARA_COMPARAR });
    if (!order) return null;
    const ids = order.items.map(i => i.productId).filter(Boolean) as string[];
    const [productos, tintes] = await Promise.all([
        ids.length ? prisma.product.findMany({ where: { id: { in: ids } } }) : Promise.resolve([]),
        prisma.tintStylePrice.findMany(),
    ]);
    const porId = new Map(productos.map(p => [p.id, p]));
    const items = order.items.map(it => ({ ...it, product: it.productId ? porId.get(it.productId) || null : null }));
    const tintStylePrices = Object.fromEntries(tintes.map(t => [t.category, t.price]));
    return { order, items, tintStylePrices };
}

export class PreciosVigentesService {
    /** La comparación de un presupuesto contra el catálogo de hoy. `null` si no existe; una venta nunca está "desactualizada". */
    static async comparar(orderId: string): Promise<ComparacionDePrecios | null> {
        const datos = await cargar(orderId);
        if (!datos) return null;
        const comparacion = compararPreciosVigentes({ ...datos.order, items: datos.items }, datos.tintStylePrices);
        if (esVenta(datos.order.orderType) || datos.order.isDeleted) {
            return { ...comparacion, desactualizado: false, filas: [] };
        }
        return comparacion;
    }

    /** Re-cotiza el presupuesto con los precios de hoy, guarda y lo firma en la ficha. */
    static async actualizar(orderId: string, actor: Actor): Promise<ComparacionDePrecios> {
        const datos = await cargar(orderId);
        if (!datos) throw new Error('Pedido no encontrado');
        if (esVenta(datos.order.orderType)) throw new Error('Una venta no se re-cotiza: su precio es el que se cerró.');

        const comparacion = compararPreciosVigentes({ ...datos.order, items: datos.items }, datos.tintStylePrices);
        if (!comparacion.desactualizado) return comparacion;

        // Los totales salen del mismo lugar que al guardar desde el cotizador.
        const itemsDeHoy = datos.items.map(it => ({ ...it, price: comparacion.preciosNuevos[it.id] ?? it.price }));
        const totales = calculateQuoteTotals(
            itemsDeHoy.map(it => ({
                productId: it.productId || null,
                product: it.product || { price: it.price },
                quantity: it.quantity,
                customPrice: it.price,
                eye: it.eye ?? null,
                framePosition: it.framePosition ?? null,
            })),
            datos.order.markup || 0,
            datos.order.discountCash || 0,
            [],
            datos.order.specialDiscount || 0,
        );

        await prisma.$transaction([
            ...comparacion.filas.map(f => prisma.orderItem.update({
                where: { id: f.itemId },
                data: { price: f.hoy },
                select: { id: true },
            })),
            prisma.order.update({
                where: { id: orderId },
                data: {
                    subtotalWithMarkup: totales.subtotalWithMarkup,
                    specialDiscount: Math.round(totales.specialDiscountAmount),
                    total: totales.totalCash,
                    appliedPromoName: totales.appliedPromoName,
                    appliedPromoDiscount: totales.promoDiscount,
                },
                select: { id: true },
            }),
        ]);

        const resumen = `lista $${formatearPrecio(comparacion.listaCotizada)} → $${formatearPrecio(comparacion.listaHoy)} (${comparacion.filas.length} de ${comparacion.itemsTotales} ítems)`;
        if (datos.order.clientId) {
            await prisma.interaction.create({
                data: {
                    clientId: datos.order.clientId,
                    type: 'SISTEMA',
                    content: `🔄 ${actor.name} actualizó los precios del presupuesto #${numero(orderId)}: ${resumen}.`,
                    userId: actor.id,
                    userName: actor.name,
                },
            }).catch(err => console.error('[Precios vigentes] nota en ficha:', err));
        }
        logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'ORDER',
            entityId: orderId,
            details: {
                motivo: 'precios_actualizados',
                listaCotizada: comparacion.listaCotizada,
                listaHoy: comparacion.listaHoy,
                items: comparacion.filas.map(f => ({ producto: f.nombre, ojo: f.ojo, de: f.cotizado, a: f.hoy })),
            },
        }).catch(console.error);

        return comparacion;
    }

    /** El vendedor mandó el presupuesto SIN actualizar: queda dicho en la ficha quién y con qué diferencia. */
    static async registrarEnvioConPreciosCotizados(orderId: string, actor: Actor, medio: string): Promise<void> {
        const datos = await cargar(orderId);
        if (!datos?.order.clientId) return;
        const comparacion = compararPreciosVigentes({ ...datos.order, items: datos.items }, datos.tintStylePrices);
        if (!comparacion.desactualizado) return;
        await prisma.interaction.create({
            data: {
                clientId: datos.order.clientId,
                type: 'SISTEMA',
                content: `⚠️ ${actor.name} envió el presupuesto #${numero(orderId)} (${medio}) con los precios cotizados, sin actualizar: ${comparacion.filas.length} ítems cambiaron; a precio de hoy la lista sería $${formatearPrecio(comparacion.listaHoy)} en vez de $${formatearPrecio(comparacion.listaCotizada)}.`,
                userId: actor.id,
                userName: actor.name,
            },
        }).catch(err => console.error('[Precios vigentes] nota en ficha:', err));
    }
}
