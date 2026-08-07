import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchWa } from '@/lib/wa-config';
import { generateOrderPDF } from '@/lib/order-pdf-generator';
import { getActor } from '@/lib/actor';
import { sendClientEmail, escHtml } from '@/lib/client-email';
import { logAudit } from '@/lib/audit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const orderId = resolvedParams.id;
        const { formattedPhone, text } = await request.json();

        if (!formattedPhone || !text) {
            return NextResponse.json({ error: 'Faltan parámetros (formattedPhone o text)' }, { status: 400 });
        }

        console.log('[send-pdf] Generating PDF for order:', orderId, 'to:', formattedPhone);

        // Obtener orden y contacto
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                client: true,
                items: {
                    include: { product: true }
                },
                payments: true,
                prescription: true
            }
        });

        if (!order || !order.client) {
            return NextResponse.json({ error: 'Orden o cliente no encontrado' }, { status: 404 });
        }

        // Buscar si hay un chat vinculado a este cliente
        const chat = await prisma.whatsAppChat.findFirst({
            where: { clientId: order.clientId }
        });

        const waId = chat ? chat.waId : `${formattedPhone}@c.us`;
        const chatIdForBot = chat ? chat.id : waId;

        // El PDF lo manda un vendedor logueado: que el buzón lo firme con su
        // nombre (antes quedaba como "CRM" genérico, sin autor).
        const actor = getActor(request, 'CRM');
        const senderName = actor.name;

        /**
         * Deja el envío asentado en las notas de la ficha, con quién lo mandó y
         * por qué canales. Antes NO quedaba rastro: el presupuesto salía y la
         * ficha no lo sabía, así que nadie podía reconstruir qué se le mandó a
         * un cliente ni cuándo. Registra TODOS los desenlaces, también el
         * fallido — que es el que más importa poder reclamar.
         */
        const registrarEnFicha = async (detalle: string, ok: boolean) => {
            try {
                await prisma.interaction.create({
                    data: {
                        clientId: order.clientId,
                        type: ok ? 'NOTE' : 'ERROR',
                        userId: actor.id,
                        userName: senderName,
                        content: `${ok ? '📄' : '⚠️'} Presupuesto ${ok ? 'enviado' : 'NO enviado'} por ${senderName}: ${detalle}`,
                    },
                });
            } catch (e) {
                console.error('[send-pdf] No se pudo registrar el envío en la ficha:', e);
            }
            logAudit({
                userId: actor.id,
                userName: senderName,
                action: 'OTHER',
                entityType: 'ORDER',
                entityId: orderId,
                details: { evento: 'envio_presupuesto', ok, detalle, clientName: order.client.name },
            }).catch(console.error);
        };

        // Generar PDF del lado del servidor
        let pdfResult = null;
        try {
            pdfResult = await generateOrderPDF(order, order.client, senderName);
            console.log('[send-pdf] PDF generated successfully:', pdfResult.filename, '| Size:', Math.round(pdfResult.base64.length * 0.75 / 1024), 'KB');
        } catch (pdfError: any) {
            console.error('[send-pdf] PDF generation failed:', pdfError.message);
            // No hacemos un early return: caemos al link de respaldo (Caso B).
        }

        // Copia por EMAIL del mismo documento, si la ficha tiene mail. Canal
        // adicional e independiente (nunca lanza): va antes del envío por
        // WhatsApp para que un fallo de WhatsApp no se lo lleve puesto.
        let emailEnviado = false;
        if (pdfResult) {
            emailEnviado = await sendClientEmail({
                to: order.client.email,
                subject: 'Tu presupuesto — Atelier Óptica',
                bodyHtml: `<p>Hola <strong>${escHtml(order.client.name)}</strong>,</p>
<p>Te enviamos el documento adjunto en PDF.</p>
<p style="white-space:pre-wrap">${escHtml(text)}</p>`,
                attachments: [{
                    filename: pdfResult.filename,
                    content: pdfResult.base64,
                    contentType: 'application/pdf',
                }],
                label: 'presupuesto',
            });
        }
        const sufijoEmail = emailEnviado ? ` y por email a ${order.client.email}` : '';

        // Caso A: El PDF se generó bien → lo enviamos como Documento adjunto.
        // IMPORTANTE: si el envío de media falla o tarda, NO caemos al link,
        // porque el PDF podría estar en curso y llegar igual → mensaje duplicado.
        // Devolvemos error y que el humano verifique antes de reintentar.
        if (pdfResult) {
            try {
                const res = await fetchWa('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: chatIdForBot,
                        message: text,
                        senderName,
                        media: {
                            base64: pdfResult.base64,
                            mimetype: 'application/pdf',
                            filename: pdfResult.filename
                        }
                    }),
                });

                if (res.ok) {
                    console.log('[send-pdf] PDF sent successfully as media to:', formattedPhone);
                    await registrarEnFicha(`PDF adjunto por WhatsApp al ${formattedPhone}${sufijoEmail}.`, true);
                    return NextResponse.json({ success: true, method: 'media', email: emailEnviado });
                }

                const responseText = await res.text();
                console.error('[send-pdf] Media send failed (sin fallback a link para evitar duplicados):', res.status, responseText.substring(0, 200));

                // 503 = el wa-service garantiza que el mensaje nunca salió (sesión
                // reconectando). Ahí sí podemos decirle al vendedor que reintente
                // tranquilo, sin la duda de "¿le habrá llegado igual?".
                if (res.status === 503 && responseText.includes('notSent')) {
                    await registrarEnFicha(`WhatsApp estaba reconectando, no salió nada${sufijoEmail ? `. Sí se envió${sufijoEmail}` : ''}. Hay que reintentar.`, false);
                    return NextResponse.json(
                        { error: 'WhatsApp se está reconectando: NO se envió nada. Esperá unos segundos y reintentá.' },
                        { status: 503 }
                    );
                }

                await registrarEnFicha(`el bot no pudo adjuntar el PDF por WhatsApp (HTTP ${res.status})${sufijoEmail ? `. Sí se envió${sufijoEmail}` : ''}. Verificar si le llegó antes de reintentar.`, false);
                return NextResponse.json(
                    { error: `El bot no pudo adjuntar el PDF (${res.status}). Verificá si le llegó al cliente antes de reintentar.` },
                    { status: 502 }
                );
            } catch (mediaErr: any) {
                console.error('[send-pdf] Media send network error:', mediaErr.message);

                // fetchWa reintenta los 503 y, si se agotan, tira el error con el
                // status pegado. Sigue siendo "no se envió nada": el wa-service
                // corta antes de tocar WhatsApp.
                if (mediaErr?.status === 503) {
                    await registrarEnFicha(`WhatsApp estaba reconectando, no salió nada${sufijoEmail ? `. Sí se envió${sufijoEmail}` : ''}. Hay que reintentar.`, false);
                    return NextResponse.json(
                        { error: 'WhatsApp se está reconectando: NO se envió nada. Esperá unos segundos y reintentá.' },
                        { status: 503 }
                    );
                }

                await registrarEnFicha(`error de red enviando el PDF por WhatsApp (${mediaErr.message})${sufijoEmail ? `. Sí se envió${sufijoEmail}` : ''}. Verificar si le llegó antes de reintentar.`, false);
                return NextResponse.json(
                    { error: `Error de red enviando el PDF: ${mediaErr.message}. Verificá si le llegó al cliente antes de reintentar.` },
                    { status: 502 }
                );
            }
        }

        // Caso B: No se pudo generar el PDF → único caso donde el link es el respaldo
        // (no hay riesgo de duplicado porque nunca se envió media).
        console.log('[send-pdf] Sin PDF generado, enviando link de respaldo para orden:', orderId);

        const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar'}/api/orders/${orderId}/pdf`;
        const fallbackText = `${text}\n\n📄 *Descargar Documento:* ${pdfUrl}`;

        try {
            const resLink = await fetchWa('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: chatIdForBot,
                    message: fallbackText,
                    senderName
                }),
            });

            if (resLink.ok) {
                console.log('[send-pdf] Link de respaldo enviado a:', formattedPhone);
                await registrarEnFicha(`no se pudo generar el PDF, se envió el LINK de descarga por WhatsApp al ${formattedPhone}.`, true);
                return NextResponse.json({ success: true, method: 'link' });
            } else {
                const responseText = await resLink.text();
                console.error('[send-pdf] Bot API Error on Link Fallback:', resLink.status, responseText);
                await registrarEnFicha(`falló el PDF y también el link de respaldo por WhatsApp (HTTP ${resLink.status}).`, false);
                return NextResponse.json({ error: `Error del bot al enviar link (${resLink.status})` }, { status: 500 });
            }
        } catch (linkErr: any) {
            console.error('[send-pdf] Network error sending link:', linkErr.message);
            await registrarEnFicha(`falló el PDF y también el link de respaldo por error de red (${linkErr.message}).`, false);
            return NextResponse.json({ error: `Error de red al enviar el link: ${linkErr.message}` }, { status: 500 });
        }

    } catch (error: any) {
        console.error('[send-pdf] Error:', error.message, error.stack);
        return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 });
    }
}
