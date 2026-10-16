import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { SYSTEM_ACTOR } from '@/lib/actor';
import { SIN_ROBOTS } from '@/lib/checkout/robots';
import { hasClosedOrder } from '@/lib/checkout/purchase-guard';
import { ensureClientForAbandonedCart } from '@/services/cart-recovery.service';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';
import { formatearPrecio } from '@/lib/format-precio';
import { sendWhatsApp } from '@/lib/whatsapp/send';
import { templateSpec, WHATSAPP_TEMPLATES, TEMPLATE_LANGUAGE } from '@/lib/whatsapp/templates';
import { saludoSegunHoraArgentina } from '@/lib/whatsapp/saludo';
import { reclamarEnvio, cerrarEnvio, diaArt, horaArt } from '@/lib/seguimientos/registro';
import { CUPO_DIARIO_POR_DEFECTO, HORA_DESDE, HORA_HASTA } from '@/lib/constants/seguimientos';
import { REMITENTES_AUTOMATICOS } from '@/lib/constants/cierres';
import { esNoCliente } from '@/lib/no-cliente';

/**
 * RECUPERO DE CARRITO POR WHATSAPP, a las 24 h.
 *
 * Plan de la tienda del 15/10/2026 (3.4). El mail de recupero no convirtió
 * nunca (12 mails en 90 días, los 12 al robot de Google); el canal que sí
 * cierra es WhatsApp. A los 45 min el equipo recibe el aviso por la
 * mensajería interna (`aviso-equipo.ts`); si pasan 24 h y NINGÚN humano le
 * escribió, sale la plantilla con el carrito.
 *
 * Lo que NO hace, a propósito:
 *  - no manda nada mientras la plantilla no esté APPROVED en el espejo local
 *    de Meta (`WhatsAppTemplate`) — hoy es un BORRADOR pendiente de Ishtar y
 *    de Meta, así que solo cuenta "pendientes de plantilla";
 *  - no le escribe a quien ya le escribió una persona (el vendedor ya está
 *    encima: una plantilla arriba de esa charla es ruido);
 *  - no pasa el cupo diario de la línea: comparte `SeguimientoEnvio` con el
 *    motor de seguimientos (TIER_250: 250 conversaciones por día entre
 *    campañas y seguimientos; `CUPO_DIARIO_POR_DEFECTO` es la parte que se
 *    permite usar en automático), y una fila por chat + plantilla + día
 *    garantiza que dos corridas no manden dos veces;
 *  - no toca al robot de Google (`SIN_ROBOTS`) ni a quien ya compró;
 *  - no mueve `updatedAt` de la sesión (es el reloj del abandono): marca
 *    `recoveryChannel = 'WHATSAPP'` por SQL crudo, como el resto del recupero.
 */

export const PLANTILLA_RECUPERO_CARRITO = 'recupero_carrito_web' as const;

/**
 * El texto que se va a pedir a Meta. PENDIENTE: aprobación de Ishtar y de
 * Meta. Es el mismo `body` del catálogo (`WHATSAPP_TEMPLATES`), expuesto acá
 * para que el informe del cron y los checks lo muestren sin recorrer el
 * catálogo. Hasta que exista la plantilla aprobada, NO SE ENVÍA.
 */
export const TEXTO_PLANTILLA_RECUPERO_CARRITO = WHATSAPP_TEMPLATES[PLANTILLA_RECUPERO_CARRITO].body;

/** Horas desde la última actividad para el toque por WhatsApp, y techo. */
export const HORAS_RECUPERO_WHATSAPP = 24;
export const HORAS_MAXIMAS_RECUPERO_WHATSAPP = 72;
/** Largo máximo del detalle del carrito dentro del mensaje. */
const LARGO_DETALLE = 80;

type ItemCarrito = { brand?: string; model?: string; name?: string; price?: number; quantity?: number };

/** "Victoria C7 y 1 más ($290.000)": lo que va en el {{3}} de la plantilla. */
export function describirCarritoParaWhatsApp(cartData: unknown, total: number): string {
    const items = Array.isArray(cartData) ? (cartData as ItemCarrito[]) : [];
    const nombres = items
        .map(i => [i.brand, i.model].filter(Boolean).join(' ') || i.name || '')
        .map(n => n.trim())
        .filter(Boolean);
    let detalle = nombres[0] || 'tus productos';
    if (nombres.length > 1) detalle += ` y ${nombres.length - 1} más`;
    if (detalle.length > LARGO_DETALLE) detalle = `${detalle.slice(0, LARGO_DETALLE - 1).trimEnd()}…`;
    return total > 0 ? `${detalle} ($${formatearPrecio(total)})` : detalle;
}

/** true solo si el espejo local de Meta dice que la plantilla está APPROVED. */
export async function plantillaRecuperoAprobada(db = prisma): Promise<boolean> {
    const fila = await db.whatsAppTemplate.findFirst({
        where: { name: PLANTILLA_RECUPERO_CARRITO, language: TEMPLATE_LANGUAGE },
        select: { status: true },
    });
    return fila?.status === 'APPROVED';
}

export interface ResultadoRecuperoWhatsApp {
    /** Carritos con teléfono en la ventana de 24-72 h sin toque por WhatsApp. */
    candidatos: number;
    enviados: number;
    /** No salió porque la plantilla no está aprobada (todos los candidatos). */
    pendientesDePlantilla: number;
    /** Una persona ya le escribió: no se interrumpe. */
    yaLoAtiendeUnHumano: number;
    yaCompro: number;
    sinFicha: number;
    noCliente: number;
    sinCupo: number;
    fallidos: number;
    motivo?: string;
}

const vacio = (extra: Partial<ResultadoRecuperoWhatsApp> = {}): ResultadoRecuperoWhatsApp => ({
    candidatos: 0, enviados: 0, pendientesDePlantilla: 0, yaLoAtiendeUnHumano: 0, yaCompro: 0, sinFicha: 0, noCliente: 0, sinCupo: 0, fallidos: 0, ...extra,
});

/**
 * Encola (manda) el recupero por WhatsApp de los carritos que lo merecen.
 * `modo: 'seco'` lista sin mandar. Nunca lanza: devuelve el motivo.
 */
export async function recuperarCarritosPorWhatsApp(opts: { ahora?: Date; modo?: 'real' | 'seco' } = {}): Promise<ResultadoRecuperoWhatsApp> {
    const ahora = opts.ahora ?? new Date();
    const modo = opts.modo ?? 'real';
    const r = vacio();

    const hace24 = new Date(ahora.getTime() - HORAS_RECUPERO_WHATSAPP * 3_600_000);
    const hace72 = new Date(ahora.getTime() - HORAS_MAXIMAS_RECUPERO_WHATSAPP * 3_600_000);
    const sesiones = await prisma.checkoutSession.findMany({
        where: {
            status: { in: ['PENDING', 'EMAIL_SENT', 'ABANDONED'] },
            phone: { not: null, notIn: [''] },
            updatedAt: { lte: hace24, gte: hace72 },
            // El mail ya salió o no: da igual. Por WhatsApp una sola vez.
            OR: [{ recoveryChannel: null }, { recoveryChannel: { not: 'WHATSAPP' } }],
            ...SIN_ROBOTS,
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, clientId: true, email: true, firstName: true, lastName: true, phone: true, total: true, cartData: true, createdAt: true },
        take: 50,
    });
    r.candidatos = sesiones.length;
    if (!sesiones.length) return r;

    // Interruptores de la línea: los mismos del motor y de las campañas.
    const followups = await prisma.systemSetting.findUnique({ where: { key: 'followups_enabled' }, select: { value: true } });
    if (followups && followups.value !== 'true') return { ...r, motivo: 'followups_enabled=false — recupero por WhatsApp pausado' };
    const hora = horaArt(ahora);
    if (hora < HORA_DESDE || hora >= HORA_HASTA) return { ...r, motivo: `fuera de horario (${HORA_DESDE}-${HORA_HASTA} ART): se reintenta en el próximo tick` };

    const aprobada = await plantillaRecuperoAprobada();
    if (!aprobada) {
        return { ...r, pendientesDePlantilla: sesiones.length, motivo: `la plantilla ${PLANTILLA_RECUPERO_CARRITO} no está aprobada en Meta (pendiente de Ishtar): no se manda nada` };
    }

    const dia = diaArt(ahora);
    const cupoSetting = await prisma.systemSetting.findUnique({ where: { key: 'seguimientos_cupo_diario' }, select: { value: true } });
    const cupoDiario = Number(cupoSetting?.value) || CUPO_DIARIO_POR_DEFECTO;
    const usadoHoy = await prisma.seguimientoEnvio.count({ where: { diaArt: dia, resultado: 'ENVIADO' } });
    let cupo = Math.max(0, cupoDiario - usadoHoy);

    const saludo = saludoSegunHoraArgentina();
    const vistos = new Set<string>();

    for (const s of sesiones) {
        const telefono = formatPhoneForWhatsApp(s.phone || '');
        if (!telefono || telefono.length < 13 || vistos.has(telefono)) continue;
        vistos.add(telefono);

        if (await hasClosedOrder(s.email, s.phone)) { r.yaCompro++; continue; }
        const clientId = s.clientId ?? await ensureClientForAbandonedCart(s).catch(() => null);
        if (!clientId) { r.sinFicha++; continue; }
        const ficha = await prisma.client.findUnique({
            where: { id: clientId },
            select: { name: true, isDeleted: true, opportunityDismissedAt: true, tags: { select: { id: true, name: true } } },
        });
        if (!ficha || ficha.isDeleted || ficha.opportunityDismissedAt) { r.sinFicha++; continue; }
        if (esNoCliente(ficha.tags)) { r.noCliente++; continue; }

        // ¿Alguien del equipo ya le escribió desde que dejó el carrito? Entonces
        // el recupero ya está en manos de una persona.
        const chat = await prisma.whatsAppChat.findFirst({
            where: { OR: [{ waId: telefono }, { waId: `${telefono}@c.us` }, { clientId }] },
            orderBy: { lastMessageAt: 'desc' },
            select: { id: true },
        });
        if (chat) {
            const humano = await prisma.whatsAppMessage.findFirst({
                where: { chatId: chat.id, direction: 'OUTBOUND', createdAt: { gte: s.createdAt }, senderName: { notIn: [...REMITENTES_AUTOMATICOS] } },
                select: { id: true },
            });
            if (humano) { r.yaLoAtiendeUnHumano++; continue; }
        }

        if (cupo <= 0) { r.sinCupo++; continue; }
        if (modo === 'seco') { r.enviados++; cupo--; continue; }

        const nombre = (s.firstName || ficha.name || '').trim().split(/\s+/)[0] || 'Hola';
        const chatId = chat?.id ?? `${telefono}@c.us`;
        const registroId = await reclamarEnvio({ chatId, clientId, plantilla: PLANTILLA_RECUPERO_CARRITO, dia });
        if (!registroId) continue; // otra corrida ya lo mandó hoy

        const params = [nombre, saludo, describirCarritoParaWhatsApp(s.cartData, s.total || 0)];
        try {
            const res = await sendWhatsApp({
                chatId: `${telefono}@c.us`,
                message: '',
                senderName: SYSTEM_ACTOR.name,
                isProactive: true,
                forceTemplate: true,
                template: templateSpec(PLANTILLA_RECUPERO_CARRITO, params),
            });
            if (!res.ok) {
                await cerrarEnvio(registroId, 'FALLIDO', res.error || `HTTP ${res.status ?? '?'}`);
                r.fallidos++;
                continue;
            }
            await cerrarEnvio(registroId, 'ENVIADO', res.via);
            r.enviados++;
            cupo--;
            // Sin mover updatedAt (es el reloj del abandono).
            await prisma.$executeRaw`UPDATE "CheckoutSession" SET "recoveryChannel" = 'WHATSAPP', "recoveryTouchAt" = ${ahora} WHERE "id" = ${s.id}`;
            await prisma.interaction.create({
                data: {
                    clientId, type: 'FOLLOWUP', userId: SYSTEM_ACTOR.id, userName: SYSTEM_ACTOR.name,
                    content: `📲 ${SYSTEM_ACTOR.name} mandó el recupero del carrito por WhatsApp (plantilla ${PLANTILLA_RECUPERO_CARRITO}): ${params[2]}.`,
                },
            }).catch(console.error);
            logAudit({
                userId: SYSTEM_ACTOR.id, userName: SYSTEM_ACTOR.name, action: 'NOTIFY', entityType: 'CONTACT', entityId: clientId,
                details: { origen: 'recupero-carrito-whatsapp', checkoutSessionId: s.id, plantilla: PLANTILLA_RECUPERO_CARRITO, total: s.total },
            }).catch(console.error);
        } catch (e: any) {
            await cerrarEnvio(registroId, 'FALLIDO', e?.message);
            r.fallidos++;
        }
    }
    return r;
}
