// ────────────────────────────────────────────────────────────────────────────
// Nombre visible del modelo (pedido del 20/8): el sufijo de color ("C1", "C3",
// "C4-1") solo tiene sentido cuando el mismo estelar existe en MÁS de un color
// dentro del catálogo visible. "Gaia C1" siendo la única Gaia se muestra
// "Gaia"; si mañana entra "Gaia C2", las dos vuelven a mostrar su sufijo solas.
//
// Es una regla de PRESENTACIÓN: no toca WebProduct.name (curado, regla
// "estelar + color") ni slugs ni SEO técnico — solo lo que la persona lee.
// Módulo puro y sin imports: lo usan tienda-map, la ficha y scripts.
// ────────────────────────────────────────────────────────────────────────────

/** Sufijo de color al final del nombre: "C1", "c3", "C4-1", "C2-1". */
const COLOR_SUFFIX = /\s+C\d+(?:-\d+)?$/i;

/** "Gaia C1" → "Gaia". Sin sufijo, devuelve el nombre tal cual. */
export function baseDelNombre(nombre: string): string {
  return (nombre || "").replace(COLOR_SUFFIX, "").trim();
}

/**
 * Dado el universo de nombres visibles del catálogo, devuelve una función que
 * calcula el nombre a mostrar: recorta el sufijo de color solo si ese estelar
 * aparece una única vez.
 */
export function armarNombreVisible(nombresVisibles: string[]): (nombre: string) => string {
  const conteoPorBase = new Map<string, number>();
  for (const n of nombresVisibles) {
    const base = baseDelNombre(n).toLowerCase();
    if (!base) continue;
    conteoPorBase.set(base, (conteoPorBase.get(base) || 0) + 1);
  }
  return (nombre: string) => {
    if (!nombre || !COLOR_SUFFIX.test(nombre)) return nombre;
    const base = baseDelNombre(nombre);
    return (conteoPorBase.get(base.toLowerCase()) || 0) === 1 ? base : nombre;
  };
}
