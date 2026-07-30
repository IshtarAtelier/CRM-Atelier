// ────────────────────────────────────────────────────────────────────────────
// Regenera los snapshots de catálogo (src/data/snapshots/<clave>.json): el piso
// de la cadena de resiliencia que garantiza que el storefront NUNCA renderiza
// sin productos (ver src/lib/catalog/resilience.ts).
//
// Recorre el registro de fuentes de src/lib/catalog/queries.ts — misma query que
// usan las páginas y sus fallbacks: un solo lugar de verdad, imposible driftear.
//
// Corre en el build (package.json → "build") contra la DB que vea DATABASE_URL:
//   · Railway → producción: snapshots frescos en cada deploy.
//   · Local   → docker (.env): base para los snapshots commiteados.
//
// NO-FATAL por diseño: si la DB no responde o una fuente da vacío, esa clave no
// se sobreescribe (queda la commiteada) y sale con código ≠0; el `||` del build
// sigue de largo. Jamás tira un deploy abajo ni escribe un snapshot vacío.
//
// Correr a mano:  npm run snapshot:catalog
// (requiere --experimental-strip-types: importa módulos .ts sin transpilar)
// ────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { CATALOG_SOURCE_KEYS, runCatalogQuery } from '../../src/lib/catalog/queries.ts';
import { defaultIsEmpty } from '../../src/lib/catalog/resilience.ts';

const OUT_DIR = resolve(process.cwd(), 'src/data/snapshots');

// ────────────────────────────────────────────────────────────────────────────
// GUARDA: no escribir snapshots desde una base LOCAL.
//
// Estos JSON son el último recurso que sirve la tienda cuando la base de
// producción no responde, y están commiteados. El build los regenera contra la
// base que vea en DATABASE_URL, así que un `npm run build` en la máquina de
// alguien los sobreescribía con el catálogo de su docker — que está
// desincronizado (29/7/2026: 449 productos / 106 activos en local contra
// 119 / 114 en producción). Si esos snapshots llegaran a producción, el día que
// la base tenga un problema la tienda mostraría el catálogo de una máquina de
// desarrollo.
//
// En Railway DATABASE_URL apunta a producción y la guarda no se activa, así que
// cada deploy sigue dejando snapshots frescos y correctos.
//
// Para regenerarlos a propósito desde producción:
//   DATABASE_URL="$PROD_DATABASE_URL" npm run snapshot:catalog
// ────────────────────────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL || '';
const esLocal = /localhost|127\.0\.0\.1|::1|host\.docker\.internal/.test(DB_URL);
if (esLocal && !process.argv.includes('--forzar-local')) {
  console.log(
    '[snapshot] DATABASE_URL apunta a una base LOCAL: no se tocan los snapshots ' +
    'commiteados (son el fallback de producción). Para forzar: --forzar-local.',
  );
  process.exit(0);
}

const prisma = new PrismaClient();

let failures = 0;
mkdirSync(OUT_DIR, { recursive: true });

for (const key of CATALOG_SOURCE_KEYS) {
  try {
    const data = await runCatalogQuery(prisma, key);
    if (defaultIsEmpty(data)) {
      console.error(`[snapshot:${key}] la DB respondió VACÍO — se conserva el snapshot commiteado.`);
      failures++;
      continue;
    }
    const out = resolve(OUT_DIR, `${key}.json`);
    const payload = { generatedAt: new Date().toISOString(), key, data };
    writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');
    const kb = Math.round(Buffer.byteLength(JSON.stringify(payload)) / 1024);
    const size = Array.isArray(data)
      ? `${data.length} filas`
      : Object.entries(data).map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : v}`).join(' ');
    console.log(`[snapshot:${key}] OK → ${size} (${kb} KB)`);
    if (kb > 5000) {
      console.warn(`[snapshot:${key}] ⚠️ pesa ${kb} KB — revisar si hay imágenes data-URI de más en las filas.`);
    }
  } catch (err) {
    console.error(`[snapshot:${key}] DB no disponible — se conserva el snapshot commiteado.`, err?.message || err);
    failures++;
  }
}

await prisma.$disconnect().catch(() => {});
if (failures > 0) {
  console.error(`[snapshot] ${failures} fuente(s) sin regenerar.`);
  process.exit(1);
}
console.log(`[snapshot] ${CATALOG_SOURCE_KEYS.length} fuentes regeneradas en src/data/snapshots/`);
