import { NextResponse } from 'next/server';

import { fetchWa } from '@/lib/wa-config';
import { prisma } from '@/lib/db';

// GET /api/whatsapp/chats — listar chats
export async function GET() {
    try {
        const res = await fetchWa('/api/chats', { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json([]);
    }
}

// POST /api/whatsapp/chats — iniciar chat para un número / cliente
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phone } = body;
        if (!phone) {
            return NextResponse.json({ error: 'Teléfono es requerido' }, { status: 400 });
        }

        let normalizedPhone = phone.replace(/\D/g, '');
        if (normalizedPhone.length < 8) {
            return NextResponse.json({ error: 'Número de teléfono inválido' }, { status: 400 });
        }

        const phoneSuffix = normalizedPhone.slice(-8);

        // Buscar si el chat ya existe usando los últimos 8 dígitos para evitar duplicados por formato
        let chat = await prisma.whatsAppChat.findFirst({
            where: {
                OR: [
                    { waId: { contains: phoneSuffix } },
                    { realPhone: { contains: phoneSuffix } }
                ]
            },
            include: { client: true }
        });

        if (!chat) {
            // Estandarizar número: en Argentina los celulares tienen 10 dígitos (cod area + numero)
            // Agregamos 549 por defecto si viene sin código de país
            if (normalizedPhone.length === 10) {
                normalizedPhone = '549' + normalizedPhone;
            }
            const waId = `${normalizedPhone}@c.us`;

            // Buscar un cliente con el mismo sufijo de teléfono (últimos 8 dígitos)
            const client = await prisma.client.findFirst({
                where: {
                    phone: {
                        contains: phoneSuffix
                    }
                }
            });

            // Crear el chat
            chat = await prisma.whatsAppChat.create({
                data: {
                    waId,
                    realPhone: normalizedPhone,
                    profileName: client?.name || 'Cliente',
                    clientId: client?.id || null,
                    status: 'OPEN',
                    botEnabled: false, // Desactivado por defecto al iniciar chat manual
                    lastMessageAt: new Date(),
                    chatLabels: []
                },
                include: { client: true }
            });
        }

        return NextResponse.json(chat);
    } catch (error: any) {
        console.error('[WhatsApp Chat POST] Error:', error);
        return NextResponse.json({ error: 'Error al iniciar chat: ' + error.message }, { status: 500 });
    }
}

