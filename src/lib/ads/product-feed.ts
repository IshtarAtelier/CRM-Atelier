/**
 * Feed de productos para catálogos publicitarios (Google Merchant Center y
 * Meta Commerce Manager). Fuente única: ambas plataformas leen RSS 2.0 con el
 * namespace g:, así que solo cambian los detalles de formato por plataforma
 * (ver PLATFORMS). Mantener UNA sola implementación evita que los catálogos
 * se desincronicen entre sí.
 *
 * Usa el catálogo mapeado resiliente — no rompe si la DB parpadea.
 */
import { getMappedWebCatalog } from '@/lib/catalog/tienda-map';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { captureError } from '@/lib/logger';

export type FeedPlatform = 'google' | 'meta';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';

/**
 * Diferencias reales entre plataformas (lo demás es idéntico):
 * Google acepta in_stock/out_of_stock; Meta exige "in stock"/"out of stock"
 * y rechaza el producto si llega con guión bajo.
 */
const PLATFORMS: Record<FeedPlatform, { inStock: string; outOfStock: string; title: string }> = {
  google: { inStock: 'in_stock', outOfStock: 'out_of_stock', title: 'Atelier Óptica' },
  meta: { inStock: 'in stock', outOfStock: 'out of stock', title: 'Atelier Óptica' },
};

const esc = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const priceStr = (n: number) => `${n.toFixed(2)} ARS`;

/**
 * URL de imagen ABSOLUTA apta para los catálogos: nada de data URIs, rutas
 * relativas ni AVIF (formato que ninguna de las dos plataformas acepta; WebP
 * sí). Los .avif de public/ tienen su copia .webp generada por
 * scripts/ads/convert_feed_images.js.
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

/**
 * Categoría de la taxonomía de Google (Meta usa la misma). Define en qué
 * búsquedas compite el producto, así que un armazón de receta NO puede ir
 * como anteojo de sol.
 *   178 = Apparel & Accessories > Clothing Accessories > Sunglasses
 *   524 = Health & Beauty > Personal Care > Vision Care > Eyeglasses
 * Los clip-on se declaran como sol: el uso que se busca es el de sol.
 */
function googleCategory(category: string | null): string {
  const c = (category || '').toLowerCase();
  return c.includes('sol') || c.includes('clip') ? '178' : '524';
}

/**
 * Descripción con las palabras que la gente busca ("anteojos de sol",
 * "armazón para lentes recetados"): las plataformas matchean la consulta
 * contra el texto del ítem, así que un "— Sol." pelado desperdicia el espacio.
 */
function describe(title: string, category: string | null): string {
  const c = (category || '').toLowerCase();
  if (c.includes('clip')) {
    return `${title}: armazón para lentes recetados con clip-on de sol magnético. Óptica Atelier, Córdoba.`;
  }
  if (c.includes('sol')) {
    return `${title}: anteojos de sol con protección UV. Se pueden graduar con tu receta. Óptica Atelier, Córdoba.`;
  }
  return `${title}: armazón para anteojos recetados. Cristales a medida (monofocales y multifocales). Óptica Atelier, Córdoba.`;
}

/** Arma el XML completo del feed para la plataforma pedida. */
export async function buildProductFeed(platform: FeedPlatform): Promise<string> {
  const cfg = PLATFORMS[platform];
  let items = '';

  try {
    const { products } = await getMappedWebCatalog();

    for (const p of products) {
      // Solo armazones/sol con precio e imagen (los cristales no van al catálogo).
      if (p.category === 'Cristal') continue;
      if (!p.price || p.price <= 0) continue;
      const img = feedImage(p.imagenesCatalogo);
      if (!img) continue;

      const title = `${p.brand} ${p.model}`.trim();
      const link = `${APP_URL}/producto/${p.slug}`;
      const available = (p.stock ?? 0) > 0 ? cfg.inStock : cfg.outOfStock;
      const hasSale = p.salePrice && p.salePrice > 0 && p.salePrice < p.price;

      items += `
    <item>
      <g:id>${esc(p.id)}</g:id>
      <g:title>${esc(title)}</g:title>
      <g:description>${esc(describe(title, p.category))}</g:description>
      <g:link>${esc(link)}</g:link>
      <g:image_link>${esc(img)}</g:image_link>
      <g:availability>${available}</g:availability>
      <g:price>${priceStr(p.price)}</g:price>${hasSale ? `
      <g:sale_price>${priceStr(p.salePrice as number)}</g:sale_price>` : ''}
      <g:brand>${esc(p.brand)}</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>false</g:identifier_exists>
      <g:google_product_category>${googleCategory(p.category)}</g:google_product_category>
      <g:product_type>${esc(p.category || 'Anteojos')}</g:product_type>
    </item>`;
    }
  } catch (err) {
    captureError(err, { scope: `feed.${platform}` });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(cfg.title)}</title>
    <link>${APP_URL}</link>
    <description>Catálogo de anteojos de Atelier Óptica</description>${items}
  </channel>
</rss>`;
}

/** Response XML cacheada 1h a nivel CDN. */
export function feedResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
