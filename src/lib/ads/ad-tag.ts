import { prisma } from '@/lib/db';

/**
 * Fachada del parser de etiquetas de anuncio.
 *
 * La lógica pura vive en `ad-tag-core.ts` (sin imports, para que el check de
 * paridad pueda ejecutarla directo contra la copia CommonJS del bot). Acá se
 * reexporta todo y se suma lo único que necesita base de datos.
 */
export {
    parseAdTag,
    prefillAdTag,
    fallbackAdTag,
    stripAdTags,
    platformFromStoredTag,
} from './ad-tag-core';
export type { AdPlatform, ParsedAdTag } from './ad-tag-core';

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
