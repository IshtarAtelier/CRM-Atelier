import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PricingService } from '@/services/PricingService';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * Calcula la cantidad de días hábiles entre dos fechas, excluyendo sábados y domingos.
 */
function getBusinessDays(start: Date, end: Date): number {
    let count = 0;
    const curDate = new Date(start.getTime());
    curDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end.getTime());
    endDate.setHours(0, 0, 0, 0);

    while (curDate < endDate) {
        curDate.setDate(curDate.getDate() + 1);
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    }
    return count;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        
        // Comprobar también autorización en cabeceras
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
        }

        if (secret !== cronSecret && token !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // Obtener órdenes activas de tipo venta (SALE)
        const activeOrders = await prisma.order.findMany({
            where: {
                orderType: 'SALE',
                isDeleted: false,
            },
            include: {
                client: true,
                items: {
                    include: {
                        product: true
                    }
                },
                payments: true,
                notifications: {
                    where: {
                        type: 'BALANCE_OVERDUE'
                    }
                }
            }
        });

        const today = new Date();
        const results = [];
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
        const adminEmail = process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';

        for (const order of activeOrders) {
            // 1. Calcular desglose financiero
            const financials = PricingService.calculateOrderFinancials(order);

            // Si no tiene saldo pendiente (tolerancia > 1000), omitir
            if (!financials.hasBalance) {
                continue;
            }

            // 2. Determinar si es multifocal
            const isMultifocal = order.items.some((item: any) => {
                const type = item.product?.type?.toUpperCase() || '';
                const category = item.product?.category?.toUpperCase() || '';
                const name = (item.product?.name || '').toUpperCase();
                const model = (item.product?.model || '').toUpperCase();
                const snapshotName = (item.productNameSnapshot || '').toUpperCase();
                const snapshotBrand = (item.productBrandSnapshot || '').toUpperCase();
                const snapshotCategory = (item.productCategorySnapshot || '').toUpperCase();
                
                return type.includes('MULTIFOCAL') || 
                       type.includes('PROGRESIVO') || 
                       type.includes('OCUPACIONAL') ||
                       category.includes('MULTIFOCAL') ||
                       category.includes('PROGRESIVO') ||
                       category.includes('OCUPACIONAL') ||
                       name.includes('MULTIFOCAL') || 
                       name.includes('PROGRESIVO') || 
                       name.includes('OCUPACIONAL') || 
                       model.includes('MULTIFOCAL') ||
                       model.includes('PROGRESIVO') ||
                       model.includes('OCUPACIONAL') ||
                       snapshotName.includes('MULTIFOCAL') ||
                       snapshotName.includes('PROGRESIVO') ||
                       snapshotName.includes('OCUPACIONAL') ||
                       snapshotBrand.includes('MULTIFOCAL') ||
                       snapshotBrand.includes('PROGRESIVO') ||
                       snapshotBrand.includes('OCUPACIONAL') ||
                       snapshotCategory.includes('MULTIFOCAL') ||
                       snapshotCategory.includes('PROGRESIVO') ||
                       snapshotCategory.includes('OCUPACIONAL');
            });

            // 3. Obtener días hábiles y límite
            const bizDays = getBusinessDays(new Date(order.createdAt), today);
            const threshold = isMultifocal ? 15 : 4;

            // Si no pasó el tiempo programado, omitir
            if (bizDays <= threshold) {
                continue;
            }

            // 4. Verificar si ya se envió la notificación/alerta para este pedido
            const hasBeenNotified = order.notifications && order.notifications.length > 0;
            if (hasBeenNotified) {
                continue;
            }

            // 5. Preparar email y link de pedido (ficha del cliente)
            const orderLink = `${appUrl}/admin/contactos?id=${order.clientId}`;
            const clientName = order.client?.name || 'Cliente sin nombre';
            const clientPhone = order.client?.phone || '';
            const createdAtStr = new Date(order.createdAt).toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const emailSubject = 'Atencion pedido con saldo';
            const emailText = `Atelier Óptica\n\nAtención: Pedido con saldo vencido.\nCliente: ${clientName}\nTeléfono: ${clientPhone || 'No registrado'}\nFecha: ${createdAtStr}\nDías hábiles transcurridos: ${bizDays} (Límite: ${threshold} días)\n\nDetalle Financiero:\n- Total Lista: $${financials.listPrice.toLocaleString('es-AR')}\n- Total Abonado: $${financials.paidReal.toLocaleString('es-AR')}\n- Saldo Pendiente (Tarjeta): $${financials.remainingCard.toLocaleString('es-AR')}\n- Saldo Pendiente (Efectivo): $${financials.remainingCash.toLocaleString('es-AR')}\n- Saldo Pendiente (Transf): $${financials.remainingTransfer.toLocaleString('es-AR')}\n\nEnlace al pedido: ${orderLink}`;

            const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Atencion pedido con saldo</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #faf8f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding: 40px 20px;">
                        <tr>
                            <td align="center">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e8e2db; box-shadow: 0 4px 12px rgba(67, 56, 49, 0.04); overflow: hidden;">
                                    <tr>
                                        <td style="height: 6px; background-color: #ef4444;"></td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f5f0eb;">
                                            <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 2px; color: #433831; text-transform: uppercase;">ATELIER ÓPTICA</h1>
                                            <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 800; color: #ef4444; letter-spacing: 1px; text-transform: uppercase;">Alerta: Pedido con Saldo Pendiente</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 32px 32px 24px 32px;">
                                            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #706359;">
                                                El siguiente pedido ha superado el tiempo programado sin haber sido cancelado en su totalidad.
                                            </p>
                                            
                                            <!-- Detalle del Cliente -->
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: #faf8f5; border-radius: 12px; border: 1px solid #e8e2db; padding: 20px;">
                                                <tr>
                                                    <td style="padding-bottom: 8px; font-size: 12px; font-weight: 700; color: #a8a095; text-transform: uppercase; width: 180px;">Cliente:</td>
                                                    <td style="padding-bottom: 8px; font-size: 14px; font-weight: 700; color: #433831;">${clientName}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding-bottom: 8px; font-size: 12px; font-weight: 700; color: #a8a095; text-transform: uppercase;">Teléfono:</td>
                                                    <td style="padding-bottom: 8px; font-size: 14px; color: #433831;">${clientPhone || 'No registrado'}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding-bottom: 8px; font-size: 12px; font-weight: 700; color: #a8a095; text-transform: uppercase;">Fecha de Creación:</td>
                                                    <td style="padding-bottom: 8px; font-size: 14px; color: #433831;">${createdAtStr}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding-bottom: 8px; font-size: 12px; font-weight: 700; color: #a8a095; text-transform: uppercase;">Días Hábiles Transcurridos:</td>
                                                    <td style="padding-bottom: 8px; font-size: 14px; font-weight: 700; color: #ef4444;">${bizDays} días hábiles (Límite: ${threshold} días)</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding-bottom: 8px; font-size: 12px; font-weight: 700; color: #a8a095; text-transform: uppercase;">Tipo de Pedido:</td>
                                                    <td style="padding-bottom: 8px; font-size: 14px; color: #433831;">${isMultifocal ? 'Multifocal (Límite 15 días)' : 'Monofocal/Otro (Límite 4 días)'}</td>
                                                </tr>
                                            </table>

                                            <!-- Detalle Financiero -->
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px; background-color: #faf8f5; border-radius: 12px; border: 1px solid #e8e2db; padding: 20px;">
                                                <tr>
                                                    <td style="padding-bottom: 8px; font-size: 12px; font-weight: 700; color: #a8a095; text-transform: uppercase;">Total de Lista:</td>
                                                    <td style="padding-bottom: 8px; font-size: 14px; text-align: right; color: #433831;">$${financials.listPrice.toLocaleString('es-AR')}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding-bottom: 8px; font-size: 12px; font-weight: 700; color: #a8a095; text-transform: uppercase;">Total Abonado Real:</td>
                                                    <td style="padding-bottom: 8px; font-size: 14px; text-align: right; color: #433831;">$${financials.paidReal.toLocaleString('es-AR')}</td>
                                                </tr>
                                                <tr>
                                                    <td style="border-top: 1px solid #e8e2db; padding-top: 8px; font-size: 14px; font-weight: 700; color: #433831; text-transform: uppercase;">Saldo Pendiente (Tarjeta):</td>
                                                    <td style="border-top: 1px solid #e8e2db; padding-top: 8px; font-size: 16px; font-weight: 900; text-align: right; color: #ef4444;">$${financials.remainingCard.toLocaleString('es-AR')}</td>
                                                </tr>
                                                <tr>
                                                    <td style="font-size: 11px; font-weight: 700; color: #a8a095; text-transform: uppercase;">Saldo Pendiente (Efectivo):</td>
                                                    <td style="font-size: 12px; text-align: right; color: #16a34a;">$${financials.remainingCash.toLocaleString('es-AR')}</td>
                                                </tr>
                                                <tr>
                                                    <td style="font-size: 11px; font-weight: 700; color: #a8a095; text-transform: uppercase;">Saldo Pendiente (Transferencia):</td>
                                                    <td style="font-size: 12px; text-align: right; color: #7c3aed;">$${financials.remainingTransfer.toLocaleString('es-AR')}</td>
                                                </tr>
                                            </table>

                                            <!-- Botón de Acción -->
                                            <div style="text-align: center; margin-bottom: 12px;">
                                                <a href="${orderLink}" style="display: inline-block; padding: 14px 28px; background-color: #433831; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 6px rgba(67, 56, 49, 0.15); transition: background-color 0.2s;">
                                                    Ver Ficha del Pedido / Cliente
                                                </a>
                                            </div>
                                            <p style="text-align: center; margin: 0; font-size: 12px; color: #9e7f65;">
                                                <a href="${orderLink}" style="color: #9e7f65; text-decoration: underline;">${orderLink}</a>
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="background-color: #faf8f5; padding: 24px 32px; text-align: center; border-top: 1px solid #f5f0eb; font-size: 11px; color: #a8a095;">
                                            <p style="margin: 0 0 4px 0; font-weight: 700;">Atelier Óptica - Sistema CRM</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `;

            console.log(`[Cron Overdue Balances] Enviando alerta de saldo para orden ${order.id} a ${adminEmail}`);
            
            // Enviar email
            const emailResult = await sendEmail({
                to: adminEmail,
                subject: emailSubject,
                text: emailText,
                html: emailHtml,
            });

            if (emailResult.success) {
                // Crear notificación en la DB para prevenir duplicados futuros
                await prisma.notification.create({
                    data: {
                        type: 'BALANCE_OVERDUE',
                        status: 'PENDING',
                        message: `Pedido de ${clientName} con saldo vencido ($${financials.remainingCard.toLocaleString('es-AR')}) tras ${bizDays} días hábiles`,
                        orderId: order.id,
                        requestedBy: 'Sistema'
                    }
                });

                results.push({
                    orderId: order.id,
                    clientName,
                    remainingCard: financials.remainingCard,
                    bizDays,
                    status: 'NOTIFIED'
                });
            } else {
                results.push({
                    orderId: order.id,
                    clientName,
                    status: 'EMAIL_FAILED',
                    error: emailResult.error
                });
            }
        }

        return NextResponse.json({
            success: true,
            processedCount: results.length,
            details: results
        });

    } catch (error: any) {
        console.error('[Cron Overdue Balances] Error inesperado:', error);
        return NextResponse.json({ error: error.message || 'Error en el servidor' }, { status: 500 });
    }
}
