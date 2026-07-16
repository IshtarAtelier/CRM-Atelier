/**
 * Identidad de email de los vendedores/usuarios internos.
 *
 * Hoy los dos vendedores (Matías y Milena) comparten la casilla del local y
 * Ishtar usa su Gmail personal. El día que cada vendedor tenga su propia
 * casilla, se carga en User.notificationEmail (editable desde
 * /admin/configuracion → Usuarios) y todos los avisos dirigidos (notas,
 * pedidos sin procesar, saldos) empiezan a llegarle ahí sin tocar código:
 * este módulo es el ÚNICO lugar que resuelve "el email de este usuario".
 */

/** Casilla compartida del local que atienden los vendedores. */
export const SHARED_VENDOR_INBOX = process.env.VENDOR_ALERT_EMAILS || 'atelier.optica.cerro@gmail.com';

/** Casilla personal de Ishtar (recibe copia y las respuestas de los vendedores). */
export const ISHTAR_INBOX = process.env.PERSONAL_REPLY_TO || 'pisano.ishtar@gmail.com';

/** Remitente "personal" (los mails que salen como escritos por Ishtar). */
export const PERSONAL_FROM = process.env.PERSONAL_EMAIL_FROM || 'Ishtar - Atelier Óptica <ishtar@atelieroptica.com.ar>';

export interface NotifiableUser {
    id?: string | null;
    name?: string | null;
    /** Username de login (User.email guarda el usuario, no una dirección). */
    email?: string | null;
    /** Casilla propia del usuario, si la tiene configurada. */
    notificationEmail?: string | null;
}

/** Email donde avisarle a un usuario: su casilla propia o la compartida del local. */
export function notificationEmailFor(user?: NotifiableUser | null): string {
    const own = (user?.notificationEmail || '').trim();
    return own || SHARED_VENDOR_INBOX;
}

/**
 * Vendedores que atienden la casilla del local, con el apodo con el que
 * Ishtar les escribe. Se matchea por nombre y por username.
 */
const KNOWN_VENDORS: { match: string[]; greeting: string }[] = [
    { match: ['matias', 'matías'], greeting: 'Mati' },
    { match: ['milena'], greeting: 'Mile' },
];

/** Apodo del vendedor ("Mati"/"Mile") o null si no es un vendedor conocido. */
export function vendorGreeting(user?: NotifiableUser | null): string | null {
    const haystack = `${user?.name || ''} ${user?.email || ''}`.toLowerCase();
    for (const v of KNOWN_VENDORS) {
        if (v.match.some(m => haystack.includes(m))) return v.greeting;
    }
    return null;
}

/** Primer nombre ("Matias Turchi" → "Matias"). */
export function firstName(fullName?: string | null): string {
    return (fullName || '').trim().split(/\s+/)[0] || 'Hola';
}
