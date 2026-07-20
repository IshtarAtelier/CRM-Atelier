import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizeArgentinePhone } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Normalización masiva de teléfonos + re-vinculación de chats: solo ADMIN.
        if (request.headers.get('x-user-role') !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }
        const clients = await prisma.client.findMany({
            where: { phone: { not: null } },
            select: { id: true, phone: true }
        });

        let updatedCount = 0;
        let linkedChatsCount = 0;

        for (const client of clients) {
            const normalized = normalizeArgentinePhone(client.phone);
            if (normalized && normalized !== client.phone) {
                // Update phone
                await prisma.client.update({
                    where: { id: client.id },
                    data: { phone: normalized }
                });
                updatedCount++;

                // Try to link unlinked WhatsApp chats
                const suffix = normalized.slice(-8);
                if (suffix.length === 8) {
                    const matchingChats = await prisma.whatsAppChat.findMany({
                        where: {
                            clientId: null,
                            OR: [
                                { realPhone: { contains: suffix } },
                                { waId: { contains: suffix } }
                            ]
                        }
                    });

                    for (const chat of matchingChats) {
                        await prisma.whatsAppChat.update({
                            where: { id: chat.id },
                            data: { clientId: client.id }
                        });
                        linkedChatsCount++;
                    }
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Proceso completado.`,
            clientsChecked: clients.length,
            clientsUpdated: updatedCount,
            chatsLinked: linkedChatsCount
        });
    } catch (error: any) {
        console.error('Error in fix-phones:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
