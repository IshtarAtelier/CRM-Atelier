import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { waId, content, direction, type, mediaUrl } = body;

        console.log('[Bot Webhook] Mensaje recibido de:', waId, 'Contenido:', content);

        if (!waId || !content) {
            return NextResponse.json({ error: 'waId y content son requeridos' }, { status: 400 });
        }

        // --- TEAM CHAT INTERCEPTION ---
        const MATIAS_PHONE = '5493518685644';
        const ISHTAR_PHONE = '5493541215971';
        
        if (direction === 'INBOUND' && (waId === `${MATIAS_PHONE}@c.us` || waId === `${ISHTAR_PHONE}@c.us`)) {
            const senderName = waId === `${MATIAS_PHONE}@c.us` ? 'MATIAS' : 'ISHTAR';
            const targetPhone = senderName === 'MATIAS' ? ISHTAR_PHONE : MATIAS_PHONE;
            
            // 1. Save internal TeamMessage
            await prisma.teamMessage.create({
                data: { content, sender: senderName }
            });
            
            // 2. Forward to the other team member
            const prefix = senderName === 'MATIAS' ? '👨🏻 *[Matías]*:\n' : '👩🏻‍💻 *[Ishtar]*:\n';
            try {
                const fetchWaRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/whatsapp/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: `${targetPhone}@c.us`,
                        message: `${prefix}${content}`
                    })
                });
                if (!fetchWaRes.ok) {
                    console.error('[Bot Bridge] Error forwarding team message');
                }
            } catch (e) {
                console.error('[Bot Bridge] Exception forwarding team message', e);
            }
            
            // We can still let it flow into the regular CRM WhatsApp chat, or we can just return here.
            // Returning early means these messages won't clutter the CRM customer chat view.
            return NextResponse.json({ success: true, teamMessage: true });
        }
        // ------------------------------


        // Find or create chat
        let chat = await prisma.whatsAppChat.findUnique({
            where: { waId }
        });

        if (!chat) {
            chat = await prisma.whatsAppChat.create({
                data: {
                    waId,
                    status: 'OPEN'
                }
            });
        }

        // Create message
        const message = await prisma.whatsAppMessage.create({
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
        await prisma.whatsAppChat.update({
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
