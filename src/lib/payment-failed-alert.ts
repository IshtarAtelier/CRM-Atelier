import { sendEmail } from '@/lib/email';
import { ADMIN_ALERT_EMAILS, CRM_ORIGIN } from '@/lib/constants';

/**
 * Aviso de VENTA WEB PERDIDA POR RECHAZO DE TARJETA.
 *
 * Nació de una venta real que se perdió sin que nadie se enterara: el 29/07/2026
 * un cliente intentó pagar $160.000 dos veces y las dos se las rechazó el emisor.
 * La ruta de checkout cancelaba la orden, la marcaba `isDeleted` y devolvía el
 * stock — dejando el único rastro en un `console.error` de Railway. La ficha del
 * cliente quedaba creada, con teléfono y mail, y nadie lo llamó.
 *
 * Un pago rechazado es el lead MÁS caliente que existe: la persona eligió los
 * productos, completó todos sus datos y puso la tarjeta. Casi siempre el rechazo
 * es del banco (límite, compras por internet deshabilitadas, tope de la tarjeta),
 * no una decisión de no comprar — se recupera con un mensaje ofreciendo otra
 * tarjeta o transferencia (que además tiene 15% off).
 *
 * No bloquea ni lanza NUNCA: avisar no puede romper la respuesta al cliente, que
 * ya está viendo el error del rechazo en pantalla.
 */

interface PaymentFailedInput {
    orderId: string;
    clientId: string;
    /** Nombre para mostrar; se arma con lo que el cliente tipeó en el checkout. */
    customerName: string;
    email?: string | null;
    /** Teléfono ya normalizado (549 + área + número) para armar el link de wa.me. */
    phone?: string | null;
    /** Lo que iba a pagar, en pesos. */
    amount: number;
    /** El motivo tal como lo devolvió Decidir/Payway. */
    reason: string;
    installments?: number | null;
    /** Descripción corta de lo que había en el carrito. */
    items?: { model?: string | null; brand?: string | null; quantity?: number | null }[];
}

const money = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

export async function notifyPaymentFailed(input: PaymentFailedInput): Promise<void> {
    try {
        const { orderId, clientId, customerName, email, phone, amount, reason, installments, items } = input;

        const fichaUrl = `${CRM_ORIGIN}/admin/contactos?clientId=${clientId}`;
        // Link directo para escribirle: el objetivo del mail es que se pueda
        // contactar a la persona en un toque, no que haya que buscarla.
        const soloDigitos = (phone || '').replace(/\D/g, '');
        const waUrl = soloDigitos
            ? `https://wa.me/${soloDigitos}?text=${encodeURIComponent(
                `Hola ${customerName.split(' ')[0]}! Te escribimos de Atelier Óptica. Vimos que tuviste un problema al pagar tu compra y queríamos darte una mano. Podés probar con otra tarjeta o por transferencia (tiene 15% de descuento). ¿Te ayudamos?`
            )}`
            : null;

        const listaItems = (items || [])
            .map(it => `<li>${(it.quantity || 1) > 1 ? `${it.quantity}× ` : ''}${[it.brand, it.model].filter(Boolean).join(' ') || 'Producto'}</li>`)
            .join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                <h2 style="color: #dc2626;">💳 Venta web perdida — le rechazaron la tarjeta</h2>
                <p style="font-size: 15px;">
                    <strong>${customerName}</strong> intentó comprar por <strong>${money(amount)}</strong>${installments && installments > 1 ? ` en ${installments} cuotas` : ''} y el pago fue rechazado.
                </p>

                <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:12px 16px; margin:16px 0;">
                    <p style="margin:0; font-size:13px;"><strong>Motivo del rechazo:</strong> ${reason}</p>
                </div>

                <h3 style="font-size:14px; margin-bottom:6px;">Cómo contactarlo</h3>
                <ul style="line-height:1.7; font-size:14px; margin-top:0;">
                    ${phone ? `<li><strong>Teléfono:</strong> ${phone}</li>` : ''}
                    ${email ? `<li><strong>Email:</strong> <a href="mailto:${email}">${email}</a></li>` : ''}
                </ul>

                ${listaItems ? `<h3 style="font-size:14px; margin-bottom:6px;">Qué quería llevar</h3><ul style="line-height:1.6; font-size:14px; margin-top:0;">${listaItems}</ul>` : ''}

                <p style="font-size:13px; color:#6b7280; line-height:1.6;">
                    Casi siempre el rechazo lo hace el banco (tope de la tarjeta, compras por internet deshabilitadas),
                    no es que la persona se arrepintió. Ofrecele otra tarjeta o transferencia — que además tiene 15% off.
                </p>

                <p style="margin-top: 20px;">
                    ${waUrl ? `<a href="${waUrl}" style="display:inline-block; padding:12px 24px; background-color:#16a34a; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:bold; font-size:14px; margin-right:8px;">Escribirle por WhatsApp</a>` : ''}
                    <a href="${fichaUrl}" style="display:inline-block; padding:12px 24px; background-color:#1f2937; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:bold; font-size:14px;">Ver ficha en el CRM</a>
                </p>

                <p style="font-size:11px; color:#9ca3af; margin-top:24px;">Orden ${orderId} · quedó cancelada y el stock volvió al catálogo.</p>
            </div>
        `;

        const text = `Venta web perdida: a ${customerName} le rechazaron la tarjeta por ${money(amount)}${installments && installments > 1 ? ` en ${installments} cuotas` : ''}. ` +
            `Motivo: ${reason}. ` +
            `Contacto: ${phone || 'sin teléfono'} / ${email || 'sin email'}. ` +
            `Ficha: ${fichaUrl}`;

        await sendEmail({
            to: ADMIN_ALERT_EMAILS,
            subject: `💳 Venta perdida ${money(amount)} — tarjeta rechazada a ${customerName}`,
            html,
            text,
        });
        console.log(`[pago-rechazado] alerta enviada: ${customerName} · ${money(amount)} · ${reason}`);
    } catch (err) {
        console.error('[pago-rechazado] no se pudo enviar la alerta de venta perdida:', err);
    }
}
