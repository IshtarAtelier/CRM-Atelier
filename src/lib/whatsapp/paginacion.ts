/**
 * Tamaño de página del hilo de WhatsApp. Lo comparten la API
 * (`/api/whatsapp/chats/[id]/messages`) y el buzón: el cliente decide si
 * quedan mensajes más viejos comparando lo recibido contra este número —
 * si divergieran, el "ver anteriores" desaparecería antes de tiempo o
 * pediría páginas de más.
 */
export const PAGINA_MENSAJES = 60;
