/**
 * La galería de la ficha web después de sincronizarla con las fotos del producto.
 *
 * La galería se arma en /admin/web: orden propio y fotos que el producto no
 * tiene (las de la modelo usándolo, las "look"). Hasta el 15/10/2026 cada
 * edición del producto en el CRM la reemplazaba por las fotos del producto:
 * 103 de las 161 fichas tenían fotos que se iban a perder con un cambio de
 * precio cualquiera, y la segunda foto (la que se ve al pasar el mouse) volvía
 * a ser la vista de atrás del anteojo (Deneb C2). Además los textos
 * alternativos quedaban desalineados (describían otra foto), y de ellos sale
 * el color del armazón para los filtros y para Google.
 *
 * Regla:
 *  · galería vacía, o copia exacta (mismas fotos, mismo orden) → se reemplaza
 *    por las fotos del producto, como siempre;
 *  · galería CURADA (alguna foto propia u otro orden) → se respeta; las fotos
 *    nuevas del producto se agregan al final, así una foto recién subida igual
 *    aparece. Sacar una foto de la galería se hace en /admin/web.
 * En los dos casos cada texto alternativo sigue a SU foto.
 *
 * Puro: lo usan los dos sincronizadores (product.service y kazwini-sync) y
 * check:catalog lo prueba con casos.
 */
export function galeriaAlSincronizar(
  actual: { images: string[] | null; imageAlts: string[] | null } | null,
  fotosDelProducto: string[],
): { images: string[]; imageAlts: string[]; imageUrl: string | null } {
  const previas = actual?.images ?? [];
  const altDe = new Map(previas.map((u, i) => [u, actual?.imageAlts?.[i] ?? '']));
  const esCopia = previas.length === fotosDelProducto.length && previas.every((u, i) => u === fotosDelProducto[i]);
  const curada = previas.length > 0 && !esCopia
    && (previas.some((u) => !fotosDelProducto.includes(u))
      || previas.some((u, i) => fotosDelProducto.indexOf(u) !== i));
  const images = curada
    ? [...previas, ...fotosDelProducto.filter((u) => !previas.includes(u))]
    : [...fotosDelProducto];
  return { images, imageAlts: images.map((u) => altDe.get(u) ?? ''), imageUrl: images[0] ?? null };
}
