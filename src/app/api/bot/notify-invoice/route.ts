import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchWa } from '@/lib/wa-config';
import { WHATSAPP_PHONE } from '@/lib/constants';
import { generateClientPDF } from '@/lib/client-pdf-generator';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientId, profileName, realPhone, messageContent } = body;

        console.log('[notify-invoice] Received invoice request alert:', {
            clientId,
            profileName,
            realPhone,
            messageContentLength: messageContent?.length || 0
        });

        // Determinar número del administrador
        const adminPhone = process.env.ADMIN_PHONE || WHATSAPP_PHONE;
        const adminWaId = adminPhone.includes('@') ? adminPhone : `${adminPhone.replace(/[^0-9]/g, '')}@c.us`;

        // Si hay un cliente registrado
        if (clientId) {
            const client = await prisma.client.findUnique({
                where: { id: clientId },
                include: {
                    tags: true,
                    prescriptions: { orderBy: { date: 'desc' } },
                    orders: {
                        where: { isDeleted: false },
                        orderBy: { createdAt: 'desc' },
                        include: {
                            items: {
                                include: { product: true }
                            }
                        }
                    },
                    interactions: { orderBy: { createdAt: 'desc' }, take: 10 },
                    tasks: {
                        where: { status: 'PENDING' },
                        orderBy: { dueDate: 'asc' }
                    }
                }
            });

            if (client) {
                console.log('[notify-invoice] Generating client PDF for:', client.name);
                let pdfResult;
                try {
                    pdfResult = await generateClientPDF(client);
                } catch (pdfError: any) {
                    console.error('[notify-invoice] Client PDF generation failed, sending without file:', pdfError.message);
                }

                const adminMessage = `📢 *Solicitud de Factura Detectada*\n\nEl cliente *${client.name || profileName}* (${client.phone || realPhone}) ha solicitado una factura.\n\n💬 Mensaje recibido: "${messageContent}"\n\nAdjuntamos su ficha de cliente.`;

                const payload: any = {
                    chatId: adminWaId,
                    message: adminMessage,
                    senderName: 'Sistema Atelier'
                };

                if (pdfResult) {
                    payload.media = {
                        base64: pdfResult.base64,
                        mimetype: 'application/pdf',
                        filename: pdfResult.filename
                    };
                }

                const res = await fetchWa('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    console.error('[notify-invoice] Failed to send WhatsApp to admin:', res.status, errorText);
                    return NextResponse.json({ error: `Error enviando WhatsApp al admin: ${errorText}` }, { status: 500 });
                }

                console.log('[notify-invoice] Invoice request notification sent to admin with client sheet.');
                return NextResponse.json({ success: true, notified: 'with_pdf' });
            }
        }

        // Si no hay cliente registrado (o no se encontró)
        const adminMessage = `📢 *Solicitud de Factura Detectada (Sin Ficha CRM)*\n\nEl cliente *${profileName}* (${realPhone}) ha solicitado una factura.\n\n💬 Mensaje recibido: "${messageContent}"\n\n⚠️ No se encontró una ficha vinculada a este número de WhatsApp en el CRM.`;

        const res = await fetchWa('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: adminWaId,
                message: adminMessage,
                senderName: 'Sistema Atelier'
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[notify-invoice] Failed to send WhatsApp to admin (no client):', res.status, errorText);
            return NextResponse.json({ error: `Error enviando WhatsApp al admin: ${errorText}` }, { status: 500 });
        }

        console.log('[notify-invoice] Invoice request notification sent to admin (no client sheet).');
        return NextResponse.json({ success: true, notified: 'text_only' });

    } catch (error: any) {
        console.error('[notify-invoice] Error in route:', error.message, error.stack);
        return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 });
    }
}
