import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/whatsapp/chats/[id]/mark-read
// Resets unreadCount to 0 when user opens a chat in the CRM
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

        return NextResponse.json({ success: true, chatId: chat.id });
    } catch (error: any) {
        console.error('[Mark Read] Error:', error);
        return NextResponse.json(
            { error: 'Error al marcar como leído' },
            { status: 500 }
        );
    }
}
