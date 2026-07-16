import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { LAB_AUDIT_START_ISO } from '@/lib/constants';
import { PricingService } from '@/services/PricingService';
import { addBusinessDays, countBusinessDays, calculateEstimatedDays } from '@/lib/business-days';
import { needsLabOperation, labNameFor, itemsForEstimation } from '@/lib/lab-orders';
import { vendorGreeting, notificationEmailFor, ISHTAR_INBOX, PERSONAL_FROM } from '@/lib/vendor-email';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Margen de revisión para pedidos sin estados (Optovision): se reclama recién
// cuando pasaron estos días hábiles POR ENCIMA del tiempo de confección.
const REVIEW_MARGIN_BUSINESS_DAYS = 4;

// Si el pedido sigue con saldo, se vuelve a insistir pasados estos días.
const REMINDER_INTERVAL_DAYS = 2;

// Registro de avisos enviados (idempotencia + traza). RESOLVED para no
// aparecer como pendiente en la campana.
const NOTIF_TYPE = 'PEDIDO_LISTO_SALDO_AVISADO';

function appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
}

function fichaLink(clientId?: string | null) {
    return clientId ? `${appUrl()}/admin/contactos?id=${clientId}` : `${appUrl()}/admin/pedidos`;
}

function money(n: number) {
    return `$${Math.round(n).toLocaleString('es-AR')}`;
}

interface Entry {
    orderId: string;
    shortId: string;
    clientId: string | null;
    clientName: string;
    vendorName: string;
    /** 'listo' = el lab lo terminó (estados de Grupo) · 'vencido' = pasó el plazo sin finalizar (Optovision, por tiempo). */
    kind: 'listo' | 'vencido';
    labStatus: string;
    labName: string | null;
    opNumber: string | null;
    sentAt: Date;
    estDays: number;
    overdueBizDays: number;
    saldoLista: number;
    saldoTransfer: number;
}

function entryLine(e: Entry) {
    const link = `<a href="${fichaLink(e.clientId)}" style="color:#1e3a8a;">${e.clientName} — venta #${e.shortId}</a>`;
    if (e.kind === 'listo') {
        const estado = e.labStatus === 'READY' ? 'listo para retirar' : 'finalizado en el laboratorio';
        return `<li>${link}: ya está ${estado} y queda un saldo de <strong>${money(e.saldoLista)}</strong> (${money(e.saldoTransfer)} por transferencia).</li>`;
    }
    const lab = e.labName ? ` de ${e.labName}` : '';
    return `<li>${link}: se mandó el ${format(e.sentAt, 'dd/MM')}${e.opNumber ? ` (op ${e.opNumber})` : ''} y el plazo${lab} (~${e.estDays} días hábiles) ya venció hace ${e.overdueBizDays} día${e.overdueBizDays === 1 ? '' : 's'} hábil${e.overdueBizDays === 1 ? '' : 'es'} — si el laboratorio no lo terminó, reclamáselo. Saldo del cliente: <strong>${money(e.saldoLista)}</strong> (${money(e.saldoTransfer)} por transferencia).</li>`;
}

/** Mail personal a un vendedor, en la voz de Ishtar. */
function buildVendorEmail(greeting: string, entries: Entry[]) {
    const listos = entries.filter(e => e.kind === 'listo');
    const vencidos = entries.filter(e => e.kind === 'vencido');
    const single = entries.length === 1;
    const e0 = entries[0];

    let subject: string;
    if (single && e0.kind === 'listo') {
        subject = `Pedido de ${e0.clientName} listo con saldo pendiente (venta #${e0.shortId})`;
    } else if (single) {
        subject = `Pedido de ${e0.clientName} vencido de plazo — reclamarlo al laboratorio (venta #${e0.shortId})`;
    } else if (vencidos.length === 0) {
        subject = `${listos.length} pedidos listos con saldo pendiente`;
    } else if (listos.length === 0) {
        subject = `${vencidos.length} pedidos vencidos de plazo para reclamar`;
    } else {
        subject = `Pedidos listos con saldo y plazos vencidos para reclamar`;
    }

    let body: string;
    if (single && e0.kind === 'listo') {
        const estado = e0.labStatus === 'READY' ? 'listo para retirar en el local' : 'finalizado en el laboratorio';
        body = `
        <p>El pedido de <strong>${e0.clientName}</strong> (venta #${e0.shortId}) ya está ${estado} y todavía tiene un saldo pendiente de <strong>${money(e0.saldoLista)}</strong> (${money(e0.saldoTransfer)} por transferencia).</p>
        <p>¿Le avisás al cliente y le pedís que abone el saldo a la brevedad? Cualquier cosa me contás.</p>
        <p>Te dejo la ficha: <a href="${fichaLink(e0.clientId)}" style="color:#1e3a8a;">${e0.clientName} — venta #${e0.shortId}</a></p>`;
    } else if (single) {
        const lab = e0.labName ? ` a ${e0.labName}` : ' al laboratorio';
        body = `
        <p>El pedido de <strong>${e0.clientName}</strong> (venta #${e0.shortId}${e0.opNumber ? `, op ${e0.opNumber}` : ''}) se mandó el ${format(e0.sentAt, 'dd/MM')} y por el tiempo de confección (~${e0.estDays} días hábiles) ya tendría que estar listo — está ${e0.overdueBizDays} día${e0.overdueBizDays === 1 ? '' : 's'} hábil${e0.overdueBizDays === 1 ? '' : 'es'} pasado del plazo.</p>
        <p>¿Te fijás cómo viene? Si todavía no lo terminaron, reclamáselo${lab}, porque ya está en el tiempo que corresponde. Y tené presente que el cliente tiene un saldo de <strong>${money(e0.saldoLista)}</strong> (${money(e0.saldoTransfer)} por transferencia) para pedirle cuando lo retire.</p>
        <p>Te dejo la ficha: <a href="${fichaLink(e0.clientId)}" style="color:#1e3a8a;">${e0.clientName} — venta #${e0.shortId}</a></p>`;
    } else {
        const bloqueListos = listos.length > 0 ? `
        <p>Estos ya están terminados y tienen saldo pendiente — ¿les avisás a los clientes que lo abonen a la brevedad?</p>
        <ul>${listos.map(entryLine).join('')}</ul>` : '';
        const bloqueVencidos = vencidos.length > 0 ? `
        <p>Y estos ya vencieron el plazo de confección y no figuran terminados — fijate cómo vienen y, si el laboratorio no los terminó, reclamáselos porque ya están en el tiempo que corresponde:</p>
        <ul>${vencidos.map(entryLine).join('')}</ul>` : '';
        body = `
        <p>Te paso los pedidos que tengo anotados para revisar:</p>
        ${bloqueListos}
        ${bloqueVencidos}
        <p>Cualquier cosa me contás.</p>`;
    }

    // Sin cajas ni encabezados: tiene que leerse como un mail escrito a mano.
    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.7;">
        <p>Hola ${greeting}, ¿cómo estás?</p>
        ${body}
        <p>Gracias,<br/>Ishtar</p>
      </div>`;

    return { subject, html };
}

/** Reporte consolidado para Ishtar: todos los pedidos en tiempo con saldo,
 *  agrupados por vendedor, con un área en blanco para detallar cada uno. */
function buildReportEmail(entries: Entry[], now: Date) {
    const byVendor = new Map<string, Entry[]>();
    for (const e of entries) {
        if (!byVendor.has(e.vendorName)) byVendor.set(e.vendorName, []);
        byVendor.get(e.vendorName)!.push(e);
    }

    const sections = [...byVendor.entries()].map(([vendor, list]) => `
        <h3 style="margin:22px 0 8px; color:#111827; border-bottom:2px solid #111827; padding-bottom:4px;">${vendor} — ${list.length} pedido${list.length === 1 ? '' : 's'}</h3>
        ${list.map(e => `
        <div style="border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px; margin:0 0 12px;">
            <p style="margin:0 0 6px;">
                <a href="${fichaLink(e.clientId)}" style="color:#1e3a8a; font-weight:bold;">${e.clientName} — venta #${e.shortId}</a>
                &nbsp;·&nbsp; ${e.kind === 'listo'
                    ? (e.labStatus === 'READY' ? '🟢 Listo para retirar' : '🟢 Finalizado en laboratorio')
                    : `🔴 Plazo vencido hace ${e.overdueBizDays} día${e.overdueBizDays === 1 ? '' : 's'} hábil${e.overdueBizDays === 1 ? '' : 'es'} — reclamar${e.labName ? ` a ${e.labName}` : ''}`}
            </p>
            <p style="margin:0 0 8px; font-size:13px; color:#4b5563;">
                Enviado: ${format(e.sentAt, 'dd/MM')} · Op: ${e.opNumber || '—'} · Confección estimada: ${e.estDays} días hábiles ·
                Saldo: <strong>${money(e.saldoLista)}</strong> (${money(e.saldoTransfer)} por transferencia)
            </p>
            <div style="border:1px dashed #9ca3af; border-radius:6px; min-height:52px; padding:8px 10px; color:#9ca3af; font-size:13px;">
                Detalle:
            </div>
        </div>`).join('')}
    `).join('');

    const subject = `Pedidos en tiempo de producción con saldo pendiente — ${format(now, 'dd/MM')}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width:720px; margin:0 auto; font-size:14px; color:#222; line-height:1.6;">
        <h2 style="color:#111827; margin:0 0 4px;">Pedidos en tiempo de producción con saldo — ${format(now, 'dd/MM/yyyy')}</h2>
        <p style="color:#6b7280; font-size:13px; margin:0 0 16px;">Borrador para completar: escribí el detalle de cada pedido en su recuadro y reenvialo a los vendedores.</p>
        ${sections || '<p>No hay pedidos en esta situación hoy. 🎉</p>'}
      </div>`;

    return { subject, html };
}

/**
 * Cron DIARIO: pedidos que ya están (o deberían estar) terminados y siguen
 * con saldo pendiente.
 *   - Con estados (Grupo Óptico / carga manual): labStatus FINISHED o READY.
 *   - Sin estados (Optovision): por tiempo — pasaron los días hábiles de
 *     confección + REVIEW_MARGIN días hábiles desde labSentAt, con nº de
 *     operación cargado (sin número lo persigue el cron pedidos-sin-operacion).
 *
 * A cada vendedor (Mati/Mile) le llega UN mail personal en la voz de Ishtar a
 * su casilla (hoy la compartida del local) con copia visible a Ishtar, y si a
 * los REMINDER_INTERVAL_DAYS días el pedido sigue con saldo, se insiste.
 *
 * Alta en cron-job.org: GET diario a /api/cron/pedidos-listos-con-saldo?secret=CRON_SECRET
 * Query params:
 *   &dry=1          → arma los mails y los devuelve sin enviar nada
 *   &report=1       → en vez de mails por vendedor, UN reporte consolidado a
 *                     Ishtar con área de detalle por pedido (para reenviar);
 *                     con &copy=atelier va también a la casilla del local.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const dryRun = searchParams.get('dry') === '1';
        const reportMode = searchParams.get('report') === '1';
        const copyAtelier = searchParams.get('copy') === 'atelier';

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
        }
        if (secret !== cronSecret && token !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const now = new Date();
        const auditStart = new Date(LAB_AUDIT_START_ISO);

        const candidates = await prisma.order.findMany({
            where: {
                isDeleted: false,
                orderType: 'SALE',
                labSentAt: { not: null, gte: auditStart },
                labStatus: { in: ['FINISHED', 'READY', 'SENT', 'IN_PROGRESS'] },
            },
            include: {
                client: { select: { id: true, name: true } },
                user: { select: { id: true, name: true, email: true, notificationEmail: true } },
                payments: { select: { amount: true, method: true } },
                items: {
                    select: {
                        productCategorySnapshot: true,
                        productTypeSnapshot: true,
                        productNameSnapshot: true,
                        productBrandSnapshot: true,
                        laboratorySnapshot: true,
                        product: {
                            select: {
                                category: true, type: true, name: true,
                                model: true, brand: true, origin: true, laboratory: true,
                            },
                        },
                    },
                },
            },
            orderBy: { labSentAt: 'asc' },
        });

        const entries: Entry[] = [];
        for (const o of candidates) {
            const financials = PricingService.calculateOrderFinancials(o);
            if (!financials.hasBalance) continue;

            let kind: Entry['kind'];
            let estDays = calculateEstimatedDays(itemsForEstimation(o.items));
            let overdueBizDays = 0;

            if (o.labStatus === 'FINISHED' || o.labStatus === 'READY') {
                kind = 'listo';
            } else {
                // Rama por tiempo: solo pedidos que van al laboratorio y que
                // efectivamente se cargaron (tienen nº de operación).
                if (!needsLabOperation(o.items)) continue;
                if (!(o.labOrderNumber || '').trim()) continue;
                const reviewAt = addBusinessDays(new Date(o.labSentAt!), estDays + REVIEW_MARGIN_BUSINESS_DAYS);
                if (now < reviewAt) continue;
                const dueAt = addBusinessDays(new Date(o.labSentAt!), estDays);
                overdueBizDays = countBusinessDays(dueAt, now);
                kind = 'vencido';
            }

            entries.push({
                orderId: o.id,
                shortId: o.id.slice(-4).toUpperCase(),
                clientId: o.client?.id || null,
                clientName: o.client?.name?.trim() || 'Cliente',
                vendorName: o.user?.name?.trim() || 'Sin vendedor',
                kind,
                labStatus: o.labStatus || 'NONE',
                labName: labNameFor(o.items),
                opNumber: (o.labOrderNumber || '').trim() || null,
                sentAt: new Date(o.labSentAt!),
                estDays,
                overdueBizDays,
                saldoLista: financials.remainingCard,
                saldoTransfer: financials.remainingTransfer,
            });
        }

        // ── Modo reporte: un solo mail consolidado (sin ventana de reintento) ──
        if (reportMode) {
            const { subject, html } = buildReportEmail(entries, now);
            const to = copyAtelier ? `${ISHTAR_INBOX}, ${notificationEmailFor(null)}` : ISHTAR_INBOX;

            if (dryRun) {
                return NextResponse.json({
                    ok: true, dryRun, report: true, to, subject,
                    total: entries.length,
                    entries: entries.map(e => ({ venta: e.shortId, cliente: e.clientName, vendedor: e.vendorName, tipo: e.kind, saldo: e.saldoLista })),
                    html,
                });
            }

            const res = await sendEmail({ to, from: PERSONAL_FROM, replyTo: ISHTAR_INBOX, subject, html });
            return NextResponse.json({ ok: true, report: true, sent: res.success, to, subject, total: entries.length });
        }

        // ── Modo cron: un mail por vendedor conocido, con ventana de reintento ──
        const reminderCutoff = new Date(now.getTime() - REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
        const orderIds = entries.map(e => e.orderId);
        const recentlyNotified = orderIds.length > 0
            ? await prisma.notification.findMany({
                where: { type: NOTIF_TYPE, orderId: { in: orderIds }, createdAt: { gte: reminderCutoff } },
                select: { orderId: true },
            })
            : [];
        const recentSet = new Set(recentlyNotified.map(n => n.orderId));

        const groups = new Map<string, { greeting: string; user: any; entries: Entry[] }>();
        let skippedRecent = 0;
        let skippedNoVendor = 0;

        for (const e of entries) {
            if (recentSet.has(e.orderId)) { skippedRecent++; continue; }
            const order = candidates.find(c => c.id === e.orderId)!;
            const greeting = vendorGreeting(order.user);
            if (!greeting) { skippedNoVendor++; continue; }
            const key = order.user!.id;
            if (!groups.has(key)) groups.set(key, { greeting, user: order.user, entries: [] });
            groups.get(key)!.entries.push(e);
        }

        const summaries: any[] = [];
        for (const { greeting, user, entries: list } of groups.values()) {
            const { subject, html } = buildVendorEmail(greeting, list);
            const vendorInbox = notificationEmailFor(user);
            // Al vendedor y a Ishtar, ambos como destinatarios visibles.
            const to = vendorInbox === ISHTAR_INBOX ? ISHTAR_INBOX : `${vendorInbox}, ${ISHTAR_INBOX}`;

            if (dryRun) {
                summaries.push({
                    greeting, to, subject,
                    pedidos: list.map(e => ({ venta: e.shortId, cliente: e.clientName, tipo: e.kind, saldo: e.saldoLista })),
                    html,
                });
                continue;
            }

            const res = await sendEmail({ to, from: PERSONAL_FROM, replyTo: ISHTAR_INBOX, subject, html });

            if (res.success) {
                await prisma.notification.createMany({
                    data: list.map(e => ({
                        type: NOTIF_TYPE,
                        status: 'RESOLVED',
                        message: `Aviso a ${greeting}: venta #${e.shortId} (${e.clientName}) ${e.kind === 'listo' ? 'lista' : 'vencida de plazo'} con saldo ${money(e.saldoLista)}.`,
                        orderId: e.orderId,
                        requestedBy: 'Sistema',
                        resolvedBy: 'Sistema',
                    })),
                });
            }

            summaries.push({
                greeting, sent: res.success, subject,
                pedidos: list.map(e => ({ venta: e.shortId, cliente: e.clientName, tipo: e.kind, saldo: e.saldoLista })),
            });
        }

        return NextResponse.json({
            ok: true,
            dryRun,
            candidates: candidates.length,
            conSaldo: entries.length,
            avisos: summaries.length,
            skippedRecent,
            skippedNoVendor,
            summaries,
        });
    } catch (error: any) {
        console.error('[Cron pedidos-listos-con-saldo] Error:', error);
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
    }
}
