import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getPrescriptionReminderHtml } from '@/lib/checkout/checkout-emails';

export const dynamic = 'force-dynamic';

const PRESCRIPTION_PENDING_MARKER = 'Enviar luego por WhatsApp';
const REMINDER_AFTER_HOURS = 48;
const MAX_ORDER_AGE_DAYS = 14;

/**
 * Recordatorio de receta pendiente: pedidos web donde el cliente eligió
 * "Enviar receta luego por WhatsApp" y pasaron 48hs sin que la mande.
 * Antes de enviar revisa la ficha del cliente: si la venta ya tiene receta
 * vinculada, o la ficha tiene una receta cargada DESPUÉS de la compra
 * (Prescription.date se setea al momento de la carga), no se envía nada.
 * Se envía UNA sola vez por pedido (dedupe vía Notification PRESCRIPTION_REMINDER).
 * Disparar diariamente: GET /api/cron/prescription-reminders?secret=<CRON_SECRET>
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
        }

        if (secret !== cronSecret && token !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const now = Date.now();
        const remindBefore = new Date(now - REMINDER_AFTER_HOURS * 60 * 60 * 1000);
        const notOlderThan = new Date(now - MAX_ORDER_AGE_DAYS * 24 * 60 * 60 * 1000);

        const candidates = await prisma.order.findMany({
            where: {
                isDeleted: false,
                prescriptionId: null, // si la venta ya tiene receta vinculada, no molestar
                createdAt: { lte: remindBefore, gte: notOlderThan },
                items: { some: { prismVal: PRESCRIPTION_PENDING_MARKER } },
                client: { email: { not: null } },
                notifications: { none: { type: 'PRESCRIPTION_REMINDER' } }
            },
            select: {
                id: true,
                createdAt: true,
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        prescriptions: {
                            select: { date: true },
                            orderBy: { date: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        // Revisar la ficha del cliente: si cargaron una receta después de la compra, ya la envió
        const orders = candidates.filter(order => {
            const lastPrescription = order.client.prescriptions[0]?.date;
            return !lastPrescription || lastPrescription < order.createdAt;
        });

        const results: Array<{ orderId: string; email: string; sent: boolean }> = [];

        for (const order of orders) {
            const email = order.client.email!;
            const firstName = (order.client.name || 'Hola').trim().split(/\s+/)[0];
            const shortId = order.id.slice(-4).toUpperCase();

            const sendResult = await sendEmail({
                to: email,
                subject: `Tu receta nos está esperando - Pedido #${shortId} - Atelier Óptica`,
                html: getPrescriptionReminderHtml(firstName, order.id)
            });

            if (sendResult.success) {
                await prisma.notification.create({
                    data: {
                        type: 'PRESCRIPTION_REMINDER',
                        message: `Recordatorio de receta enviado a ${order.client.name} (${email}) por el pedido #${shortId}. Marcar como resuelta cuando llegue la receta.`,
                        orderId: order.id,
                        requestedBy: 'SISTEMA (Auto)',
                        status: 'PENDING'
                    }
                });
            }

            results.push({ orderId: order.id, email, sent: sendResult.success });
        }

        console.log(`[Cron Prescription Reminders] ${results.filter(r => r.sent).length}/${results.length} recordatorios enviados (${candidates.length - orders.length} omitidos por receta ya cargada en ficha)`);

        return NextResponse.json({
            success: true,
            remindersSent: results.filter(r => r.sent).length,
            skippedWithPrescription: candidates.length - orders.length,
            details: results
        });
    } catch (error: any) {
        console.error('[Cron Prescription Reminders] Error inesperado:', error);
        return NextResponse.json({ error: error.message || 'Error en el servidor' }, { status: 500 });
    }
}
