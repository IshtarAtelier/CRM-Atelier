// ────────────────────────────────────────────────────────────────────────────
// Nombre visible del modelo: SIN el código de color del proveedor, siempre.
//
// Ishtar, 19/10/2026, mirando "ZEUS C33-P86" en la ficha: "eso que está así con
// el código no debe estar así, sacalo; el código es interno". Reemplaza la
// regla del 20/8 (recortar el sufijo solo si el estelar tenía un único color):
// con Zeus en cuatro colores la ficha mostraba el código, y el código no le
// dice nada al cliente. Cada color sigue siendo su propia ficha (decisión del
// 3/9, no se reabre): se distinguen por la foto y por los círculos del
// selector, no por un "C33-P18-1" en el título.
//
// Es una regla de PRESENTACIÓN: no toca WebProduct.name (ahí el sufijo sigue
// siendo lo que identifica la ficha en el CRM) ni slugs ni URLs — solo lo que
// la persona lee. Módulo puro y sin imports: lo usan tienda-map, la ficha y
// scripts.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Código de color al final del nombre, en todas las formas que hay en el
 * catálogo: "C1", "c3", "C4-1", "C275", "C33-P86", "C33-P18-1", y el modelo
 * del proveedor delante ("Monaco A12183 C2"). No toca nombres de color en
 * palabras ("Olimpo Black", "Calipso Oval Carey").
 */
const COLOR_SUFFIX = /\s+(?:[A-Z]{1,3}\d{3,}[A-Z]*\s+)?C\d+(?:-[A-Z]?\d+)*$/i;

/** "Gaia C1" → "Gaia"; "Zeus C33-P86" → "Zeus". Sin código, el nombre tal cual. */
export function baseDelNombre(nombre: string): string {
  return (nombre || "").replace(COLOR_SUFFIX, "").trim();
}

/**
 * Devuelve la función que calcula el nombre a mostrar. Hoy es siempre
 * `baseDelNombre`; conserva la firma (recibía el universo de nombres para
 * contar variantes) para no tocar a quienes la llaman.
 */
export function armarNombreVisible(_nombresVisibles: string[]): (nombre: string) => string {
  return (nombre: string) => baseDelNombre(nombre) || nombre;
}
