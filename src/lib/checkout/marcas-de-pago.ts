/**
 * Las marcas que deja un pago ya resuelto en `WebPaymentIntent.lastError`
 * ("[pago 123]", "[reclamo 123:refunded]"). Son el candado que impide que un
 * aviso repetido de Mercado Pago vuelva a firmar la ficha o a mandar un mail.
 * Se SUMAN: un aviso de otro pago o un reclamo no pueden borrar la marca de un
 * pago anterior (revisión del 10/10/2026).
 */
const MARCA = /\[(?:pago|reclamo) [^\]]+\]/g;

export function tieneMarca(lastError: string | null | undefined, marca: string): boolean {
  return (lastError || '').includes(marca);
}

/** lastError nuevo: las marcas que ya había, la nueva, y el texto. */
export function conMarca(lastError: string | null | undefined, marca: string, texto: string): string {
  const previas = (lastError || '').match(MARCA) || [];
  const marcas = [...new Set([...previas, marca])];
  return `${marcas.join('')} ${texto}`.slice(0, 2000);
}
