import { calcularConfiguracion, type ResultadoCalculo } from '@/lib/cristales-web/calculo';
import type { LensConfig, MapaOpciones } from '@/lib/cristales-web/claves';

/**
 * Precio efectivo del armazón (fuente de verdad única para checkout y desglose de la orden).
 * - Mayorista con wholesalePrice > 0 → wholesalePrice (la oferta retail NO aplica a mayoristas).
 * - Retail con salePrice válido (0 < salePrice < price) → salePrice (precio de oferta).
 * - En cualquier otro caso → price de lista.
 * Siempre sale de la DB (dbProduct), nunca del payload del cliente.
 */
export const effectiveFramePrice = (dbProduct: any, isWholesaleUser: boolean): number => {
  if (isWholesaleUser && dbProduct.wholesalePrice > 0) return dbProduct.wholesalePrice;
  const sale = dbProduct.salePrice;
  if (sale != null && sale > 0 && sale < dbProduct.price) return sale;
  return dbProduct.price;
};

/**
 * Precio de un ítem del carrito, calculado en el servidor con el MISMO cálculo
 * que usa el configurador (src/lib/cristales-web/calculo.ts) sobre las mismas
 * opciones. El armazón sale de la base (oferta / mayorista), los cristales del
 * producto vinculado a cada opción. Devuelve el resultado entero para que la
 * ruta pueda responder 400 con el motivo cuando una opción no está disponible.
 */
export const calcularItemDeCarrito = (
  item: { lensConfig?: LensConfig | null },
  dbProduct: any,
  isWholesaleUser: boolean,
  opciones: MapaOpciones,
): ResultadoCalculo => {
  return calcularConfiguracion({
    basePrice: effectiveFramePrice(dbProduct, isWholesaleUser),
    lensConfig: item.lensConfig,
    opciones,
  });
};

/** Igual que `calcularItemDeCarrito`, pero lanza si la configuración no se puede cobrar. */
export const recalculateItemPrice = (
  item: { lensConfig?: LensConfig | null },
  dbProduct: any,
  isWholesaleUser: boolean,
  opciones: MapaOpciones,
): number => {
  const r = calcularItemDeCarrito(item, dbProduct, isWholesaleUser, opciones);
  if (!r.ok) throw new Error(r.error);
  return r.total;
};
