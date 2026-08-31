/**
 * El link al buzón de WhatsApp del CRM. Un solo lugar.
 *
 * Por qué existe: el buzón (`src/app/admin/whatsapp/page.tsx`) abre una
 * conversación SOLO por `?phone=` — no hay ni un `searchParams.get('chatId')`
 * en todo `src/`. La tarjeta del embudo linkeaba a
 * `/admin/whatsapp?chatId=549…@c.us`, así que el botón "Ir al chat" no abría
 * nada: llevaba al buzón vacío y la vendedora tenía que buscar el contacto a
 * mano. Además había ~8 lugares armando ese link a mano y TRES repitiendo la
 * misma normalización ("si tiene 10 dígitos, prefijá 549").
 *
 * 🔴 POR QUÉ EL LINK VA EN FORMA NACIONAL (10 dígitos) Y NO CON EL 549
 *
 * El buzón no busca por igualdad: pregunta si el identificador del chat
 * CONTIENE lo que vino en la URL (`c.waId.includes(x) || c.client.phone.…
 * includes(x)`). O sea que cuanto MÁS largo el número de la URL, MENOS chats
 * matchea. Medido contra la base local (1.100 fichas / 228 chats):
 *
 *   - `Client.phone` está guardado en tres formatos: 625 fichas con 10 dígitos
 *     ("3512094104"), 277 con 12 ("542974207763", sin el 9) y 166 con 13
 *     ("5493512094104").
 *   - Los `waId` copian esa misma mezcla, y 207 de los 228 chats son `@lid`
 *     (identificador opaco de WhatsApp que no contiene el teléfono).
 *
 * Con el 549 por delante, un link a la ficha "3512094104" no matchea ni su
 * propio teléfono ni un `waId` "542974207763@c.us" — el buzón se cae al
 * `POST /api/whatsapp/chats`, que resuelve por los últimos 8 dígitos, o falla.
 * Los últimos 10 dígitos, en cambio, están CONTENIDOS en los tres formatos, así
 * que el chat se encuentra en el acto y sin ir al servidor.
 *
 * La normalización previa no se reimplementa: se reusa `formatPhoneForWhatsApp()`
 * (`src/lib/phone-utils.ts`), que saca el 0 de trunco, el 15 embebido y los
 * prefijos 54/549 duplicados. Recién sobre ese número limpio se toma la parte
 * nacional. Y el fallback del buzón sigue funcionando igual: con 10 dígitos,
 * `POST /api/whatsapp/chats` vuelve a anteponer el 549 antes de crear nada.
 */

import { formatPhoneForWhatsApp } from '@/lib/phone-utils';

/**
 * Link al buzón abriendo la conversación de ese teléfono.
 *
 * @param phone  Teléfono en cualquier formato (con o sin 54/9/0/15, con guiones).
 * @param texto  Mensaje a precargar en el redactor (`?text=`), opcional.
 * @returns      `/admin/whatsapp?phone=…` — o `/admin/whatsapp` pelado si el
 *               teléfono no tiene dígitos usables (mejor el buzón que un link roto).
 */
export function linkAlChat(phone: string | null | undefined, texto?: string): string {
    // `formatPhoneForWhatsApp` devuelve siempre "549" + parte nacional; '549'
    // pelado significa que no había ni un dígito real detrás.
    const normalizado = formatPhoneForWhatsApp(phone);
    const nacional = normalizado.slice(3);
    if (!nacional) return '/admin/whatsapp';

    const params = new URLSearchParams({ phone: nacional });
    if (texto) params.set('text', texto);
    return `/admin/whatsapp?${params.toString()}`;
}
