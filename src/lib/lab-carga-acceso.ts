import type { Actor } from '@/lib/actor';
import { prisma } from '@/lib/db';

/**
 * Quién puede cargar pedidos en el portal de un laboratorio (carga asistida,
 * `src/services/lab-modules`): SOLO Ishtar y Milena (Ishtar, 15/10/2026).
 * ADMIN entra siempre; Milena es STAFF, así que se la reconoce por su usuario
 * (`email`, que en producción es "milena"). Para sumar o cambiar a alguien sin
 * tocar código: env CARGA_LAB_EMAILS (lista separada por comas).
 * El middleware no inyecta el email: para no-ADMIN se resuelve por id.
 */
const POR_DEFECTO = ['milena'];

export async function puedeCargarEnLaboratorio(actor: Actor): Promise<boolean> {
    if (actor.role === 'ADMIN') return true;
    if (!actor.id) return false;
    const env = (process.env.CARGA_LAB_EMAILS || '')
        .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const permitidos = env.length > 0 ? env : POR_DEFECTO;
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { email: true } });
    return !!user?.email && permitidos.includes(user.email.toLowerCase());
}
