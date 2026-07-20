import { NextResponse } from 'next/server';
import { CashService } from '@/services/cash.service';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

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

        // Obtener balance de caja
        const balance = await CashService.getCashBalance();

        const today = new Date();
        const dateStr = today.toLocaleDateString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Formatear HTML del email
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reporte de Caja Efectivo</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #faf8f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e8e2db; box-shadow: 0 4px 12px rgba(67, 56, 49, 0.04); overflow: hidden;">
                                <tr>
                                    <td style="height: 6px; background-color: #9e7f65;"></td>
                                </tr>
                                <tr>
                                    <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f5f0eb;">
                                        <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 2px; color: #433831; text-transform: uppercase;">ATELIER ÓPTICA</h1>
                                        <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 800; color: #9e7f65; letter-spacing: 1px; text-transform: uppercase;">Estado de Caja Efectivo al Comienzo del Día</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 32px; text-align: center;">
                                        <p style="margin: 0 0 16px 0; font-size: 14px; color: #706359;">${dateStr}</p>
                                        <div style="background-color: #faf8f5; border-radius: 12px; padding: 24px; border: 1px solid #e8e2db; display: inline-block;">
                                            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #a8a095; text-transform: uppercase; letter-spacing: 1px;">Efectivo en Caja</p>
                                            <p style="margin: 0; font-size: 32px; font-weight: 900; color: #433831;">$${balance.total.toLocaleString('es-AR')}</p>
                                        </div>
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

        const emailTo = process.env.ADMIN_EMAIL || 'Pisano.ishtar@gmail.com';
        const emailSubject = `Caja Efectivo - ${dateStr} - Atelier Óptica`;
        const emailText = `Atelier Óptica\nEstado de Caja Efectivo al Comienzo del Día\nFecha: ${dateStr}\nTotal: $${balance.total.toLocaleString('es-AR')}`;

        console.log('[Cron Daily Cash] Enviando reporte a', emailTo);
        const emailResult = await sendEmail({
            to: emailTo,
            subject: emailSubject,
            text: emailText,
            html: emailHtml,
        });

        if (!emailResult.success) {
            console.error('[Cron Daily Cash] Error al enviar correo:', emailResult.error);
            return NextResponse.json({
                success: false,
                error: 'Error al enviar correo',
                details: emailResult.error,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Reporte de caja diario enviado exitosamente',
            emailMessageId: emailResult.messageId,
            balance: balance.total
        });

    } catch (error: any) {
        console.error('[Cron Daily Cash] Error inesperado en cron handler:', error);
        return NextResponse.json({ error: error.message || 'Error del servidor en cron handler' }, { status: 500 });
    }
}
