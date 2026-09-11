import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { serverCache } from '@/lib/cache';
import { getActor } from '@/lib/actor';
import { ensureClientForAbandonedCart } from '@/services/cart-recovery.service';
import { SOLO_CLIENTES_POSIBLES } from '@/lib/no-cliente';
import {
    DIAS_PARA_ENFRIARSE, DIAS_TICKET_ALTO, DIAS_PRESUPUESTO_COMUN, DIAS_SIN_PRESUPUESTO,
    DIAS_CARRITO, MONTO_TICKET_ALTO, DIAS_ESCONDIDA_TRAS_ESCRIBIRLE, REMITENTES_AUTOMATICOS,
} from '@/lib/constants/cierres';
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

/**
 * Llave de NOMBRE para dedup y exclusión: sin tildes ni signos, y SOLO si tiene
 * dos palabras o más. "Sandra" a secas coincide con cualquier Sandra — ese
 * match difuso ya dejó el panel en cero una vez ("fernando" tapaba a todos los
 * Fernandos que no habían comprado). "Viviana Espeche" sí identifica.
 */
function nombreKey(name: string | null | undefined): string | null {
    const limpio = (name || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    return limpio.split(' ').length >= 2 ? limpio : null;
}

const DIA_MS = 24 * 60 * 60 * 1000;
const haceDias = (d: number) => new Date(Date.now() - d * DIA_MS);

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cacheKey = 'sales-opportunities';
        const cached = serverCache.get<any>(cacheKey);
        if (cached !== null) {
            return NextResponse.json(cached);
        }

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - DIAS_PARA_ENFRIARSE);

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
                // Un proveedor marcado como favorito no es una oportunidad de
                // venta: la etiqueta lo saca de acá y del embudo por igual.
                ...SOLO_CLIENTES_POSIBLES,
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

                const isHighValue = (latestOrder && latestOrder.total >= MONTO_TICKET_ALTO) || isSpecialTicket;

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
                    // Solo entran si son ticket alto: son "importantes del mes".
                    importante: true,
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
                // La ventana larga; la corta de los comunes se aplica abajo, cuando
                // ya se sabe si el presupuesto es ticket alto.
                createdAt: {
                    lt: threeDaysAgo,
                    gt: haceDias(Math.max(DIAS_TICKET_ALTO, DIAS_PRESUPUESTO_COMUN))
                },
                // `status notIn CLIENT/active` se quedó tras verificarlo contra
                // los datos reales (12/8/2026): acá una venta cerrada muchas
                // veces NO deja Order SALE ni Payment — lo único que cambia es
                // que la ficha pasa a CLIENT (Sonia Guzman: presupuesto de
                // $1.021.074 "pendiente", cero pagos registrados, y ya compró).
                // Al sacar este filtro el panel se llenó de clientes cerrados,
                // que es peor que vacío: un vendedor persiguiendo a quien ya
                // compró. La señal operativa de cierre ES el status.
                client: {
                    isDeleted: false,
                    status: { notIn: ['CLIENT', 'active'] },
                    ...SOLO_CLIENTES_POSIBLES
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

            const hasHighValue = quote.total >= MONTO_TICKET_ALTO;
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

            // Antes el presupuesto común no entraba NUNCA. Ahora entra por
            // DIAS_PRESUPUESTO_COMUN y el ticket alto se persigue
            // DIAS_TICKET_ALTO (Ishtar, 10/9/2026: ventanas por tipo).
            const importante = hasHighValue || hasHighGraduation || hasSpecialLenses;
            const daysElapsed = Math.floor((Date.now() - quote.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            if (daysElapsed > (importante ? DIAS_TICKET_ALTO : DIAS_PRESUPUESTO_COMUN)) continue;
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
                importante,
                detail: `Presupuesto de $${quote.total.toLocaleString('es-AR')} hace ${daysElapsed} días`,
                amount: quote.total,
                daysElapsed,
                lastActivity: quote.createdAt.toISOString()
            });
        }

        // 3. Carritos abandonados (Checkout sessions pending or abandoned > 24 hours ago)
        const abandonedCarts = await prisma.checkoutSession.findMany({
            where: {
                // EMAIL_SENT TAMBIÉN: es el carrito al que el recupero ya le mandó
                // el segundo mail y sigue sin pagar. Quedaba afuera, y como el
                // recupero pasa a EMAIL_SENT a todos los que no compran, el panel
                // no mostraba NINGÚN carrito — medido el 10/9/2026: 11 en 30
                // días, cero visibles.
                status: {
                    in: ['PENDING', 'ABANDONED', 'EMAIL_SENT']
                },
                createdAt: {
                    lt: oneDayAgo,
                    gt: haceDias(DIAS_CARRITO)
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        for (const cart of abandonedCarts) {

            // Exclude small/simple carts (only show high value, multifocals, myopia controls)
            const hasHighValue = cart.total >= MONTO_TICKET_ALTO;
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

            // Todo carrito entra (ya no solo los caros): son pocos y cada uno es
            // alguien que llegó hasta el checkout. El monto decide si es
            // "importante", no si aparece.
            const importante = hasHighValue || hasSpecialLenses;

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
                importante,
                detail: `Carrito de $${cart.total.toLocaleString('es-AR')} hace ${hoursElapsed >= 48 ? `${daysElapsed} días` : `${hoursElapsed} horas`}`,
                amount: cart.total,
                daysElapsed,
                lastActivity: cart.createdAt.toISOString()
            });
        }

        // 4. Fichas que NUNCA recibieron presupuesto (Ishtar, 10/9/2026: "de los
        // que no recibieron presupuesto dentro de los 30 días también"). Medido
        // en prod: el equipo cotiza a casi todos, así que entran pocas — y casi
        // todas nacieron de un anuncio de Meta.
        const sinPresupuesto = await prisma.client.findMany({
            where: {
                isDeleted: false,
                status: { notIn: ['CLIENT', 'active'] },
                createdAt: { lt: threeDaysAgo, gt: haceDias(DIAS_SIN_PRESUPUESTO) },
                orders: { none: { isDeleted: false } },
                // Descartada con el ✓: no vuelve (no hay un presupuesto nuevo
                // que la haga "genuinamente nueva", como pasa con los otros tipos).
                opportunityDismissedAt: null,
                ...SOLO_CLIENTES_POSIBLES,
            },
            select: { id: true, name: true, phone: true, email: true, createdAt: true, contactSource: true },
        });
        for (const c of sinPresupuesto) {
            const daysElapsed = Math.floor((Date.now() - c.createdAt.getTime()) / DIA_MS);
            opportunities.push({
                id: c.id,
                type: 'SIN_PRESUPUESTO',
                title: 'Sin presupuesto',
                clientName: c.name,
                clientId: c.id,
                phone: c.phone,
                email: c.email,
                isPriority: false,
                importante: false,
                detail: `Ficha de hace ${daysElapsed} días${c.contactSource ? ` (${c.contactSource})` : ''} — nunca se le pasó presupuesto`,
                amount: null,
                daysElapsed,
                lastActivity: c.createdAt.toISOString(),
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

        // Llaves de clientes ya convertidos: teléfono normalizado, email y nombre.
        //
        // Verificado contra los datos (12/8/2026) antes de intentar "mejorarla":
        // esta exclusión difusa es la que tapa las FICHAS DUPLICADAS de gente
        // que ya compró — Viviana Espeche tiene una ficha CONTACT con el
        // presupuesto viejo y otra CLIENT con la compra; sin el match por
        // nombre, la ficha vieja reaparece en el panel como falsa oportunidad.
        // El costo (un homónimo real queda tapado) es menor que el de mandar a
        // un vendedor a perseguir a quien ya compró.
        const clientPhones = new Set<string>();
        const clientNames = new Set<string>();
        const clientEmails = new Set<string>();

        for (const c of clientsWithSales) {
            const nk = nombreKey(c.name);
            if (nk) clientNames.add(nk);
            const pk = phoneKey(c.phone);
            if (pk) clientPhones.add(pk);
            if (c.email) clientEmails.add(c.email.trim().toLowerCase());
        }

        const filteredOpportunities = opportunities.filter(opp => {
            const nk = nombreKey(opp.clientName);
            if (nk && clientNames.has(nk)) {
                return false;
            }
            const pk = phoneKey(opp.phone);
            if (pk && clientPhones.has(pk)) {
                return false;
            }
            if (opp.email && clientEmails.has(opp.email.trim().toLowerCase())) {
                return false;
            }
            return true;
        });

        // Orden: los IMPORTANTES del mes arriba (ticket alto, multifocal,
        // miopía, graduación alta), después el resto; adentro de cada grupo,
        // los especiales, después monto, después antigüedad.
        const ordenar = (a: any, b: any) => {
            if (!!b.importante !== !!a.importante) return b.importante ? 1 : -1;
            if (!!b.isPriority !== !!a.isPriority) return b.isPriority ? 1 : -1;
            const amountA = a.amount || 0;
            const amountB = b.amount || 0;
            if (amountB !== amountA) return amountB - amountA;
            return b.daysElapsed - a.daysElapsed;
        };
        filteredOpportunities.sort(ordenar);

        // DEDUP: una persona, UNA tarjeta — nunca dos (Ishtar, 10/9/2026).
        //
        // Antes dos fichas DISTINTAS con el mismo teléfono se mostraban las dos
        // ("madre e hija con el mismo celular"). Ese caso casi no existe; el que
        // sí existe a montones es la ficha DUPLICADA de la misma persona (alta
        // desde WhatsApp + alta a mano + ficha del carrito web). Medido en prod:
        // 65 de 322 candidatos eran duplicados. Además el seguimiento es por
        // WhatsApp, UN chat por número: dos tarjetas terminan en el mismo chat.
        //
        // Llaves: ficha, teléfono normalizado, email y nombre completo. Como la
        // lista viene ordenada, la tarjeta que queda es la más importante de esa
        // persona, y se lleva las fichas de las que colapsó (`fichas`) para que
        // "ya le escribí" en cualquiera de ellas cuente.
        const uniqueOpportunities: any[] = [];
        const duenoDeLlave = new Map<string, number>();

        for (const opp of filteredOpportunities) {
            const pk = phoneKey(opp.phone);
            const ek = opp.email ? opp.email.trim().toLowerCase() : null;
            const nk = nombreKey(opp.clientName);
            const llaves = [
                opp.clientId ? `c:${opp.clientId}` : null,
                pk ? `t:${pk}` : null,
                ek ? `e:${ek}` : null,
                nk ? `n:${nk}` : null,
            ].filter((k): k is string => !!k);

            const previo = llaves.map(k => duenoDeLlave.get(k)).find(i => i !== undefined);
            const idx = previo ?? uniqueOpportunities.push({ ...opp, fichas: [] as string[] }) - 1;
            if (opp.clientId && !uniqueOpportunities[idx].fichas.includes(opp.clientId)) {
                uniqueOpportunities[idx].fichas.push(opp.clientId);
            }
            // TODAS las llaves apuntan a la tarjeta que quedó: si A comparte
            // teléfono con B y B email con C, las tres son la misma persona.
            for (const k of llaves) duenoDeLlave.set(k, idx);
        }

        // "YA LE ESCRIBÍ" (Ishtar, 10/9/2026). Lo que hace abarcable la lista no
        // es la ventana sino que se ACHIQUE a medida que trabajan. En los
        // últimos DIAS_ESCONDIDA_TRAS_ESCRIBIRLE días cuenta cualquiera de:
        //   · un seguimiento firmado en la ficha (botón "Ya le escribí", copiar
        //     el número, el verde de este panel, la plantilla del embudo);
        //   · un WhatsApp SALIENTE de una persona — desde el celular de la
        //     óptica ("Teléfono") o desde el buzón. Es lo que más pasa: el
        //     equipo escribe desde el celular y eso llega al sistema solo, sin
        //     que nadie tenga que acordarse de tocar un botón.
        // Qué pasa entonces:
        //   · lo común se ESCONDE y vuelve solo si sigue sin comprar;
        //   · lo IMPORTANTE queda a la vista, abajo y atenuado, con quién le
        //     escribió y cuándo ("los importantes del mes, tenerlos presentes").
        const todasLasFichas = [...new Set(uniqueOpportunities.flatMap(o => o.fichas))] as string[];
        const escritos = todasLasFichas.length ? await prisma.interaction.findMany({
            where: {
                clientId: { in: todasLasFichas },
                type: 'FOLLOWUP',
                userId: { not: null },
                createdAt: { gte: haceDias(DIAS_ESCONDIDA_TRAS_ESCRIBIRLE) },
            },
            orderBy: { createdAt: 'desc' },
            select: { clientId: true, createdAt: true, userName: true },
        }) : [];
        const chats = todasLasFichas.length ? await prisma.whatsAppChat.findMany({
            where: { clientId: { in: todasLasFichas } },
            select: {
                clientId: true,
                messages: {
                    // OJO: `notIn` descarta también los senderName NULL (en SQL
                    // `NULL NOT IN (...)` no es TRUE). Medido: entre los
                    // candidatos no hay salientes sin remitente, así que no se
                    // pierde nada — pero no "arreglarlo" sumando null sin mirar.
                    where: {
                        direction: 'OUTBOUND',
                        senderName: { notIn: [...REMITENTES_AUTOMATICOS] },
                        createdAt: { gte: haceDias(DIAS_ESCONDIDA_TRAS_ESCRIBIRLE) },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true, senderName: true },
                },
            },
        }) : [];

        const contactos = [
            ...escritos.map(e => ({ clientId: e.clientId, cuando: e.createdAt, quien: e.userName })),
            ...chats.flatMap(ch => ch.clientId && ch.messages[0] ? [{
                clientId: ch.clientId,
                cuando: ch.messages[0].createdAt,
                // "Teléfono" es el celular de la óptica, no una persona: sin nombre.
                quien: ch.messages[0].senderName === 'Teléfono' ? null : ch.messages[0].senderName,
            }] : []),
        ].sort((a, b) => b.cuando.getTime() - a.cuando.getTime());

        const ultimoEscrito = new Map<string, { cuando: string; quien: string | null }>();
        for (const c of contactos) {
            if (!ultimoEscrito.has(c.clientId)) ultimoEscrito.set(c.clientId, { cuando: c.cuando.toISOString(), quien: c.quien });
        }

        const visibles: any[] = [];
        for (const { fichas, ...opp } of uniqueOpportunities) {
            const esc = (fichas as string[])
                .map(id => ultimoEscrito.get(id))
                .filter(Boolean)
                .sort((a, b) => b!.cuando.localeCompare(a!.cuando))[0];
            if (esc && !opp.importante) continue;
            visibles.push(esc ? { ...opp, yaEscrito: esc } : opp);
        }
        // Los importantes a los que ya les escribieron, al fondo (estable: el
        // resto del orden se mantiene).
        visibles.sort((a, b) => (a.yaEscrito ? 1 : 0) - (b.yaEscrito ? 1 : 0));

        // 120s > los 60s de polling: la caché absorbe el request siguiente en vez de
        // expirar justo al llegar. Son 4 queries relacionales pesadas sobre Client.
        serverCache.set(cacheKey, visibles, 120);

        return NextResponse.json(visibles);
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

        if (type === 'STALLED_FAVORITE' || type === 'SIN_PRESUPUESTO') {
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
                    where: { clientId: session.clientId, status: { in: ['PENDING', 'ABANDONED', 'EMAIL_SENT'] } },
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

