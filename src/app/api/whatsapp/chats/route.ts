import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

// GET /api/whatsapp/chats — listar chats
// Lee DIRECTO de la base (compartida con wa-service): antes esto proxied a
// wa-service (browser → Next → Express en Railway → misma DB), sumando un hop
// de red, reintentos con backoff y hasta 100s de timeout cuando el servicio
// estaba ocupado con la sesión de WhatsApp. Como es una lectura pura, el hop
// no aportaba nada. wa-service queda solo para lo que sí necesita la sesión
// (enviar, sincronizar, estado).
// Además la lista trae solo los campos que usa el buzón y una preview corta
// del último mensaje (sin arrastrar base64 de audios ni todo el cliente).
export async function GET() {
    try {
        const chats = await prisma.whatsAppChat.findMany({
            orderBy: { lastMessageAt: 'desc' },
            select: {
                id: true,
                clientId: true,
                waId: true,
                profileName: true,
                lastMessageAt: true,
                status: true,
                unreadCount: true,
                botEnabled: true,
                archived: true,
                chatLabels: true,
                realPhone: true,
                chatSummary: true,
                lastFollowUpAt: true,
                client: { select: { id: true, name: true, phone: true, isFavorite: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { direction: true, type: true, content: true, createdAt: true },
                },
            },
        });

        // Preview corta: para audio/imagen el front muestra un rótulo fijo,
        // para texto alcanza un recorte para el preview del buzón.
        for (const chat of chats) {
            const last = chat.messages[0];
            if (last) last.content = last.type === 'TEXT' ? last.content.slice(0, 200) : '';
        }

        return NextResponse.json(chats);
    } catch (err) {
        console.error('[Next.js Chats GET] Error al obtener chats de la DB:', err);
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
