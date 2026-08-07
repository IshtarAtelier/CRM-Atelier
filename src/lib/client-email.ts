import { sendEmail } from '@/lib/email';
import { RECEIPTS_BCC_EMAIL } from '@/lib/constants';

/**
 * Email a un CLIENTE con copia (BCC) a la casilla del negocio.
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
 * @returns true si el email salió; false si no había dirección o si falló.
 */
export async function sendClientEmail({ to, subject, bodyHtml, attachments, label }: ClientEmailOptions): Promise<boolean> {
    const dest = to?.trim();
    if (!dest || !dest.includes('@')) return false;

    try {
        const res = await sendEmail({
            to: dest,
            bcc: RECEIPTS_BCC_EMAIL,
            subject,
            html: `${bodyHtml}${PIE}`,
            ...(attachments?.length ? { attachments } : {}),
        });
        if (res.success) {
            console.log(`[ClientEmail] "${label}" enviado a ${dest} (BCC negocio).`);
            return true;
        }
        console.error(`[ClientEmail] "${label}" falló para ${dest}:`, res.error);
        return false;
    } catch (err) {
        console.error(`[ClientEmail] "${label}" lanzó para ${dest}:`, err);
        return false;
    }
}
