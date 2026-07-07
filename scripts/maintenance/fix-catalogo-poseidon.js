/**
 * fix-catalogo-poseidon.js — Auditoría de catálogo (julio 2026)
 *
 * Qué corrige:
 *  1. El producto "Poseidón" (Product `prod-fg1643-c2`, modelo FG1643 C2, acetato)
 *     quedó mal bautizado: FG1643 es la familia de "Dionisio" (FG1643 C4). Por eso
 *     el configurador (/arma-tus-lentes) muestra "POSEIDÓN" y "POSEIDON" como si
 *     fueran armazones distintos junto a la familia real Poseidon (9004M, metal).
 *     → Se renombra Product.name y WebProduct.name a "Dionisio C2", con lo que el
 *       duplicado desaparece y el armazón queda en su familia verdadera.
 *  2. Su WebProduct (slug `poseidon`) tiene la descripción de la plantilla metálica
 *     ("aleación metálica ultraliviana... el modelo FG1643 C2") que corresponde a la
 *     familia 9004M: texto de otro armazón sobre un cuadrado XL de acetato.
 *     → Se reemplaza por una descripción correcta de acetato.
 *  3. Dionisio (FG1643 C4, slug `dionisio`) tiene LA MISMA descripción metálica
 *     errónea. Por defecto solo se avisa; con --incluir-dionisio también se corrige.
 *
 * Además reporta (sin tocar nada): las fotos de ambos FG1643
 * (public/assets/products/acetato/FG1643-c2.avif y FG1643-c4.avif) muestran el logo
 * dorado del proveedor KAZWINI grabado en las patillas — hay que reemplazarlas a mano.
 *
 * Uso:
 *   node scripts/maintenance/fix-catalogo-poseidon.js                    # DRY-RUN contra DATABASE_URL (base local)
 *   node scripts/maintenance/fix-catalogo-poseidon.js --prod             # DRY-RUN contra PROD_DATABASE_URL
 *   node scripts/maintenance/fix-catalogo-poseidon.js --prod --ejecutar  # aplica los cambios en producción
 *
 * Flags:
 *   --ejecutar          aplica los UPDATE (sin este flag SOLO imprime lo que haría)
 *   --prod              apunta a PROD_DATABASE_URL en vez de DATABASE_URL
 *   --incluir-dionisio  corrige también la descripción de Dionisio (FG1643 C4)
 *   --renombrar-slug    además cambia el slug `poseidon` → `dionisio-c2`.
 *                       OJO: rompe URLs ya indexadas y saca al producto de la lista
 *                       hardcodeada de slugs XL en src/app/api/store/products/route.ts
 *                       y src/app/tienda/page.tsx. Por defecto el slug se conserva.
 *
 * Nota: el catálogo web se cachea 180s en memoria (serverCache), los cambios pueden
 * tardar hasta 3 minutos en verse en la tienda.
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--ejecutar');
const USE_PROD = args.includes('--prod');
const INCLUIR_DIONISIO = args.includes('--incluir-dionisio');
const RENOMBRAR_SLUG = args.includes('--renombrar-slug');

const NOMBRE_NUEVO = 'Dionisio C2';
const SLUG_NUEVO = 'dionisio-c2';

// Descripciones correctas (acetato, cuadrado amplio) con la voz del catálogo actual.
const descripcionAcetato = (modelo) =>
  `Elaborado en acetato de alta densidad pulido a mano, el modelo ${modelo} presenta un formato cuadrado amplio de espíritu retro, con frente robusto y carácter definido. Pensado para rostros medianos a grandes que buscan un estilo audaz y una presencia visual superior, sin comprometer la liviandad ni el confort de uso diario. Una pieza premium que combina elegancia atemporal y comodidad absoluta.`;

// Firma de la plantilla metálica (familia 9004M) que quedó pegada en los FG1643.
const PLANTILLA_METALICA = 'aleación metálica ultraliviana';

function resolverUrl() {
  // @prisma/client ya carga .env a process.env; fallback por si se corre pelado.
  let url = USE_PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) {
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath)) {
      const clave = USE_PROD ? 'PROD_DATABASE_URL' : 'DATABASE_URL';
      const linea = fs.readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith(clave + '='));
      if (linea) url = linea.slice(clave.length + 1).trim().replace(/^"|"$/g, '');
    }
  }
  if (!url) {
    console.error(`No se encontró ${USE_PROD ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el entorno ni en .env`);
    process.exit(1);
  }
  return url;
}

const url = resolverUrl();
const prisma = new PrismaClient({ datasources: { db: { url } } });

function hostSeguro(u) {
  try {
    const p = new URL(u);
    return `${p.hostname}:${p.port || '5432'}${p.pathname}`;
  } catch {
    return '(url ilegible)';
  }
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log(' fix-catalogo-poseidon — Poseidón (FG1643 C2) → Dionisio C2');
  console.log(`  Base:  ${USE_PROD ? 'PRODUCCIÓN' : 'local'} → ${hostSeguro(url)}`);
  console.log(`  Modo:  ${DRY_RUN ? 'DRY-RUN (no escribe nada)' : '⚠️  EJECUTAR (escribe en la base)'}`);
  console.log('════════════════════════════════════════════════════════\n');

  const cambios = []; // { descripcion, aplicar: () => Promise }

  // ── 1. El "Poseidón" mal bautizado (FG1643 C2) ─────────────────────────────
  const poseidonFalso = await prisma.product.findFirst({
    where: { model: 'FG1643 C2' },
    include: { webProducts: true },
  });

  if (!poseidonFalso) {
    console.log('No hay ningún Product con model "FG1643 C2" en esta base.');
    console.log('(La base local de dev no tiene este registro: correr con --prod para verlo.)');
  } else {
    console.log(`Product ${poseidonFalso.id} | name=${JSON.stringify(poseidonFalso.name)} | model=${poseidonFalso.model} | stock=${poseidonFalso.stock}`);

    if (poseidonFalso.name === NOMBRE_NUEVO) {
      console.log('  ✔ El Product ya se llama "Dionisio C2" (nada que hacer).');
    } else {
      cambios.push({
        descripcion: `Product ${poseidonFalso.id}: name ${JSON.stringify(poseidonFalso.name)} → ${JSON.stringify(NOMBRE_NUEVO)}`,
        aplicar: () => prisma.product.update({
          where: { id: poseidonFalso.id },
          data: { name: NOMBRE_NUEVO },
        }),
      });
    }

    for (const wp of poseidonFalso.webProducts) {
      console.log(`  WebProduct ${wp.id} | slug=${wp.slug} | name=${JSON.stringify(wp.name)} | isActive=${wp.isActive}`);
      const data = {};

      if (wp.name !== NOMBRE_NUEVO) data.name = NOMBRE_NUEVO;

      if (wp.description && wp.description.includes(PLANTILLA_METALICA)) {
        data.description = descripcionAcetato('FG1643 C2');
        console.log('    ✗ Descripción actual (plantilla metálica de la familia 9004M):');
        console.log(`      "${wp.description.slice(0, 140)}..."`);
        console.log('    → Descripción nueva (acetato):');
        console.log(`      "${data.description.slice(0, 140)}..."`);
      } else if (wp.description === descripcionAcetato('FG1643 C2')) {
        console.log('    ✔ La descripción ya está corregida.');
      } else {
        console.log('    ⚠ La descripción no coincide con la plantilla metálica esperada; no se toca.');
        console.log(`      Actual: "${(wp.description || '(vacía)').slice(0, 140)}..."`);
      }

      if (RENOMBRAR_SLUG && wp.slug === 'poseidon') {
        const ocupado = await prisma.webProduct.findUnique({ where: { slug: SLUG_NUEVO } });
        if (ocupado) {
          console.log(`    ⚠ El slug "${SLUG_NUEVO}" ya existe (WebProduct ${ocupado.id}); no se renombra.`);
        } else {
          data.slug = SLUG_NUEVO;
          console.log(`    ⚠ Se va a renombrar el slug "poseidon" → "${SLUG_NUEVO}" (revisar la lista XL hardcodeada en src).`);
        }
      }

      if (Object.keys(data).length > 0) {
        cambios.push({
          descripcion: `WebProduct ${wp.id} (slug=${wp.slug}): ${Object.keys(data).join(', ')}`,
          aplicar: () => prisma.webProduct.update({ where: { id: wp.id }, data }),
        });
      }
    }
  }

  // ── 2. Contexto: la familia Poseidon real (9004M, metal) — solo lectura ────
  const familiaReal = await prisma.product.findMany({
    where: { model: { startsWith: '9004M' } },
    select: { id: true, name: true, model: true, stock: true },
    orderBy: { model: 'asc' },
  });
  console.log(`\nFamilia Poseidon real (9004M, metal) — se deja como está (${familiaReal.length} productos):`);
  familiaReal.forEach((p) => console.log(`  · ${p.name} (${p.model}) stock=${p.stock}`));

  // ── 3. Dionisio (FG1643 C4): misma descripción metálica errónea ────────────
  const dionisio = await prisma.product.findFirst({
    where: { model: 'FG1643 C4' },
    include: { webProducts: true },
  });
  if (dionisio) {
    for (const wp of dionisio.webProducts) {
      if (wp.description && wp.description.includes(PLANTILLA_METALICA)) {
        if (INCLUIR_DIONISIO) {
          cambios.push({
            descripcion: `WebProduct ${wp.id} (slug=${wp.slug}, Dionisio FG1643 C4): description → plantilla de acetato`,
            aplicar: () => prisma.webProduct.update({
              where: { id: wp.id },
              data: { description: descripcionAcetato('FG1643 C4') },
            }),
          });
        } else {
          console.log(`\n⚠ Dionisio (slug=${wp.slug}) también tiene la descripción metálica errónea.`);
          console.log('  Correr con --incluir-dionisio para corregirla en la misma pasada.');
        }
      }
    }
  }

  // ── 4. Fotos con la marca del proveedor (solo aviso, no se toca nada) ──────
  const fotosProveedor = ['acetato/FG1643-c2.avif', 'acetato/FG1643-c4.avif'];
  console.log('\nFotos con el logo KAZWINI grabado en las patillas (reemplazar a mano, este script NO las toca):');
  for (const rel of fotosProveedor) {
    const abs = path.join(__dirname, '..', '..', 'public', 'assets', 'products', rel);
    console.log(`  · /assets/products/${rel} ${fs.existsSync(abs) ? '(existe en public/)' : '(no está en public/ local)'}`);
  }
  console.log('  (La foto del 9004M metal además tiene el sticker de fábrica "9004 55□16-145" en el cristal.)');

  // ── 5. Aplicar o imprimir ──────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────────────');
  if (cambios.length === 0) {
    console.log('No hay cambios pendientes.');
    return;
  }

  console.log(`${cambios.length} cambio(s) ${DRY_RUN ? 'que se harían' : 'a aplicar'}:`);
  cambios.forEach((c, i) => console.log(`  ${i + 1}. ${c.descripcion}`));

  if (DRY_RUN) {
    console.log('\nDRY-RUN: no se escribió nada. Para aplicar, agregar --ejecutar');
    return;
  }

  for (const c of cambios) {
    await c.aplicar();
    console.log(`  ✔ ${c.descripcion}`);
  }
  console.log('\nListo. Recordar que la tienda cachea el catálogo 180s; refrescar después de ~3 min.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
