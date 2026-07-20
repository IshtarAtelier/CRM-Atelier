import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { LAB_AUDIT_START_ISO } from '@/lib/constants';
import { vendorGreeting, notificationEmailFor, ISHTAR_INBOX, PERSONAL_FROM } from '@/lib/vendor-email';
import { needsLabOperation } from '@/lib/lab-orders';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// A partir de cuántos días de enviado al sistema sin número de operación se avisa.
const DAYS_THRESHOLD = 4;

// Cada cuántos días se vuelve a insistir por un pedido que sigue sin procesar.
// No se repite el aviso si ya se mandó uno dentro de esta ventana; pasada,
// vuelve a avisar hasta que carguen el nº de operación (ahí sale de la lista).
const REMINDER_INTERVAL_DAYS = 3;

// Tipo de notificación que usamos como registro de los avisos ya enviados: deja
// constancia de cada aviso por pedido (para respetar la ventana de reintento y
// como traza de "avisé el tal día"). Se crea en estado RESOLVED para que no
// aparezca como pendiente en la campana (staff ve solo PENDING; admin lo ve en
// el historial).
const NOTIF_TYPE = 'PEDIDO_SIN_OPERACION_AVISADO';

function appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
}

function fichaLink(clientId?: string | null) {
    return clientId ? `${appUrl()}/admin/contactos?id=${clientId}` : `${appUrl()}/admin/pedidos`;
}

interface PendingOrder {
    id: string;
    shortId: string;
    clientId: string | null;
    clientName: string;
    amount: number;
    days: number;
    sentAt: Date;
}

function buildEmail(greeting: string, orders: PendingOrder[]) {
    const single = orders.length === 1;
    const o0 = orders[0];

    const listHtml = orders.map(o =>
        `<li><a href="${fichaLink(o.clientId)}" style="color:#1e3a8a;">${o.clientName} — venta #${o.shortId}</a> ` +
        `($${o.amount.toLocaleString('es-AR')}) — enviado hace ${o.days} día${o.days === 1 ? '' : 's'} (${format(o.sentAt, 'dd/MM')})</li>`
    ).join('');

    // Sin cajas ni encabezados de colores: tiene que leerse como un mail escrito
    // a mano por Ishtar, no como una alerta del sistema.
    const html = single
        ? `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.7;">
        <p>Hola ${greeting}, ¿cómo estás?</p>
        <p>Tengo este pedido de <strong>${o0.clientName}</strong> (venta #${o0.shortId}, $${o0.amount.toLocaleString('es-AR')}) que figura enviado hace ${o0.days} días y todavía no tiene número de operación cargado.</p>
        <p>¿Lo podés procesar de forma urgente? ¿O hay algún motivo por el cual no se pueda procesar? Contame así lo vemos.</p>
        <p>Te dejo la ficha para que lo tengas a mano: <a href="${fichaLink(o0.clientId)}" style="color:#1e3a8a;">${o0.clientName} — venta #${o0.shortId}</a></p>
        <p>Gracias,<br/>Ishtar</p>
      </div>`
        : `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.7;">
        <p>Hola ${greeting}, ¿cómo estás?</p>
        <p>Tengo estos pedidos que figuran enviados hace varios días y todavía no tienen número de operación cargado:</p>
        <ul>${listHtml}</ul>
        <p>¿Los podés procesar de forma urgente? Si alguno no se puede procesar, contame el motivo así lo vemos.</p>
        <p>Gracias,<br/>Ishtar</p>
      </div>`;

    const subject = single
        ? `Pedido de ${o0.clientName} (venta #${o0.shortId}) sin procesar hace ${o0.days} días`
        : `${orders.length} pedidos sin procesar hace varios días`;

    return { subject, html };
}

/**
 * Cron DIARIO: avisa a los vendedores cuando un pedido lleva más de
 * DAYS_THRESHOLD días enviado al sistema (labSentAt) sin número de operación
 * (labOrderNumber) cargado. Sólo cuenta pedidos que realmente van al
 * laboratorio (tienen un cristal); las ventas de mostrador no llevan operación.
 *
 * El mail va DIRIGIDO al vendedor dueño de la venta: a su casilla propia
 * (User.notificationEmail) + Ishtar como destinatarios visibles; si el vendedor
 * todavía no tiene casilla propia, cae en la compartida del local. Redactado en
 * primera persona como si lo mandara Ishtar, con reply-to a su Gmail. Se envía
 * UNA sola vez por pedido (queda registrado en Notification) para no repetir el
 * aviso cada día.
 *
 * Alta en cron-job.org: GET diario a /api/cron/pedidos-sin-operacion?secret=CRON_SECRET
 * Modo previsualización (no envía nada): agregar &dry=1
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const dryRun = searchParams.get('dry') === '1';

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
        }
        if (secret !== cronSecret && token !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const now = new Date();
        const threshold = new Date(now.getTime() - DAYS_THRESHOLD * 24 * 60 * 60 * 1000);
        const auditStart = new Date(LAB_AUDIT_START_ISO);

        // Candidatos: ventas enviadas al sistema hace ≥ DAYS_THRESHOLD días, sin
        // nº de operación, dentro de la era del sistema (post 8/4/2026) y no
        // entregadas. El filtro de "tiene cristal" y "vendedor conocido" se
        // aplica en JS (necesita el join de items / la lógica de apodos).
        const candidates = await prisma.order.findMany({
            where: {
                isDeleted: false,
                orderType: 'SALE',
                labSentAt: { lte: threshold, gte: auditStart },
                OR: [{ labOrderNumber: null }, { labOrderNumber: '' }],
                labStatus: { notIn: ['DELIVERED'] },
            },
            include: {
                client: { select: { id: true, name: true } },
                user: { select: { id: true, name: true, email: true, notificationEmail: true } },
                items: {
                    select: {
                        productCategorySnapshot: true,
                        productTypeSnapshot: true,
                        product: { select: { category: true, type: true } },
                    },
                },
            },
            orderBy: { labSentAt: 'asc' },
        });

        // Avisados hace poco: pedidos con un aviso dentro de la ventana de
        // reintento. Un solo query para todos los candidatos. Si el último aviso
        // es más viejo que la ventana, no vuelve acá y el pedido se re-avisa.
        const candidateIds = candidates.map(o => o.id);
        const reminderCutoff = new Date(now.getTime() - REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
        const recentlyNotified = candidateIds.length > 0
            ? await prisma.notification.findMany({
                where: { type: NOTIF_TYPE, orderId: { in: candidateIds }, createdAt: { gte: reminderCutoff } },
                select: { orderId: true },
            })
            : [];
        const recentlyNotifiedSet = new Set(recentlyNotified.map(n => n.orderId));

        // Agrupar por vendedor conocido los que de verdad van a laboratorio,
        // no tienen nº de operación (re-chequeo con trim) y no se avisaron dentro
        // de la ventana de reintento.
        const groups = new Map<string, { greeting: string; user: typeof candidates[number]['user']; orders: PendingOrder[] }>();
        let skippedNoVendor = 0;
        let skippedRecent = 0;

        for (const o of candidates) {
            if ((o.labOrderNumber || '').trim() !== '') continue;
            if (!needsLabOperation(o.items)) continue;
            if (recentlyNotifiedSet.has(o.id)) { skippedRecent++; continue; }

            const greeting = vendorGreeting(o.user);
            if (!greeting) { skippedNoVendor++; continue; }

            const days = Math.floor((now.getTime() - new Date(o.labSentAt!).getTime()) / (24 * 60 * 60 * 1000));
            const entry: PendingOrder = {
                id: o.id,
                shortId: o.id.slice(-4).toUpperCase(),
                clientId: o.client?.id || null,
                clientName: o.client?.name || 'Cliente',
                amount: o.total || 0,
                days,
                sentAt: new Date(o.labSentAt!),
            };

            const key = o.user!.id;
            if (!groups.has(key)) groups.set(key, { greeting, user: o.user, orders: [] });
            groups.get(key)!.orders.push(entry);
        }

        const summaries: any[] = [];

        for (const { greeting, user, orders } of groups.values()) {
            const { subject, html } = buildEmail(greeting, orders);

            // Dirigido al vendedor dueño de la venta: si tiene casilla propia
            // (User.notificationEmail) le llega a él + Ishtar; si todavía no la
            // tiene, cae en la casilla compartida del local. Mismo patrón que
            // el aviso de pedidos listos con saldo.
            const vendorInbox = notificationEmailFor(user);
            const to = vendorInbox === ISHTAR_INBOX ? ISHTAR_INBOX : `${vendorInbox}, ${ISHTAR_INBOX}`;

            if (dryRun) {
                summaries.push({
                    greeting,
                    to,
                    subject,
                    orders: orders.map(o => ({ venta: o.shortId, cliente: o.clientName, dias: o.days })),
                    html,
                });
                continue;
            }

            const res = await sendEmail({
                to,
                from: PERSONAL_FROM,
                replyTo: ISHTAR_INBOX,
                subject,
                html,
            });

            // Sólo registramos el aviso si el mail salió bien; si falló, queda
            // pendiente y se reintenta en la próxima corrida.
            if (res.success) {
                await prisma.notification.createMany({
                    data: orders.map(o => ({
                        type: NOTIF_TYPE,
                        status: 'RESOLVED',
                        message: `Aviso a ${greeting} por venta #${o.shortId} (${o.clientName}) sin nº de operación hace ${o.days} días.`,
                        orderId: o.id,
                        requestedBy: 'Sistema',
                        resolvedBy: 'Sistema',
                    })),
                });
            }

            summaries.push({
                greeting,
                sent: res.success,
                subject,
                orders: orders.map(o => ({ venta: o.shortId, cliente: o.clientName, dias: o.days })),
            });
        }

        return NextResponse.json({
            ok: true,
            dryRun,
            candidates: candidates.length,
            avisos: summaries.length,
            skippedRecent,
            skippedNoVendor,
            summaries,
        });
    } catch (error: any) {
        console.error('[Cron pedidos-sin-operacion] Error:', error);
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
    }
}
