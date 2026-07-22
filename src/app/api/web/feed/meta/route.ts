import { buildProductFeed, feedResponse } from '@/lib/ads/product-feed';

/**
 * Feed de productos para Meta Commerce Manager (catálogo de Facebook/Instagram,
 * anuncios dinámicos y Advantage+ catalog). Mismo contenido que el de Google;
 * cambia el formato de `availability`, que Meta exige con espacio.
 *
 * Alta: Commerce Manager → Catálogo → Fuentes de datos → Feed programado con
 * la URL https://atelieroptica.com.ar/api/web/feed/meta
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return feedResponse(await buildProductFeed('meta'));
}
