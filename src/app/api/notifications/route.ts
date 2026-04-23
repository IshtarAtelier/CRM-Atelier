import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

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

        return NextResponse.json(notification);
    } catch (error: any) {
        console.error('Error creating notification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
