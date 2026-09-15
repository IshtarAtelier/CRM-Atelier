#!/usr/bin/env node
/**
 * ⚠️ ESCRIBE en la base (con --aplicar): agrega las fotos "look" (la modelo con
 *   el armazón puesto o en la mano) a la galería web de cada producto.
 *
 * Qué hace
 * --------
 * Para cada `public/images/products/<clave>-look-<n>.webp`, busca el WebProduct
 * cuyo nombre normalizado coincide con <clave> y le AGREGA las fotos al final de
 * `WebProduct.images`. Al final y nunca adelante: la foto principal (images[0])
 * es la del armazón solo, es la que usa la grilla de la tienda, WhatsApp y el
 * feed de Google — no se toca. La grilla solo lee images[0] e images[1], así
 * que sumar fotos acá no le agrega ni un byte.
 *
 * Por qué `WebProduct.images` y no `Product.imagenesCatalogo`: la ficha usa
 * `images` cuando no está vacío (ver producto/[slug]/page.tsx:93), y hoy está
 * cargado en los 106 productos activos. Lo que se escriba en imagenesCatalogo
 * no se ve.
 *
 * `imageAlts` va alineado por índice con `images`: si el producto tiene alts,
 * se agrega un '' por cada foto nueva (alt automático). Si no tiene, se deja
 * vacío.
 *
 * Idempotente: una foto que ya está en la galería no se agrega dos veces.
 *
 * Uso (base LOCAL):
 *   node --env-file=.env scripts/maintenance/vincular-fotos-look.mjs            (simula)
 *   node --env-file=.env scripts/maintenance/vincular-fotos-look.mjs --aplicar
 * Contra PRODUCCIÓN (solo con OK explícito del dueño):
 *   node --env-file=.env scripts/maintenance/vincular-fotos-look.mjs --produccion
 *   node --env-file=.env scripts/maintenance/vincular-fotos-look.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { readdirSync } from 'node:fs';

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
if (PRODUCCION && !process.env.PROD_DATABASE_URL) {
  console.error('Falta PROD_DATABASE_URL. Correr con --env-file=.env desde la raíz.');
  process.exit(2);
}
const prisma = new PrismaClient(PRODUCCION ? { datasources: { db: { url: process.env.PROD_DATABASE_URL } } } : {});

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const base = (k) => k.replace(/-c\d+(-\d+)?$/, '');

async function main() {
  console.log(`Base:   ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'local'}`);
  console.log(`Modo:   ${APLICAR ? '⚠️  APLICAR (escribe)' : 'simulación'}\n`);

  const archivos = readdirSync('public/images/products').filter((f) => /-look-\d+\.webp$/.test(f)).sort();
  const porClave = new Map();
  for (const f of archivos) {
    const clave = f.replace(/-look-\d+\.webp$/, '');
    if (!porClave.has(clave)) porClave.set(clave, []);
    porClave.get(clave).push(`/images/products/${f}`);
  }

  const productos = await prisma.webProduct.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true, images: true, imageAlts: true },
  });
  const conClave = productos.map((p) => ({ ...p, k: norm(p.name) }));

  const cambios = [];
  const sinProducto = [];
  const ambiguos = [];
  for (const [clave, fotos] of porClave) {
    let m = conClave.filter((p) => p.k === clave || p.slug === clave);
    if (m.length !== 1) {
      const b = conClave.filter((p) => base(p.k) === base(clave));
      if (b.length === 1) m = b;
      else if (b.length > 1) { ambiguos.push(`${clave} → ${b.map((x) => x.name).join(' / ')}`); continue; }
    }
    if (m.length !== 1) { sinProducto.push(clave); continue; }
    const p = m[0];
    const nuevas = fotos.filter((f) => !p.images.includes(f));
    if (!nuevas.length) continue;
    cambios.push({ p, nuevas });
  }

  for (const { p, nuevas } of cambios) {
    console.log(`  ${p.name.padEnd(22)} ${p.slug.padEnd(28)} +${nuevas.length}  (galería: ${p.images.length} → ${p.images.length + nuevas.length})`);
  }
  console.log(`\nProductos a actualizar: ${cambios.length} · fotos a vincular: ${cambios.reduce((a, c) => a + c.nuevas.length, 0)}`);
  if (sinProducto.length) console.log(`Sin producto en la tienda (se ignoran): ${sinProducto.join(', ')}`);
  if (ambiguos.length) console.log(`Ambiguos (NO se tocan): ${ambiguos.join(' | ')}`);
  const yaHechos = productos.filter((p) => p.images.some((i) => i.includes('-look-'))).length;
  console.log(`Productos que ya tenían fotos look: ${yaHechos}`);

  if (!APLICAR) { console.log('\nSIMULACIÓN — no se escribió nada. Para aplicar: --aplicar'); return; }

  let ok = 0;
  for (const { p, nuevas } of cambios) {
    const imageAlts = p.imageAlts.length ? [...p.imageAlts, ...nuevas.map(() => '')] : [];
    await prisma.webProduct.update({
      where: { id: p.id },
      data: { images: [...p.images, ...nuevas], imageAlts },
      select: { id: true },
    });
    ok++;
  }
  console.log(`\nEscritos: ${ok} productos.`);
}

main().catch((e) => { console.error('Falló:', e); process.exit(1); }).finally(() => prisma.$disconnect());
