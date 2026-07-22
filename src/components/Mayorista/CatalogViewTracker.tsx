'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/client-analytics';

/**
 * Dispara UN evento `wholesale_catalog_view` al abrir /mayorista/catalogo.
 * Separado del `page_view` genérico (que ya manda AnalyticsTracker en el
 * layout) porque acá nos interesa correlacionar con el lead que mandó el
 * link (`?lead=<id>` del panel /admin/opticas), no solo contar visitas.
 */
export default function CatalogViewTracker({ leadId }: { leadId: string | null }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track('wholesale_catalog_view', {
      path: '/capsulaescarlata',
      meta: leadId ? { leadId } : undefined,
    });
  }, [leadId]);

  return null;
}
