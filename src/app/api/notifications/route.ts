import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// GET /api/notifications — List notifications (ADMIN sees all, STAFF sees own)
export async function GET() {
    try {
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';

        const notifications = await prisma.notification.findMany({
            where: role === 'ADMIN' ? {} : { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        return NextResponse.json(notifications);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/notifications — Create a request (DELETE_REQUEST or INVOICE_REQUEST)
export async function POST(request: Request) {
    try {
        const headersList = await headers();
        const userName = headersList.get('x-user-name') || 'Desconocido';
        const body = await request.json();
        const { type, message, orderId } = body;

        if (!type || !message) {
            return NextResponse.json({ error: 'type y message son requeridos' }, { status: 400 });
        }

        if (!['DELETE_REQUEST', 'INVOICE_REQUEST'].includes(type)) {
            return NextResponse.json({ error: 'Tipo de solicitud inválido' }, { status: 400 });
        }

        if (type === 'INVOICE_REQUEST' && orderId) {
            // Extract the requested amount from the new message
            const newAmountMatch = message.match(/\$([0-9.,]+)/);
            if (newAmountMatch) {
                const newAmountStr = newAmountMatch[1];
                
                // Check if there is already a pending or approved request for the SAME amount and order
                const existingRequests = await prisma.notification.findMany({
                    where: {
                        type: 'INVOICE_REQUEST',
                        orderId: orderId,
                        status: { in: ['PENDING', 'APPROVED'] }
                    }
                });
                
                const isDuplicate = existingRequests.some((req: any) => {
                    const match = req.message.match(/\$([0-9.,]+)/);
                    return match && match[1] === newAmountStr;
                });

                if (isDuplicate) {
                    // Alert the admin that the seller tried to request it again
                    await prisma.notification.create({
                        data: {
                            type: 'SYSTEM_ALERT',
                            message: `ALERTA: El vendedor (${userName}) intentó volver a solicitar la facturación de ${newAmountStr} para la Venta #${orderId.slice(-4).toUpperCase()} que YA ESTÁ PENDIENTE.`,
                            requestedBy: 'SISTEMA',
                            status: 'PENDING'
                        }
                    });

                    // Enviar email con el recordatorio exacto que pidió el admin
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
                    // The best link for an order is usually through its ID or just the orders page with search
                    const orderLink = `${appUrl}/admin/ventas?id=${orderId}`;

                    const emailMessage = `${userName.toUpperCase()} ESTA SOLICITANDO ESTA FACTURA AUTOMATICA QUE NO SE EFECTUO.\n\nLink del pedido para poder facturarlo:\n${orderLink}`;

                    sendEmail({
                        to: 'pisano.ishtar@gmail.com',
                        subject: '⚠️ Recordatorio: Solicitud de Factura Duplicada',
                        text: emailMessage
                    }).catch(console.error);

                    // Return the 400 error with the specific custom message requested by user
                    return NextResponse.json({ 
                        error: 'La solicitud de la factura está en curso, pero ya se solicitó realizar a la brevedad.' 
                    }, { status: 400 });
                }
            }
        }

        const notification = await prisma.notification.create({
            data: {
                type,
                message,
                orderId: orderId || null,
                requestedBy: userName,
                status: 'PENDING',
            },
        });

        if (type === 'INVOICE_REQUEST') {
            const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
            const toEmail = !adminEmail || adminEmail.toLowerCase() === 'pisano.ishtar@gmail.com'
                ? 'pisano.ishtar@gmail.com'
                : `pisano.ishtar@gmail.com, ${adminEmail}`;

            sendEmail({
                to: toEmail,
                subject: '🧾 Solicitud de Factura (Manual)',
                text: `El usuario ${userName} ha generado una solicitud de factura manualmente:\n\n${message}`
            }).catch(console.error);
        }

        return NextResponse.json(notification);
    } catch (error: any) {
        console.error('Error creating notification:', error);
        
        let userMessage = error.message || 'Error desconocido al crear la notificación';
        if (error.code === 'P2003' || error.message?.includes('Foreign key constraint')) {
            userMessage = 'Error interno: no se pudo crear la notificación porque el usuario no fue encontrado en el sistema.';
        }
        
        return NextResponse.json({ error: userMessage }, { status: 500 });
    }
}

// PATCH /api/notifications — Resolve a request
export async function PATCH(request: Request) {
    try {
        const headersList = await headers();
        const userName = headersList.get('x-user-name') || 'Admin';
        const body = await request.json();
        const { id, status } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'id y status son requeridos' }, { status: 400 });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: {
                status,
                resolvedBy: userName,
            },
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error updating notification:', error);
        
        let userMessage = error.message || 'Error desconocido al actualizar la notificación';
        if (error.code === 'P2025') {
            userMessage = 'La notificación que intentaste actualizar ya no existe o fue eliminada.';
        }
        
        return NextResponse.json({ error: userMessage }, { status: 500 });
    }
}
