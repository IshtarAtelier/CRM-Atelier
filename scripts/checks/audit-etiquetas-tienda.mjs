// ────────────────────────────────────────────────────────────────────────────
// Auditoría SOLO LECTURA de las etiquetas de los productos MINORISTAS de la web.
//
// Revisa, producto por producto, si tiene todo lo que las superficies de venta
// necesitan: la grilla de /tienda (filtros forma/material/género), la ficha
// /producto/[slug], el JSON-LD de Google y el feed de Merchant Center.
//
// NO escribe nada. Por defecto pega a la base LOCAL (DATABASE_URL). Para correr
// contra producción: AUDIT_DB_URL="$PROD_DATABASE_URL" node <este archivo>
//
// Salida: reporte por consola + JSON detallado en la ruta que se pase por
// AUDIT_OUT (opcional).
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';

const url = process.env.AUDIT_DB_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } } });

// Mismos patrones que src/utils/product-controllers.ts: si seoTags no matchea
// ninguno, la tienda cae en heurística por código de modelo y termina poniendo
// un default ("Cuadrado" / "Metal") que puede ser falso.
const FORMA_RE = /CAT-EYE|CATEYE|GATO|HEXAGONAL|REDOND[OA]|AVIADOR|CUADRAD[OA]|XL/;
const MATERIAL_RE = /TITANIO|TITANIUM|ACETATO|METAL|TR90|TR-90/;

const CATEGORIAS_VALIDAS = new Set(['Sol', 'Receta', 'Clip-On']);

const main = async () => {
  const rows = await prisma.webProduct.findMany({
    where: {
      isActive: true,
      product: { publishToWeb: true, category: { not: 'Cristal' } },
    },
    select: {
      id: true, name: true, slug: true, description: true, category: true,
      images: true, imageAlts: true, imageUrl: true, isFeatured: true,
      product: {
        select: {
          id: true, model: true, brand: true, gender: true, ageGroup: true,
          price: true, salePrice: true, stock: true, seoTitle: true,
          seoDescription: true, seoTags: true, mpn: true,
          lensWidth: true, bridgeWidth: true, templeLength: true, frameHeight: true,
          imagenesCatalogo: true, category: true,
        },
      },
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  const slugCount = new Map();
  for (const r of rows) slugCount.set(r.slug, (slugCount.get(r.slug) || 0) + 1);

  const report = rows.map((wp) => {
    const p = wp.product;
    const tags = (p.seoTags || '').toUpperCase();
    const imgs = wp.images?.length ? wp.images : (p.imagenesCatalogo || []);
    const primera = imgs[0] || '';
    const faltas = [];

    // ── Bloqueantes: sin esto no se vende o no se puede anunciar ──────────
    if (!p.price || p.price <= 0) faltas.push(['BLOQUEANTE', 'precio', 'price <= 0: no se puede comprar y el feed lo descarta']);
    if (imgs.length === 0) faltas.push(['BLOQUEANTE', 'imagen', 'sin ninguna foto: el feed lo descarta y la grilla muestra placeholder']);
    else if (primera.startsWith('data:')) faltas.push(['BLOQUEANTE', 'imagen-data-uri', 'la foto principal es base64: Merchant Center la rechaza y WhatsApp/Facebook no la previsualizan']);
    if (!wp.slug?.trim()) faltas.push(['BLOQUEANTE', 'slug', 'sin slug: la ficha no es accesible por URL']);
    else if (slugCount.get(wp.slug) > 1) faltas.push(['BLOQUEANTE', 'slug-duplicado', `el slug "${wp.slug}" se repite en ${slugCount.get(wp.slug)} productos`]);
    if (!CATEGORIAS_VALIDAS.has(wp.category)) faltas.push(['BLOQUEANTE', 'categoria', `categoría "${wp.category}" fuera de Sol/Receta/Clip-On: no entra en ningún listado`]);

    // ── Etiquetas de catálogo: si faltan, los filtros de /tienda mienten ──
    if (!FORMA_RE.test(tags)) faltas.push(['FILTRO', 'forma', 'seoTags sin forma: la tienda la adivina por código y por defecto cae en "Cuadrado"']);
    if (!MATERIAL_RE.test(tags)) faltas.push(['FILTRO', 'material', 'seoTags sin material: por defecto cae en "Metal"']);
    if (!p.gender?.trim()) faltas.push(['FILTRO', 'genero', 'sin género: la grilla lo fuerza a "Unisex"']);
    if (!p.brand?.trim()) faltas.push(['FILTRO', 'marca', 'sin marca: la grilla y el feed lo publican como "ATELIER"']);

    // ── Ficha y SEO: afectan conversión y posicionamiento ─────────────────
    if (!wp.description?.trim()) faltas.push(['FICHA', 'descripcion', 'sin descripción propia: la ficha usa un texto genérico autogenerado']);
    if (!p.seoTitle?.trim()) faltas.push(['SEO', 'seoTitle', 'sin título SEO: el <title> se arma con el modelo pelado']);
    if (!p.seoDescription?.trim()) faltas.push(['SEO', 'seoDescription', 'sin meta description propia']);
    const altsUtiles = (wp.imageAlts || []).filter((a) => a?.trim()).length;
    if (wp.images?.length > 0 && altsUtiles < wp.images.length) faltas.push(['SEO', 'imageAlts', `${altsUtiles}/${wp.images.length} fotos con alt: el resto usa alt autogenerado`]);
    if (!p.lensWidth || !p.bridgeWidth || !p.templeLength) faltas.push(['FICHA', 'medidas', 'faltan medidas (calibre/puente/patilla): el diagrama de la ficha sale vacío']);
    if (!p.mpn?.trim()) faltas.push(['SEO', 'mpn', 'sin MPN: el feed va con identifier_exists=false']);
    if (!p.ageGroup?.trim()) faltas.push(['SEO', 'ageGroup', 'sin grupo etario: no se puede segmentar adulto/niño']);

    // ── Informativo ───────────────────────────────────────────────────────
    const avisos = [];
    if ((p.stock ?? 0) <= 0) avisos.push('stock 0 → se publica como out_of_stock');
    if (p.salePrice && p.salePrice > 0 && p.salePrice >= p.price) avisos.push(`salePrice ${p.salePrice} >= price ${p.price}: la oferta no se aplica`);

    return {
      webProductId: wp.id,
      productId: p.id,
      nombre: wp.name || p.model || '(sin nombre)',
      modelo: p.model,
      slug: wp.slug,
      categoria: wp.category,
      precio: p.price,
      stock: p.stock,
      seoTags: p.seoTags,
      faltas, avisos,
    };
  });

  // ── Resumen ────────────────────────────────────────────────────────────
  const total = report.length;
  const porCampo = new Map();
  for (const r of report) {
    for (const [nivel, campo, detalle] of r.faltas) {
      if (!porCampo.has(campo)) porCampo.set(campo, { nivel, detalle, productos: [] });
      porCampo.get(campo).productos.push(r);
    }
  }

  const ORDEN = { BLOQUEANTE: 0, FILTRO: 1, FICHA: 2, SEO: 3 };
  const ranking = [...porCampo.entries()].sort(
    (a, b) => (ORDEN[a[1].nivel] - ORDEN[b[1].nivel]) || (b[1].productos.length - a[1].productos.length)
  );

  const completos = report.filter((r) => r.faltas.length === 0).length;
  const sinBloqueantes = report.filter((r) => !r.faltas.some(([n]) => n === 'BLOQUEANTE')).length;

  console.log(`\nBase auditada: ${(url || '').replace(/:[^:@/]*@/, ':****@')}`);
  console.log(`Productos minoristas publicados: ${total}`);
  console.log(`  · Sin ninguna falta: ${completos}`);
  console.log(`  · Sin bloqueantes:   ${sinBloqueantes}  (con bloqueantes: ${total - sinBloqueantes})\n`);

  console.log('FALTANTES POR ETIQUETA (peor primero)');
  console.log('─'.repeat(78));
  for (const [campo, info] of ranking) {
    const pct = ((info.productos.length / total) * 100).toFixed(0);
    console.log(`[${info.nivel.padEnd(11)}] ${campo.padEnd(16)} ${String(info.productos.length).padStart(3)}/${total} (${pct}%)  ${info.detalle}`);
  }

  console.log('\nPRODUCTOS CON BLOQUEANTES');
  console.log('─'.repeat(78));
  const bloqueados = report.filter((r) => r.faltas.some(([n]) => n === 'BLOQUEANTE'));
  if (bloqueados.length === 0) console.log('  (ninguno)');
  for (const r of bloqueados) {
    const b = r.faltas.filter(([n]) => n === 'BLOQUEANTE').map(([, c]) => c).join(', ');
    console.log(`  ${r.nombre}  [${r.categoria}]  /producto/${r.slug}  →  ${b}`);
  }

  const conAvisos = report.filter((r) => r.avisos.length > 0);
  console.log(`\nAVISOS (${conAvisos.length})`);
  console.log('─'.repeat(78));
  for (const r of conAvisos) console.log(`  ${r.nombre} → ${r.avisos.join(' | ')}`);

  if (process.env.AUDIT_OUT) {
    writeFileSync(process.env.AUDIT_OUT, JSON.stringify({ total, completos, ranking: ranking.map(([c, i]) => ({ campo: c, nivel: i.nivel, cantidad: i.productos.length })), productos: report }, null, 2));
    console.log(`\nDetalle completo → ${process.env.AUDIT_OUT}`);
  }

  await prisma.$disconnect();
};

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
