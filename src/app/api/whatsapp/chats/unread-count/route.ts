import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { serverCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

// Se cachea 20s: es una agregación (_sum) sobre TODA la tabla WhatsAppChat, sin
// índice en unreadCount → full scan en cada corrida. El badge la pollea seguido
// por pestaña, pero el socket.io ya refresca el contador en vivo ante mensajes
// nuevos y lecturas, así que este número es solo un respaldo y puede ir cacheado.
export async function GET() {
    try {
        const cacheKey = 'whatsapp-unread-count';
        const cached = serverCache.get<number>(cacheKey);
        if (cached !== null) {
            return NextResponse.json({ count: cached });
        }

        const result = await prisma.whatsAppChat.aggregate({
            _sum: {
                unreadCount: true
            }
        });
        const unreadCount = result._sum.unreadCount ?? 0;
        serverCache.set(cacheKey, unreadCount, 20);
        return NextResponse.json({ count: unreadCount });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
