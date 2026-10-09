/**
 * GIFT CARDS: emitir tarjetas de regalo, listarlas y cambiarles el estado.
 *
 * Toda la lógica vive acá; las rutas de /api/gift-cards validan, llaman y
 * responden. Quién puede qué está en `src/lib/constants/gift-cards.ts`.
 *
 * El código (AO-AAMM-NNNN) lo genera este service, nunca la pantalla: es lo
 * que el cliente presenta para canjear, así que tiene que ser único y no
 * depender de lo que alguien tipee.
 *
 * Las fechas de vencimiento son DÍAS: se guardan a medianoche de Córdoba,
 * como en las novedades del equipo.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';
import {
    ESTADOS_GIFT_CARD, ESTADOS_SOLO_ADMIN, MONTO_MAXIMO_GIFT_CARD, PREFIJO_CODIGO_GIFT_CARD,
    hoyCordoba, type EstadoGiftCard,
} from '@/lib/constants/gift-cards';

const TZ_OFFSET = '-03:00'; // Córdoba no tiene horario de verano.
const ROLES_INTERNOS = ['ADMIN', 'STAFF'];

export class GiftCardError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

export interface GiftCardInput {
    para: string;
    de?: string | null;
    monto: number;
    /** AAAA-MM-DD o vacío (sin vencimiento). */
    validaHasta?: string | null;
    telefono?: string | null;
    notas?: string | null;
}

const SELECT = {
    id: true, code: true, para: true, de: true, monto: true, validaHasta: true, telefono: true,
    estado: true, usadaAt: true, usadaPorName: true, notas: true, createdByName: true, createdAt: true,
} as const;

function exigirEquipo(actor: Actor) {
    if (!actor.id) throw new GiftCardError('Sin sesión', 401);
    if (!actor.role || !ROLES_INTERNOS.includes(actor.role)) throw new GiftCardError('Solo el equipo puede manejar gift cards', 403);
}

/** "2026-10-08" → Date a medianoche de Córdoba. Rechaza cualquier otra cosa. */
function diaAFecha(dia: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new GiftCardError('Fecha de vencimiento inválida (se espera AAAA-MM-DD)');
    const d = new Date(`${dia}T00:00:00${TZ_OFFSET}`);
    if (isNaN(d.getTime())) throw new GiftCardError('Fecha de vencimiento inválida');
    return d;
}

function texto(v: unknown, max: number): string | null {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'string') throw new GiftCardError('Dato inválido');
    const t = v.trim().replace(/\s+/g, ' ');
    if (t.length > max) throw new GiftCardError(`Texto demasiado largo (máximo ${max} caracteres)`);
    return t || null;
}

function nuevoCodigo(): string {
    const hoy = hoyCordoba(); // AAAA-MM-DD
    const aamm = hoy.slice(2, 4) + hoy.slice(5, 7);
    const n = Math.floor(Math.random() * 10_000).toString().padStart(4, '0');
    return `${PREFIJO_CODIGO_GIFT_CARD}-${aamm}-${n}`;
}

export class GiftCardService {

    /** Las últimas tarjetas, filtradas por código, para o de. */
    static listar(actor: Actor, q?: string | null) {
        exigirEquipo(actor);
        const busqueda = q?.trim();
        return prisma.giftCard.findMany({
            where: busqueda ? {
                OR: [
                    { code: { contains: busqueda, mode: 'insensitive' } },
                    { para: { contains: busqueda, mode: 'insensitive' } },
                    { de: { contains: busqueda, mode: 'insensitive' } },
                ],
            } : undefined,
            select: SELECT,
            orderBy: { createdAt: 'desc' },
            take: 300,
        });
    }

    static async crear(input: GiftCardInput, actor: Actor) {
        exigirEquipo(actor);
        const para = texto(input.para, 80);
        if (!para) throw new GiftCardError('Falta el nombre de quien recibe la tarjeta');
        const monto = Number(input.monto);
        if (!Number.isFinite(monto) || monto <= 0) throw new GiftCardError('Falta el monto');
        if (monto > MONTO_MAXIMO_GIFT_CARD) throw new GiftCardError('El monto parece demasiado alto: revisalo');
        let validaHasta: Date | null = null;
        if (input.validaHasta) {
            if (input.validaHasta < hoyCordoba()) throw new GiftCardError('La fecha de vencimiento ya pasó');
            validaHasta = diaAFecha(input.validaHasta);
        }
        const telefono = (input.telefono || '').replace(/\D/g, '') || null;

        // El código es único en la base: si choca (1 en 10.000 por mes), se
        // genera otro. Cinco choques seguidos no es azar, es un error.
        for (let intento = 0; intento < 5; intento++) {
            try {
                const card = await prisma.giftCard.create({
                    data: {
                        code: nuevoCodigo(),
                        para,
                        de: texto(input.de, 80),
                        monto: Math.round(monto),
                        validaHasta,
                        telefono,
                        notas: texto(input.notas, 500),
                        createdById: actor.id,
                        createdByName: actor.name,
                    },
                    select: SELECT,
                });
                logAudit({
                    userId: actor.id, userName: actor.name, action: 'CREATE', entityType: 'GIFT_CARD', entityId: card.id,
                    details: { code: card.code, para: card.para, monto: card.monto, validaHasta: input.validaHasta || null },
                }).catch(console.error);
                return card;
            } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
                throw e;
            }
        }
        throw new GiftCardError('No se pudo generar un código libre. Probá de nuevo.', 500);
    }

    /**
     * USADA: cualquiera del equipo (es el canje en el mostrador).
     * ACTIVA (deshacer un canje) o ANULADA: solo ADMIN.
     */
    static async cambiarEstado(id: string, estado: EstadoGiftCard, actor: Actor) {
        exigirEquipo(actor);
        if (!ESTADOS_GIFT_CARD.includes(estado)) throw new GiftCardError('Estado inválido');
        if (ESTADOS_SOLO_ADMIN.includes(estado) && actor.role !== 'ADMIN') {
            throw new GiftCardError('Reactivar o anular una gift card lo hace un administrador', 403);
        }
        const actual = await prisma.giftCard.findUnique({ where: { id }, select: { id: true, code: true, estado: true } });
        if (!actual) throw new GiftCardError('No existe', 404);
        if (actual.estado === estado) return prisma.giftCard.findUnique({ where: { id }, select: SELECT });
        if (estado === 'USADA' && actual.estado !== 'ACTIVA') throw new GiftCardError('Solo se puede usar una tarjeta activa');

        const card = await prisma.giftCard.update({
            where: { id },
            data: estado === 'USADA'
                ? { estado, usadaAt: new Date(), usadaPorId: actor.id, usadaPorName: actor.name }
                : { estado, ...(estado === 'ACTIVA' ? { usadaAt: null, usadaPorId: null, usadaPorName: null } : {}) },
            select: SELECT,
        });
        // Un cambio de estado de una tarjeta es plata: el audit se espera.
        await logAudit({
            userId: actor.id, userName: actor.name, action: 'STATUS_CHANGE', entityType: 'GIFT_CARD', entityId: id,
            details: { code: actual.code, de: actual.estado, a: estado },
        });
        return card;
    }
}
