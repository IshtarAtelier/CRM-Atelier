import { getMappedWebCatalog } from '@/lib/catalog/tienda-map';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { captureError } from '@/lib/logger';

/**
 * Feed de productos para Google Merchant Center (Shopping / Performance Max).
 * RSS 2.0 con namespace g:. Público bajo /api/web. Usa el catálogo mapeado
 * resiliente (no rompe si la DB parpadea). Se cachea 1h a nivel CDN.
 *
 * Alta: en Merchant Center → Productos → Feeds → agregar feed programado con
 * la URL https://atelieroptica.com.ar/api/web/feed/google
 */
export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';

const esc = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const priceStr = (n: number) => `${n.toFixed(2)} ARS`;

/**
 * URL de imagen ABSOLUTA apta para Merchant Center, o '' si el producto no
 * tiene ninguna. Reglas de Google: nada de data URIs, nada de rutas relativas
 * y nada de AVIF (WebP sí) — por eso los .avif de public/ tienen su copia
 * .webp generada por scripts/ads/convert_feed_images.js.
 */
function feedImage(images: string[] | undefined): string {
  for (const raw of images || []) {
    let resolved = resolveStorageUrl(raw);
    if (!resolved || resolved.startsWith('data:')) continue;
    resolved = resolved.replace(/\.avif$/i, '.webp');
    if (resolved.startsWith('http')) return resolved;
    if (resolved.startsWith('/')) return `${APP_URL}${resolved}`;
  }
  return '';
}

export async function GET() {
  let items = '';
  try {
    const { products } = await getMappedWebCatalog();

    for (const p of products) {
      // Solo armazones/sol con precio e imagen (los cristales no van a Shopping).
      if (p.category === 'Cristal') continue;
      if (!p.price || p.price <= 0) continue;
      const img = feedImage(p.imagenesCatalogo);
      if (!img) continue;

      const title = `${p.brand} ${p.model}`.trim();
      const link = `${APP_URL}/producto/${p.slug}`;
      const available = (p.stock ?? 0) > 0 ? 'in_stock' : 'out_of_stock';
      const hasSale = p.salePrice && p.salePrice > 0 && p.salePrice < p.price;

      items += `
    <item>
      <g:id>${esc(p.id)}</g:id>
      <g:title>${esc(title)}</g:title>
      <g:description>${esc(`${title} — ${p.category || 'Anteojos'}. Óptica Atelier.`)}</g:description>
      <g:link>${esc(link)}</g:link>
      <g:image_link>${esc(img)}</g:image_link>
      <g:availability>${available}</g:availability>
      <g:price>${priceStr(p.price)}</g:price>${hasSale ? `
      <g:sale_price>${priceStr(p.salePrice as number)}</g:sale_price>` : ''}
      <g:brand>${esc(p.brand)}</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>false</g:identifier_exists>
      <g:google_product_category>178</g:google_product_category>
      <g:product_type>${esc(p.category || 'Anteojos')}</g:product_type>
    </item>`;
    }
  } catch (err) {
    captureError(err, { scope: 'feed.google' });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Atelier Óptica</title>
    <link>${APP_URL}</link>
    <description>Catálogo de anteojos de Atelier Óptica</description>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
