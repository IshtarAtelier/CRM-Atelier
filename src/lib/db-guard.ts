// Guard para queries de páginas públicas con ISR.
//
// Si una query a la DB falla en runtime, la página NO debe renderizarse vacía:
// ISR cachearía ese HTML sin productos y lo serviría a todos los visitantes
// (incidente del 2026-07-07 en el home). Lanzar el error hace que Next conserve
// la última versión buena de la página; si no hay caché, el error.tsx global
// muestra el fallback con auto-retry y botón de WhatsApp.
//
// Durante `next build` sí tragamos el error: un build sin DB accesible debe
// poder completarse (la página queda vacía solo hasta la primera revalidación).
export function rethrowUnlessBuild(error: unknown, label: string): void {
  console.error(`[${label}] DB query failed:`, error);
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
