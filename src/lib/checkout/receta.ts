/**
 * Estado de la receta dentro de un ítem del carrito.
 *
 * El configurador tenía un dropzone que parecía subir la receta pero guardaba
 * solo el NOMBRE del archivo y tiraba los bytes. Se reemplazó por un pedido
 * explícito de mandarla por WhatsApp, y para eso el ítem lleva este centinela
 * en `prescriptionFile`.
 *
 * El centinela vive acá y no en el configurador porque lo leen también el
 * carrito, el resumen del checkout y los emails: si cada uno compara contra su
 * propio string, el día que cambie el texto alguno va a seguir mostrando un
 * tilde verde sobre una receta que no llegó.
 */

/** Valor que se guarda cuando el cliente todavía tiene que mandar la receta. */
export const RECETA_POR_WHATSAPP = 'A enviar por WhatsApp';

/**
 * ¿La receta está pendiente de recibir?
 *
 * Importa para el copy: mostrar "✓ Receta: …" en verde comunica "ya la
 * tenemos". Cuando está pendiente hay que decirlo con otro tono, porque si no
 * el cliente que pagó cree que ya mandó todo y nadie le pide nada hasta que el
 * pedido se traba en el laboratorio.
 */
export function recetaPendiente(valor?: string | null): boolean {
  return !valor || valor.trim() === RECETA_POR_WHATSAPP;
}
