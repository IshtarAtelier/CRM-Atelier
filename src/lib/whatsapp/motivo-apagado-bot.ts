/**
 * Por qué está apagado el bot en un chat — espejo del CRM de
 * `wa-service/shared/motivo-apagado.js` (mismos valores; lo fija
 * `npm run check:vuelta-bot`).
 *
 * Por qué existe (auditoría del 15/10/2026): el bot volvía solo a cualquier
 * chat con la etiqueta `[SISTEMA - BOT APAGADO]`, que también ponían el panel,
 * la derivación y los errores. Ahora cada apagado dice su motivo y SOLO
 * `TOMADO_POR_PERSONA` deja que el bot vuelva solo. Todo camino del CRM que
 * apaga o prende el bot de un chat pasa por acá.
 *
 * Tolerancia a la columna ausente: el CRM corre `migrate deploy` al arrancar,
 * así que en producción la columna siempre está antes de que este código
 * sirva. Igual se escribe con `updateMany` (no devuelve la fila) y, si la base
 * rechaza las columnas nuevas, se reintenta sin ellas.
 */

export const MOTIVO_APAGADO = {
    TOMADO_POR_PERSONA: 'TOMADO_POR_PERSONA',
    APAGADO_MANUAL: 'APAGADO_MANUAL',
    DERIVADO: 'DERIVADO',
    PERSONAL: 'PERSONAL',
    ERRORES: 'ERRORES',
    GUARDRAIL: 'GUARDRAIL',
    CREDITO: 'CREDITO',
    ETIQUETA: 'ETIQUETA',
} as const;

export type MotivoApagado = (typeof MOTIVO_APAGADO)[keyof typeof MOTIVO_APAGADO];

const COLUMNAS_NUEVAS = ['botOffReason', 'botOffAt'] as const;

export function datosDeApagado(motivo: MotivoApagado, ahora: Date = new Date()) {
    return { botEnabled: false, botOffReason: motivo as string | null, botOffAt: ahora as Date | null };
}

export function datosDePrendido() {
    return { botEnabled: true, botOffReason: null as string | null, botOffAt: null as Date | null };
}

function esColumnaAusente(e: unknown): boolean {
    const err = e as { code?: string; message?: string } | null;
    if (!err) return false;
    if (err.code === 'P2022') return true;
    const m = String(err.message || '');
    return /Unknown (argument|field|arg)|does not exist/i.test(m) && COLUMNAS_NUEVAS.some(c => m.includes(c));
}

type UpdateManyChat = {
    whatsAppChat: { updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }> };
};

/** `updateMany` de WhatsAppChat que sobrevive a una base sin las columnas del motivo. */
export async function actualizarChatsBot(
    prisma: UpdateManyChat,
    where: Record<string, unknown>,
    data: Record<string, unknown>,
): Promise<{ count: number }> {
    try {
        return await prisma.whatsAppChat.updateMany({ where, data });
    } catch (e) {
        if (!esColumnaAusente(e)) throw e;
        console.warn('[MotivoApagado] La base no tiene botOffReason/botOffAt: se escribe sin el motivo.');
        const sin = Object.fromEntries(Object.entries(data).filter(([k]) => !(COLUMNAS_NUEVAS as readonly string[]).includes(k)));
        return prisma.whatsAppChat.updateMany({ where, data: sin });
    }
}
