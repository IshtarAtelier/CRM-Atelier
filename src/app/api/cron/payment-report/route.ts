import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    EFECTIVO: 'Efectivo',
    DEBIT: 'Débito',
    CREDIT: 'Crédito (1 pago)',
    CREDIT_3: '3 Cuotas S/I',
    CREDIT_6: '6 Cuotas S/I',
    PLAN_Z: 'Plan Z',
    TRANSFER: 'Transferencia',
    TRANSFERENCIA_ISHTAR: 'Transf. Ishtar',
    TRANSFERENCIA_LUCIA: 'Transf. Lucía',
    PAY_WAY_3_ISH: 'PayWay 3c Ish',
    PAY_WAY_3_YANI: 'PayWay 3c Yani',
    PAY_WAY_6_ISH: 'PayWay 6c Ish',
    PAY_WAY_6_YANI: 'PayWay 6c Yani',
    NARANJA_Z_ISH: 'Naranja Z Ish',
    NARANJA_Z_YANI: 'Naranja Z Yani',
    GO_CUOTAS: 'Go Cuotas',
    GO_CUOTAS_ISH: 'Go Cuotas Ish',
};

function getAccountName(method: string): string {
    if (['PAY_WAY_6_ISH', 'PAY_WAY_3_ISH', 'NARANJA_Z_ISH', 'GO_CUOTAS_ISH', 'TRANSFERENCIA_ISHTAR'].includes(method)) {
        return 'Cuenta Ishtar';
    }
    if (['PAY_WAY_6_YANI', 'PAY_WAY_3_YANI', 'NARANJA_Z_YANI'].includes(method)) {
        return 'Cuenta Yani';
    }
    if (method === 'TRANSFERENCIA_LUCIA') {
        return 'Cuenta Lucía';
    }
    if (['EFECTIVO', 'CASH'].includes(method)) {
        return 'Efectivo / Caja';
    }
    return 'Otros / Sin Clasificar';
}

function formatDate(date: Date): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        // Check header authorization as well
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
        }

        if (secret !== cronSecret && token !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');

        let startDate: Date;
        let endDate: Date;

        if (fromParam && toParam) {
            startDate = new Date(fromParam);
            endDate = new Date(toParam);
            if (!toParam.includes('T')) {
                endDate.setHours(23, 59, 59, 999);
            }
        } else {
            const today = new Date();
            const dayOfMonth = today.getDate();

            if (dayOfMonth === 1) {
                // First of the month: Report the entire previous month
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0, 0);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
            } else {
                // Mid month (e.g. 15th) or manual trigger: Report current month from 1st to today
                startDate = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            }
        }

        // Fetch payments
        const payments = await prisma.payment.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
                order: {
                    isDeleted: false,
                },
            },
            include: {
                order: {
                    include: {
                        client: true,
                    },
                },
            },
            orderBy: {
                date: 'desc',
            },
        });

        // Initialize account structures
        const accounts: Record<string, { name: string; total: number; payments: any[]; methodSubtotals: Record<string, number> }> = {
            'Cuenta Ishtar': { name: 'Cuenta Ishtar', total: 0, payments: [], methodSubtotals: {} },
            'Cuenta Yani': { name: 'Cuenta Yani', total: 0, payments: [], methodSubtotals: {} },
            'Cuenta Lucía': { name: 'Cuenta Lucía', total: 0, payments: [], methodSubtotals: {} },
            'Efectivo / Caja': { name: 'Efectivo / Caja', total: 0, payments: [], methodSubtotals: {} },
            'Otros / Sin Clasificar': { name: 'Otros / Sin Clasificar', total: 0, payments: [], methodSubtotals: {} },
        };

        let grandTotal = 0;
        let paywayIshTotal = 0;

        for (const p of payments) {
            const accName = getAccountName(p.method);
            const group = accounts[accName] || accounts['Otros / Sin Clasificar'];

            group.payments.push(p);
            group.total += p.amount;

            const label = METHOD_LABELS[p.method] || p.method;
            group.methodSubtotals[label] = (group.methodSubtotals[label] || 0) + p.amount;

            grandTotal += p.amount;

            if (p.method === 'PAY_WAY_3_ISH' || p.method === 'PAY_WAY_6_ISH') {
                paywayIshTotal += p.amount;
            }
        }

        const showPaywayWarning = paywayIshTotal > 5000000;

        // Generate HTML Report
        const periodStr = `${formatDate(startDate)} al ${formatDate(endDate)}`;
        
        let accountsHtml = '';
        for (const key of Object.keys(accounts)) {
            const group = accounts[key];
            if (group.payments.length === 0 && group.total === 0) {
                // For a cleaner look, skip empty accounts
                continue;
            }

            const methodRows = Object.entries(group.methodSubtotals)
                .map(([method, total]) => `
                    <tr>
                        <td style="padding: 4px 0; font-weight: 600; color: #5a4e45;">${method}</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #433831;">$${total.toLocaleString('es-AR')}</td>
                    </tr>
                `).join('');

            const paymentRows = group.payments.map((p) => {
                const clientName = p.order?.client?.name || 'Cliente desconocido';
                const methodLabel = METHOD_LABELS[p.method] || p.method;
                const detail = p.notes ? `${methodLabel} (${p.notes})` : methodLabel;
                return `
                    <tr style="border-bottom: 1px dotted #f0eae4;">
                        <td style="padding: 8px 0; color: #706359; font-size: 11px;">${formatDate(p.date)}</td>
                        <td style="padding: 8px 0; font-weight: 700; color: #433831; font-size: 11px;">${clientName}</td>
                        <td style="padding: 8px 0; color: #706359; font-size: 11px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${detail}</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #433831; font-size: 11px;">$${p.amount.toLocaleString('es-AR')}</td>
                    </tr>
                `;
            }).join('');

            accountsHtml += `
                <div style="padding: 24px 0; border-bottom: 1px solid #f5f0eb;">
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
                        <tr>
                            <td>
                                <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #433831; text-transform: uppercase; letter-spacing: 0.5px;">${group.name}</h3>
                            </td>
                            <td style="text-align: right;">
                                <span style="font-size: 15px; font-weight: 900; color: #9e7f65;">$${group.total.toLocaleString('es-AR')}</span>
                            </td>
                        </tr>
                    </table>
                    
                    <div style="background-color: #faf8f5; border-radius: 8px; padding: 12px; margin-bottom: 14px; border: 1px solid #f0eae4;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            ${methodRows}
                        </table>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
                        <thead>
                            <tr style="border-bottom: 1px solid #e8e2db;">
                                <th style="text-align: left; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Fecha</th>
                                <th style="text-align: left; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Cliente</th>
                                <th style="text-align: left; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Detalle</th>
                                <th style="text-align: right; padding-bottom: 6px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; color: #a8a095;">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paymentRows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // If all groups are empty
        if (payments.length === 0) {
            accountsHtml = `
                <div style="padding: 40px 0; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #a8a095; font-style: italic;">No se registraron cobros durante este período.</p>
                </div>
            `;
        }

        const warningBannerHtml = showPaywayWarning ? `
            <div style="background-color: #fffbeb; border: 1px solid #f59e0b; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <span style="color: #b45309; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">⚠️ ALERTA: Límite PayWay Ishtar</span>
                <span style="color: #78350f; font-size: 12px; font-weight: 500; line-height: 1.4; display: block;">
                    La suma acumulada de PayWay Ishtar 3 y 6 cuotas es de <strong>$${paywayIshTotal.toLocaleString('es-AR')}</strong>, superando el límite mensual establecido de $5.000.000.
                </span>
            </div>
        ` : '';

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reporte de Cobros</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #faf8f5; -webkit-text-size-adjust: none; text-size-adjust: none;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #faf8f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <!-- Main Container Card -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e8e2db; box-shadow: 0 4px 12px rgba(67, 56, 49, 0.04); overflow: hidden;">
                                <!-- Top Accent Bar -->
                                <tr>
                                    <td style="height: 6px; background-color: #9e7f65;"></td>
                                </tr>
                                
                                <!-- Brand Header -->
                                <tr>
                                    <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f5f0eb;">
                                        <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 2px; color: #433831; text-transform: uppercase;">ATELIER ÓPTICA</h1>
                                        <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 800; color: #9e7f65; letter-spacing: 1px; text-transform: uppercase;">Resumen Consolidado de Cobros</p>
                                    </td>
                                </tr>

                                <!-- Period & Grand Total Info -->
                                <tr>
                                    <td style="padding: 24px 32px; background-color: #faf8f5; border-bottom: 1px solid #f5f0eb;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td style="vertical-align: middle;">
                                                    <span style="font-size: 10px; font-weight: 800; color: #9e7f65; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Período Reportado</span>
                                                    <span style="font-size: 14px; font-weight: 700; color: #433831;">${periodStr}</span>
                                                </td>
                                                <td style="text-align: right; vertical-align: middle;">
                                                    <span style="font-size: 10px; font-weight: 800; color: #9e7f65; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Total Recaudado</span>
                                                    <span style="font-size: 22px; font-weight: 900; color: #433831;">$${grandTotal.toLocaleString('es-AR')}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Accounts Details & List -->
                                <tr>
                                    <td style="padding: 8px 32px 32px 32px;">
                                        ${warningBannerHtml}
                                        ${accountsHtml}
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #faf8f5; padding: 24px 32px; text-align: center; border-top: 1px solid #f5f0eb; font-size: 11px; color: #a8a095;">
                                        <p style="margin: 0 0 4px 0; font-weight: 700;">Atelier Óptica - Sistema CRM</p>
                                        <p style="margin: 0;">Generado automáticamente el ${formatDate(new Date())}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        // Send Email
        const emailTo = 'Pisano.ishtar@gmail.com';
        const emailSubject = `Reporte de Cobros: ${periodStr} - Atelier Óptica`;
        const emailText = `Reporte de Cobros Atelier Óptica\nPeriodo: ${periodStr}\nTotal General: $${grandTotal.toLocaleString('es-AR')}\n\nRevisá el formato HTML en tu cliente de correo.`;

        console.log(`[Cron Report] Enviando reporte a ${emailTo}...`);
        const emailResult = await sendEmail({
            to: emailTo,
            subject: emailSubject,
            text: emailText,
            html: emailHtml,
        });

        if (!emailResult.success) {
            console.error('[Cron Report] Error al enviar correo:', emailResult.error);
            return NextResponse.json({
                success: false,
                error: 'Error al enviar correo',
                details: emailResult.error,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Reporte de cobros enviado exitosamente',
            emailMessageId: emailResult.messageId,
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
            summary: {
                grandTotal,
                paywayIshTotal,
                accountsBreakdown: Object.values(accounts).map(g => ({ name: g.name, total: g.total })),
            },
        });

    } catch (error: any) {
        console.error('[Cron Report] Error inesperado en cron handler:', error);
        return NextResponse.json({ error: error.message || 'Error del servidor en cron handler' }, { status: 500 });
    }
}
