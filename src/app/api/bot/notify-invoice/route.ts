import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
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
                            },
                            // Los pagos son imprescindibles: el PDF que recibe el
                            // cliente calcula el saldo con PricingService, y ese
                            // cálculo necesita convertir cada pago a su
                            // equivalente de lista. Sin esta relación el saldo
                            // salía de `total − paid`, que es la resta prohibida.
                            payments: true,
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

                // 18/8/2026 (B7-bis del plan de la API oficial): la ficha del
                // cliente le llega a la administración por EMAIL con el PDF
                // adjunto — antes era un WhatsApp del bot al número del admin.
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
                const ok = await sendEmail({
                    to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                    subject: `🧾 Solicitud de factura — ${client.name || profileName}`,
                    text: `El cliente ${client.name || profileName} (${client.phone || realPhone}) pidió factura por WhatsApp.\n\nMensaje recibido: "${messageContent}"\n\nFicha: ${appUrl}/admin/contactos?id=${client.id}${pdfResult ? '\n\nAdjuntamos su ficha en PDF.' : ''}`,
                    ...(pdfResult ? { attachments: [{ filename: pdfResult.filename, content: pdfResult.base64, contentType: 'application/pdf' }] } : {}),
                });
                if (!ok) {
                    console.error('[notify-invoice] No se pudo enviar el email al admin');
                    return NextResponse.json({ error: 'Error enviando el aviso por email' }, { status: 500 });
                }

                console.log('[notify-invoice] Invoice request notification sent to admin by email with client sheet.');
                return NextResponse.json({ success: true, notified: 'with_pdf' });
            }
        }

        // Si no hay cliente registrado (o no se encontró, o no tiene status CLIENT), ignoramos la notificación
        console.log('[notify-invoice] Invoice request ignored: not an active client.');
        return NextResponse.json({ success: true, ignored: true, reason: 'El remitente no es un cliente registrado activo.' });

    } catch (error: any) {
        console.error('[notify-invoice] Error in route:', error.message, error.stack);
        return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 });
    }
}
