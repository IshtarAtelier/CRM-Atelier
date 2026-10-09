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
 * Prueba de envío, cualquiera de las tres:
 *   - la nota "📄 Presupuesto enviado" que deja `send-order-pdf` (PDF por
 *     WhatsApp/mail, lo mande una persona o el bot), posterior al presupuesto;
 *   - un mensaje de WhatsApp escrito por una PERSONA después de armarlo (el
 *     equipo suele pasarlo como texto o foto dentro de la ventana de 24 h);
 *   - el cliente PASÓ POR EL LOCAL (botón "Visita", turno cumplido o etiqueta,
 *     ver visito-local.ts): el presupuesto se lo mostraron en el mostrador.
 *     Desde el 8/10/2026 — medido: 38 de 372 presupuestos del mes no tenían
 *     rastro de envío y eran casi todos armados cara a cara; preguntarles
 *     "¿retomamos el armado?" a quien ya lo vio sonaba raro.
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
    /** ¿Pasó por el local? (visito-local.ts) */
    visitoElLocal?: boolean;
}): boolean {
    if (!e.quoteCreatedAt) return false;
    if (e.visitoElLocal) return true;
    const q = e.quoteCreatedAt.getTime();
    if (e.pdfEnviadoAt && e.pdfEnviadoAt.getTime() >= q) return true;
    if (e.ultimoMensajeHumano && e.ultimoMensajeHumano.getTime() >= q) return true;
    return false;
}
