/**
 * Cómo se LEE una entrada de costo de laboratorio: las dos aclaraciones que
 * tienen que decir lo mismo en la pantalla de conciliación y en los emails.
 *
 * 1) UNA FACTURA PUEDE TRAER VARIOS PEDIDOS, y hasta de clientes distintos.
 *    Caso real (12/8/2026): "Ped: TI-7101568(587979) /TI-7101583(588049)
 *    /TI-7101638(588966)" — Guerra Silvina, Gustavo Kotzian y Ayelen Gutiérrez
 *    en el mismo comprobante. El importe se reparte en partes iguales entre
 *    los pedidos, así que el número de cada uno es APROXIMADO. Eso hay que
 *    decirlo donde se muestra la plata: sin la aclaración, un importe
 *    prorrateado se lee como si fuera lo que costó ese pedido.
 *
 * 2) "SIN VENTA" NO ES LO MISMO QUE "LA FACTURA NO TRAE EL Nº". Optovisión
 *    emite algunas facturas contra remito, sin nº de pedido; esas se guardan
 *    con la clave "S/PEDIDO 3008-00063271". La venta puede existir
 *    perfectamente — lo que falta es el dato en el papel para engancharla.
 *    Mostrarlas como "sin venta" acusa en falso.
 */

/** Nota que estampa el cruce cuando una factura se reparte entre varios pedidos. */
export const notaFacturaCompartida = (pedidos: string[]) =>
    `Factura compartida entre ${pedidos.length} pedidos (${pedidos.join(', ')}); importe prorrateado.`;

/** ¿El importe de esta entrada es una parte prorrateada de una factura compartida? */
export function facturaCompartida(notes: string | null | undefined): { compartida: boolean; pedidos: number | null } {
    const m = (notes || '').match(/Factura compartida entre (\d+) pedidos/);
    return { compartida: !!m, pedidos: m ? Number(m[1]) : null };
}

/** Texto de la aclaración, para poner al lado del importe. */
export function aclaracionImporte(notes: string | null | undefined): string | null {
    const { compartida, pedidos } = facturaCompartida(notes);
    if (!compartida) return null;
    return `Importe aproximado: la factura vino con ${pedidos} pedidos y se repartió en partes iguales.`;
}

/** Prefijo con el que se guardan las facturas que llegaron sin nº de pedido. */
export const CLAVE_SIN_NUMERO = 'S/PEDIDO';

/** ¿Esta entrada es una factura que llegó SIN nº de pedido (no una venta faltante)? */
export const esFacturaSinNumero = (labOrderNumber: string | null | undefined) =>
    String(labOrderNumber || '').startsWith(CLAVE_SIN_NUMERO);

/**
 * Qué decir cuando una entrada quedó sin venta enganchada. Distingue el pedido
 * huérfano de verdad de la factura a la que le falta el número.
 */
export function etiquetaSinVenta(labOrderNumber: string | null | undefined): { label: string; detalle: string } {
    return esFacturaSinNumero(labOrderNumber)
        ? {
            label: 'Sin nº de pedido en la factura',
            detalle: 'El comprobante no dice a qué pedido corresponde. La venta puede estar cargada: hay que asignarlo a mano.',
        }
        : {
            label: 'Sin venta',
            detalle: 'El laboratorio facturó este pedido y no hay ninguna venta ni postventa que lo respalde.',
        };
}
