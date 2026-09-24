/**
 * Umbrales de la prueba social de la tienda ("Elegido por N clientes",
 * "¡Últimas N u.!").
 *
 * REGLA INNEGOCIABLE (Ishtar, 31/8/2026): todo cartel de prueba social muestra
 * SOLO datos reales de la base. Si el número real no llega al umbral, el cartel
 * NO se muestra — jamás se infla ni se inventa (Ley 24.240, publicidad
 * engañosa). Por eso los umbrales viven acá con nombre: son la línea entre
 * "esto convence" y "esto no se dice".
 */

/**
 * Ventas reales mínimas de UN producto para mostrar "Elegido por N clientes"
 * en su ficha. Con menos de esto, el cartel no aparece.
 */
export const UMBRAL_ELEGIDO_PRODUCTO = 3;

/**
 * Clientes reales mínimos de un MODELO (el mismo armazón sumando TODOS sus
 * colores) para decir "N clientes eligieron este armazón". Es el escalón del
 * medio: cada color tiene ficha propia (decisión de Ishtar), así que un armazón
 * que vendió bien repartido entre tres colores no llegaba nunca al umbral de
 * producto y caía directo al cartel de marca. Mismo 3 que el de producto porque
 * es la misma clase de afirmación, solo que agregada por armazón.
 */
export const UMBRAL_ELEGIDO_MODELO = 3;

/**
 * Clientes reales mínimos de una MARCA para el cartel de respaldo cuando ni el
 * color ni el armazón llegan a su umbral.
 */
export const UMBRAL_ELEGIDO_MARCA = 10;

/**
 * Stock igual o menor a esto = aviso de "última unidad". Lo leen la ficha de
 * producto y las tarjetas de la tienda, para que las dos superficies digan lo
 * mismo del mismo dato. Era 3 ("¡Últimas 3 u.!"); Ishtar lo bajó a 1 el
 * 24/9/2026: con 3 en stock no hay apuro que avisar, y en un lote de 5
 * unidades el cartel salía casi siempre.
 */
export const UMBRAL_ULTIMAS_UNIDADES = 1;

/** El texto del aviso, único para ficha y tarjetas: "¡Última unidad!" o "¡Últimas N u.!". */
export function textoUltimasUnidades(stock: number): string {
  return stock === 1 ? '¡Última unidad!' : `¡Últimas ${stock} u.!`;
}

/**
 * Normalización de la marca para el mapa de prueba social. Vive acá (y no en
 * lib/social-proof.ts, que importa prisma) porque la usan las dos puntas: el
 * server al armar el mapa y la ficha (cliente) al consultarlo — si divergen,
 * el cartel de marca no aparece nunca.
 */
export function claveMarca(brand: string | null | undefined): string {
  return (brand || "").trim().toLowerCase();
}

/**
 * Normalización del MODELO para el mapa de prueba social: el código de fábrica
 * hasta el primer espacio o guion ("HY238014" de "HY238014 C4-1"), que es lo
 * que comparten los colores del mismo armazón. Es la misma regla con la que la
 * ficha arma sus variantes de color (`baseModel` en producto/[slug]/page.tsx),
 * y por el mismo motivo descarta claves de 1 o 2 caracteres: matchearían media
 * tienda. Vive acá, al lado de claveMarca(), porque también la usan las dos
 * puntas —el server al contar y la ficha al consultar—; si divergen, el cartel
 * de modelo no aparece nunca.
 */
export function claveModelo(modelCode: string | null | undefined): string {
  const base = (modelCode || "").trim().split(/[\s-]/)[0] || "";
  return base.length > 2 ? base.toLowerCase() : "";
}
