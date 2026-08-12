import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { serverCache } from '@/lib/cache';
import { getActor } from '@/lib/actor';
import { ensureClientForAbandonedCart } from '@/services/cart-recovery.service';
import { normalizeArgentinePhone } from '@/services/contact.service';

/**
 * Llave de teléfono para dedup: normaliza formatos argentinos (el "15"
 * intercalado, 0 de área, +54 9) antes de quedarse con los últimos 8 dígitos.
 * Sin esto, "0351 15 6123456" y "3516123456" parecían dos personas.
 */
function phoneKey(phone: string | null | undefined): string | null {
    const normalized = normalizeArgentinePhone(phone);
    if (normalized.length <= 3) return null;
    const digits = normalized.slice(3); // sin el '549'
    return digits.length >= 8 ? digits.slice(-8) : null;
}

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cacheKey = 'sales-opportunities';
        const cached = serverCache.get<any>(cacheKey);
        if (cached !== null) {
            return NextResponse.json(cached);
        }

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Ventana de 30 días, por definición del negocio (12/8/2026): "cierres es
        // todos los que no hayan comprado aún, que tengan dentro de los 30 días y
        // sean tickets altos". Más viejo que eso ya no se persigue desde el panel.
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const opportunities: any[] = [];

        // 1. Favoritos sin actividad (Favorite clients with no activity for 3 days)
        const favoriteClients = await prisma.client.findMany({
            where: {
                isFavorite: true,
                isDeleted: false,
                status: { notIn: ['CLIENT', 'active'] },
                opportunityDismissedAt: null,
                orders: {
                    none: {
                        OR: [
                            { orderType: 'SALE' },
                            { status: 'CONFIRMED', updatedAt: { gte: sevenDaysAgo } }
                        ],
                        isDeleted: false
                    }
                }
            },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                status: true,
                interest: true,
                updatedAt: true,
                createdAt: true,
                interactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true }
                },
                orders: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true, total: true }
                },
                tasks: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true }
                },
                whatsappChats: {
                    orderBy: { lastMessageAt: 'desc' },
                    take: 1,
                    select: { lastMessageAt: true }
                },
                prescriptions: {
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: {
                        sphereOD: true,
                        cylinderOD: true,
                        additionOD: true,
                        sphereOI: true,
                        cylinderOI: true,
                        additionOI: true
                    }
                }
            }
        });

        for (const client of favoriteClients) {
            const dates = [
                client.updatedAt,
                client.interactions[0]?.createdAt,
                client.orders[0]?.createdAt,
                client.tasks[0]?.createdAt,
                client.whatsappChats[0]?.lastMessageAt
            ].filter(Boolean) as Date[];

            const lastActivity = dates.length > 0
                ? new Date(Math.max(...dates.map(d => d.getTime())))
                : client.createdAt;

            if (lastActivity < threeDaysAgo && lastActivity > thirtyDaysAgo) {
                const latestRx = client.prescriptions[0];
                const latestOrder = client.orders[0];

                // Ticket importante = producto de alto compromiso (graduación
                // alta, multifocal, control de miopía). Va primero en el panel,
                // por encima del monto.
                const isSpecialTicket =
                    // Graduaciones altas (abs >= 4 esfera o abs >= 2 cilindro)
                    (latestRx && (
                        Math.abs(latestRx.sphereOD || 0) >= 4.0 ||
                        Math.abs(latestRx.sphereOI || 0) >= 4.0 ||
                        Math.abs(latestRx.cylinderOD || 0) >= 2.0 ||
                        Math.abs(latestRx.cylinderOI || 0) >= 2.0
                    )) ||
                    // Multifocales (tiene adición)
                    (latestRx && (latestRx.additionOD != null || latestRx.additionOI != null)) ||
                    // Interés en multifocales, miopía o control miópico
                    (client.interest && (
                        client.interest.toLowerCase().includes('multifocal') ||
                        client.interest.toLowerCase().includes('progresivo') ||
                        client.interest.toLowerCase().includes('bifocal') ||
                        client.interest.toLowerCase().includes('miop') ||
                        client.interest.toLowerCase().includes('myofix') ||
                        client.interest.toLowerCase().includes('myolens') ||
                        client.interest.toLowerCase().includes('myopilux')
                    ));

                const isHighValue = (latestOrder && latestOrder.total >= 250000) || isSpecialTicket;

                if (!isHighValue) continue;

                const daysElapsed = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
                opportunities.push({
                    id: client.id,
                    type: 'STALLED_FAVORITE',
                    title: 'Favorito sin actividad',
                    clientName: client.name,
                    clientId: client.id,
                    phone: client.phone,
                    email: client.email,
                    isPriority: !!isSpecialTicket,
                    detail: `Sin actividad por ${daysElapsed} días`,
                    amount: latestOrder?.total || null,
                    daysElapsed,
                    lastActivity: lastActivity.toISOString()
                });
            }
        }

        // 2. Presupuestos fríos (Pending quotes created > 3 days ago)
        const pendingQuotes = await prisma.order.findMany({
            where: {
                orderType: 'QUOTE',
                status: { in: ['PENDING', 'CONFIRMED'] },
                isDeleted: false,
                createdAt: {
                    lt: threeDaysAgo,
                    gt: thirtyDaysAgo
                },
                // "No compró AÚN" = no hay venta POSTERIOR a este presupuesto
                // (se resuelve abajo, en JS, mirando las ventas del cliente).
                //
                // Antes acá se exigía además `status notIn CLIENT/active` y
                // "cero ventas en la historia": un cliente viejo que volvía a
                // pedir presupuesto quedaba invisible para siempre — y son
                // justamente los más fáciles de cerrar. Medido contra
                // producción (12/8/2026): entre ese filtro y la exclusión por
                // nombre/teléfono de más abajo, el panel llevaba semanas en
                // cero con 76 clientes reales para perseguir.
                client: {
                    isDeleted: false
                }
            },
            select: {
                id: true,
                total: true,
                createdAt: true,
                status: true,
                client: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true,
                        opportunityDismissedAt: true,
                        // Para decidir "compró después" y "venta en curso" sin
                        // una query por presupuesto.
                        orders: {
                            where: {
                                isDeleted: false,
                                OR: [
                                    { orderType: 'SALE' },
                                    { status: 'CONFIRMED', updatedAt: { gte: sevenDaysAgo } }
                                ]
                            },
                            select: { id: true, orderType: true, status: true, createdAt: true, updatedAt: true }
                        }
                    }
                },
                items: {
                    select: {
                        sphereVal: true,
                        cylinderVal: true,
                        additionVal: true,
                        productNameSnapshot: true,
                        productBrandSnapshot: true,
                        productCategorySnapshot: true
                    }
                }
            }
        });

        for (const quote of pendingQuotes) {
            // Cliente descartado como oportunidad DESPUÉS de este presupuesto:
            // no volver a mostrarlo. Un presupuesto NUEVO posterior al descarte
            // sí entra — es una oportunidad genuinamente nueva.
            if (quote.client.opportunityDismissedAt && quote.createdAt < quote.client.opportunityDismissedAt) {
                continue;
            }

            // "No compró aún": si hay una VENTA posterior al presupuesto, este
            // presupuesto se cerró (o quedó superado) — afuera. Una venta
            // ANTERIOR no lo tapa: cliente que vuelve es oportunidad de nuevo.
            const boughtAfter = quote.client.orders.some(o =>
                o.orderType === 'SALE' && o.createdAt > quote.createdAt
            );
            if (boughtAfter) continue;

            // Venta en curso: algo del cliente quedó CONFIRMED hace <7 días y
            // no es este mismo presupuesto frío — un vendedor ya está encima.
            const inProgress = quote.client.orders.some(o =>
                o.id !== quote.id && o.status === 'CONFIRMED' && o.updatedAt >= sevenDaysAgo
            );
            if (inProgress) continue;

            const hasHighValue = quote.total >= 250000;
            let hasHighGraduation = false;
            let hasSpecialLenses = false;

            for (const item of quote.items) {
                if (
                    (item.sphereVal != null && Math.abs(item.sphereVal) >= 4.0) ||
                    (item.cylinderVal != null && Math.abs(item.cylinderVal) >= 2.0)
                ) {
                    hasHighGraduation = true;
                }

                if (item.additionVal != null) {
                    hasSpecialLenses = true;
                }

                const name = `${item.productBrandSnapshot || ''} ${item.productNameSnapshot || ''} ${item.productCategorySnapshot || ''}`.toLowerCase();
                if (
                    name.includes('multifocal') ||
                    name.includes('progresivo') ||
                    name.includes('bifocal') ||
                    name.includes('myofix') ||
                    name.includes('myopilux') ||
                    name.includes('myolens') ||
                    name.includes('miopía') ||
                    name.includes('miopia') ||
                    name.includes('control miop')
                ) {
                    hasSpecialLenses = true;
                }
            }

            if (!hasHighValue && !hasHighGraduation && !hasSpecialLenses) {
                continue; // Skip if it doesn't meet the target criteria
            }

            const daysElapsed = Math.floor((Date.now() - quote.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const title = quote.status === 'CONFIRMED' ? 'Presupuesto confirmado sin avance' : 'Presupuesto frío';
            
            opportunities.push({
                id: quote.id,
                type: 'PENDING_QUOTE',
                title: title,
                clientName: quote.client.name,
                clientId: quote.client.id,
                phone: quote.client.phone,
                email: quote.client.email,
                isPriority: hasHighGraduation || hasSpecialLenses,
                detail: `Presupuesto de $${quote.total.toLocaleString('es-AR')} hace ${daysElapsed} días`,
                amount: quote.total,
                daysElapsed,
                lastActivity: quote.createdAt.toISOString()
            });
        }

        // 3. Carritos abandonados (Checkout sessions pending or abandoned > 24 hours ago)
        const abandonedCarts = await prisma.checkoutSession.findMany({
            where: {
                status: {
                    in: ['PENDING', 'ABANDONED']
                },
                createdAt: {
                    lt: oneDayAgo,
                    gt: thirtyDaysAgo
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        for (const cart of abandonedCarts) {

            // Exclude small/simple carts (only show high value, multifocals, myopia controls)
            const hasHighValue = cart.total >= 250000;
            let hasSpecialLenses = false;

            const cartItems = Array.isArray(cart.cartData) ? cart.cartData as any[] : [];
            for (const item of cartItems) {
                const name = `${item.brand || ''} ${item.model || ''} ${item.category || ''}`.toLowerCase();
                if (
                    name.includes('multifocal') ||
                    name.includes('progresivo') ||
                    name.includes('bifocal') ||
                    name.includes('myofix') ||
                    name.includes('myopilux') ||
                    name.includes('myolens') ||
                    name.includes('miopía') ||
                    name.includes('miopia') ||
                    name.includes('control miop')
                ) {
                    hasSpecialLenses = true;
                }
            }

            if (!hasHighValue && !hasSpecialLenses) {
                continue; // Skip if it doesn't meet the target criteria
            }

            // Carrito que califica → ficha en el CRM (etiqueta "Carrito Web",
            // evento en el historial). Con ficha, el dedup es por cliente y los
            // seguimientos quedan registrados. Idempotente: solo la primera vez.
            let cartClientId: string | null = cart.clientId;
            try {
                cartClientId = await ensureClientForAbandonedCart(cart);
            } catch (e) {
                console.error('[sales-opportunities] No se pudo asegurar ficha para carrito', cart.id, e);
            }

            // Si el cliente fue descartado como oportunidad después de crear
            // este carrito, no lo volvemos a mostrar (mismo criterio que
            // presupuestos: un carrito nuevo posterior al descarte sí entra).
            if (cartClientId) {
                const cartClient = await prisma.client.findUnique({
                    where: { id: cartClientId },
                    select: { name: true, opportunityDismissedAt: true },
                });
                if (cartClient?.opportunityDismissedAt && cart.createdAt < cartClient.opportunityDismissedAt) {
                    continue;
                }
            }

            const daysElapsed = Math.floor((Date.now() - cart.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const hoursElapsed = Math.floor((Date.now() - cart.createdAt.getTime()) / (1000 * 60 * 60));
            const clientName = `${cart.firstName || ''} ${cart.lastName || ''}`.trim() || 'Cliente Web';
            opportunities.push({
                id: cart.id,
                type: 'ABANDONED_CART',
                title: 'Carrito abandonado',
                clientName,
                clientId: cartClientId,
                phone: cart.phone,
                email: cart.email,
                isPriority: hasSpecialLenses,
                detail: `Carrito de $${cart.total.toLocaleString('es-AR')} hace ${hoursElapsed >= 48 ? `${daysElapsed} días` : `${hoursElapsed} horas`}`,
                amount: cart.total,
                daysElapsed,
                lastActivity: cart.createdAt.toISOString()
            });
        }

        // Fetch all clients who are already customers (status CLIENT/active OR have a SALE order)
        const clientsWithSales = await prisma.client.findMany({
            where: {
                OR: [
                    { status: { in: ['CLIENT', 'active'] } },
                    {
                        orders: {
                            some: {
                                OR: [
                                    { orderType: 'SALE' },
                                    { status: 'CONFIRMED', updatedAt: { gte: sevenDaysAgo } }
                                ],
                                isDeleted: false
                            }
                        }
                    }
                ],
                // Un cliente borrado no puede suprimir oportunidades vivas por
                // coincidencia de nombre/teléfono.
                isDeleted: false
            },
            select: {
                name: true,
                phone: true,
                email: true
            }
        });

        // Llaves de clientes ya convertidos: teléfono normalizado y email.
        //
        // SIN nombre, y SOLO para carritos. Esta exclusión mataba el panel
        // entero: medido contra producción (12/8/2026), los 5 presupuestos que
        // sobrevivían a todos los demás filtros caían acá — "fernando" a secas
        // coincidía con cualquier cliente convertido llamado Fernando, y un
        // teléfono compartido (madre e hija) tapaba a la persona que no compró.
        // Para presupuestos y favoritos la ficha es conocida y "¿compró?" ya se
        // decide mirando SUS ventas; el match difuso solo aporta para carritos
        // web, donde la identidad es un formulario a medio llenar.
        const clientPhones = new Set<string>();
        const clientEmails = new Set<string>();

        for (const c of clientsWithSales) {
            const pk = phoneKey(c.phone);
            if (pk) clientPhones.add(pk);
            if (c.email) clientEmails.add(c.email.trim().toLowerCase());
        }

        const filteredOpportunities = opportunities.filter(opp => {
            if (opp.type !== 'ABANDONED_CART') return true;
            const pk = phoneKey(opp.phone);
            if (pk && clientPhones.has(pk)) {
                return false;
            }
            if (opp.email && clientEmails.has(opp.email.trim().toLowerCase())) {
                return false;
            }
            return true;
        });

        // Orden: tickets importantes primero (multifocales, control de miopía,
        // graduaciones altas), después monto, después antigüedad.
        filteredOpportunities.sort((a, b) => {
            if (!!b.isPriority !== !!a.isPriority) {
                return b.isPriority ? 1 : -1;
            }
            const amountA = a.amount || 0;
            const amountB = b.amount || 0;
            if (amountB !== amountA) {
                return amountB - amountA;
            }
            return b.daysElapsed - a.daysElapsed;
        });

        const uniqueOpportunities = [];
        const seenClients = new Set<string>();
        // Llave → clientId dueño. Dos fichas DISTINTAS que comparten teléfono
        // (madre e hija con el mismo celular) son dos oportunidades legítimas,
        // no un duplicado — solo se colapsa si alguna de las dos no tiene ficha.
        const seenPhones = new Map<string, string | null>();
        const seenEmails = new Map<string, string | null>();

        const sameOwner = (prev: string | null | undefined, curr: string | null) =>
            prev === undefined ? false : (prev === null || curr === null || prev === curr);

        for (const opp of filteredOpportunities) {
            const pk = phoneKey(opp.phone);
            const ek = opp.email ? opp.email.trim().toLowerCase() : null;
            const cid: string | null = opp.clientId || null;

            const isDuplicate =
                (cid && seenClients.has(cid)) ||
                (pk && seenPhones.has(pk) && sameOwner(seenPhones.get(pk), cid)) ||
                (ek && seenEmails.has(ek) && sameOwner(seenEmails.get(ek), cid));

            if (!isDuplicate) {
                uniqueOpportunities.push(opp);
                // Las llaves se registran SOLO para filas que quedaron: una fila
                // descartada no debe suprimir a la siguiente.
                if (cid) seenClients.add(cid);
                if (pk) seenPhones.set(pk, cid);
                if (ek) seenEmails.set(ek, cid);
            }
        }

        // 120s > los 60s de polling: la caché absorbe el request siguiente en vez de
        // expirar justo al llegar. Son 4 queries relacionales pesadas sobre Client.
        serverCache.set(cacheKey, uniqueOpportunities, 120);

        return NextResponse.json(uniqueOpportunities);
    } catch (error) {
        console.error('Error fetching sales opportunities:', error);
        return NextResponse.json({
            error: 'Error al obtener oportunidades de ventas',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, type } = body;

        if (!id || !type) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        if (type === 'STALLED_FAVORITE') {
            // Create a system interaction note to update last activity
            const actor = getActor(req);
            await prisma.interaction.create({
                data: {
                    clientId: id,
                    type: 'NOTE',
                    content: `Seguimiento finalizado (Oportunidad de Cierre) por ${actor.name}`,
                    userId: actor.id,
                    userName: actor.name,
                }
            });
            // Descarte definitivo: ya no vuelve a aparecer como oportunidad de cierre
            await prisma.client.update({
                where: { id },
                data: { opportunityDismissedAt: new Date() }
            });
        } else if (type === 'PENDING_QUOTE') {
            const actor = getActor(req);
            // Guarda: solo un PRESUPUESTO pendiente puede marcarse perdido. Un
            // id viejo del panel (o manipulado) podía pisar con LOST una orden
            // que ya se convirtió en venta.
            const order = await prisma.order.findUnique({
                where: { id },
                select: { clientId: true, orderType: true, status: true }
            });
            if (!order || order.orderType !== 'QUOTE' || !['PENDING', 'CONFIRMED'].includes(order.status)) {
                serverCache.clear();
                return NextResponse.json({
                    success: true,
                    skipped: true,
                    message: 'La orden ya no es un presupuesto pendiente; no se modificó.'
                });
            }
            await prisma.order.update({
                where: { id },
                data: { status: 'LOST' }
            });
            // El descarte es de la PERSONA, no solo del presupuesto: sin esto,
            // el mismo cliente reaparecía como "favorito sin actividad" al día
            // siguiente (descarte asimétrico favorito↔presupuesto).
            await prisma.client.update({
                where: { id: order.clientId },
                data: { opportunityDismissedAt: new Date() }
            });
            await prisma.interaction.create({
                data: {
                    clientId: order.clientId,
                    type: 'NOTE',
                    content: `Seguimiento finalizado (Oportunidad de Cierre, presupuesto marcado perdido) por ${actor.name}`,
                    userId: actor.id,
                    userName: actor.name,
                }
            });
        } else if (type === 'ABANDONED_CART') {
            const actor = getActor(req);
            const session = await prisma.checkoutSession.update({
                where: { id },
                data: { status: 'FINALIZED' },
                select: { clientId: true }
            });
            if (session.clientId) {
                // Cerrar TODAS las sesiones abiertas de la misma persona: si
                // volvió a entrar al checkout y generó otra, esa otra seguía
                // viva y "reaparecía" lo que se creyó descartado.
                await prisma.checkoutSession.updateMany({
                    where: { clientId: session.clientId, status: { in: ['PENDING', 'ABANDONED'] } },
                    data: { status: 'FINALIZED' }
                });
                await prisma.client.update({
                    where: { id: session.clientId },
                    data: { opportunityDismissedAt: new Date() }
                });
                await prisma.interaction.create({
                    data: {
                        clientId: session.clientId,
                        type: 'NOTE',
                        content: `Seguimiento finalizado (Oportunidad de Cierre, carrito web descartado) por ${actor.name}`,
                        userId: actor.id,
                        userName: actor.name,
                    }
                });
            }
        } else {
            return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
        }

        serverCache.clear();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error finalizing opportunity:', error);
        return NextResponse.json({
            error: 'Error al finalizar oportunidad',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

