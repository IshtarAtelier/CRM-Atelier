import type { Actor } from '@/lib/actor';
import { prisma } from '@/lib/db';

/**
 * Acceso al panel de captación de ópticas (/admin/opticas):
 * SOLO Ishtar y Milena. ADMIN entra siempre; para sumar a Milena sin
 * cambiarle el rol, su email va en la env OPTICAS_LEADS_EMAILS
 * (lista separada por comas). Cualquier otro STAFF queda afuera.
 * El middleware no inyecta email, así que para no-ADMIN se resuelve por id.
 */
export async function canAccessOpticasLeads(actor: Actor): Promise<boolean> {
    if (actor.role === 'ADMIN') return true;
    const allowed = (process.env.OPTICAS_LEADS_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
    if (allowed.length === 0 || !actor.id) return false;
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { email: true } });
    return !!user?.email && allowed.includes(user.email.toLowerCase());
}

/**
 * Normaliza un teléfono argentino a formato wa.me (549 + área + número, sin
 * signos). Devuelve null si no parece un número usable.
 * Ej: "011 4752-6689" → "5491147526689"; "351 686-5644" → "5493516865644".
 */
export function normalizePhoneWa(raw?: string | null): string | null {
    if (!raw) return null;
    let d = raw.replace(/\D/g, '');
    if (!d) return null;
    // Sacar prefijo internacional si ya viene
    if (d.startsWith('549')) d = d.slice(3);
    else if (d.startsWith('54')) d = d.slice(2);
    // Sacar 0 inicial de área
    if (d.startsWith('0')) d = d.slice(1);
    // "15" después del código de área (ej 351 15 423 9876 → 12 dígitos): solo
    // quitarlo cuando sobran exactamente esos 2 dígitos, para no comerse
    // números válidos que casualmente contienen "15".
    if (d.length === 12) d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    // 10 dígitos = código de área + número local (formato nacional sin 9)
    if (d.length !== 10) return null;
    return '549' + d;
}
