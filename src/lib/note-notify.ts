import { sendEmail } from '@/lib/email';
import { notificationEmailFor, firstName, type NotifiableUser } from '@/lib/vendor-email';

function appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
}

interface DirectedNoteInfo {
    /** Usuario al que va dirigida la nota. */
    directedTo: NotifiableUser;
    /** Quién escribió la nota (actor). */
    authorName: string;
    clientId: string;
    clientName: string;
}

/**
 * Aviso por email cuando alguien deja una nota dirigida a un usuario en la
 * ficha de un cliente. No incluye el contenido de la nota a propósito: el
 * asunto lleva a la persona a leerla en la ficha (y como hoy los vendedores
 * comparten casilla, la nota en sí no viaja por email).
 *
 * Asunto: "Matias, recibiste una nota en el cliente Rocio Diaz"
 */
export async function notifyDirectedNote(info: DirectedNoteInfo): Promise<boolean> {
    const nombre = firstName(info.directedTo.name);
    const ficha = `${appUrl()}/admin/contactos?id=${info.clientId}`;

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.7;">
        <p>Hola ${nombre},</p>
        <p><strong>${info.authorName}</strong> te dejó una nota en el cliente <strong>${info.clientName}</strong>.</p>
        <p>Leé la nota en la ficha del cliente:</p>
        <p style="margin: 18px 0;">
          <a href="${ficha}" style="background:#111827; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:bold;">
            Abrir la ficha de ${info.clientName}
          </a>
        </p>
        <p style="font-size:12px; color:#6b7280;">Si el botón no funciona: <a href="${ficha}" style="color:#1e3a8a;">${ficha}</a></p>
      </div>`;

    const res = await sendEmail({
        to: notificationEmailFor(info.directedTo),
        subject: `${nombre}, recibiste una nota en el cliente ${info.clientName}`,
        html,
    });
    return res.success;
}
