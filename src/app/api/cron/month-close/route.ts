import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { ReportService } from '@/services/report.service';
import { PricingService } from '@/services/PricingService';
import { METHOD_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function money(n: number): string {
    return `$${Math.round(n).toLocaleString('es-AR')}`;
}

function formatDate(date: Date | string): string {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Fila del estado de resultados (la "cuenta del cierre")
function pnlRow(label: string, amount: number, opts: { sign?: '+' | '-'; bold?: boolean; color?: string } = {}): string {
    const { sign = '-', bold = false, color } = opts;
    const displayColor = color || (bold ? '#433831' : '#706359');
    const amountColor = color || (sign === '-' ? '#b45309' : '#433831');
    return `
        <tr style="border-bottom: 1px dotted #f0eae4;">
            <td style="padding: 7px 0; font-size: 12px; color: ${displayColor}; font-weight: ${bold ? 800 : 500};">${label}</td>
            <td style="padding: 7px 0; text-align: right; font-size: 12px; font-weight: ${bold ? 900 : 700}; color: ${amountColor}; white-space: nowrap;">${sign === '-' ? '− ' : ''}${money(Math.abs(amount))}</td>
        </tr>
    `;
}

function sectionTitle(title: string): string {
    return `<h3 style="margin: 28px 0 10px 0; font-size: 13px; font-weight: 800; color: #433831; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 2px solid #9e7f65; padding-bottom: 6px;">${title}</h3>`;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
        }
        if (secret !== cronSecret && token !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // ── Período: ?month=YYYY-MM manda; si no, los primeros días del mes
        // reportan el mes anterior completo (el cron corre el día 1).
        const monthParam = searchParams.get('month');
        let year: number;
        let month: number; // 1-12
        if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
            year = parseInt(monthParam.slice(0, 4), 10);
            month = parseInt(monthParam.slice(5, 7), 10);
        } else {
            const now = new Date();
            if (now.getDate() <= 3) {
                const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                year = prev.getFullYear();
                month = prev.getMonth() + 1;
            } else {
                year = now.getFullYear();
                month = now.getMonth() + 1;
            }
        }

        const lastDay = new Date(year, month, 0).getDate();
        // Mismo formato yyyy-MM-dd que usa /admin/reportes: los números del email
        // tienen que coincidir con los del dashboard.
        const from = `${year}-${String(month).padStart(2, '0')}-01`;
        const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

        const data = await ReportService.generateReportData(from, to);
        const s = data.summary;

        // ── Saldos pendientes con la fuente de verdad (PricingService):
        // el totalPending del reporte es lista − pagado y sobreestima el saldo
        // de quien pagó contado/transferencia con descuento.
        const dateFilter = { gte: new Date(from), lte: new Date(`${to}T23:59:59.999`) };
        const monthOrders = await prisma.order.findMany({
            where: {
                orderType: 'SALE',
                isDeleted: false,
                OR: [
                    { labSentAt: dateFilter },
                    { AND: [{ labSentAt: null }, { createdAt: dateFilter }] },
                ],
            },
            select: {
                id: true,
                createdAt: true,
                subtotalWithMarkup: true,
                paid: true,
                discountCash: true,
                discountTransfer: true,
                client: { select: { name: true, phone: true } },
                user: { select: { name: true } },
                payments: { select: { amount: true, method: true } },
            },
        });

        const pendingOrders: { client: string; vendor: string; date: Date; listPrice: number; paidReal: number; remainingList: number }[] = [];
        let totalPendingReal = 0;
        for (const order of monthOrders) {
            const fin = PricingService.calculateOrderFinancials(order);
            if (fin.hasBalance) {
                totalPendingReal += fin.remainingList;
                pendingOrders.push({
                    client: order.client?.name || 'Cliente desconocido',
                    vendor: order.user?.name || 'Sin asignar',
                    date: order.createdAt,
                    listPrice: fin.listPrice,
                    paidReal: fin.paidReal,
                    remainingList: fin.remainingList,
                });
            }
        }
        pendingOrders.sort((a, b) => b.remainingList - a.remainingList);

        // ── Números del cierre ──
        const billed = data.salesDetail.reduce((sum: number, o: any) => sum + (o.totalList || 0), 0); // facturación a valor de lista
        const collected = s.totalRevenue; // cobrado real
        const totalIncomeIfCollected = collected + totalPendingReal;
        // Descuentos ya otorgados por medio de pago (contado/transferencia)
        const paymentDiscounts = Math.max(0, billed - collected - totalPendingReal);

        const totalExpenses = s.totalFixedCosts + s.totalMarketingCosts;
        const projectedProfit = s.netProfit + totalPendingReal; // ganancia si se cobra todo

        // ── Ventas por vendedor (a valor de lista, criterio del dashboard de objetivos) ──
        const vendorAgg: Record<string, { name: string; billed: number; collected: number; orders: number }> = {};
        for (const sale of data.salesDetail) {
            const name = sale.vendorName || 'Sin asignar';
            if (!vendorAgg[name]) vendorAgg[name] = { name, billed: 0, collected: 0, orders: 0 };
            vendorAgg[name].billed += sale.totalList || 0;
            vendorAgg[name].collected += sale.totalPaid || 0;
            vendorAgg[name].orders += 1;
        }
        const vendors = Object.values(vendorAgg).sort((a, b) => b.billed - a.billed);

        // ── HTML ──
        const vendorRows = vendors.map(v => `
            <tr style="border-bottom: 1px dotted #f0eae4;">
                <td style="padding: 8px 0; font-weight: 700; color: #433831; font-size: 12px;">${v.name}</td>
                <td style="padding: 8px 0; text-align: center; color: #706359; font-size: 12px;">${v.orders}</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #433831; font-size: 12px;">${money(v.billed)}</td>
                <td style="padding: 8px 0; text-align: right; color: #706359; font-size: 12px;">${money(v.collected)}</td>
            </tr>
        `).join('');

        const paymentRows = data.paymentMethods.map((pm: any) => `
            <tr style="border-bottom: 1px dotted #f0eae4;">
                <td style="padding: 7px 0; color: #433831; font-weight: 600; font-size: 12px;">${METHOD_LABELS[pm.method] || pm.method}</td>
                <td style="padding: 7px 0; text-align: right; color: #706359; font-size: 12px;">${money(pm.total)}</td>
                <td style="padding: 7px 0; text-align: right; font-weight: 700; font-size: 12px; color: ${pm.commission > 0 ? '#b45309' : '#a8a095'};">${pm.commission > 0 ? `− ${money(pm.commission)}` : '—'}</td>
            </tr>
        `).join('');

        const expenseItems = (data.fixedCosts || []).filter((fc: any) => fc.month === month && fc.year === year && (fc.amount || 0) > 0);
        const expenseTypeLabel: Record<string, string> = { FIJO: 'Fijo', MARKETING: 'Marketing', PROVEEDOR: 'Proveedor', OTRO: 'Otro' };
        const expenseRows = expenseItems.map((fc: any) => `
            <tr style="border-bottom: 1px dotted #f0eae4;">
                <td style="padding: 7px 0; color: #433831; font-weight: 600; font-size: 12px;">${fc.name}</td>
                <td style="padding: 7px 0; text-align: center; color: #a8a095; font-size: 11px;">${expenseTypeLabel[fc.type] || fc.type || 'Fijo'}</td>
                <td style="padding: 7px 0; text-align: right; font-weight: 700; color: #433831; font-size: 12px;">${money(fc.amount)}</td>
            </tr>
        `).join('') || `<tr><td colspan="3" style="padding: 12px 0; text-align: center; color: #a8a095; font-style: italic; font-size: 12px;">No hay gastos cargados para este mes.</td></tr>`;

        const pendingRows = pendingOrders.map(p => `
            <tr style="border-bottom: 1px dotted #f0eae4;">
                <td style="padding: 8px 0; color: #706359; font-size: 11px;">${formatDate(p.date)}</td>
                <td style="padding: 8px 0; font-weight: 700; color: #433831; font-size: 11px;">${p.client}</td>
                <td style="padding: 8px 0; color: #706359; font-size: 11px;">${p.vendor}</td>
                <td style="padding: 8px 0; text-align: right; color: #706359; font-size: 11px;">${money(p.listPrice)}</td>
                <td style="padding: 8px 0; text-align: right; color: #706359; font-size: 11px;">${money(p.paidReal)}</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 800; color: #b45309; font-size: 11px;">${money(p.remainingList)}</td>
            </tr>
        `).join('');

        const pendingSection = pendingOrders.length > 0 ? `
            ${sectionTitle(`Saldos pendientes del mes (${pendingOrders.length})`)}
            <p style="margin: 0 0 10px 0; font-size: 11px; color: #a8a095;">Saldo a valor de lista. Si pagan en efectivo o transferencia, el monto final es menor por el descuento.</p>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid #e8e2db;">
                        <th style="text-align: left; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Fecha</th>
                        <th style="text-align: left; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Cliente</th>
                        <th style="text-align: left; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Vendedor</th>
                        <th style="text-align: right; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Total</th>
                        <th style="text-align: right; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Pagado</th>
                        <th style="text-align: right; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Saldo</th>
                    </tr>
                </thead>
                <tbody>${pendingRows}</tbody>
            </table>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; background-color: #fffbeb; border-radius: 8px;">
                <tr>
                    <td style="padding: 12px 14px; font-weight: 800; color: #78350f; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Total por cobrar</td>
                    <td style="padding: 12px 14px; text-align: right; font-weight: 900; color: #b45309; font-size: 15px;">${money(totalPendingReal)}</td>
                </tr>
            </table>
        ` : `
            ${sectionTitle('Saldos pendientes del mes')}
            <p style="margin: 8px 0; font-size: 12px; color: #15803d; font-weight: 700;">✓ No quedan saldos pendientes de este mes. Todo cobrado.</p>
        `;

        const providerNote = s.totalProviderCosts > 0
            ? `<p style="margin: 10px 0 0 0; font-size: 11px; color: #a8a095;">Además se registraron <strong>${money(s.totalProviderCosts)}</strong> en compras a proveedores (mercadería); no se descuentan de la ganancia del mes.</p>`
            : '';

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Cierre de Mes</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #faf8f5; -webkit-text-size-adjust: none; text-size-adjust: none;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #faf8f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e8e2db; box-shadow: 0 4px 12px rgba(67, 56, 49, 0.04); overflow: hidden;">
                                <tr><td style="height: 6px; background-color: #9e7f65;"></td></tr>

                                <tr>
                                    <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f5f0eb;">
                                        <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 2px; color: #433831; text-transform: uppercase;">ATELIER ÓPTICA</h1>
                                        <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 800; color: #9e7f65; letter-spacing: 1px; text-transform: uppercase;">Cierre de Mes — ${monthLabel}</p>
                                    </td>
                                </tr>

                                <!-- Números principales -->
                                <tr>
                                    <td style="padding: 24px 32px; background-color: #faf8f5; border-bottom: 1px solid #f5f0eb;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td style="vertical-align: top; width: 50%; padding-bottom: 16px;">
                                                    <span style="font-size: 10px; font-weight: 800; color: #9e7f65; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Facturación total (lista)</span>
                                                    <span style="font-size: 22px; font-weight: 900; color: #433831;">${money(billed)}</span>
                                                    <span style="font-size: 10px; color: #a8a095; display: block;">${s.ordersCount} ventas</span>
                                                </td>
                                                <td style="vertical-align: top; width: 50%; padding-bottom: 16px; text-align: right;">
                                                    <span style="font-size: 10px; font-weight: 800; color: #9e7f65; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Ganancia del mes*</span>
                                                    <span style="font-size: 22px; font-weight: 900; color: ${projectedProfit >= 0 ? '#15803d' : '#dc2626'};">${money(projectedProfit)}</span>
                                                    <span style="font-size: 10px; color: #a8a095; display: block;">*con todos los saldos cobrados</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="vertical-align: top;">
                                                    <span style="font-size: 10px; font-weight: 800; color: #9e7f65; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Cobrado real</span>
                                                    <span style="font-size: 15px; font-weight: 800; color: #433831;">${money(collected)}</span>
                                                </td>
                                                <td style="vertical-align: top; text-align: right;">
                                                    <span style="font-size: 10px; font-weight: 800; color: #9e7f65; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Saldos por cobrar</span>
                                                    <span style="font-size: 15px; font-weight: 800; color: ${totalPendingReal > 0 ? '#b45309' : '#15803d'};">${money(totalPendingReal)}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <tr>
                                    <td style="padding: 8px 32px 32px 32px;">

                                        ${sectionTitle('Ventas por vendedor')}
                                        <table style="width: 100%; border-collapse: collapse;">
                                            <thead>
                                                <tr style="border-bottom: 1px solid #e8e2db;">
                                                    <th style="text-align: left; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Vendedor</th>
                                                    <th style="text-align: center; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Ventas</th>
                                                    <th style="text-align: right; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Facturado</th>
                                                    <th style="text-align: right; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Cobrado</th>
                                                </tr>
                                            </thead>
                                            <tbody>${vendorRows}</tbody>
                                        </table>

                                        ${sectionTitle('Cobros por medio de pago y comisiones')}
                                        <table style="width: 100%; border-collapse: collapse;">
                                            <thead>
                                                <tr style="border-bottom: 1px solid #e8e2db;">
                                                    <th style="text-align: left; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Medio</th>
                                                    <th style="text-align: right; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Cobrado</th>
                                                    <th style="text-align: right; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Comisión</th>
                                                </tr>
                                            </thead>
                                            <tbody>${paymentRows}</tbody>
                                        </table>

                                        ${sectionTitle('Gastos del mes')}
                                        <table style="width: 100%; border-collapse: collapse;">
                                            <tbody>${expenseRows}</tbody>
                                        </table>

                                        ${sectionTitle('La cuenta del cierre (si se cobra todo)')}
                                        <div style="background-color: #faf8f5; border-radius: 12px; padding: 16px 18px; border: 1px solid #f0eae4;">
                                            <table style="width: 100%; border-collapse: collapse;">
                                                ${pnlRow('Ingresos totales (cobrado + saldos por cobrar)', totalIncomeIfCollected, { sign: '+', bold: true })}
                                                ${pnlRow('Laboratorio (costo de cristales)', s.totalCostLenses)}
                                                ${pnlRow('Costo de armazones', s.totalCostFrames)}
                                                ${s.totalCostOther > 0 ? pnlRow('Otros costos de mercadería', s.totalCostOther) : ''}
                                                ${s.totalPostSaleCosts > 0 ? pnlRow('Costos de posventa / garantías', s.totalPostSaleCosts) : ''}
                                                ${pnlRow('Comisiones PayWay / plataformas', s.totalPlatformFees)}
                                                ${pnlRow('Honorarios médicos (15%)', s.totalDoctorFees)}
                                                ${s.totalSpecialDiscounts > 0 ? pnlRow('Descuentos especiales', s.totalSpecialDiscounts) : ''}
                                                ${pnlRow('Gastos fijos', s.totalFixedCosts)}
                                                ${s.totalMarketingCosts > 0 ? pnlRow('Marketing', s.totalMarketingCosts) : ''}
                                                <tr>
                                                    <td style="padding: 12px 0 4px 0; font-size: 13px; font-weight: 900; color: #433831; text-transform: uppercase; letter-spacing: 0.5px; border-top: 2px solid #9e7f65;">Ganancia del mes</td>
                                                    <td style="padding: 12px 0 4px 0; text-align: right; font-size: 17px; font-weight: 900; color: ${projectedProfit >= 0 ? '#15803d' : '#dc2626'}; border-top: 2px solid #9e7f65; white-space: nowrap;">${money(projectedProfit)}</td>
                                                </tr>
                                            </table>
                                            <p style="margin: 10px 0 0 0; font-size: 11px; color: #a8a095;">Con lo cobrado hasta hoy la ganancia es <strong>${money(s.netProfit)}</strong>. Los descuentos por pago contado/transferencia ya otorgados suman <strong>${money(paymentDiscounts)}</strong> (diferencia entre lista y lo que entra).</p>
                                            ${providerNote}
                                        </div>

                                        ${pendingSection}

                                    </td>
                                </tr>

                                <tr>
                                    <td style="background-color: #faf8f5; padding: 24px 32px; text-align: center; border-top: 1px solid #f5f0eb; font-size: 11px; color: #a8a095;">
                                        <p style="margin: 0 0 4px 0; font-weight: 700;">Atelier Óptica - Sistema CRM</p>
                                        <p style="margin: 0;">Cierre generado automáticamente el ${formatDate(new Date())} · Período ${formatDate(new Date(`${from}T12:00:00`))} al ${formatDate(new Date(`${to}T12:00:00`))}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        // Vista previa en el navegador sin mandar el mail: ?dryRun=1
        if (searchParams.get('dryRun')) {
            return new NextResponse(emailHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        const emailTo = process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';
        const emailSubject = `Cierre de Mes ${monthLabel}: Facturación ${money(billed)} · Ganancia ${money(projectedProfit)} - Atelier Óptica`;
        const emailText = [
            `Cierre de Mes ${monthLabel} - Atelier Óptica`,
            `Facturación total (lista): ${money(billed)}`,
            `Cobrado real: ${money(collected)}`,
            `Saldos por cobrar: ${money(totalPendingReal)}`,
            `Ganancia del mes (si se cobra todo): ${money(projectedProfit)}`,
            '',
            'Revisá el formato HTML en tu cliente de correo.',
        ].join('\n');

        console.log(`[Cron Month-Close] Enviando cierre de ${monthLabel} a ${emailTo}...`);
        const emailResult = await sendEmail({
            to: emailTo,
            subject: emailSubject,
            text: emailText,
            html: emailHtml,
        });

        if (!emailResult.success) {
            console.error('[Cron Month-Close] Error al enviar correo:', emailResult.error);
            return NextResponse.json({
                success: false,
                error: 'Error al enviar correo',
                details: emailResult.error,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Cierre de ${monthLabel} enviado exitosamente`,
            emailMessageId: emailResult.messageId,
            period: { from, to },
            summary: {
                billed: Math.round(billed),
                collected: Math.round(collected),
                pending: Math.round(totalPendingReal),
                pendingOrders: pendingOrders.length,
                projectedProfit: Math.round(projectedProfit),
                realProfit: Math.round(s.netProfit),
                expenses: Math.round(totalExpenses),
                platformFees: Math.round(s.totalPlatformFees),
                labCosts: Math.round(s.totalCostLenses),
                doctorFees: Math.round(s.totalDoctorFees),
            },
        });

    } catch (error: any) {
        console.error('[Cron Month-Close] Error inesperado:', error);
        return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
    }
}
