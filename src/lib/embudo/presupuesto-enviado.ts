/**
 * ¿El presupuesto le LLEGÓ al cliente, o solo está armado en el CRM?
 *
 * Hasta el 12/9/2026 el embudo tomaba "hay un QUOTE en la base" como
 * "cotización enviada", y el motor de seguimientos le escribía "¿pudiste ver
 * el presupuesto que te pasamos?". Alina contestó: "No me pasaron presupuesto.
 * Ya compré en otra óptica". Medido ese día: de 188 presupuestos creados
 * desde el 7/9, 38 no tenían ningún rastro de envío — armados y nunca
 * mandados.
 *
 * Prueba de envío, cualquiera de las dos:
 *   - la nota "📄 Presupuesto enviado" que deja `send-order-pdf` (PDF por
 *     WhatsApp/mail, lo mande una persona o el bot), posterior al presupuesto;
 *   - un mensaje de WhatsApp escrito por una PERSONA después de armarlo (el
 *     equipo suele pasarlo como texto o foto dentro de la ventana de 24 h).
 * Sin prueba, para el embudo el lead sigue SIN presupuesto: la tarjeta pide
 * mandarlo, y si hay que escribirle solo se le dice "¿retomamos el armado de
 * tu presupuesto?", nunca "¿lo pudiste ver?".
 */

/** Prefijo de la nota que deja send-order-pdf. Único lugar donde se escribe. */
export const MARCA_PDF_ENVIADO = '📄 Presupuesto enviado';

export function presupuestoFueEnviado(e: {
    quoteCreatedAt: Date | null;
    /** Última nota "📄 Presupuesto enviado" de la ficha. */
    pdfEnviadoAt: Date | null;
    /** Último WhatsApp saliente escrito por una persona del equipo. */
    ultimoMensajeHumano: Date | null;
}): boolean {
    if (!e.quoteCreatedAt) return false;
    const q = e.quoteCreatedAt.getTime();
    if (e.pdfEnviadoAt && e.pdfEnviadoAt.getTime() >= q) return true;
    if (e.ultimoMensajeHumano && e.ultimoMensajeHumano.getTime() >= q) return true;
    return false;
}
