import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { invalidarContadorNoLeidos } from '@/lib/whatsapp/unread-cache';

export const dynamic = 'force-dynamic';

// POST /api/whatsapp/chats/[id]/mark-read
// Pone en 0 el `unreadCount` del chat cuando alguien lo abre en el CRM.
//
// Devuelve además el total GLOBAL de no leídos ya recalculado: el buzón lo
// SETEA con ese número en vez de restarle 1 al que tenía. Restar de a uno daba
// mal siempre que el chat tuviera más de un mensaje sin leer, y el contador
// global va cacheado 20 s, así que el número viejo volvía a aparecer solo.
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const chat = await prisma.whatsAppChat.update({
            where: { id },
            data: { unreadCount: 0 },
            select: { id: true, unreadCount: true }
        });

        // El cache del contador se tira ANTES de recalcular, así ninguna lectura
        // posterior se queda con el total de antes de esta lectura.
        invalidarContadorNoLeidos();
        const total = await prisma.whatsAppChat.aggregate({ _sum: { unreadCount: true } });

        return NextResponse.json({ success: true, chatId: chat.id, unreadTotal: total._sum.unreadCount ?? 0 });
    } catch (error: any) {
        console.error('[Mark Read] Error:', error);
        return NextResponse.json(
            { error: 'Error al marcar como leído' },
            { status: 500 }
        );
    }
}
