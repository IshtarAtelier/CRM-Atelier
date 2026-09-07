import { sendEmail } from '@/lib/email';

/**
 * Email a un CLIENTE.
 *
 * Existe para que los avisos importantes tengan un segundo canal además de
 * WhatsApp, y para que ese canal se arme en UN solo lugar: si cada ruta escribe
 * su propio bloque de email, el pie y el escapado divergen.
 *
 * Reglas que respeta todo lo que pasa por acá:
 * - Es un canal ADICIONAL: nunca lanza. Su falla no puede tumbar el envío por
 *   WhatsApp de la ruta que lo llama.
 * - Todo lo interpolado se escapa: los nombres los tipea cualquiera en la ficha.
 *
 * Lo que ya NO hace: mandar una copia de cada aviso a la casilla del negocio
 * (`atelier.optica.cerro@`). Nació el 7/8/2026 para poder distinguir "no llegó
 * la copia" de "no se mandó", y terminó siendo un mail por cada presupuesto y
 * cada pedido listo en una casilla que se lee a mano — ruido, y se apaga
 * (Ishtar, 7/9/2026). Si un aviso salió o no sigue quedando en el log
 * (`[ClientEmail] "<label>" enviado a …` / `… falló para …`), que es donde se
 * mira cuando hay una duda concreta.
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

    return enviado;
}
