import { sendEmail } from '@/lib/email';
import { ATELIER_COPY_EMAIL } from '@/lib/constants';

/**
 * Email a un CLIENTE, más una copia propia a la casilla del negocio.
 *
 * Existe para que los avisos importantes tengan un segundo canal además de
 * WhatsApp, y para que ese canal se arme en UN solo lugar: si cada ruta escribe
 * su propio bloque de email, el pie, la copia al negocio y el escapado divergen.
 *
 * Reglas que respeta todo lo que pasa por acá:
 * - Es un canal ADICIONAL: nunca lanza. Su falla no puede tumbar el envío por
 *   WhatsApp de la ruta que lo llama.
 * - Copia oculta al negocio (nunca `to`): el cliente no ve la casilla interna.
 * - Todo lo interpolado se escapa: los nombres los tipea cualquiera en la ficha.
 */

/** Escapa texto que se interpola dentro del HTML del mail. */
export function escHtml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const PIE = `<p style="margin-top:24px;color:#555;font-size:13px">Atelier Óptica — José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba</p>`;

interface ClientEmailOptions {
    /** Email del cliente. Si viene vacío o sin @, no se manda nada. */
    to?: string | null;
    subject: string;
    /** Cuerpo en HTML, sin el pie (lo agrega este helper). */
    bodyHtml: string;
    attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>;
    /** Para los logs: qué aviso es ("recibo", "pedido listo", …). */
    label: string;
}

/**
 * @returns true si el email al cliente salió; false si no había dirección o si falló.
 */
export async function sendClientEmail({ to, subject, bodyHtml, attachments, label }: ClientEmailOptions): Promise<boolean> {
    const dest = to?.trim();
    if (!dest || !dest.includes('@')) return false;

    let enviado = false;
    try {
        const res = await sendEmail({
            to: dest,
            subject,
            html: `${bodyHtml}${PIE}`,
            ...(attachments?.length ? { attachments } : {}),
        });
        enviado = !!res.success;
        if (enviado) {
            console.log(`[ClientEmail] "${label}" enviado a ${dest}.`);
        } else {
            console.error(`[ClientEmail] "${label}" falló para ${dest}:`, res.error);
        }
    } catch (err) {
        console.error(`[ClientEmail] "${label}" lanzó para ${dest}:`, err);
    }

    // Copia interna al negocio como email PROPIO, no como BCC del mail al cliente.
    //
    // El BCC tenía tres problemas: llegaba con el asunto y el "para" del cliente
    // (imposible de filtrar o buscar por cliente), Gmail lo agrupa con el hilo
    // del cliente, y sobre todo NO se puede distinguir "no llegó la copia" de
    // "no se mandó" — que fue exactamente la duda del 7/8/2026. Como email
    // propio, tiene asunto claro, dice a quién se le mandó y si el envío al
    // cliente salió o falló.
    try {
        await sendEmail({
            to: ATELIER_COPY_EMAIL,
            subject: `[Copia] ${subject} — ${dest}`,
            html: `<p style="background:#f4f4f4;padding:10px;border-radius:6px">
                <strong>Copia interna.</strong> Este es el mensaje que ${enviado ? 'se le envió' : '<strong>NO se pudo enviar</strong>'} a <strong>${escHtml(dest)}</strong> (${escHtml(label)}).
            </p>${bodyHtml}${PIE}`,
            ...(attachments?.length ? { attachments } : {}),
        });
    } catch (err) {
        console.error(`[ClientEmail] copia interna de "${label}" falló:`, err);
    }

    return enviado;
}
