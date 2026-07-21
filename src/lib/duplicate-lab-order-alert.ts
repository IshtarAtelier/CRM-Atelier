import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';

/** Un nº de operación real tiene dígitos; el campo a veces trae notas sueltas
 *  ("sin numero", "Lentes de contacto") que no tiene sentido cruzar. */
function looksLikeOpNumber(value: string): boolean {
    return /[0-9]{4,}/.test(value);
}

function ficha(clientId: string | null | undefined, name: string) {
    return clientId
        ? `<a href="${APP_URL}/admin/contactos?clientId=${clientId}">${name}</a>`
        : name;
}

/**
 * Avisa al admin cuando un nº de operación del laboratorio se repite.
 *
 * NO bloquea la carga: a veces el mismo nº agrupa legítimamente dos pedidos
 * (un pase, una rehechura). Lo que no puede pasar es que se repita en silencio,
 * porque después la conciliación de costos cruza por ese número y no hay forma
 * de saber a qué pedido corresponde cada factura.
 */
export async function alertDuplicateLabOrderNumber(params: {
    orderId: string;
    labOrderNumber: string;
    actorName: string;
}): Promise<void> {
    try {
        const numero = (params.labOrderNumber || '').trim();
        if (!numero || !looksLikeOpNumber(numero)) return;

        const otros = await prisma.order.findMany({
            where: {
                id: { not: params.orderId },
                isDeleted: false,
                labOrderNumber: numero,
            },
            select: {
                id: true,
                labSentAt: true,
                clientId: true,
                client: { select: { name: true } },
                user: { select: { name: true } },
            },
        });

        if (otros.length === 0) return;

        const actual = await prisma.order.findUnique({
            where: { id: params.orderId },
            select: { id: true, clientId: true, client: { select: { name: true } } },
        });

        const nombreActual = actual?.client?.name?.trim() || 'Cliente';
        const shortActual = params.orderId.slice(-4).toUpperCase();

        const filas = otros.map(o => {
            const nombre = o.client?.name?.trim() || 'Cliente';
            const enviado = o.labSentAt
                ? new Date(o.labSentAt).toLocaleDateString('es-AR')
                : 'sin fecha de envío';
            return `<li>Pedido <strong>#${o.id.slice(-4).toUpperCase()}</strong> de ${ficha(o.clientId, nombre)}
                    — enviado el ${enviado}${o.user?.name ? `, vendedor ${o.user.name}` : ''}</li>`;
        }).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                <h2 style="color: #dc2626;">⚠️ N° de operación repetido: ${numero}</h2>
                <p><strong>${params.actorName}</strong> cargó el N° de operación <strong>${numero}</strong>
                   en el pedido <strong>#${shortActual}</strong> de ${ficha(actual?.clientId, nombreActual)},
                   pero ese número ya estaba en ${otros.length === 1 ? 'otro pedido' : `${otros.length} pedidos`}:</p>
                <ul style="line-height: 1.8;">${filas}</ul>
                <p>Si es un error, corregí el que corresponda. Si los dos comparten pedido de laboratorio
                   a propósito, ignorá este aviso — queda registrado en la ficha de cada cliente.</p>
                <p style="margin-top: 16px;">
                    <a href="${APP_URL}/admin/ventas?orderId=${params.orderId}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">Ver el pedido en el CRM</a>
                </p>
            </div>
        `;

        const text = `N° de operación ${numero} repetido. ${params.actorName} lo cargó en #${shortActual} (${nombreActual}), ` +
            `pero ya estaba en: ${otros.map(o => `#${o.id.slice(-4).toUpperCase()} (${o.client?.name || 'Cliente'})`).join(', ')}. ` +
            `${APP_URL}/admin/ventas?orderId=${params.orderId}`;

        await sendEmail({
            to: ADMIN_ALERT_EMAILS,
            subject: `⚠️ N° de operación repetido (${numero}): ${nombreActual} y ${otros.map(o => o.client?.name || 'Cliente').join(', ')}`,
            html,
            text,
        });

        // El aviso queda también en la ficha de todos los clientes involucrados:
        // el mail se pierde, la ficha no.
        const involucrados = [
            { clientId: actual?.clientId, short: shortActual },
            ...otros.map(o => ({ clientId: o.clientId, short: o.id.slice(-4).toUpperCase() })),
        ];
        const listado = involucrados.map(i => `#${i.short}`).join(' y ');
        await Promise.all(involucrados
            .filter(i => i.clientId)
            .map(i => prisma.interaction.create({
                data: {
                    clientId: i.clientId!,
                    type: 'SISTEMA',
                    content: `⚠️ El N° de operación ${numero} está repetido en los pedidos ${listado}. Cargado por ${params.actorName}.`,
                    userId: null,
                    userName: 'Sistema',
                },
            }).catch(err => console.error('[dup-op] no se pudo anotar en la ficha:', err)))
        );

        console.log(`[dup-op] N° ${numero} repetido entre #${shortActual} y ${otros.length} pedido(s) — alerta enviada`);
    } catch (err) {
        // Nunca romper la carga del pedido por fallar el aviso.
        console.error('[dup-op] no se pudo procesar la alerta de N° de operación repetido:', err);
    }
}
