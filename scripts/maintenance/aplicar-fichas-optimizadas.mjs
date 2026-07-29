// ────────────────────────────────────────────────────────────────────────────
// Aplica las fichas optimizadas (salida de la auditoría multi-agente) sobre la
// base. DRY-RUN por defecto: sin --apply no escribe una sola fila.
//
//   Ver qué cambiaría (local):
//     node --env-file=.env scripts/maintenance/aplicar-fichas-optimizadas.mjs <fichas.json>
//   Aplicar de verdad (local):
//     node --env-file=.env scripts/maintenance/aplicar-fichas-optimizadas.mjs <fichas.json> --apply
//   Contra producción (SOLO con autorización explícita del dueño):
//     AUDIT_DB_URL="$PROD_DATABASE_URL" node --env-file=.env scripts/maintenance/aplicar-fichas-optimizadas.mjs <fichas.json> --apply
//
// Qué toca:  Product.seoTitle, seoDescription, seoTags, mpn, gender, ageGroup
//            WebProduct.description, imageAlts
// Qué NO toca NUNCA: precio, costo, stock, imágenes, isActive, publishToWeb,
//            slug ni categoría. Este script no puede cambiar lo que se cobra ni
//            despublicar nada.
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'node:fs';

const [, , fichasPath, ...flags] = process.argv;
const APPLY = flags.includes('--apply');

if (!fichasPath) {
  console.error('Uso: node aplicar-fichas-optimizadas.mjs <fichas.json> [--apply]');
  process.exit(1);
}

const url = process.env.AUDIT_DB_URL || process.env.DATABASE_URL;
const esProd = /rlwy\.net|railway/.test(url || '');
const prisma = new PrismaClient({ datasources: { db: { url } } });

// Mismo vocabulario que src/utils/product-controllers.ts. Si un seoTags no
// matchea, la tienda cae en su heurística y el filtro miente: lo rechazamos
// antes de escribirlo, no después.
const FORMA_RE = /CAT-EYE|CATEYE|GATO|HEXAGONAL|REDOND[OA]|AVIADOR|CUADRAD[OA]|XL/;
const MATERIAL_RE = /TITANIO|TITANIUM|ACETATO|METAL|TR90|TR-90/;
const GENEROS = new Set(['Femenino', 'Masculino', 'Unisex']);
const EDADES = new Set(['Adulto', 'Niño']);

const validar = (f) => {
  const e = [];
  const tags = (f.seoTags || '').toUpperCase();
  if (!FORMA_RE.test(tags)) e.push('seoTags sin forma del vocabulario cerrado');
  if (!MATERIAL_RE.test(tags)) e.push('seoTags sin material del vocabulario cerrado');
  if (!f.seoTitle?.trim()) e.push('seoTitle vacío');
  else if (f.seoTitle.length > 40) e.push(`seoTitle de ${f.seoTitle.length} chars (máx 40)`);
  else if (/atelier|óptica|optica|córdoba|cordoba/i.test(f.seoTitle)) e.push('seoTitle repite marca/ciudad que el código ya agrega');
  if (!f.seoDescription?.trim()) e.push('seoDescription vacía');
  else if (f.seoDescription.length > 160) e.push(`seoDescription de ${f.seoDescription.length} chars (máx 160)`);
  if (!f.description?.trim()) e.push('description vacía');
  else if (f.description.length < 250) e.push(`description de ${f.description.length} chars (mín 250)`);
  if (f.genero && !GENEROS.has(f.genero)) e.push(`genero inválido: "${f.genero}"`);
  if (f.ageGroup && !EDADES.has(f.ageGroup)) e.push(`ageGroup inválido: "${f.ageGroup}"`);
  if (/\bgafas\b|\bmontura\b/i.test(`${f.description} ${f.seoDescription}`)) e.push('españolismo ("gafas"/"montura")');
  return e;
};

const main = async () => {
  const raw = JSON.parse(readFileSync(fichasPath, 'utf8'));
  const fichas = Array.isArray(raw) ? raw : (raw.productos || []);

  console.log(`\nBase:   ${(url || '').replace(/:[^:@/]*@/, ':****@')}`);
  console.log(`Modo:   ${APPLY ? '*** APLICANDO CAMBIOS ***' : 'DRY-RUN (no escribe nada)'}`);
  if (esProd && APPLY) console.log('⚠️  ESTA ES LA BASE DE PRODUCCIÓN.');
  console.log(`Fichas: ${fichas.length}\n`);

  const rechazadas = [];
  const cambios = [];
  const noEncontradas = [];

  for (const f of fichas) {
    const errores = validar(f);
    if (errores.length) { rechazadas.push({ slug: f.slug, errores }); continue; }

    const wp = await prisma.webProduct.findUnique({
      where: { slug: f.slug },
      select: {
        id: true, description: true, imageAlts: true, images: true,
        product: { select: { id: true, seoTitle: true, seoDescription: true, seoTags: true, mpn: true, gender: true, ageGroup: true } },
      },
    });
    if (!wp) { noEncontradas.push(f.slug); continue; }

    const p = wp.product;
    const diff = {};
    const set = (campo, viejo, nuevo) => { if (nuevo != null && nuevo !== '' && nuevo !== viejo) diff[campo] = { de: viejo, a: nuevo }; };

    set('seoTitle', p.seoTitle, f.seoTitle);
    set('seoDescription', p.seoDescription, f.seoDescription);
    set('seoTags', p.seoTags, f.seoTags);
    set('mpn', p.mpn, f.mpn);
    set('gender', p.gender, f.genero);
    set('ageGroup', p.ageGroup, f.ageGroup);
    set('description', wp.description, f.description);

    // Un alt por foto: recortamos/completamos para que queden alineados por índice.
    if (Array.isArray(f.imageAlts) && f.imageAlts.length && wp.images.length) {
      const alts = wp.images.map((_, i) => f.imageAlts[i] || f.imageAlts[f.imageAlts.length - 1]);
      if (JSON.stringify(alts) !== JSON.stringify(wp.imageAlts)) diff.imageAlts = { de: wp.imageAlts, a: alts };
    }

    if (Object.keys(diff).length === 0) continue;
    cambios.push({ slug: f.slug, webProductId: wp.id, productId: p.id, diff });

    if (APPLY) {
      const dataProduct = {};
      for (const c of ['seoTitle', 'seoDescription', 'seoTags', 'mpn', 'ageGroup']) if (diff[c]) dataProduct[c] = diff[c].a;
      if (diff.gender) dataProduct.gender = diff.gender.a;
      const dataWeb = {};
      if (diff.description) dataWeb.description = diff.description.a;
      if (diff.imageAlts) dataWeb.imageAlts = diff.imageAlts.a;

      await prisma.$transaction([
        ...(Object.keys(dataProduct).length ? [prisma.product.update({ where: { id: p.id }, data: dataProduct })] : []),
        ...(Object.keys(dataWeb).length ? [prisma.webProduct.update({ where: { id: wp.id }, data: dataWeb })] : []),
      ]);
    }
  }

  // ── Reporte ────────────────────────────────────────────────────────────
  console.log(`Productos con cambios: ${cambios.length}`);
  const porCampo = {};
  for (const c of cambios) for (const k of Object.keys(c.diff)) porCampo[k] = (porCampo[k] || 0) + 1;
  for (const [k, v] of Object.entries(porCampo).sort((a, b) => b[1] - a[1])) console.log(`   ${k.padEnd(16)} ${v}`);

  if (rechazadas.length) {
    console.log(`\n❌ RECHAZADAS por no cumplir las reglas (${rechazadas.length}) — no se tocaron:`);
    for (const r of rechazadas) console.log(`   ${r.slug}: ${r.errores.join(' | ')}`);
  }
  if (noEncontradas.length) console.log(`\n⚠️  Sin match en la base (${noEncontradas.length}): ${noEncontradas.join(', ')}`);

  const salida = fichasPath.replace(/\.json$/, '') + '.diff.json';
  writeFileSync(salida, JSON.stringify({ modo: APPLY ? 'aplicado' : 'dry-run', cambios, rechazadas, noEncontradas }, null, 2));
  console.log(`\nDiff completo → ${salida}`);
  if (!APPLY) console.log('Nada se escribió. Volvé a correr con --apply cuando revises el diff.');

  await prisma.$disconnect();
};

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
