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
        const results: any[] = [];
        // Acumulador del digest: un solo email diario con TODOS los saldos
        // vencidos nuevos, en vez de un correo por pedido (nadie leía nada).
        const pendientes: any[] = [];
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
        const adminEmail = process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';

        for (const order of activeOrders) {
            // 1. Calcular desglose financiero
            const financials = PricingService.calculateOrderFinancials(order);

            // Si no tiene saldo pendiente (tolerancia > 1000), omitir
            if (!financials.hasBalance) {
                continue;
            }

            // 2. Determinar tipo de cristal para el threshold de vencimiento
            const buildItemFullStr = (item: any) => {
                const type = item.product?.type?.toUpperCase() || '';
                const category = item.product?.category?.toUpperCase() || '';
                const name = (item.product?.name || '').toUpperCase();
                const model = (item.product?.model || '').toUpperCase();
                const snapshotName = (item.productNameSnapshot || '').toUpperCase();
                const snapshotBrand = (item.productBrandSnapshot || '').toUpperCase();
                const snapshotCategory = (item.productCategorySnapshot || '').toUpperCase();
                return `${type} ${category} ${name} ${model} ${snapshotName} ${snapshotBrand} ${snapshotCategory}`;
            };

            // Stellest: 25 días hábiles de entrega
            const isStellest = order.items.some((item: any) => {
                return buildItemFullStr(item).includes('STELLEST');
            });

            // Multifocal/Progresivo/Ocupacional/Bifocal/etc: 15 días hábiles
            const isMultifocal = !isStellest && order.items.some((item: any) => {
                const fullStr = buildItemFullStr(item);
                return fullStr.includes('MULTIFOCAL') || 
                       fullStr.includes('PROGRESIVO') || 
                       fullStr.includes('OCUPACIONAL') ||
                       fullStr.includes('BIFOCAL') ||
                       fullStr.includes('MYOFIX') ||
                       fullStr.includes('MYOPILUX') ||
                       fullStr.includes('MIYOSMART');
            });

            // 3. Obtener días hábiles y límite
            const bizDays = getBusinessDays(new Date(order.createdAt), today);
            const threshold = isStellest ? 25 : isMultifocal ? 15 : 4;

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

            // Digest diario (pedido de Ishtar 27/8): NADA de un email por
            // pedido — se acumula y al final sale UN solo correo con todos.
            pendientes.push({
                orderId: order.id,
                clientName,
                clientPhone,
                createdAtStr,
                bizDays,
                threshold,
                saldoLista: financials.remainingCard,
                saldoEfectivo: financials.remainingCash,
                saldoTransfer: financials.remainingTransfer,
                abonado: financials.paidReal,
                total: financials.listPrice,
                orderLink,
            });
        }

        // ── UN solo email con todos los saldos vencidos nuevos del día ──
        if (pendientes.length > 0) {
            const filas = pendientes.map(pd => `
                <tr>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;"><a href="${pd.orderLink}" style="color:#1e3a8a;font-weight:bold;">${pd.clientName}</a><br/><span style="color:#888;font-size:11px;">${pd.clientPhone || 'sin teléfono'} · pedido del ${pd.createdAtStr}</span></td>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${pd.bizDays} días<br/><span style="color:#888;font-size:11px;">(límite ${pd.threshold})</span></td>
                    <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;"><strong>$${pd.saldoLista.toLocaleString('es-AR')}</strong><br/><span style="color:#888;font-size:11px;">efvo $${pd.saldoEfectivo.toLocaleString('es-AR')} · transf $${pd.saldoTransfer.toLocaleString('es-AR')}</span></td>
                </tr>`).join('');

            const totalSaldos = pendientes.reduce((a, pd) => a + pd.saldoLista, 0);
            const emailResult = await sendEmail({
                to: adminEmail,
                subject: `Saldos vencidos: ${pendientes.length} pedido${pendientes.length === 1 ? '' : 's'} por $${totalSaldos.toLocaleString('es-AR')}`,
                text: pendientes.map(pd => `${pd.clientName} — ${pd.bizDays} días (límite ${pd.threshold}) — saldo lista $${pd.saldoLista.toLocaleString('es-AR')} — ${pd.orderLink}`).join('\n'),
                html: `
                    <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;">
                        <h2 style="font-size:16px;">Saldos vencidos — resumen del día</h2>
                        <p>${pendientes.length} pedido${pendientes.length === 1 ? '' : 's'} nuevo${pendientes.length === 1 ? '' : 's'} con saldo vencido, $${totalSaldos.toLocaleString('es-AR')} de lista en total.</p>
                        <table style="border-collapse:collapse;width:100%;max-width:640px;">
                            <tr style="background:#faf8f5;"><th style="padding:8px 10px;text-align:left;">Cliente</th><th style="padding:8px 10px;">Antigüedad</th><th style="padding:8px 10px;text-align:right;">Saldo (lista)</th></tr>
                            ${filas}
                        </table>
                        <p style="color:#888;font-size:12px;margin-top:16px;">Atelier Óptica · CRM — un solo aviso diario; cada pedido se lista una única vez.</p>
                    </div>`,
            });

            if (emailResult.success) {
                // Una notificación por pedido: es el candado anti-repetición de siempre
                await prisma.notification.createMany({
                    data: pendientes.map(pd => ({
                        type: 'BALANCE_OVERDUE',
                        status: 'PENDING',
                        message: `Pedido de ${pd.clientName} con saldo vencido ($${pd.saldoLista.toLocaleString('es-AR')}) tras ${pd.bizDays} días hábiles`,
                        orderId: pd.orderId,
                        requestedBy: 'Sistema',
                    })),
                });
                results.push(...pendientes.map(pd => ({ orderId: pd.orderId, clientName: pd.clientName, remainingCard: pd.saldoLista, bizDays: pd.bizDays, status: 'NOTIFIED' })));
            } else {
                results.push({ status: 'EMAIL_FAILED', error: emailResult.error, count: pendientes.length });
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
