// Guard para queries de páginas públicas con ISR.
//
// Si una query a la DB falla en runtime, la página NO debe renderizarse vacía:
// ISR cachearía ese HTML sin productos y lo serviría a todos los visitantes
// (incidente del 2026-07-07 en el home). Lanzar el error hace que Next conserve
// la última versión buena de la página; si no hay caché, el error.tsx global
// muestra el fallback con auto-retry y botón de WhatsApp.
//
// Durante `next build` sí tragamos el error: el paso de build de Railway NO tiene
// DATABASE_URL (se inyecta solo en runtime), así que un build sin DB accesible debe
// poder completarse (la página queda vacía solo hasta la primera revalidación con DB).
// NEXT_PHASE solo no alcanza — probado en el incidente del 2026-07-07 (e886e676):
// hace falta chequear también la ausencia de DATABASE_URL.
export function rethrowUnlessBuild(error: unknown, label: string): void {
  console.error(`[${label}] DB query failed:`, error);
  const isBuildTime =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    !process.env.DATABASE_URL;
  if (!isBuildTime) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
