import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { ensureClientForAbandonedCart } from '@/services/cart-recovery.service';

/**
 * Registra en la ficha del cliente que se le envió un seguimiento manual desde
 * el panel de Oportunidades de Cierre (botón de WhatsApp). Sin esto, el
 * seguimiento no dejaba rastro: nadie sabía si a esa persona ya le habían
 * escrito ni cuántas veces.
 */
export async function POST(req: Request) {
    try {
        const { id, type, message } = await req.json();
        if (!id || !type) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        let clientId: string | null = null;
        if (type === 'STALLED_FAVORITE') {
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
        await prisma.interaction.create({
            data: {
                clientId,
                type: 'FOLLOWUP',
                content: `📲 Seguimiento de Oportunidad de Cierre enviado por WhatsApp por ${actor.name}${message ? `:\n"${message}"` : ''}`,
                userId: actor.id,
                userName: actor.name,
            },
        });

        return NextResponse.json({ success: true, logged: true });
    } catch (error) {
        console.error('Error registrando seguimiento de oportunidad:', error);
        return NextResponse.json({ error: 'Error al registrar seguimiento' }, { status: 500 });
    }
}
