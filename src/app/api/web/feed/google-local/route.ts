import { buildLocalInventoryFeed } from '@/lib/ads/product-feed';
import { GOOGLE_STORE_CODE } from '@/lib/constants/ads';

/**
 * Inventario local para Google Merchant Center (fichas locales gratuitas): los
 * mismos productos del feed /api/web/feed/google, declarados en el local
 * (código de tienda del Perfil de Empresa). La lógica vive en
 * src/lib/ads/product-feed.ts.
 *
 * Alta (25/9/2026): Merchant Center → Fichas locales gratuitas → Argentina →
 * Añadir inventario → "Introduce un enlace a tu archivo" con
 * https://atelieroptica.com.ar/api/web/feed/google-local (se baja cada 24 h).
 * Reemplaza al archivo inventario-local-ATELIER01.tsv subido a mano ese día.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(await buildLocalInventoryFeed(GOOGLE_STORE_CODE), {
    headers: {
      'Content-Type': 'text/tab-separated-values; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
