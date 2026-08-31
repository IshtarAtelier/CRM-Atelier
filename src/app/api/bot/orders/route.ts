import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { snapshotFromProduct } from '@/lib/order-snapshot';
import { formatOrderItemsSummary } from '@/lib/order-utils';
import { PricingService } from '@/services/PricingService';
import { applyTeñidoPromoDiscount, isCrystal, isTeñidoAddon, recalculateCrystalPrices } from '@/lib/promo-utils';
import { BOT_ACTOR } from '@/lib/actor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get('orderId');
        const orderNumber = searchParams.get('orderNumber');
        const clientId = searchParams.get('clientId');

        if (!orderId && !orderNumber && !clientId) {
            return NextResponse.json({ error: 'orderId, orderNumber o clientId es requerido' }, { status: 400 });
        }

        let order = null;

        if (orderId || orderNumber) {
            order = await prisma.order.findFirst({
                where: {
                    OR: [
                        { id: orderId || undefined },
                        { labOrderNumber: orderNumber || undefined }
                    ],
                    isDeleted: false
                },
                include: {
                    client: true,
                    items: {
                        include: {
                            product: true
                        }
                    },
                    payments: true
                }
            });
        } else if (clientId) {
            // Buscar el pedido relevante del cliente: primero una venta con saldo pendiente,
            // si no la venta más reciente, y como último recurso el presupuesto más reciente
            const sales = await prisma.order.findMany({
                where: { clientId, isDeleted: false, orderType: 'SALE' },
                include: { client: true, items: { include: { product: true } }, payments: true },
                orderBy: { createdAt: 'desc' }
            });

            order = sales.find(o => PricingService.calculateOrderFinancials(o).hasBalance) || sales[0] || null;

            if (!order) {
                order = await prisma.order.findFirst({
                    where: { clientId, isDeleted: false, orderType: 'QUOTE' },
                    include: { client: true, items: { include: { product: true } }, payments: true },
                    orderBy: { createdAt: 'desc' }
                });
            }
        }

        if (!order) {
            return NextResponse.json({ found: false });
        }

        // Desglose financiero oficial: exactamente el mismo cálculo que muestran
        // las vistas de saldos del CRM (ventas, pedidos, modales de pago)
        const financials = PricingService.calculateOrderFinancials(order);

        return NextResponse.json({ found: true, order, financials });
    } catch (error: any) {
        console.error('[Bot Bridge Orders GET] Error:', error);
        return NextResponse.json({ error: 'Error al consultar pedido' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, items, total, discountCash } = body;

        if (!clientId || !items || items.length === 0) {
            return NextResponse.json({ error: 'clientId y items son requeridos' }, { status: 400 });
        }

        const productIds = items.map((it: any) => it.productId).filter(Boolean);
        const dbProducts = await prisma.product.findMany({
            where: { id: { in: productIds } }
        });

        // ─────────────────────────────────────────────────────────────────
        // Los precios NO se toman del body.
        //
        // El único llamador de esta ruta es la tool `create_quote` del bot, cuyo
        // schema declara `total` y los `items` como campos libres: los rellena el
        // LLM. Hasta acá se guardaba `total: Math.round(total || 0)` y
        // `price: it.price` tal cual venían, así que un número alucinado se
        // convertía en Order real, en el PDF que recibe el cliente, en el embudo
        // y en las estadísticas — sin promo 2x1, sin markup y sin ninguno de los
        // topes del cotizador. Regla dura de CLAUDE.md: el cálculo de plata vive
        // SOLO en PricingService.
        //
        // Desde acá cada línea se reconstruye con el precio VIVO del catálogo y
        // el total lo calcula PricingService, igual que el camino humano
        // (`src/app/api/orders/route.ts`): `subtotalWithMarkup` = lista y
        // `total` = contado.
        const lineasInvalidas = items.filter((it: any) => !dbProducts.some(p => p.id === it.productId));
        if (lineasInvalidas.length > 0) {
            return NextResponse.json({
                error: 'Hay ítems sin producto del catálogo: no se puede presupuestar sin un precio verificable.',
                items: lineasInvalidas.map((it: any) => it.productId ?? null),
            }, { status: 400 });
        }

        const cartItems = items.map((it: any) => {
            const dbProd = dbProducts.find(p => p.id === it.productId)!;
            // Los cristales se cotizan POR OJO: `recalculateCrystalPrices` deja
            // cada línea a la mitad del precio de catálogo, porque el cotizador
            // siempre carga dos (OD y OI). El bot manda UNA línea por cristal,
            // así que esa línea vale el PAR: cantidad × 2 para que las dos
            // mitades sumen el precio real. Con `eye` explícito se respeta lo
            // que mandó (ahí sí es un solo ojo).
            const cantidad = it.quantity || 1;
            const esCristalPorPar = isCrystal(dbProd) && !isTeñidoAddon(dbProd) && !it.eye;
            return {
                productId: dbProd.id,
                product: dbProd,
                eye: it.eye || null,
                quantity: esCristalPorPar ? cantidad * 2 : cantidad,
                price: dbProd.price ?? 0,
            };
        });

        // Mismos ajustes de precio que el camino humano, y por los mismos
        // helpers: precio de cristal por ojo y teñido cobrado una sola vez.
        recalculateCrystalPrices(cartItems);
        const tintStylePrices = Object.fromEntries(
            (await prisma.tintStylePrice.findMany()).map(t => [t.category, t.price])
        );
        applyTeñidoPromoDiscount(cartItems, tintStylePrices);

        // `?? 20` y no `|| 20`: el default del cotizador es 20, y guardar 0
        // rompe el espejo SQL del filtro "con saldo" (`COALESCE(o."discountCash", 20)`
        // en src/app/api/orders/route.ts), que solo dispara con NULL. Con 0
        // guardado, `totalCash = lista` y todo pago en efectivo contra el
        // presupuesto se convertía mal: es el mecanismo de los saldos fantasma.
        const descuentoEfectivo = discountCash ?? 20;
        const totals = PricingService.calculateTotals(cartItems, 0, descuentoEfectivo, []);
        const totalLista = totals.subtotalWithMarkup;
        const totalContado = totals.totalCash;

        // Divergencia visible: si el número que mandó el modelo no se explica por
        // ninguno de los dos totales oficiales, se corta con 400 en vez de
        // guardarlo en silencio. Se acepta cualquier valor DENTRO de la banda
        // [contado, lista] porque el bot cotiza el contado con el descuento de la
        // tienda (`web_promo_cash_discount`, hoy 15%) mientras que la orden se
        // guarda con el 20% del cotizador: son dos puntos legítimos de la banda.
        // Fuera de la banda no hay lectura posible: es un número inventado.
        if (typeof total === 'number' && Number.isFinite(total)) {
            const fueraDeBanda = total < totalContado - 1 || total > totalLista + 1;
            if (fueraDeBanda) {
                console.error(
                    `[Bot Bridge Orders POST] Total del modelo fuera de rango: mandó ${total}, ` +
                    `el cálculo oficial da lista ${totalLista} / contado ${totalContado}.`
                );
                return NextResponse.json({
                    error: 'El total no coincide con el cálculo del sistema: el presupuesto no se registró.',
                    totalRecibido: total,
                    totalLista,
                    totalContado,
                }, { status: 400 });
            }
        }

        // Get an existing admin user to act as the SYSTEM creator
        let systemUser = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
            orderBy: { createdAt: 'asc' }
        });

        if (!systemUser) {
            systemUser = await prisma.user.findFirst();
        }

        const fallbackUserId = systemUser ? systemUser.id : 'SYSTEM';

        // DEDUPLICATION GATE: Check for duplicate order creation (double click) within last 10 seconds
        const tenSecondsAgo = new Date(Date.now() - 10000);
        const duplicateOrder = await prisma.order.findFirst({
            where: {
                clientId,
                total: Math.round(totalContado),
                createdAt: { gte: tenSecondsAgo },
                isDeleted: false
            },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });
        if (duplicateOrder) {
            console.log(`[DEDUPLICATION GATE BOT] Duplicate order detected for client ${clientId}. Returning existing order: ${duplicateOrder.id}`);
            return NextResponse.json(duplicateOrder);
        }

        // Create the Budget (Quote)
        const order = await prisma.order.create({
            data: {
                clientId,
                userId: fallbackUserId, // Marked as bot-created (using a real user ID)
                status: 'PENDING',
                orderType: 'QUOTE',
                // Mismo criterio que el camino humano: `total` es el contado y
                // `subtotalWithMarkup` la lista (que es lo que lee
                // `calculateOrderFinancials` para los saldos).
                total: Math.round(totalContado),
                subtotalWithMarkup: Math.round(totalLista),
                paid: 0,
                discountCash: descuentoEfectivo,
                items: {
                    create: items.map((it: any, i: number) => {
                        const linea = cartItems[i];
                        return {
                            productId: linea.productId,
                            quantity: linea.quantity,
                            price: linea.price,
                            eye: it.eye || null,
                            ...snapshotFromProduct(linea.product),
                        };
                    })
                }
            },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });

        // Register interaction
        const itemSummaries = formatOrderItemsSummary(order.items);
        await prisma.interaction.create({
            data: {
                clientId,
                type: 'BUDGET_SENT',
                content: `🤖 Presupuesto generado automáticamente vía WhatsApp por $${totalLista.toLocaleString('es-AR')} de lista (contado $${totalContado.toLocaleString('es-AR')})\n\nProductos:\n• ${itemSummaries}`,
                userId: BOT_ACTOR.id,
                userName: BOT_ACTOR.name,
            }
        });

        return NextResponse.json(order);
    } catch (error: any) {
        console.error('[Bot Bridge Orders POST] Error:', error);
        return NextResponse.json({ error: 'Error al crear presupuesto' }, { status: 500 });
    }
}
