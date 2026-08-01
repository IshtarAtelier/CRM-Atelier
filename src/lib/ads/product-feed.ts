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
 * Título con el sustantivo por el que la gente busca adelante. El nombre de la
 * tienda es una estrella ("Antares", "Vega") y la marca es "Cápsula Escarlata":
 * los dos juntos no matchean NINGUNA búsqueda real, así que el título arranca
 * por el tipo de producto y deja marca y modelo detrás (Google corta a 150).
 */
function feedTitle(brand: string, model: string, category: string | null): string {
  const c = (category || '').toLowerCase();
  const noun = c.includes('clip')
    ? 'Armazón con clip-on de sol'
    : c.includes('sol')
      ? 'Anteojos de sol'
      : 'Armazón para lentes recetados';
  return `${noun} ${brand} ${model}`.trim().slice(0, 150);
}

/**
 * Agrupa los colores de un mismo modelo ("Dionisio C2" y "Dionisio C3" son el
 * mismo armazón). Sin esto las plataformas los tratan como productos sin relación
 * y compiten entre ellos en la misma subasta.
 */
function itemGroupId(model: string, slug: string): string {
  const base = model.replace(/\s*[-–]?\s*C\s*\d+\s*$/i, '').trim();
  return (base || slug).toLowerCase().replace(/\s+/g, '-');
}

/**
 * Género en el vocabulario de las plataformas. OJO: el dato de origen viene
 * sucio (la auditoría del catálogo del 27/7 encontró ~40 fichas con el género
 * mal cargado); esto lo traduce fielmente, no lo corrige.
 */
function feedGender(gender: string | null): string {
  const g = (gender || '').toLowerCase();
  if (g.startsWith('hombre') || g.startsWith('masc') || g === 'male') return 'male';
  if (g.startsWith('mujer') || g.startsWith('fem') || g === 'female') return 'female';
  return 'unisex';
}

/**
 * Descripción con las palabras que la gente busca ("anteojos de sol",
 * "armazón para lentes recetados"): las plataformas matchean la consulta
 * contra el texto del ítem, así que un "— Sol." pelado desperdicia el espacio.
 */
function describe(name: string, category: string | null): string {
  const c = (category || '').toLowerCase();
  // Condiciones reales de la tienda: entran acá porque son parte de lo que la
  // gente compara en el listado de Shopping, no solo en la ficha.
  const promo = 'Envío gratis a todo el país, 6 cuotas sin interés y 15% off por transferencia.';
  if (c.includes('clip')) {
    return `${name}: armazón para lentes recetados con clip-on de sol magnético. ${promo} Óptica Atelier, Córdoba.`;
  }
  if (c.includes('sol')) {
    return `${name}: anteojos de sol con protección UV. Se pueden graduar con tu receta. ${promo} Óptica Atelier, Córdoba.`;
  }
  return `${name}: armazón para anteojos recetados. Cristales a medida (monofocales y multifocales). ${promo} Óptica Atelier, Córdoba.`;
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

      const name = `${p.brand} ${p.model}`.trim();
      const title = feedTitle(p.brand, p.model, p.category);
      const link = `${APP_URL}/producto/${p.slug}`;
      const available = (p.stock ?? 0) > 0 ? cfg.inStock : cfg.outOfStock;
      const hasSale = p.salePrice && p.salePrice > 0 && p.salePrice < p.price;
      // El código de modelo del fabricante es el único identificador real que
      // tenemos (no hay código de barras): con mpn + marca el producto deja de
      // ser "sin identificar" y compite mejor.
      const mpn = (p.modelCode || '').trim();

      items += `
    <item>
      <g:id>${esc(p.id)}</g:id>
      <g:title>${esc(title)}</g:title>
      <g:description>${esc(describe(name, p.category))}</g:description>
      <g:link>${esc(link)}</g:link>
      <g:image_link>${esc(img)}</g:image_link>
      <g:availability>${available}</g:availability>
      <g:price>${priceStr(p.price)}</g:price>${hasSale ? `
      <g:sale_price>${priceStr(p.salePrice as number)}</g:sale_price>` : ''}
      <g:brand>${esc(p.brand)}</g:brand>
      <g:condition>new</g:condition>${mpn ? `
      <g:mpn>${esc(mpn)}</g:mpn>` : ''}
      <g:identifier_exists>${mpn ? 'true' : 'false'}</g:identifier_exists>
      <g:item_group_id>${esc(itemGroupId(p.model, p.slug))}</g:item_group_id>
      <g:google_product_category>${googleCategory(p.category)}</g:google_product_category>
      <g:product_type>${esc(p.category || 'Anteojos')}</g:product_type>
      <g:gender>${feedGender(p.gender)}</g:gender>
      <g:age_group>adult</g:age_group>${p.color ? `
      <g:color>${esc(p.color)}</g:color>` : ''}${p.material ? `
      <g:material>${esc(p.material)}</g:material>` : ''}${p.shape && p.shape !== 'Otros' ? `
      <g:product_detail>
        <g:section_name>Armazón</g:section_name>
        <g:attribute_name>Forma</g:attribute_name>
        <g:attribute_value>${esc(p.shape)}</g:attribute_value>
      </g:product_detail>` : ''}
      <g:shipping>
        <g:country>AR</g:country>
        <g:price>0.00 ARS</g:price>
      </g:shipping>
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
