import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { BotService } from '@/services/bot.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
        }

        if (secret !== cronSecret && token !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // Obtener la fecha de hace 24 horas
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Buscar notificaciones LAB_READY pendientes creadas hace más de 24 horas
        // y que tengan un orderId asociado
        const pendingNotifications = await prisma.notification.findMany({
            where: {
                type: 'LAB_READY',
                status: 'PENDING',
                createdAt: { lte: twentyFourHoursAgo },
                orderId: { not: null }
            },
            include: {
                order: {
                    include: {
                        client: true,
                        items: { include: { product: true } },
                        payments: true
                    }
                }
            }
        });

        const results = [];

        for (const notif of pendingNotifications) {
            const order = notif.order;
            
            // Si el pedido fue eliminado, simplemente resolvemos la notificación
            if (!order || order.isDeleted) {
                await prisma.notification.update({
                    where: { id: notif.id },
                    data: { status: 'RESOLVED', resolvedBy: 'Cron Pickup Auto' }
                });
                continue;
            }

            // Validar que el labStatus sea FINISHED (que significa fabricado pero no listo)
            // Si el pedido volvió atrás o ya avanzó, no mandamos mensaje.
            if (order.labStatus !== 'FINISHED') {
                 await prisma.notification.update({
                    where: { id: notif.id },
                    data: { status: 'RESOLVED', resolvedBy: 'Cron Pickup - Estado Inválido o Ya Procesado' }
                });
                continue;
            }

            // Actualizar estado de la orden a READY (Terminado)
            await prisma.order.update({
                where: { id: order.id },
                data: { labStatus: 'READY' }
            });
            // Update order object for BotService if it checks it
            order.labStatus = 'READY';

            // Si llegamos acá, el pedido sigue en FINISHED (ahora READY) y pasaron 24 hs.
            // Enviar WhatsApp al cliente informando saldo, dirección y horarios.
            const sent = await BotService.notifyOrderReady(order);

            if (sent) {
                // Resolver notificación interna para que no aparezca más en la campana
                await prisma.notification.update({
                    where: { id: notif.id },
                    data: { status: 'RESOLVED', resolvedBy: 'Cron Pickup' }
                });

                results.push({ orderId: order.id, status: 'Sent & Resolved' });
            } else {
                // Si falla el envío (ej: número de WhatsApp inválido), lo dejamos pendiente
                // Opcional: podrías marcarlo FAILED si no quieres que reintente mañana.
                // Por ahora lo dejamos PENDING así el vendedor lo ve.
                results.push({ orderId: order.id, status: 'Failed to send' });
            }
        }

        return NextResponse.json({
            success: true,
            processed: pendingNotifications.length,
            results
        });

    } catch (error: any) {
        console.error('[Cron Pickup Reminder] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
