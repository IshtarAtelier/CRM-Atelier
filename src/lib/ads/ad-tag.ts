import { prisma } from '@/lib/db';

/**
 * Plataforma de la que vino el clic pago. `[metaFlor]` y `[googleVerano]` son
 * las dos formas del prefill que cargamos nosotros en Ads Manager y en Google
 * Ads; el vocabulario es cerrado a propósito.
 */
export type AdPlatform = 'META' | 'GOOGLE';

export interface ParsedAdTag {
    platform: AdPlatform;
    /** Campaña ya normalizada: "[metaFlor]" → "flor". */
    campaign: string;
}

/**
 * ÚNICO parser de la etiqueta del prefill. Todo tiene que pasar por acá.
 *
 * Antes había cuatro copias de este regex y NO eran iguales: `meta-insights.ts`
 * aceptaba `[a-z0-9_ -]` y el resto `[^\]]`, así que un mismo chat podía recibir
 * una etiqueta al entrar por el bot y otra distinta al reportarse. La versión
 * CommonJS para el bot y los scripts vive en `wa-service/shared/ad-tag.js` —los
 * dos mundos se despliegan por separado y no pueden importarse entre sí— y
 * `scripts/checks/ad-tag-paridad.check.mjs` falla si divergen.
 *
 * Reconoce `google` además de `meta`: hasta ahora exigía el literal `meta`, así
 * que un anuncio de Google era estructuralmente invisible por más que le
 * pusieras la etiqueta.
 */
export function parseAdTag(text?: string | null): ParsedAdTag | null {
    if (!text) return null;
    const m = String(text).match(/\[\s*(meta|google)([^\]]*?)\s*\]/i);
    if (!m) return null;
    const campaign = m[2].trim().toLowerCase().replace(/\s+/g, '');
    if (!campaign) return null;
    return { platform: m[1].toLowerCase() === 'google' ? 'GOOGLE' : 'META', campaign };
}

/**
 * Clave que se persiste en `WhatsAppChat.adTag` / `Client.adTag`.
 *
 * Meta va sin prefijo y Google con `google:` adelante. Es deliberado: hay
 * historial de filas de Meta guardadas sin prefijo y los reportes las cruzan por
 * ese valor exacto, así que prefijar Meta invalidaría lo viejo. Con este esquema
 * el histórico sigue leyéndose y lo nuevo de Google queda distinguible.
 *
 * Solo corchetes — a diferencia de adTag() de meta-insights NO deduce por
 * producto, porque esta forma se persiste como columna y una mención casual
 * ("quiero clipones") no puede quedar grabada como origen del cliente.
 */
export function prefillAdTag(text?: string | null): string | null {
    const parsed = parseAdTag(text);
    if (!parsed) return null;
    return parsed.platform === 'GOOGLE' ? `google:${parsed.campaign}` : parsed.campaign;
}

/** Plataforma a partir de una etiqueta ya guardada en la base. */
export function platformFromStoredTag(tag?: string | null): AdPlatform | null {
    if (!tag) return null;
    return tag.startsWith('google:') ? 'GOOGLE' : 'META';
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
