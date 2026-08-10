import { prisma } from '@/lib/db';

/**
 * Vincula un chat de WhatsApp con la ficha del cliente que le corresponde.
 *
 * El agujero que tapa: el vínculo chat↔cliente se armaba en UN solo sentido.
 * Cuando se creaba una ficha, `ContactService.create` buscaba los chats sueltos
 * con ese teléfono y los enganchaba. Pero cuando entraba un WhatsApp nuevo, el
 * chat se creaba con `clientId: null` y NADIE volvía a mirar si esa persona ya
 * era clienta. Resultado medido: los chats con etiqueta de anuncio tenían el
 * `clientId` en NULL, y como el reporte de ROAS cruza gasto contra ventas POR
 * clientId (`api/cron/ads-report`), toda venta de esa gente quedaba invisible
 * para la atribución. El plan lo anotó como bloqueante B5: sin esto, ninguna
 * regla de corte por retorno es ejecutable, porque el retorno se subestima.
 *
 * Cómo matchea: por los últimos 8 dígitos del teléfono. Es el mismo criterio
 * que ya usaba `contact.service.ts`, y existe porque el mismo número aparece
 * escrito de formas distintas (con y sin 9, con y sin 54, con prefijo de área
 * separado). Comparar los últimos 8 evita todas esas variantes de una.
 */

/**
 * Extrae los dígitos del identificador de WhatsApp.
 *
 * `waId` puede venir como `5493511234567@c.us` (un teléfono real) o como un
 * `@lid` — un identificador opaco que WhatsApp usa cuando no expone el número.
 * Del `@lid` no se puede sacar teléfono, y por eso el chat guarda `realPhone`
 * aparte cuando se lo conoce por otra vía.
 */
export function telefonoDeChat(chat: { waId?: string | null; realPhone?: string | null }): string | null {
  const desdeReal = (chat.realPhone || '').replace(/\D/g, '');
  if (desdeReal.length >= 8) return desdeReal;

  const waId = chat.waId || '';
  // Un @lid no es un teléfono: usarlo daría un match por casualidad de dígitos.
  if (!waId.includes('@c.us')) return null;
  const digitos = waId.split('@')[0].replace(/\D/g, '');
  return digitos.length >= 8 ? digitos : null;
}

/**
 * Busca la ficha cuyo teléfono coincide en los últimos 8 dígitos.
 *
 * Si hay más de una candidata devuelve `null` en vez de elegir: adivinar mal
 * mete la conversación de una persona en la ficha de otra, que es bastante peor
 * que dejar el chat sin vincular. El caso se loguea para poder revisarlo.
 */
export async function buscarClientePorTelefono(telefono: string): Promise<string | null> {
  const sufijo = telefono.slice(-8);
  if (sufijo.length < 8) return null;

  const candidatos = await prisma.client.findMany({
    where: { isDeleted: false, phone: { contains: sufijo } },
    select: { id: true, name: true },
    take: 3,
  });

  if (candidatos.length === 1) return candidatos[0].id;
  if (candidatos.length > 1) {
    console.warn(
      `[vincular-chat] ${candidatos.length} fichas comparten el final ${sufijo} ` +
        `(${candidatos.map((c) => c.name).join(', ')}): no se vincula para no mezclar conversaciones.`,
    );
  }
  return null;
}

/**
 * Engancha el chat con su ficha si puede. Devuelve el `clientId` si vinculó.
 *
 * No lanza: esto corre en la ruta por la que entra CADA mensaje de WhatsApp, y
 * un error acá no puede hacer que se pierda el mensaje.
 */
export async function vincularChatSiCorresponde(chat: {
  id: string;
  clientId?: string | null;
  waId?: string | null;
  realPhone?: string | null;
}): Promise<string | null> {
  if (chat.clientId) return chat.clientId;

  try {
    const telefono = telefonoDeChat(chat);
    if (!telefono) return null;

    const clientId = await buscarClientePorTelefono(telefono);
    if (!clientId) return null;

    // `clientId: null` en el where: si otro proceso lo vinculó mientras tanto,
    // no se pisa su decisión.
    const r = await prisma.whatsAppChat.updateMany({
      where: { id: chat.id, clientId: null },
      data: { clientId },
    });
    if (r.count > 0) {
      console.log(`[vincular-chat] Chat ${chat.waId} enganchado a la ficha ${clientId}.`);
      return clientId;
    }
    return null;
  } catch (err) {
    console.error('[vincular-chat] No se pudo vincular (el mensaje sigue su curso):', err);
    return null;
  }
}
