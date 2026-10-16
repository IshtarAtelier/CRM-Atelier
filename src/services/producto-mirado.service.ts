import { prisma } from '@/lib/db';
import { FILTRO_MENSAJES_CON_PRODUCTO, productoMiradoEnMensaje, type ProductoMirado } from '@/lib/producto-mirado-web';

/**
 * Qué producto de la tienda miraba cada cliente, leído de sus chats de
 * WhatsApp (ver src/lib/producto-mirado-web.ts). Una consulta para todos los
 * clientes pedidos; devuelve solo los que nombraron alguno.
 */
export async function productoMiradoPorCliente(clientIds: string[]): Promise<Map<string, ProductoMirado>> {
    const ids = [...new Set(clientIds.filter(Boolean))];
    const out = new Map<string, ProductoMirado>();
    if (!ids.length) return out;
    const mensajes = await prisma.whatsAppMessage.findMany({
        where: { direction: 'INBOUND', chat: { clientId: { in: ids } }, ...FILTRO_MENSAJES_CON_PRODUCTO },
        orderBy: { createdAt: 'asc' },
        select: { content: true, chat: { select: { clientId: true } } },
        take: ids.length * 3,
    });
    for (const m of mensajes) {
        const clientId = m.chat.clientId;
        if (!clientId || out.has(clientId)) continue;
        const p = productoMiradoEnMensaje(m.content);
        if (p) out.set(clientId, p);
    }
    return out;
}

export async function productoMiradoDe(clientId: string): Promise<ProductoMirado | null> {
    return (await productoMiradoPorCliente([clientId])).get(clientId) ?? null;
}
