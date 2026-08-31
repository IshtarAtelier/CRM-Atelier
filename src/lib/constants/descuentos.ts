/**
 * Qué descuento puede dar cada rol. Un solo lugar.
 *
 * La promo VIGENTE de la óptica es -15% por efectivo y -15% por transferencia
 * (`BUSINESS_INFO.discountCashPercent` / `discountTransferPercent`, y el setting
 * `web_promo_cash_discount` que usan la tienda y el checkout). Acá decía "-20%
 * por efectivo", que era la promo vieja: el 20 que sí sigue vivo es el TOPE de
 * abajo, no lo que se anuncia. Confundir el tope con la promo es cómo
 * `/optica-cordoba` terminó publicando un 20% que el checkout no cobraba.
 *
 * Un VENDEDOR puede vender por la promo vigente, por menos descuento, o hasta
 * el tope de `TOPE_VENDEDOR`; para dar MÁS tiene que pedírselo al administrador,
 * que además es el único que puede aplicar el descuento especial en pesos
 * (`Order.specialDiscount`, guardado aparte).
 *
 * Por qué existe este archivo: los topes estaban tipeados a mano en el JSX del
 * cotizador y en ningún lado más. La UI escondía las opciones altas, pero la
 * API las aceptaba igual — un `PATCH` con `discountCash: 90` entraba, se
 * guardaba y quedaba como precio de la venta. Peor con `discountTransfer`: el
 * saldo convierte cada pago a su equivalente de lista dividiendo por
 * `(1 - discountTransfer/100)`, así que un 90% hacía que un pago de $10.000
 * cancelara una venta de $100.000. El tope tiene que vivir en el servidor y
 * salir del mismo lugar que las opciones que dibuja la pantalla.
 */

/** Opciones que ofrece el cotizador, por campo. El vendedor ve solo hasta su tope. */
export const OPCIONES_DESCUENTO_EFECTIVO = [0, 5, 10, 15, 20, 25, 30];
export const OPCIONES_DESCUENTO_TRANSFERENCIA = [0, 5, 10, 15, 20];
export const OPCIONES_RECARGO_CUOTAS = [0, 5, 10];

/**
 * Costo financiero de las cuotas largas de Mercado Pago (12 y 18): el cliente
 * paga lista + este %.
 *
 * REGLA DE COMUNICACIÓN (Ishtar, 31/8/2026 — decisión explícita): este
 * porcentaje se ACLARA SIEMPRE, en TODA superficie —tienda, checkout, PDFs,
 * mails, plantillas de WhatsApp, prompts del bot, piezas de redes, anuncios y
 * blog— y las 12 cuotas nunca se anuncian "sin interés" (sin interés son solo
 * 3 y 6). La redacción única para pantallas vive en `src/lib/promo-cuotas.ts`.
 *
 * No es negociable por venta (a diferencia de `discountCard`): es fijo, y la
 * conversión de saldos divide por (1 + este %) para los pagos MP 12/18.
 */
export const RECARGO_MP_CUOTAS_LARGAS = 10;
/** Factor listo para multiplicar/dividir: 1.10 */
export const FACTOR_MP_CUOTAS_LARGAS = 1 + RECARGO_MP_CUOTAS_LARGAS / 100;

/**
 * Lo máximo que un vendedor puede abaratar la venta por su cuenta.
 *
 * `discountCard` es un RECARGO, no un descuento: sube el precio. Por eso su
 * límite es un piso (nunca por debajo de 0), no un techo — un valor negativo
 * sería un descuento encubierto por el campo equivocado.
 */
export const TOPE_VENDEDOR = {
  discountCash: 20,
  discountTransfer: 15,
  recargoCuotasMinimo: 0,
} as const;

/** Campos de precio que este helper controla. Todos opcionales: se valida lo que venga. */
export interface DescuentosPropuestos {
  discountCash?: number | null;
  discountTransfer?: number | null;
  discountCard?: number | null;
}

/**
 * ¿Estos descuentos superan lo que puede dar un vendedor?
 *
 * Devuelve el mensaje de rechazo, o `null` si están dentro del tope. El mensaje
 * arranca con "Solo el administrador" a propósito: es la frase que el manejador
 * de errores del PATCH mapea a 403 (`src/app/api/orders/[id]/route.ts`).
 */
export function excedeTopeVendedor(v: DescuentosPropuestos): string | null {
  const efvo = Number(v.discountCash);
  if (Number.isFinite(efvo) && efvo > TOPE_VENDEDOR.discountCash) {
    return `Solo el administrador puede dar más de ${TOPE_VENDEDOR.discountCash}% de descuento por efectivo (se intentó ${efvo}%).`;
  }
  const transf = Number(v.discountTransfer);
  if (Number.isFinite(transf) && transf > TOPE_VENDEDOR.discountTransfer) {
    return `Solo el administrador puede dar más de ${TOPE_VENDEDOR.discountTransfer}% de descuento por transferencia (se intentó ${transf}%).`;
  }
  const cuotas = Number(v.discountCard);
  if (Number.isFinite(cuotas) && cuotas < TOPE_VENDEDOR.recargoCuotasMinimo) {
    return `El recargo por cuotas no puede ser negativo (se intentó ${cuotas}%).`;
  }
  return null;
}

/**
 * Un descuento negativo INFLA la venta en vez de abaratarla, así que tampoco se
 * acepta de nadie —ni del admin— por ninguno de los dos campos de descuento.
 */
export function descuentoNegativo(v: DescuentosPropuestos): string | null {
  const efvo = Number(v.discountCash);
  if (Number.isFinite(efvo) && efvo < 0) return 'El descuento por efectivo no puede ser negativo.';
  const transf = Number(v.discountTransfer);
  if (Number.isFinite(transf) && transf < 0) return 'El descuento por transferencia no puede ser negativo.';
  return null;
}
