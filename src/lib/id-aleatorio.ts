/**
 * Un id único para el navegador, también en iPhones viejos.
 *
 * `crypto.randomUUID()` existe recién desde Safari 15.4: en iOS 15.0–15.3
 * tiraba "crypto.randomUUID is not a function" y "Agregar al carrito" no
 * hacía nada (revisión del 10/10/2026). Con respaldo, nunca rompe.
 */
export function idAleatorio(prefijo = 'id'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* sigue con el respaldo */
  }
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
