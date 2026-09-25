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

/**
 * 3) EL PAR BONIFICADO DE UN 2x1 VINO COBRADO. Regla de Ishtar del 25/9/2026:
 *    siempre que el 2x1 esté tildado en los cristales, uno de los pedidos de la
 *    venta tiene que venir sin cargo o con un cargo mínimo (el tope vive en
 *    `TOPE_PAR_BONIFICADO_2X1`, lab-recon/types.ts). Cuando TODOS los pedidos
 *    vinieron por encima, el cruce lo deja escrito en la nota con esta marca y
 *    la pantalla y los emails la muestran como alerta. Va entre corchetes para
 *    poder sacar la nota entera cuando deja de aplicar (el lab acreditó el par
 *    y la factura se volvió a leer) — si no, quedaría acusando para siempre.
 */
export const MARCA_PAR_BONIFICADO_COBRADO = '⚠️ 2x1 CON EL PAR BONIFICADO COBRADO';

/** ¿El cruce dejó marcada esta entrada como 2x1 con el par bonificado cobrado? */
export const tieneParBonificadoCobrado = (notes: string | null | undefined): boolean =>
    (notes || '').includes(MARCA_PAR_BONIFICADO_COBRADO);

/** Saca la nota del par bonificado: el cruce la vuelve a escribir en cada pasada si sigue aplicando. */
export function sinNotaParBonificado(notes: string | null | undefined): string | null {
    const marca = MARCA_PAR_BONIFICADO_COBRADO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const limpio = (notes || '').replace(new RegExp(`\\s*\\[${marca}[^\\]]*\\]`, 'g'), '').trim();
    return limpio || null;
}

/**
 * 4) RESUELTO A MANO. Un hallazgo (sobrecosto, huérfano, lo que sea) que el
 *    administrador ya trató —lo reclamó, el lab lo acreditó, o era correcto—
 *    se marca desde la pantalla (`resolvedAt`, `resolvedBy`, `resolvedNote`) y
 *    deja de salir en los avisos y en el semanal; sin eso reaparecía para
 *    siempre (Ishtar, 25/9/2026). Las resoluciones que viven en código
 *    (RESOLUCIONES_CONOCIDAS, notas que empiezan por RESUELTO/RECLAMADO)
 *    cuentan igual hasta que el cruce les estampe la fecha.
 */
export const estaResuelta = (e: { resolvedAt?: Date | string | null; notes?: string | null }): boolean =>
    !!e.resolvedAt || /^(RESUELTO|RECLAMADO)\b/.test((e.notes || '').trim());
