'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track, captureAttribution } from '@/lib/client-analytics';

/** Zonas de la tienda que reportamos como `zone_view` además del page_view. */
const ZONE_PREFIXES: Array<{ prefix: string; zone: string }> = [
  { prefix: '/tienda', zone: 'tienda' },
  { prefix: '/lentes-de-sol', zone: 'lentes-de-sol' },
  { prefix: '/receta', zone: 'receta' },
  { prefix: '/arma-tus-lentes', zone: 'arma-tus-lentes' },
  { prefix: '/producto', zone: 'producto' },
  { prefix: '/checkout', zone: 'checkout' },
  { prefix: '/landing', zone: 'landing' },
  { prefix: '/blog', zone: 'blog' },
  { prefix: '/resenas', zone: 'resenas' },
  { prefix: '/contacto', zone: 'contacto' },
];

function zoneFor(pathname: string): string | null {
  const match = ZONE_PREFIXES.find(
    (z) => pathname === z.prefix || pathname.startsWith(z.prefix + '/'),
  );
  return match ? match.zone : null;
}

/**
 * Registra navegación en la analítica propia. Montado una sola vez en el layout.
 * No pinta nada. No corre en el critical path (efecto post-render + sendBeacon).
 */
export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Fija la atribución first-touch apenas carga.
    captureAttribution();
  }, []);

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;
    // No trackear el panel admin (no es tráfico de tienda).
    if (pathname.startsWith('/admin') || pathname.startsWith('/login')) return;

    track('page_view', { path: pathname });
    const zone = zoneFor(pathname);
    if (zone) track('zone_view', { path: pathname, meta: { zone } });
  }, [pathname]);

  return null;
}
