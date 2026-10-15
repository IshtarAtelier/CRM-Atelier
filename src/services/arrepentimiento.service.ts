/**
 * Botón de arrepentimiento de la tienda online: registra la solicitud, le da
 * al cliente un código de trámite y avisa a la óptica.
 *
 * Por qué existe (auditoría del 25/9/2026, confirmado el 28/9): el sitio no
 * tenía botón de arrepentimiento (Disp. 954/2025, que reemplazó a la Res. SCI
 * 424/2020). La norma pide un link visible, un trámite sin login y un código
 * de identificación de la solicitud para el consumidor.
 *
 * Qué hace, en orden:
 * 1. Genera el código (ARR-AAAAMMDD-XXXXX) y busca el pedido por el número
 *    que ve el cliente (#ABCD = últimos 4 del id) Y el email. El email vale
 *    si es el de la ficha O el que la persona escribió al comprar: el
 *    checkout encuentra la ficha por teléfono y no le guarda el email, así
 *    que un cliente que ya existía nunca coincidía (revisión del 5/10). El
 *    del checkout queda en el intento de pago de Mercado Pago y, desde esta
 *    versión, en la auditoría de la compra web.
 * 2. Crea la Notification pendiente en el CRM. Si la base no responde, ACÁ
 *    falla: el cliente tiene que enterarse de que no quedó registrado.
 * 3. Deja el registro firmado por SYSTEM_ACTOR en AuditLog (con await: es la
 *    constancia del trámite) y, si el pedido coincide, una nota en la ficha.
 * 4. Mail al equipo siempre. Mail al cliente SOLO si el email coincide con el
 *    del pedido: si no, cualquiera podría usar el formulario para mandarle
 *    mails nuestros a un tercero. En los dos casos el código se muestra en
 *    pantalla, que es lo que pide la norma.
 *
 * La respuesta es la misma exista o no el pedido, para no revelar qué
 * números de pedido son reales.
 *
 * No hace falta tabla nueva: el trámite queda en AuditLog (entityType
 * WITHDRAWAL_REQUEST, entityId = código) y como Notification pendiente, que es
 * donde el equipo lo resuelve. Si algún día hace falta seguir estados
 * (recibido, devuelto, reintegrado), ahí sí va una tabla por migración.
 */
import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { escHtml } from '@/lib/client-email';
import { logAudit } from '@/lib/audit';
import { SYSTEM_ACTOR } from '@/lib/actor';
import { ADMIN_ALERT_EMAILS, CRM_ORIGIN } from '@/lib/constants';
import { BUSINESS_INFO } from '@/lib/business-info';
import { formatDateTime } from '@/lib/format-date';

export interface SolicitudArrepentimiento {
    /** Como lo escribe el cliente: "#A1B2", "a1b2", "A1B2". */
    numeroPedido: string;
    email: string;
    motivo?: string | null;
    /**
     * Llegó con el campo trampa completado. Puede ser un robot o el
     * autocompletado del navegador de una persona: el código que se le
     * muestra tiene que ser real, así que queda la constancia en la
     * auditoría, pero no se avisa a nadie ni se manda ningún mail.
     */
    sospechoso?: boolean;
}

export interface ResultadoArrepentimiento {
    codigo: string;
    recibidoEn: Date;
}

/** Lo que el servicio necesita de la base (inyectable para el check sin base). */
export interface DbArrepentimiento {
    order: {
        findMany(args: unknown): Promise<Array<{
            id: string; clientId: string | null;
            client: { id: string; name: string | null; email: string | null } | null;
            paymentIntents?: Array<{ checkoutContext: string | null }>;
        }>>;
    };
    auditLog: { findMany(args: unknown): Promise<Array<{ entityId: string; details: unknown }>> };
    notification: { create(args: unknown): Promise<unknown>; count(args: unknown): Promise<number> };
    interaction: { create(args: unknown): Promise<unknown> };
}

export interface DependenciasArrepentimiento {
    db?: DbArrepentimiento;
    enviarEmail?: typeof sendEmail;
    registrarAuditoria?: typeof logAudit;
    ahora?: () => Date;
}

const ZONA_ARGENTINA = 'America/Argentina/Buenos_Aires';
/**
 * Solicitudes SIN pedido que coincida que llegan a la campana y al mail del
 * equipo en 24 h. El formulario es público: sin tope, alguien con varias IPs
 * llenaba las 50 notificaciones que muestra la campana y tapaba las de
 * verdad. Las que pasan el tope quedan igual en la auditoría, con su código.
 */
export const TOPE_SIN_PEDIDO_POR_DIA = 5;
/** Sin 0/O ni 1/I/L: el código se dicta por teléfono o WhatsApp. */
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** "#a1b2 " → "A1B2". Solo letras y números. */
export function normalizarNumeroPedido(valor: string): string {
    return (valor || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

/** La fecha y hora de Argentina, aunque el servidor corra en UTC. */
function enHoraArgentina(fecha: Date): Date {
    return new Date(fecha.toLocaleString('en-US', { timeZone: ZONA_ARGENTINA }));
}

export function generarCodigoTramite(fecha: Date, azar: (max: number) => number = randomInt): string {
    const ar = enHoraArgentina(fecha);
    const dia = `${ar.getFullYear()}${String(ar.getMonth() + 1).padStart(2, '0')}${String(ar.getDate()).padStart(2, '0')}`;
    let sufijo = '';
    for (let i = 0; i < 5; i++) sufijo += ALFABETO_CODIGO[azar(ALFABETO_CODIGO.length)];
    return `ARR-${dia}-${sufijo}`;
}

function mismoEmail(a: string | null | undefined, b: string | null | undefined): boolean {
    return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** El email que la persona escribió en el checkout de Mercado Pago (WebPaymentIntent.checkoutContext). */
function emailDelIntento(checkoutContext: string | null): string | null {
    if (!checkoutContext) return null;
    try {
        const email = (JSON.parse(checkoutContext) as { customer?: { email?: unknown } })?.customer?.email;
        return typeof email === 'string' ? email : null;
    } catch {
        return null;
    }
}

export async function registrarArrepentimiento(
    solicitud: SolicitudArrepentimiento,
    deps: DependenciasArrepentimiento = {},
): Promise<ResultadoArrepentimiento> {
    const db = deps.db ?? (prisma as unknown as DbArrepentimiento);
    const enviarEmail = deps.enviarEmail ?? sendEmail;
    const registrarAuditoria = deps.registrarAuditoria ?? logAudit;
    const recibidoEn = (deps.ahora ?? (() => new Date()))();

    const pedido = normalizarNumeroPedido(solicitud.numeroPedido);
    const email = solicitud.email.trim();
    const motivo = solicitud.motivo?.trim() || null;
    const codigo = generarCodigoTramite(recibidoEn);

    // 1. ¿Qué pedido es? Mismo número que ve el cliente (#ABCD) y el email de su ficha.
    const candidatos = pedido.length >= 4
        ? await db.order.findMany({
            where: { id: { endsWith: pedido.toLowerCase() }, isDeleted: false },
            select: {
                id: true, clientId: true,
                client: { select: { id: true, name: true, email: true } },
                paymentIntents: { select: { checkoutContext: true } },
            },
            take: 20,
        })
        : [];
    // El email del checkout que quedó en la auditoría de la compra web.
    const auditorias = candidatos.length
        ? await db.auditLog.findMany({
            where: { entityType: 'ORDER', action: 'CREATE', entityId: { in: candidatos.map(o => o.id) } },
            select: { entityId: true, details: true },
        })
        : [];
    const emailsDelCheckout = (orderId: string): string[] => [
        ...auditorias.filter(a => a.entityId === orderId)
            .map(a => (a.details as { email?: unknown } | null)?.email)
            .filter((e): e is string => typeof e === 'string'),
        ...(candidatos.find(o => o.id === orderId)?.paymentIntents ?? [])
            .map(i => emailDelIntento(i.checkoutContext))
            .filter((e): e is string => !!e),
    ];
    const coincide = candidatos.find(o =>
        mismoEmail(o.client?.email, email) || emailsDelCheckout(o.id).some(e => mismoEmail(e, email)),
    ) ?? null;

    const resumen = coincide
        ? `pedido #${pedido} de ${coincide.client?.name || 'cliente'}`
        : `pedido #${pedido || '(sin número)'} — el email no coincide con ningún pedido: revisar a mano`;

    // 2. ¿Se avisa al equipo? Una sola notificación pendiente por pedido, y
    // un tope diario para las que no coinciden con ningún pedido. Estas
    // consultas van ANTES de devolver el código: si la base no responde,
    // falla, y el cliente se entera de que no quedó registrado.
    let sinAviso: 'campo-trampa' | 'ya-pendiente' | 'tope-diario' | null = null;
    if (solicitud.sospechoso) {
        sinAviso = 'campo-trampa';
    } else if (coincide) {
        const pendientes = await db.notification.count({
            where: { type: 'WITHDRAWAL_REQUEST', status: 'PENDING', orderId: coincide.id },
        });
        if (pendientes > 0) sinAviso = 'ya-pendiente';
    } else {
        const ultimas24h = await db.notification.count({
            where: { type: 'WITHDRAWAL_REQUEST', orderId: null, createdAt: { gte: new Date(recibidoEn.getTime() - 24 * 60 * 60 * 1000) } },
        });
        if (ultimas24h >= TOPE_SIN_PEDIDO_POR_DIA) sinAviso = 'tope-diario';
    }

    // Aviso en el CRM. Si esto falla, se propaga: el trámite no quedó registrado.
    if (!sinAviso) {
        await db.notification.create({
            data: {
                type: 'WITHDRAWAL_REQUEST',
                message: `Botón de arrepentimiento ${codigo}: ${resumen}. Email: ${email}.${motivo ? ` Motivo: ${motivo}` : ''}`,
                orderId: coincide?.id ?? null,
                requestedBy: SYSTEM_ACTOR.name,
                status: 'PENDING',
            },
        });
    }

    // 3. La constancia del trámite, firmada. await: es lo que prueba que se recibió.
    await registrarAuditoria({
        userId: SYSTEM_ACTOR.id,
        userName: SYSTEM_ACTOR.name,
        action: 'CREATE',
        entityType: 'WITHDRAWAL_REQUEST',
        entityId: codigo,
        details: { codigo, numeroPedido: pedido, email, motivo, orderId: coincide?.id ?? null, emailCoincide: !!coincide, recibidoEn: recibidoEn.toISOString(), sinAviso },
    });

    if (sinAviso === 'campo-trampa' || sinAviso === 'tope-diario') return { codigo, recibidoEn };

    if (coincide?.clientId) {
        await db.interaction.create({
            data: {
                clientId: coincide.clientId,
                type: 'SISTEMA',
                content: `↩️ Solicitud de arrepentimiento del pedido #${pedido} desde el botón de la web. Código ${codigo}. Registrada por ${SYSTEM_ACTOR.name}.${motivo ? ` Motivo: "${motivo}"` : ''}`,
                userId: SYSTEM_ACTOR.id,
                userName: SYSTEM_ACTOR.name,
            },
        }).catch(err => console.error('[Arrepentimiento] No se pudo dejar la nota en la ficha:', err));
    }

    // 4. Mails, sin demorar la respuesta.
    // Si el pedido ya tenía una solicitud pendiente, el equipo ya está avisado:
    // la nueva queda en la ficha y en la auditoría, y el cliente recibe su código.
    const cuando = formatDateTime(enHoraArgentina(recibidoEn));
    if (!sinAviso) {
        enviarEmail({
            to: ADMIN_ALERT_EMAILS,
            subject: `↩️ Botón de arrepentimiento ${codigo} · pedido #${pedido || '?'}`,
            html: htmlParaElEquipo({ codigo, cuando, pedido, email, motivo, coincide }),
        }).catch(err => console.error('[Arrepentimiento] No se pudo avisar al equipo por mail:', err));
    }

    if (coincide) {
        enviarEmail({
            to: email,
            subject: `Recibimos tu solicitud de arrepentimiento · ${codigo}`,
            html: htmlParaElCliente({ codigo, cuando, pedido }),
        }).catch(err => console.error('[Arrepentimiento] No se pudo mandar la constancia al cliente:', err));
    }

    return { codigo, recibidoEn };
}

function htmlParaElEquipo(d: {
    codigo: string; cuando: string; pedido: string; email: string; motivo: string | null;
    coincide: { id: string; client: { name: string | null } | null } | null;
}): string {
    const pedidoHtml = d.coincide
        ? `<p>El email coincide con el pedido <strong>#${escHtml(d.pedido)}</strong> de ${escHtml(d.coincide.client?.name || 'cliente')}: <a href="${CRM_ORIGIN}/admin/ventas?id=${encodeURIComponent(d.coincide.id)}">abrir la venta</a>.</p>`
        : `<p style="color:#9a3412"><strong>No encontramos un pedido #${escHtml(d.pedido || '(sin número)')} con ese email.</strong> Puede ser un error de tipeo o un pedido del local: revisarlo a mano y contestarle al cliente. A este cliente NO se le mandó mail (solo vio el código en pantalla).</p>`;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="margin-top:0">↩️ Botón de arrepentimiento</h2>
        <p><strong>Código de trámite:</strong> ${escHtml(d.codigo)}</p>
        <p><strong>Recibido:</strong> ${escHtml(d.cuando)}</p>
        <p><strong>Email:</strong> ${escHtml(d.email)}</p>
        <p><strong>Motivo:</strong> ${d.motivo ? escHtml(d.motivo) : '(no lo dijo)'}</p>
        ${pedidoHtml}
        <p style="font-size:12px;color:#666;margin-top:20px">Quedó como notificación pendiente en el CRM y registrado en la auditoría. El cliente ya vio este código en pantalla.</p>
      </div>`;
}

function htmlParaElCliente(d: { codigo: string; cuando: string; pedido: string }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="margin-top:0">Recibimos tu solicitud de arrepentimiento</h2>
        <p>Tu código de trámite es <strong>${escHtml(d.codigo)}</strong>. Guardalo: es la constancia de que pediste arrepentirte de la compra del pedido <strong>#${escHtml(d.pedido)}</strong> el ${escHtml(d.cuando)}.</p>
        <p>Te vamos a contactar para coordinar la devolución.</p>
        <p>Si tenés dudas, escribinos por WhatsApp al ${escHtml(BUSINESS_INFO.phone)} con tu código.</p>
        <p style="font-size:12px;color:#666;margin-top:20px">${escHtml(BUSINESS_INFO.name)} · ${escHtml(BUSINESS_INFO.address)}</p>
      </div>`;
}
