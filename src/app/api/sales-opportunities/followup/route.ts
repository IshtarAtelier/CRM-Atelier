import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { ensureClientForAbandonedCart } from '@/services/cart-recovery.service';
import { serverCache } from '@/lib/cache';

/**
 * Registra en la ficha del cliente que se le envió un seguimiento manual desde
 * el panel de Oportunidades de Cierre (botón de WhatsApp). Sin esto, el
 * seguimiento no dejaba rastro: nadie sabía si a esa persona ya le habían
 * escrito ni cuántas veces.
 *
 * Desde el 10/9/2026 además es lo que ESCONDE la tarjeta 5 días ("ya le
 * escribí"). Tres formas de llegar acá, distinguidas por `via`:
 *   · 'whatsapp' — el botón verde (default, con el texto que se mandó);
 *   · 'copia'    — copió el número para escribirle desde SU WhatsApp;
 *   · 'manual'   — tocó "Ya le escribí".
 */
export async function POST(req: Request) {
    try {
        const { id, type, message, via } = await req.json();
        if (!id || !type) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        let clientId: string | null = null;
        if (type === 'STALLED_FAVORITE' || type === 'SIN_PRESUPUESTO') {
            clientId = id;
        } else if (type === 'PENDING_QUOTE') {
            const order = await prisma.order.findUnique({ where: { id }, select: { clientId: true } });
            clientId = order?.clientId ?? null;
        } else if (type === 'ABANDONED_CART') {
            const session = await prisma.checkoutSession.findUnique({ where: { id } });
            if (session) {
                clientId = session.clientId ?? await ensureClientForAbandonedCart(session);
            }
        } else {
            return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
        }

        if (!clientId) {
            // Carrito sin ningún dato de contacto: no hay ficha donde anotar.
            return NextResponse.json({ success: true, logged: false });
        }

        const actor = getActor(req);

        // Copiar el número y después tocar "Ya le escribí" es UN seguimiento,
        // no dos: si la misma persona ya lo registró en los últimos 10 minutos,
        // no se repite en el historial de la ficha.
        const reciente = await prisma.interaction.findFirst({
            where: {
                clientId,
                type: 'FOLLOWUP',
                userId: actor.id,
                createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
            },
            select: { id: true },
        });

        if (!reciente) {
            const content =
                via === 'copia'
                    ? `📋 ${actor.name} copió el número para escribirle por WhatsApp (Oportunidad de Cierre)`
                    : via === 'manual'
                        ? `✍️ ${actor.name} marcó que ya le escribió (Oportunidad de Cierre)`
                        : `📲 Seguimiento de Oportunidad de Cierre enviado por WhatsApp por ${actor.name}${message ? `:\n"${message}"` : ''}`;
            await prisma.interaction.create({
                data: { clientId, type: 'FOLLOWUP', content, userId: actor.id, userName: actor.name },
            });
        }

        // Sin esto la tarjeta seguía en el panel hasta 2 minutos (la caché).
        serverCache.clear();

        return NextResponse.json({ success: true, logged: !reciente });
    } catch (error) {
        console.error('Error registrando seguimiento de oportunidad:', error);
        return NextResponse.json({ error: 'Error al registrar seguimiento' }, { status: 500 });
    }
}
