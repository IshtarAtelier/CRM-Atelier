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
import { formaAdjetivo, formaFemenina, formaVisible } from '@/lib/catalog/forma-armazon';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
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

/** Sin tildes y en minúscula: para comparar nombres, nunca para mostrar. */
const plano = (s: string) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * URLs de imagen ABSOLUTAS aptas para los catálogos: nada de data URIs, rutas
 * relativas ni AVIF (formato que ninguna de las dos plataformas acepta; WebP
 * sí). Los .avif de public/ tienen su copia .webp generada por
 * scripts/ads/convert_feed_images.js.
 *
 * Devuelve la lista completa porque Shopping muestra las fotos extra en la
 * ficha del producto: con una sola imagen el aviso queda plano al lado de
 * competidores que muestran tres ángulos.
 */
function feedImages(images: string[] | undefined): string[] {
  const out: string[] = [];
  for (const raw of images || []) {
    let resolved = resolveStorageUrl(raw);
    if (!resolved || resolved.startsWith('data:')) continue;
    resolved = resolved.replace(/\.avif$/i, '.webp');
    const abs = resolved.startsWith('http')
      ? resolved
      : resolved.startsWith('/')
        ? `${APP_URL}${resolved}${versionDeImagen(resolved)}`
        : '';
    if (abs && !out.includes(abs)) out.push(abs);
  }
  return out;
}

/**
 * `?v=<hash del archivo>` para las fotos que viven en public/. Meta y Google
 * no vuelven a bajar una imagen cuya URL no cambió: el 3/10/2026 se
 * reemplazaron las fotos de seis lentes de sol (recorte del PDF del pedido →
 * foto oficial) en el MISMO path y el catálogo de Meta habría seguido
 * mostrando la captura. Con el hash en la URL, una foto nueva es una URL
 * nueva y se baja sola en la próxima lectura del feed; una foto igual
 * conserva su URL y no se re-descarga. Se calcula una vez por archivo y por
 * proceso.
 */
const versionesDeImagen = new Map<string, string>();
function versionDeImagen(rutaPublica: string): string {
  const limpia = rutaPublica.split('?')[0];
  if (!versionesDeImagen.has(limpia)) {
    let v = '';
    try {
      const bytes = readFileSync(path.join(process.cwd(), 'public', limpia));
      v = createHash('md5').update(bytes).digest('hex').slice(0, 8);
    } catch {
      v = '';   // no está en public/ (Firebase, etc.): la URL queda como estaba
    }
    versionesDeImagen.set(limpia, v);
  }
  const v = versionesDeImagen.get(limpia);
  return v ? `?v=${v}` : '';
}

/**
 * Categoría de la taxonomía de Google (Meta usa la misma). Define en qué
 * búsquedas compite el producto, así que un armazón de receta NO puede ir
 * como anteojo de sol.
 *   178 = Ropa y accesorios > Complementos > Gafas de sol
 *   524 = Salud y belleza > Cuidado personal > Cuidado visual > Gafas
 * Los clip-on se declaran como sol: el uso que se busca es el de sol.
 */
function googleCategory(category: string | null): string {
  const c = (category || '').toLowerCase();
  return c.includes('sol') || c.includes('clip') ? '178' : '524';
}

type Tipo = 'sol' | 'clip' | 'receta';

function tipoDe(category: string | null): Tipo {
  const c = (category || '').toLowerCase();
  if (c.includes('clip')) return 'clip';
  if (c.includes('sol')) return 'sol';
  return 'receta';
}

/**
 * El sustantivo por el que la gente busca. `plural` existe solo para que el
 * adjetivo de forma concuerde: "anteojos de sol REDONDOS" vs "armazón REDONDO".
 */
const SUSTANTIVO: Record<Tipo, { texto: string; plural: boolean }> = {
  sol: { texto: 'Anteojos de sol', plural: true },
  clip: { texto: 'Armazón con clip-on de sol', plural: false },
  receta: { texto: 'Armazón para lentes recetados', plural: false },
};

/**
 * Saca la marca del nombre del modelo cuando ya viene adentro: hay fichas
 * cargadas como "Capsula escarlata Carey", que en el título salían
 * "Cápsula Escarlata Capsula escarlata Carey".
 */
function modeloSinMarca(brand: string, model: string): string {
  const b = plano(brand);
  const m = model.trim();
  if (!b || plano(m) === b) return m;
  // plano() no cambia la cantidad de caracteres (descompone y vuelve a sacar la
  // tilde), pero se verifica igual antes de cortar por longitud: si no coincide,
  // se devuelve el modelo tal cual en vez de mutilarlo.
  if (plano(m).startsWith(b) && plano(m.slice(0, brand.length)) === b) {
    const resto = m.slice(brand.length).replace(/^[\s\-–·]+/, '').trim();
    if (resto) return resto;
  }
  return m;
}

/**
 * Título con el sustantivo por el que la gente busca adelante, seguido de los
 * atributos que se escriben en la consulta real (forma, material, color). El
 * nombre de la tienda es una estrella ("Antares", "Vega") y la marca es
 * "Cápsula Escarlata": los dos juntos no matchean NINGUNA búsqueda, así que
 * van al final. Google indexa hasta 150 caracteres y muestra ~70, por eso el
 * orden es de más buscado a menos.
 *
 * El género NO entra acá a propósito: el dato de origen viene sucio (la
 * auditoría del 27/7 encontró ~40 fichas mal cargadas) y un "para mujer"
 * equivocado en el título espanta el clic. Va solo en <g:gender>.
 */
function feedTitle(
  brand: string,
  model: string,
  category: string | null,
  color: string | null,
  material: string | null,
  shape: string | null,
  polarizado: boolean,
): string {
  const tipo = tipoDe(category);
  const { texto, plural } = SUSTANTIVO[tipo];
  const forma = formaAdjetivo(shape, plural);
  const mat = (material || '').trim().toLowerCase();
  const col = (color || '').trim().toLowerCase();

  let t = texto;
  // "Polarizados" es de lo más buscado en sol, y va pegado al sustantivo porque
  // así se escribe la búsqueda. Solo cuando la ficha lo dice (ver esPolarizado).
  if (polarizado && tipo !== 'receta') t += plural ? ' polarizados' : ' polarizado';
  if (forma) t += ` ${forma}`;
  if (mat) t += ` de ${mat}`;
  if (col) t += `, color ${col}`;
  const nombre = `${brand} ${modeloSinMarca(brand, model)}`.trim();
  return `${t} · ${nombre}`.trim().slice(0, 150);
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
 * Descripción con las palabras que la gente busca Y con forma, color y material
 * escritos en el texto: Merchant Center evalúa la descripción aparte de los
 * atributos y viene reclamando justamente esos tres para la categoría Gafas.
 *
 * NADA de promociones acá (envío gratis, cuotas, % off): las guías editoriales
 * de Google prohíben texto promocional en la descripción, y el envío gratis ya
 * viaja en <g:shipping>, que es donde Google lo lee para mostrarlo.
 */
function describe(
  name: string,
  category: string | null,
  color: string | null,
  material: string | null,
  shape: string | null,
  polarizado: boolean,
): string {
  const tipo = tipoDe(category);
  const cabeza =
    tipo === 'sol'
      ? `${name}: anteojos de sol con ${polarizado ? 'lentes polarizados y ' : ''}protección UV.`
      : tipo === 'clip'
        ? `${name}: armazón para lentes recetados con clip-on de sol magnético${polarizado ? ' de lentes polarizados' : ''}.`
        : `${name}: armazón para anteojos recetados.`;

  // Cada dato con su etiqueta, como lo busca Google. El 3/10/2026 Merchant
  // Center marcaba 73 fichas como "faltan Forma, Color, Material del marco"
  // aunque la frase "Marco de forma cuadrada, color negro, material del marco
  // titanio" ya los tenía: su lector espera "Forma: …", "Color: …",
  // "Material del marco: …" como oraciones propias.
  const specs: string[] = [];
  // formaFemenina() ya devuelve la palabra como se escribe ("cuadrada", "XL"):
  // bajarla a minúsculas acá dejaba "forma xl".
  const forma = formaFemenina(shape);
  if (forma) specs.push(`Forma: ${forma}.`);
  if (color) specs.push(`Color: ${color.toLowerCase()}.`);
  if (material) specs.push(`Material del marco: ${material.toLowerCase()}.`);
  const ficha = specs.length ? ` ${specs.join(' ')}` : '';

  const uso =
    tipo === 'sol'
      ? ' Se puede graduar con tu receta: se le colocan cristales monofocales o multifocales a medida.'
      : ' Se arma con cristales a medida según tu receta, monofocales o multifocales.';

  return `${cabeza}${ficha}${uso} Anteojos vendidos y armados por Atelier Óptica, Córdoba, Argentina.`;
}

/**
 * Ruta de categoría propia (no la taxonomía de Google). Google la usa para
 * agrupar el catálogo en las campañas: con "Receta" pelado no se puede pujar
 * distinto por material o por forma.
 */
function productType(category: string | null, material: string | null, shape: string | null): string {
  const tipo = tipoDe(category);
  const raiz =
    tipo === 'sol' ? 'Anteojos de sol' : tipo === 'clip' ? 'Armazones con clip-on' : 'Armazones de receta';
  const partes = ['Anteojos', raiz];
  if (material) partes.push(material);
  const forma = formaVisible(shape);
  if (forma) partes.push(forma);
  return partes.join(' > ');
}

/**
 * Datos destacados que Google puede mostrar en la ficha del producto. Máximo
 * 10, hasta 150 caracteres cada uno y sin texto promocional (misma regla que
 * la descripción).
 */
function highlights(
  category: string | null,
  color: string | null,
  material: string | null,
  shape: string | null,
  polarizado: boolean,
): string[] {
  const tipo = tipoDe(category);
  const out: string[] = [];
  const forma = formaFemenina(shape);
  if (forma) out.push(`Forma ${forma}`);
  if (material) out.push(`Marco de ${material.toLowerCase()}`);
  if (color) out.push(`Color ${color.toLowerCase()}`);
  if (polarizado && tipo !== 'receta') out.push('Lentes polarizados');
  if (tipo === 'sol') out.push('Protección UV');
  if (tipo === 'clip') out.push('Clip-on de sol magnético incluido');
  out.push('Cristales a medida según tu receta, monofocales o multifocales');
  return out.slice(0, 10);
}

/*
 * custom_label_3 (solo Meta) = el nombre del modelo tal como lo muestra la
 * tienda ("Onix Negro", "Vega C1"). Es el título de cada tarjeta en los
 * carruseles de catálogo (`{{product.custom_label_3}}` en
 * scripts/ads/rearmar_campania_ventas_tienda.js): con el título largo del feed,
 * la tarjeta decía "Armazón para lentes recetados cuad…" y el modelo quedaba
 * cortado. El título del feed no se acorta porque es el que matchea búsquedas
 * (ver feedTitle).
 */

/** Franja de precio para segmentar las pujas sin tener que listar productos. */
function franjaPrecio(precio: number): string {
  if (precio < 150000) return 'hasta-150k';
  if (precio < 180000) return '150k-180k';
  if (precio < 210000) return '180k-210k';
  return '210k-mas';
}

type ProductoMapeado = Awaited<ReturnType<typeof getMappedWebCatalog>>['products'][number];

/**
 * Qué productos van a los catálogos. Una sola regla para el feed de productos
 * y para el inventario local: si divergieran, Merchant tendría inventario de
 * productos que no conoce (o productos sin inventario en el local).
 * Solo armazones/sol con precio e imagen (los cristales no van al catálogo).
 */
function vaAlCatalogo(p: ProductoMapeado): p is ProductoMapeado & { price: number } {
  if (p.category === 'Cristal') return false;
  if (!p.price || p.price <= 0) return false;
  return feedImages(p.imagenesCatalogo).length > 0;
}

/** Arma el XML completo del feed para la plataforma pedida. */
export async function buildProductFeed(platform: FeedPlatform): Promise<string> {
  const cfg = PLATFORMS[platform];
  let items = '';

  try {
    const { products } = await getMappedWebCatalog();

    for (const p of products) {
      if (!vaAlCatalogo(p)) continue;
      const [img, ...extra] = feedImages(p.imagenesCatalogo);

      const shape = formaVisible(p.shape) || null;
      const material = p.material || null;
      const color = p.color || null;

      const name = `${p.brand} ${modeloSinMarca(p.brand, p.model)}`.trim();
      const title = feedTitle(p.brand, p.model, p.category, color, material, shape, p.polarizado);
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
      <g:description>${esc(describe(name, p.category, color, material, shape, p.polarizado))}</g:description>
      <g:link>${esc(link)}</g:link>
      <g:image_link>${esc(img)}</g:image_link>${extra
        .slice(0, 10)
        .map((u) => `
      <g:additional_image_link>${esc(u)}</g:additional_image_link>`)
        .join('')}
      <g:availability>${available}</g:availability>
      <g:price>${priceStr(p.price)}</g:price>${hasSale ? `
      <g:sale_price>${priceStr(p.salePrice as number)}</g:sale_price>` : ''}
      <g:brand>${esc(p.brand)}</g:brand>
      <g:condition>new</g:condition>${mpn ? `
      <g:mpn>${esc(mpn)}</g:mpn>` : ''}
      <g:identifier_exists>${mpn ? 'true' : 'false'}</g:identifier_exists>
      <g:item_group_id>${esc(itemGroupId(p.model, p.slug))}</g:item_group_id>
      <g:google_product_category>${googleCategory(p.category)}</g:google_product_category>
      <g:product_type>${esc(productType(p.category, material, shape))}</g:product_type>
      <g:gender>${feedGender(p.gender)}</g:gender>
      <g:age_group>adult</g:age_group>${color ? `
      <g:color>${esc(color)}</g:color>` : ''}${material ? `
      <g:material>${esc(material)}</g:material>` : ''}${shape ? `
      <g:product_detail>
        <g:section_name>Armazón</g:section_name>
        <g:attribute_name>Forma</g:attribute_name>
        <g:attribute_value>${esc(shape)}</g:attribute_value>
      </g:product_detail>` : ''}${highlights(p.category, color, material, shape, p.polarizado)
        .map((h) => `
      <g:product_highlight>${esc(h)}</g:product_highlight>`)
        .join('')}
      <g:custom_label_0>${esc(p.category || 'Anteojos')}</g:custom_label_0>
      <g:custom_label_1>${franjaPrecio(p.price)}</g:custom_label_1>${shape ? `
      <g:custom_label_2>${esc(shape)}</g:custom_label_2>` : ''}${platform === 'meta' ? `
      <g:custom_label_3>${esc(modeloSinMarca(p.brand, p.model))}</g:custom_label_3>` : ''}
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

/**
 * Inventario LOCAL para Google Merchant Center (fichas locales gratuitas): los
 * mismos productos del feed, declarados en el local (código de tienda del
 * Perfil de Empresa), con la misma disponibilidad y el mismo precio que online.
 * Merchant lo baja cada 24 h desde /api/web/feed/google-local, así el stock
 * del local se mantiene igual al de la tienda sin cargar nada a mano.
 *
 * Formato: texto separado por tabulaciones, una fila por producto.
 */
export async function buildLocalInventoryFeed(storeCode: string): Promise<string> {
  const filas = ['store_code\tid\tavailability\tprice\tsale_price'];
  try {
    const { products } = await getMappedWebCatalog();
    for (const p of products) {
      if (!vaAlCatalogo(p)) continue;
      const disponible = (p.stock ?? 0) > 0 ? 'in_stock' : 'out_of_stock';
      const oferta = p.salePrice && p.salePrice > 0 && p.salePrice < p.price ? priceStr(p.salePrice) : '';
      filas.push([storeCode, p.id, disponible, priceStr(p.price), oferta].map((v) => String(v).replace(/[\t\n]/g, ' ')).join('\t'));
    }
  } catch (err) {
    captureError(err, { scope: 'feed.google-local' });
  }
  return filas.join('\n') + '\n';
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
