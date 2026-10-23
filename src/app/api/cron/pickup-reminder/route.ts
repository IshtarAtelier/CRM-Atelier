import { NextResponse } from 'next/server';
import { pasaPorLaboratorio } from '@/lib/pedido-sin-laboratorio';
import { prisma } from '@/lib/db';
import { BotService } from '@/services/bot.service';
import { REGISTRO_MODULOS } from '@/services/lab-modules/registro';
import { retiroAutomaticoPermitido } from '@/services/lab-modules/retiro';
import { avisarAlEquipo } from '@/lib/avisos/aviso-al-equipo';

export const dynamic = 'force-dynamic';

/**
 * `Notification` no tiene un campo libre (solo `message`, `status`,
 * `requestedBy` y `resolvedBy`), así que las dos marcas de proceso de este cron
 * viven en el TEXTO del mensaje. Son constantes para que el "¿ya pasó?" se
 * compare contra exactamente lo que se escribió; agregar un campo al modelo
 * sería una migración por dos banderas, y las notificaciones viejas ya están
 * escritas así.
 */
const MARCA_CLIENTE_NOTIFICADO = '🛍️ Cliente notificado (Listo para Retirar)';
const MARCA_EQUIPO_AVISADO = ' · equipo avisado';

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
                 if (order.labStatus === 'READY' && notif.message.includes(MARCA_CLIENTE_NOTIFICADO)) {
                     continue;
                 }

                 await prisma.notification.update({
                    where: { id: notif.id },
                    data: { status: 'RESOLVED', resolvedBy: 'Cron Pickup - Estado Inválido o Ya Procesado' }
                });
                continue;
            }

            // Un laboratorio con módulo puede pedir que el aviso NO sea automático
            // (Vitolen: todavía no se sabe cuánto tarda en llegar al local). La
            // notificación queda PENDING en la campanita y el vendedor avisa al
            // marcar "Listo p/ Retirar" a mano.
            // Sin cristales no hay retiro que avisar (anteojo de sol).
            if (!pasaPorLaboratorio(order.items as any[])) {
                await prisma.notification.update({
                    where: { id: notif.id },
                    data: { status: 'RESOLVED', resolvedBy: 'Cron Pickup - Sin laboratorio' }
                });
                continue;
            }

            const retiro = retiroAutomaticoPermitido(order.items as any[], REGISTRO_MODULOS);
            if (!retiro.permitido) {
                results.push({ orderId: order.id, status: `Sin aviso automático (${retiro.modulo}): lo avisa el vendedor` });
                continue;
            }

            // AVISAR PRIMERO, PERSISTIR DESPUÉS.
            //
            // Antes esto pasaba la orden a READY en la base ANTES de mandar el
            // WhatsApp, y si el envío fallaba solo dejaba un "Failed to send" en
            // la respuesta del cron. El problema aparecía en la corrida
            // siguiente: el guard de arriba veía `labStatus === 'READY'` pero el
            // mensaje NO decía "Cliente notificado" (nunca se había enviado),
            // así que caía al else y RESOLVÍA la notificación. Resultado: el
            // pedido quedaba listo, la campanita del vendedor se apagaba sola y
            // el cliente no se enteraba nunca de que podía pasar a retirarlo.
            //
            // Ahora, si el envío falla, la orden queda en FINISHED y la
            // notificación PENDING: la próxima corrida lo reintenta.
            order.labStatus = 'READY'; // solo en memoria, para el texto del bot
            const sent = await BotService.notifyOrderReady(order);

            if (sent) {
                await prisma.order.update({
                    where: { id: order.id },
                    data: { labStatus: 'READY' }
                });

                // Modificar la notificación en lugar de resolverla para que el vendedor
                // sepa que el cliente ya fue avisado y lo pase a entregado cuando venga.
                // El mensaje lo escriben dos lugares ("…en laboratorio" desde
                // smartlab.service, "…en <lab>" desde lab-modules/estados): se
                // reemplaza la cabecera entera y, si no tiene esa forma, se antepone,
                // para que la marca quede SIEMPRE y el guard de arriba la encuentre.
                const updatedMessage = /Pedido finalizado en .+? —/.test(notif.message)
                    ? notif.message.replace(/🏭?\s*Pedido finalizado en .+? —/, `${MARCA_CLIENTE_NOTIFICADO} —`)
                    : `${MARCA_CLIENTE_NOTIFICADO} — ${notif.message}`;
                await prisma.notification.update({
                    where: { id: notif.id },
                    data: { message: updatedMessage }
                });

                results.push({ orderId: order.id, status: 'Sent & Notification Updated' });
            } else {
                // No se persiste READY: la orden sigue FINISHED y la notificación
                // PENDING, así el próximo cron vuelve a intentar el aviso.
                console.error(`[Cron Pickup Reminder] No se pudo avisar al cliente de la orden ${order.id}; queda FINISHED para reintentar.`);

                // Y el equipo se entera UNA vez (no cada hora): un cliente sin
                // teléfono ni mail, o con WhatsApp caído, no se arregla
                // reintentando — alguien tiene que llamarlo. Hasta el 3/10/2026
                // esto era solo un console.error que nadie leía.
                let equipoAvisado = notif.message.includes(MARCA_EQUIPO_AVISADO);
                if (!equipoAvisado) {
                    const pedido = `#${order.id.slice(-4).toUpperCase()}`;
                    const quien = order.client?.name?.trim() || 'el cliente';
                    const llegaron = await avisarAlEquipo({
                        asunto: `⚠️ No salió el aviso de retiro ${pedido}`,
                        cuerpo: `El pedido ${pedido} de ${quien} está terminado en el laboratorio, pero el aviso automático de "listo para retirar" NO salió (cliente sin teléfono ni mail, o WhatsApp caído).\n\nHay que avisarle a mano que puede pasar a retirarlo y marcar la venta como "Listo p/ Retirar" en /admin/ventas?id=${order.id}.`,
                    });
                    if (llegaron > 0) {
                        await prisma.notification.update({
                            where: { id: notif.id },
                            data: { message: notif.message + MARCA_EQUIPO_AVISADO },
                        });
                        equipoAvisado = true;
                    }
                }
                results.push({ orderId: order.id, status: `Failed to send — queda pendiente para reintentar${equipoAvisado ? ' (equipo avisado)' : ''}` });
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
