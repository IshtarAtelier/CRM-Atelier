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
 * Clientes reales mínimos de una MARCA para el cartel de respaldo
 * ("Los <marca> ya están en la cara de N clientes") cuando el modelo puntual
 * todavía no llega a su umbral.
 */
export const UMBRAL_ELEGIDO_MARCA = 10;

/**
 * Stock igual o menor a esto = "¡Últimas N u.!". Es el mismo 3 que la ficha
 * de producto usa desde siempre; ahora también lo leen las tarjetas de la
 * tienda para que las dos superficies digan lo mismo del mismo dato.
 */
export const UMBRAL_ULTIMAS_UNIDADES = 3;

/**
 * Normalización de la marca para el mapa de prueba social. Vive acá (y no en
 * lib/social-proof.ts, que importa prisma) porque la usan las dos puntas: el
 * server al armar el mapa y la ficha (cliente) al consultarlo — si divergen,
 * el cartel de marca no aparece nunca.
 */
export function claveMarca(brand: string | null | undefined): string {
  return (brand || "").trim().toLowerCase();
}
