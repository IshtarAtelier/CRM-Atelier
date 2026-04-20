import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { waId, content, direction, type, mediaUrl } = body;

        if (!waId || !content) {
            return NextResponse.json({ error: 'waId y content son requeridos' }, { status: 400 });
        }

        // Find or create chat
        let chat = await prisma.whatsappChat.findUnique({
            where: { waId }
        });

        if (!chat) {
            chat = await prisma.whatsappChat.create({
                data: {
                    waId,
                    status: 'OPEN'
                }
            });
        }

        // Create message
        const message = await prisma.whatsappMessage.create({
            data: {
                chatId: chat.id,
                content,
                direction: direction || 'OUTBOUND',
                type: type || 'TEXT',
                mediaUrl,
                status: 'SENT'
            }
        });

        // Update chat
        await prisma.whatsappChat.update({
            where: { id: chat.id },
            data: {
                lastMessageAt: new Date(),
                unreadCount: direction === 'INBOUND' ? { increment: 1 } : undefined
            }
        });

        return NextResponse.json(message);
    } catch (error: any) {
        console.error('[Bot Bridge Messages POST] Error:', error);
        return NextResponse.json({ error: 'Error al registrar mensaje' }, { status: 500 });
    }
}
