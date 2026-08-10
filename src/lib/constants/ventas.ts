/**
 * Qué cuenta como VENTA REAL. Un solo lugar.
 *
 * La regla de negocio del proyecto: `Order.paid` no prueba que se haya cobrado
 * (hay filas con `paid` y cero pagos). La venta real se mide por filas de
 * `Payment` o porque el pedido ya está en el laboratorio.
 *
 * Por qué existe este archivo: la regla estaba re-escrita a mano en cuatro
 * lugares y una de las copias la escribió mal. El script que sube conversiones
 * a Google usaba `Boolean(o.labStatus)` — y como el schema declara
 * `labStatus String? @default("NONE")`, `Boolean('NONE')` es `true`, así que el
 * guard no descartaba nada. Medido sobre 90 días de la base local: la regla
 * buena cuenta 35 ventas y esa copia contaba 111. Son **76 conversiones
 * fantasma** que Google iba a usar para decidir dónde poner la plata.
 *
 * El error vivió tapado porque el docstring del script prometía "la misma regla
 * que el resto del sistema". Un comentario no es un mecanismo: mientras cada
 * consumidor la vuelva a tipear, alguna copia va a divergir.
 */

/** `labStatus` de un pedido que nunca fue al laboratorio. */
export const LAB_STATUS_SIN_ENVIAR = 'NONE';

/** ¿El pedido está en el laboratorio? Ojo: `'NONE'` es truthy, por eso se compara. */
export function estaEnFabrica(labStatus?: string | null): boolean {
  return labStatus != null && labStatus !== LAB_STATUS_SIN_ENVIAR;
}

/**
 * ¿Esto es una venta real y no un presupuesto?
 *
 * `cobrado` es la SUMA de las filas de `Payment` de la orden — nunca
 * `Order.paid`, que es un denormalizado que puede mentir.
 */
export function esVentaReal(orden: {
  status?: string | null;
  labStatus?: string | null;
  cobrado: number;
}): boolean {
  if (orden.status === 'LOST' || orden.status === 'CANCELED') return false;
  return orden.cobrado > 0 || estaEnFabrica(orden.labStatus);
}

/**
 * El equivalente en `where` de Prisma, para no traer media base y filtrar en JS.
 * Se combina con el filtro de pagos del lado del llamador (Prisma no puede
 * comparar una agregación de la relación dentro del mismo `where`).
 */
export const WHERE_EN_FABRICA = {
  labStatus: { not: LAB_STATUS_SIN_ENVIAR as string | null },
} as const;
