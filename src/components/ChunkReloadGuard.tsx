'use client';

import { useEffect } from 'react';

// ────────────────────────────────────────────────────────────────────────────
// Guardia contra chunks viejos tras un deploy.
//
// Cada deploy cambia los hashes de los archivos JS de Next. Una pestaña abierta
// durante el deploy pide chunks que ya no existen → los componentes cliente no
// hidratan y secciones enteras (p. ej. el carrusel de productos del home) quedan
// en blanco. Este guard detecta ese error puntual y recarga la página UNA vez
// (con candado en sessionStorage para no entrar en loop de recargas).
// ────────────────────────────────────────────────────────────────────────────

const RELOAD_LOCK_KEY = 'atelier-chunk-reload-at';
const RELOAD_LOCK_MS = 60_000; // máx. 1 recarga por minuto

function isStaleChunkError(message: string): boolean {
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
}

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_LOCK_KEY) || 0);
    if (Date.now() - last < RELOAD_LOCK_MS) return; // ya recargamos hace nada — no loopear
    sessionStorage.setItem(RELOAD_LOCK_KEY, String(Date.now()));
  } catch {
    // sessionStorage bloqueado: recargar igual es mejor que quedar en blanco
  }
  window.location.reload();
}

export function ChunkReloadGuard() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (event.message && isStaleChunkError(event.message)) reloadOnce();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      const message =
        (reason instanceof Error ? `${reason.name} ${reason.message}` : String(reason ?? '')) || '';
      if (isStaleChunkError(message)) reloadOnce();
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
