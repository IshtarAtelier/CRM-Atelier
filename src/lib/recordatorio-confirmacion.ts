/**
 * EL RECORDATORIO DE LA CONFIRMACIÓN DE COMPRA (Ishtar, 15/10/2026).
 *
 * Cuando una venta está "esperando el OK del cliente" y no contesta, desde
 * Ventas se le manda un recordatorio por WhatsApp: un texto y, si la voz se
 * pudo generar, un audio que dice lo mismo. El mensaje explica que SIN su OK
 * no se puede procesar el pedido. Lo que se dice vive acá, en un solo lugar,
 * para el texto, el audio, la ficha y el buzón. Puro.
 */

/** El texto del recordatorio, para el WhatsApp escrito. `nombre`: el nombre de pila del cliente. */
export function textoRecordatorioConfirmacion(nombre: string | null | undefined): string {
    const saludo = nombre ? `¡Hola ${nombre}!` : '¡Hola!';
    return [
        `${saludo} Te escribimos de *Atelier Óptica* 😊`,
        '',
        'Te mandamos la confirmación de tu pedido para que revises los datos (cristales, armazón, graduación) y nos respondas *OK*.',
        '',
        '⚠️ *Sin tu OK no podemos procesar el pedido ni mandarlo al laboratorio.* Es tu garantía de que se fabrica exactamente lo que elegiste.',
        '',
        'Si está todo bien, respondé *OK*. Si hay algo para corregir, decinos qué y lo vemos antes de fabricar.',
        '',
        '¡Gracias!',
    ].join('\n');
}

/** Lo que dice el AUDIO (sin emojis ni asteriscos: se lee en voz alta). */
export function guionRecordatorioConfirmacion(nombre: string | null | undefined): string {
    const saludo = nombre ? `Hola ${nombre}` : 'Hola';
    return `${saludo}, te hablamos de Atelier Óptica. Te mandamos la confirmación de tu pedido para que revises los datos y nos respondas OK. Es importante: sin tu OK no podemos procesar el pedido ni mandarlo al laboratorio, porque es tu garantía de que se fabrica exactamente lo que elegiste. Si está todo bien, respondé OK; y si hay algo para corregir, decinos qué y lo vemos antes de fabricar. ¡Gracias!`;
}

/** Cuánto se espera entre un recordatorio y el siguiente a la misma venta. */
export const HORAS_ENTRE_RECORDATORIOS = 6;

/** El sello con el que se busca en la ficha si ya se le recordó (idempotencia). */
export const SELLO_RECORDATORIO = '📣 Recordatorio de confirmación de compra';
