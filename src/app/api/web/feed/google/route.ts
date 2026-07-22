import { buildProductFeed, feedResponse } from '@/lib/ads/product-feed';

/**
 * Feed de productos para Google Merchant Center (Shopping / Performance Max).
 * La lógica vive en src/lib/ads/product-feed.ts, compartida con el feed de Meta.
 *
 * Alta: en Merchant Center → Productos → Feeds → agregar feed programado con
 * la URL https://atelieroptica.com.ar/api/web/feed/google
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return feedResponse(await buildProductFeed('google'));
}
