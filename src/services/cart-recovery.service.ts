/**
 * Carritos abandonados → ficha en el CRM.
 *
 * Un carrito abandonado que califica como oportunidad de cierre deja de ser una
 * fila suelta de CheckoutSession y pasa a tener ficha de cliente: con etiqueta
 * "Carrito Web", el evento registrado en su historial, y los seguimientos que se
 * le hagan firmados en la misma ficha. Además el panel de Oportunidades puede
 * deduplicar por cliente en vez de por teléfono suelto (los carritos sin
 * teléfono generaban tarjetas "Cliente Web" repetidas sin forma de colapsarlas).
 *
 * Idempotente: si la sesión ya tiene clientId, no hace nada. Si la persona ya
 * existe en el CRM (por teléfono normalizado o email), se linkea a esa ficha en
 * vez de crear una duplicada.
 */

import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { SYSTEM_ACTOR } from '@/lib/actor';
import { normalizeArgentinePhone } from './contact.service';

export const CART_WEB_TAG = 'Carrito Web';

type CheckoutSessionLike = {
    id: string;
    clientId: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    total: number;
    cartData: unknown;
};

function cartItemsSummary(cartData: unknown): string {
    const items = Array.isArray(cartData) ? (cartData as any[]) : [];
    if (items.length === 0) return 'sin detalle de productos';
    return items
        .slice(0, 4)
        .map(i => [i.brand, i.model].filter(Boolean).join(' ') || i.category || 'producto')
        .join(', ');
}

/**
 * Asegura que el carrito tenga ficha asociada y devuelve el clientId (o null si
 * la sesión no dejó ningún dato de contacto utilizable).
 */
export async function ensureClientForAbandonedCart(session: CheckoutSessionLike): Promise<string | null> {
    if (session.clientId) return session.clientId;

    const email = session.email?.trim().toLowerCase() || null;
    const normalizedPhone = normalizeArgentinePhone(session.phone);
    // '549' pelado significa que no había dígitos reales.
    const phone = normalizedPhone.length > 3 ? normalizedPhone : null;
    if (!email && !phone) return null;

    // Buscar ficha existente por email exacto o por teléfono normalizado.
    const last8 = phone ? phone.slice(-8) : null;
    let existing: { id: string; name: string } | null = email
        ? await prisma.client.findFirst({
            where: { isDeleted: false, email: { equals: email, mode: 'insensitive' } },
            select: { id: true, name: true },
        })
        : null;

    if (!existing && last8) {
        // El teléfono en las fichas está como lo tipearon ("0351 15 6998877",
        // "+54 9 351..."), así que un contains de dígitos no matchea: hay que
        // normalizar AMBOS lados. Se cargan solo id/nombre/teléfono y solo en el
        // camino frío (primera vez que un carrito califica) — no por request.
        const candidates = await prisma.client.findMany({
            where: { isDeleted: false, phone: { not: null } },
            select: { id: true, name: true, phone: true },
        });
        existing = candidates.find(c => {
            const n = normalizeArgentinePhone(c.phone);
            return n.length > 3 && n.slice(-8) === last8;
        }) ?? null;
    }

    const summary = cartItemsSummary(session.cartData);
    const detail = `🛒 Carrito abandonado en la tienda: $${session.total.toLocaleString('es-AR')} (${summary})`;

    if (existing) {
        await prisma.$transaction([
            prisma.checkoutSession.update({
                where: { id: session.id },
                data: { clientId: existing.id },
            }),
            prisma.client.update({
                where: { id: existing.id },
                data: { tags: { connectOrCreate: { where: { name: CART_WEB_TAG }, create: { name: CART_WEB_TAG, color: '#f59e0b' } } } },
            }),
            prisma.interaction.create({
                data: {
                    clientId: existing.id,
                    type: 'NOTE',
                    content: detail,
                    userId: SYSTEM_ACTOR.id,
                    userName: SYSTEM_ACTOR.name,
                },
            }),
        ]);
        return existing.id;
    }

    const name = [session.firstName, session.lastName].map(s => s?.trim()).filter(Boolean).join(' ') || 'Cliente Web';
    let client: { id: string };
    try {
        client = await prisma.client.create({
            data: {
                name,
                phone: session.phone?.trim() || null,
                email,
                status: 'CONTACT',
                contactSource: 'Carrito Web',
                createdBy: SYSTEM_ACTOR.name,
                tags: { connectOrCreate: { where: { name: CART_WEB_TAG }, create: { name: CART_WEB_TAG, color: '#f59e0b' } } },
                interactions: {
                    create: {
                        type: 'NOTE',
                        content: `${detail}\nFicha creada automáticamente desde la tienda.`,
                        userId: SYSTEM_ACTOR.id,
                        userName: SYSTEM_ACTOR.name,
                    },
                },
            },
            select: { id: true },
        });
    } catch (err: any) {
        // Carrera entre dos requests procesando carritos de la misma persona:
        // email es @unique, el segundo create pega P2002. El ganador ya creó la
        // ficha — la buscamos y enlazamos a ésa en vez de fallar.
        if (err?.code === 'P2002' && email) {
            const winner = await prisma.client.findFirst({
                where: { email: { equals: email, mode: 'insensitive' } },
                select: { id: true },
            });
            if (!winner) throw err;
            client = winner;
        } else {
            throw err;
        }
    }

    await prisma.checkoutSession.update({
        where: { id: session.id },
        data: { clientId: client.id },
    });

    logAudit({
        userId: SYSTEM_ACTOR.id,
        userName: SYSTEM_ACTOR.name,
        action: 'CREATE',
        entityType: 'CONTACT',
        entityId: client.id,
        details: { origen: 'Carrito abandonado', checkoutSessionId: session.id, total: session.total },
    }).catch(console.error);

    return client.id;
}
