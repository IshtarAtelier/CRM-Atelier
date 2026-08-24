import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { notificationEmailFor, ISHTAR_INBOX, SHARED_VENDOR_INBOX } from '@/lib/vendor-email';

export const dynamic = 'force-dynamic';

// ────────────────────────────────────────────────────────────────────────────
// VENTAS REABIERTAS QUE SE OLVIDARON ABIERTAS.
//
// Reabrir una venta (isLocked: false) la deja editable — y, desde el 24/8/26,
// también le permite volver a seguir el catálogo si de verdad se cambia un
// producto (ver order.service.ts). Cuanto más tiempo quede así, más chance
// de que alguien la toque sin querer o que se olvide de re-confirmarla.
//
// Si sigue reabierta 24h después de la reapertura, avisa al vendedor (quien
// la envió a fábrica, o quien la creó si eso no está) y a Ishtar (bcc).
// Se avisa UNA vez por cada reapertura — si se re-confirma y se vuelve a
// reabrir más adelante, puede volver a avisar.
//
// Correr desde cron-job.org (Bearer CRON_SECRET), mismo patrón que los demás
// crons de scripts/../api/cron/*.
// ────────────────────────────────────────────────────────────────────────────

const HORAS_LIMITE = 24;
const TIPO_NOTIF = 'SALE_REOPENED_24H';

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

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';

        const reabiertas = await prisma.order.findMany({
            where: { orderType: 'SALE', isLocked: false, isDeleted: false },
            select: {
                id: true, total: true, labSentBy: true, labSentById: true, userId: true,
                client: { select: { id: true, name: true, phone: true } },
                notifications: {
                    where: { type: TIPO_NOTIF },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true },
                },
            },
        });

        const results: any[] = [];

        for (const order of reabiertas) {
            // La reapertura queda registrada en el AuditLog (order.service.ts,
            // bloque "Historial: reapertura y re-confirmación"). Es la ÚNICA
            // fuente del "desde cuándo está abierta" — no hay un campo dedicado
            // en Order. Si no hay rastro (dato viejo, de antes de esa regla),
            // no se puede saber con certeza: se omite en vez de adivinar.
            const ultimoCambio = await prisma.auditLog.findFirst({
                where: { entityType: 'ORDER', entityId: order.id, action: 'STATUS_CHANGE' },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true, details: true, userName: true },
            });
            const evento = (ultimoCambio?.details as any)?.evento;
            if (!ultimoCambio || evento !== 'REAPERTURA') {
                results.push({ orderId: order.id, status: 'SIN_RASTRO_DE_REAPERTURA' });
                continue;
            }

            const horasAbierta = (Date.now() - new Date(ultimoCambio.createdAt).getTime()) / 3_600_000;
            if (horasAbierta < HORAS_LIMITE) {
                results.push({ orderId: order.id, status: 'TODAVIA_A_TIEMPO', horasAbierta: Math.round(horasAbierta) });
                continue;
            }

            // Dedup: solo cuenta un aviso mandado DESPUÉS de esta reapertura —
            // si se re-confirma y se reabre de nuevo más adelante, tiene que
            // poder avisar otra vez.
            const yaAvisado = order.notifications[0] && order.notifications[0].createdAt >= ultimoCambio.createdAt;
            if (yaAvisado) {
                results.push({ orderId: order.id, status: 'YA_AVISADO' });
                continue;
            }

            // Vendedor = quien la envió a fábrica (regla del negocio). Si esta
            // venta reabierta nunca llegó a fábrica, cae a quien la creó.
            const vendedorId = order.labSentById || order.userId;
            const vendedor = vendedorId
                ? await prisma.user.findUnique({ where: { id: vendedorId }, select: { name: true, email: true, notificationEmail: true } })
                : null;
            const vendedorEmail = vendedor ? notificationEmailFor(vendedor) : SHARED_VENDOR_INBOX;
            const vendedorNombre = order.labSentBy || vendedor?.name || 'sin asignar';

            const clientName = order.client?.name || 'Cliente sin nombre';
            const orderLink = `${appUrl}/admin/contactos?id=${order.client?.id || ''}`;
            const motivo = (ultimoCambio.details as any)?.motivo || 'sin motivo registrado';
            const horasRedondeadas = Math.round(horasAbierta);

            const emailSubject = `⏰ Venta de ${clientName} lleva ${horasRedondeadas}h reabierta`;
            const emailText = `Atelier Óptica\n\nLa venta de ${clientName} está reabierta hace ${horasRedondeadas} horas y todavía no se volvió a confirmar.\n\nVendedor: ${vendedorNombre}\nReabierta por: ${ultimoCambio.userName || 'Sistema'}\nMotivo de la reapertura: "${motivo}"\nTotal: $${(order.total || 0).toLocaleString('es-AR')}\n\nMientras siga reabierta, cualquier edición puede tocarle el precio o los ítems. Conviene revisarla y volver a confirmarla.\n\nEnlace: ${orderLink}`;

            const emailHtml = `
                <!DOCTYPE html>
                <html>
                <body style="margin:0;padding:0;background-color:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding:40px 20px;">
                        <tr><td align="center">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:16px;border:1px solid #e8e2db;overflow:hidden;">
                                <tr><td style="height:6px;background-color:#f59e0b;"></td></tr>
                                <tr><td style="padding:32px 32px 24px 32px;text-align:center;border-bottom:1px solid #f5f0eb;">
                                    <h1 style="margin:0;font-size:20px;font-weight:900;letter-spacing:2px;color:#433831;text-transform:uppercase;">ATELIER ÓPTICA</h1>
                                    <p style="margin:6px 0 0 0;font-size:11px;font-weight:800;color:#f59e0b;letter-spacing:1px;text-transform:uppercase;">Venta reabierta hace más de 24h</p>
                                </td></tr>
                                <tr><td style="padding:32px;">
                                    <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#706359;">
                                        Esta venta se reabrió para editarla y todavía sigue así. Mientras esté reabierta, cualquier edición puede tocarle el precio o los ítems.
                                    </p>
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;background-color:#faf8f5;border-radius:12px;border:1px solid #e8e2db;padding:20px;">
                                        <tr><td style="padding-bottom:8px;font-size:12px;font-weight:700;color:#a8a095;text-transform:uppercase;width:180px;">Cliente:</td><td style="padding-bottom:8px;font-size:14px;font-weight:700;color:#433831;">${clientName}</td></tr>
                                        <tr><td style="padding-bottom:8px;font-size:12px;font-weight:700;color:#a8a095;text-transform:uppercase;">Vendedor:</td><td style="padding-bottom:8px;font-size:14px;color:#433831;">${vendedorNombre}</td></tr>
                                        <tr><td style="padding-bottom:8px;font-size:12px;font-weight:700;color:#a8a095;text-transform:uppercase;">Reabierta hace:</td><td style="padding-bottom:8px;font-size:14px;font-weight:700;color:#f59e0b;">${horasRedondeadas} horas</td></tr>
                                        <tr><td style="padding-bottom:8px;font-size:12px;font-weight:700;color:#a8a095;text-transform:uppercase;">Motivo:</td><td style="padding-bottom:8px;font-size:14px;color:#433831;">${motivo}</td></tr>
                                        <tr><td style="font-size:12px;font-weight:700;color:#a8a095;text-transform:uppercase;">Total:</td><td style="font-size:14px;font-weight:700;color:#433831;">$${(order.total || 0).toLocaleString('es-AR')}</td></tr>
                                    </table>
                                    <div style="text-align:center;">
                                        <a href="${orderLink}" style="display:inline-block;padding:14px 28px;background-color:#433831;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Ver la venta</a>
                                    </div>
                                </td></tr>
                                <tr><td style="background-color:#faf8f5;padding:24px 32px;text-align:center;border-top:1px solid #f5f0eb;font-size:11px;color:#a8a095;">
                                    <p style="margin:0;font-weight:700;">Atelier Óptica - Sistema CRM</p>
                                </td></tr>
                            </table>
                        </td></tr>
                    </table>
                </body>
                </html>
            `;

            const emailResult = await sendEmail({
                to: vendedorEmail,
                bcc: ISHTAR_INBOX,
                subject: emailSubject,
                text: emailText,
                html: emailHtml,
            });

            if (emailResult.success) {
                await prisma.notification.create({
                    data: {
                        type: TIPO_NOTIF,
                        status: 'PENDING',
                        message: `Venta de ${clientName} reabierta hace ${horasRedondeadas}h sin volver a confirmarse`,
                        orderId: order.id,
                        requestedBy: 'Sistema',
                    },
                });
                results.push({ orderId: order.id, clientName, vendedorEmail, horasAbierta: horasRedondeadas, status: 'NOTIFICADO' });
            } else {
                results.push({ orderId: order.id, clientName, status: 'EMAIL_FALLO', error: emailResult.error });
            }
        }

        return NextResponse.json({ success: true, processedCount: results.length, details: results });
    } catch (error: any) {
        console.error('[Cron venta-reabierta-24h] Error inesperado:', error);
        return NextResponse.json({ error: error.message || 'Error en el servidor' }, { status: 500 });
    }
}
