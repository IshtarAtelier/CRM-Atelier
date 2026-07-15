// ────────────────────────────────────────────────────────────────────────────
// Regenera src/data/home-snapshot.json: el fallback empaquetado que garantiza
// que la home NUNCA renderiza sin productos (ver src/lib/home-fallback.ts).
//
// Corre en el build (package.json → "build"), contra la DB que vea DATABASE_URL:
//   - En Railway: la de producción → snapshot fresco en cada deploy.
//   - En local: la de docker (.env) → sirve como fallback inicial commiteado.
//
// Es NO-FATAL por diseño: si la DB no responde o devuelve 0 productos, sale con
// código ≠0 y el build sigue usando el snapshot commiteado (por el `||` del script
// de build). Jamás debe tirar un deploy abajo ni escribir un snapshot vacío.
// ────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const OUT = resolve(process.cwd(), 'src/data/home-snapshot.json');

// Mismo shape que PRODUCT_SELECT en src/lib/home-products.ts
const PRODUCT_SELECT = {
  name: true,
  imageUrl: true,
  images: true,
  slug: true,
  product: {
    select: {
      id: true,
      price: true,
      stock: true,
      model: true,
      category: true,
      imagenesCatalogo: true,
    },
  },
};

const prisma = new PrismaClient();

try {
  const [destacados, sol, receta, nuevos, count] = await Promise.all([
    prisma.webProduct.findMany({
      where: { isActive: true, isFeatured: true, product: { publishToWeb: true, category: { not: 'Cristal' } } },
      select: PRODUCT_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 24,
    }),
    prisma.webProduct.findMany({
      where: { isActive: true, product: { publishToWeb: true, category: 'Lentes de Sol' } },
      select: PRODUCT_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 24,
    }),
    prisma.webProduct.findMany({
      where: { isActive: true, product: { publishToWeb: true, category: 'Armazón de Receta' } },
      select: PRODUCT_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 24,
    }),
    prisma.webProduct.findMany({
      where: { isActive: true, product: { publishToWeb: true, category: { not: 'Cristal' } } },
      select: PRODUCT_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 24,
    }),
    prisma.webProduct.count({
      where: { isActive: true, product: { publishToWeb: true, category: { not: 'Cristal' } } },
    }),
  ]);

  const total = destacados.length + sol.length + receta.length + nuevos.length;
  if (total === 0) {
    console.error('[snapshot] La DB respondió pero con 0 productos — NO se sobreescribe el snapshot commiteado.');
    process.exit(1);
  }

  const snapshot = { generatedAt: new Date().toISOString(), count, destacados, sol, receta, nuevos };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`[snapshot] OK → ${OUT} (destacados:${destacados.length} sol:${sol.length} receta:${receta.length} nuevos:${nuevos.length}, catálogo:${count})`);
} catch (err) {
  console.error('[snapshot] DB no disponible — se mantiene el snapshot commiteado.', err?.message || err);
  process.exit(1);
} finally {
  await prisma.$disconnect().catch(() => {});
}
