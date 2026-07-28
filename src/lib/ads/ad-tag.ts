import { prisma } from '@/lib/db';

/**
 * Etiqueta del prefill de un anuncio: "[metaFlor]" → "flor". Solo corchetes —
 * a diferencia de adTag() de meta-insights NO deduce por producto, porque esta
 * forma se persiste como columna y una mención casual ("quiero clipones") no
 * puede quedar grabada como origen del cliente. Misma normalización que el
 * wa-service usa en su ingestión directa.
 */
export function prefillAdTag(text?: string | null): string | null {
    if (!text) return null;
    const m = String(text).match(/\[\s*meta([^\]]*?)\s*\]/i);
    if (!m) return null;
    const tag = m[1].trim().toLowerCase().replace(/\s+/g, '');
    return tag || null;
}

/**
 * Copia la etiqueta de anuncio persistida en los chats del cliente a
 * Client.adTag (primer toque: el chat más viejo con etiqueta gana y una
 * etiqueta ya grabada nunca se pisa). Llamar después de vincular un chat a un
 * cliente. Nunca lanza — la medición no puede romper el flujo que la invoca.
 */
export async function syncAdTagFromChats(clientId: string): Promise<void> {
    try {
        const chat = await prisma.whatsAppChat.findFirst({
            where: { clientId, adTag: { not: null } },
            orderBy: { createdAt: 'asc' },
            select: { adTag: true },
        });
        if (!chat?.adTag) return;
        await prisma.client.updateMany({
            where: { id: clientId, adTag: null },
            data: { adTag: chat.adTag },
        });
    } catch (e) {
        console.error('[adTag] Error sincronizando etiqueta al cliente:', e);
    }
}
