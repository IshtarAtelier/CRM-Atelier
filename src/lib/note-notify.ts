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
    /** Texto de la nota, para mostrarlo en el cuerpo del email. */
    noteContent?: string;
}

/** Escapa el texto de la nota para meterlo seguro en el HTML del email. */
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
}

/**
 * Aviso por email cuando alguien deja una nota dirigida a un usuario en la
 * ficha de un cliente. Muestra el texto de la nota en el cuerpo para poder
 * decidir de un vistazo si es urgente o si se puede ver después, con el botón
 * a la ficha para responder/actuar.
 *
 * Asunto: "Matias, recibiste una nota en el cliente Rocio Diaz"
 */
export async function notifyDirectedNote(info: DirectedNoteInfo): Promise<boolean> {
    const nombre = firstName(info.directedTo.name);
    const ficha = `${appUrl()}/admin/contactos?id=${info.clientId}`;
    const noteText = (info.noteContent || '').trim();

    // La nota misma, resaltada como una cita para que se lea de un vistazo.
    const noteBlock = noteText
        ? `<div style="margin:16px 0; padding:14px 16px; background:#f9fafb; border-left:4px solid #111827; border-radius:6px; color:#111827; white-space:normal;">${escapeHtml(noteText)}</div>`
        : '';

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.7;">
        <p>Hola ${nombre},</p>
        <p><strong>${info.authorName}</strong> te dejó una nota en el cliente <strong>${info.clientName}</strong>:</p>
        ${noteBlock}
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
