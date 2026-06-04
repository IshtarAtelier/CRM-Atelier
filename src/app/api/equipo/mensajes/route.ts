import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MATIAS_PHONE = '5493518685644';
const ISHTAR_PHONE = '5493541215971';

export async function GET() {
    try {
        const messages = await prisma.teamMessage.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        return NextResponse.json(messages.reverse());
    } catch (error: any) {
        console.error('[TeamMessage GET] Error:', error);
        return NextResponse.json({ error: 'Error fetching team messages' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { content, sender } = body;

        if (!content || !sender) {
            return NextResponse.json({ error: 'content and sender are required' }, { status: 400 });
        }

        const message = await prisma.teamMessage.create({
            data: { content, sender }
        });

        // Send via WhatsApp
        let targetPhone = '';
        if (sender === 'ISHTAR') {
            targetPhone = MATIAS_PHONE;
        } else if (sender === 'MATIAS') {
            targetPhone = ISHTAR_PHONE;
        }

        if (targetPhone) {
            try {
                // Determine prefix based on sender
                let prefix = '';
                if (sender === 'ISHTAR') prefix = '👩🏻‍💻 *[Mensaje Interno de Ishtar]*:\n';
                if (sender === 'MATIAS') prefix = '👨🏻 *[Mensaje Interno de Matías]*:\n';
                if (sender === 'SYSTEM') prefix = '🤖 *[Aviso del Sistema]*:\n';

                const fetchWaRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/whatsapp/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: `${targetPhone}@c.us`,
                        message: `${prefix}${content}`
                    })
                });
                
                if (!fetchWaRes.ok) {
                    console.error('[TeamMessage] Warning: WhatsApp send API returned an error');
                }
            } catch (waError) {
                console.error('[TeamMessage] WhatsApp routing error:', waError);
            }
        }

        return NextResponse.json(message);
    } catch (error: any) {
        console.error('[TeamMessage POST] Error:', error);
        return NextResponse.json({ error: 'Error creating team message' }, { status: 500 });
    }
}
