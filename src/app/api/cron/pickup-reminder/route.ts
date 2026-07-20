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
                 // Si el cron ya lo pasó a READY ayer, dejamos la notificación PENDING en la campanita
                 // para que el vendedor lo pueda pasar a Entregado desde ahí, pero no volvemos a procesarlo.
                 if (order.labStatus === 'READY' && notif.message.includes('Cliente notificado')) {
                     continue;
                 }
                 
                 await prisma.notification.update({
                    where: { id: notif.id },
                    data: { status: 'RESOLVED', resolvedBy: 'Cron Pickup - Estado Inválido o Ya Procesado' }
                });
                continue;
            }

            // Enviar PRIMERO el WhatsApp al cliente (saldo, dirección, horarios).
            // Recién si el envío sale bien movemos la orden a READY y marcamos la
            // notificación. Si falla, dejamos labStatus=FINISHED y la notificación
            // PENDING para que la próxima corrida lo reintente (antes se marcaba
            // READY antes de enviar → un envío fallido dejaba al cliente sin avisar
            // y la corrida siguiente lo resolvía como "estado inválido").
            const sent = await BotService.notifyOrderReady(order);

            if (sent) {
                await prisma.order.update({
                    where: { id: order.id },
                    data: { labStatus: 'READY' }
                });
                order.labStatus = 'READY';

                // Modificar la notificación en lugar de resolverla para que el vendedor
                // sepa que el cliente ya fue avisado y lo pase a entregado cuando venga.
                const updatedMessage = notif.message.replace('Pedido finalizado en laboratorio', '🛍️ Cliente notificado (Listo para Retirar)');
                await prisma.notification.update({
                    where: { id: notif.id },
                    data: { message: updatedMessage }
                });

                results.push({ orderId: order.id, status: 'Sent & Notification Updated' });
            } else {
                // Envío fallido (ej: WhatsApp caído / número inválido): se reintenta
                // en la próxima corrida (la orden sigue FINISHED, la notif PENDING).
                results.push({ orderId: order.id, status: 'Failed to send - will retry' });
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
