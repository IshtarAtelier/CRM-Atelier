// ────────────────────────────────────────────────────────────────────────────
// Normaliza los nombres y la marca de la tienda minorista.
//
// Reglas aplicadas (decididas por el usuario el 27/07/2026):
//   1. El nombre visible es SOLO el nombre estelar + el color: "Frida C3".
//      Nada de "Cápsula escarlata", nada de prefijo "Atelier", nada de código
//      de fábrica.
//   2. La marca (campo `Product.brand`, que la tienda imprime arriba del
//      nombre) es "Cápsula Escarlata" en TODOS los armazones, con una sola
//      grafía. Se excluyen las marcas de terceros reales (Wicue, Stellest).
//   3. Un modelo = una ficha. El G7013 C1 estaba cargado dos veces.
//
// Los nombres nuevos NO son inventados: salen del slug y del título SEO que
// cada ficha ya tenía. La única excepción es Altair (ver ORION_FIX abajo).
//
// Uso:
//   DRY_RUN=1 AUDIT_DB_URL="$PROD_DATABASE_URL" node <este archivo>   → simula
//            AUDIT_DB_URL="$PROD_DATABASE_URL" node <este archivo>   → escribe
//
// Antes de escribir deja una reversa JSON con el estado previo de cada fila
// tocada, para poder volver atrás sin tener que restaurar un backup entero.
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';

const url = process.env.AUDIT_DB_URL || process.env.DATABASE_URL;
const DRY = !!process.env.DRY_RUN;
const prisma = new PrismaClient({ datasources: { db: { url } } });

const MARCA = 'Cápsula Escarlata';
// Marcas de terceros: son fabricantes reales distintos, no se pisan.
const MARCAS_AJENAS = ['Wicue', 'Stellest essilor'];

// Nombre nuevo por código de fábrica. Fuente: el slug y el seoTitle de la
// propia ficha, salvo Altair.
const NOMBRES = {
  // Perdieron el nombre y quedaron con el del canal mayorista
  'A12183 C2': 'Monaco C2',
  'BC3059-C1': 'Lumen C1',
  'FD88810-C1': 'Roma C1',
  'FD88821-C4': 'Osiris C4',
  'M7027 C4': 'Calliope C4',
  'P5783-C3': 'Atenea C3',
  'P5786-C1': 'Olimpia C1',
  'P5787-C4': 'Hera C4',
  'Q5205-C2': 'Helena C2',
  'Q5205-C3': 'Helena C3',
  'Q5205-C4': 'Helena C4',
  'Q5205-C5': 'Helena C5',
  'Q8013-C3': 'Frida C3',
  'Q8013-C6': 'Frida C6',
  'TL3704A C4': 'Electra C4',
  'TL3704A C5': 'Electra C5',
  // Traían el prefijo "Atelier" pegado
  '91501 C6': 'Athena C6',
  'HY238013 C1': 'Gaia C1',
  // Les faltaba el color (el color estaba en su propia URL)
  'M7239 C4': 'Clotho C4',
  'M7011 C4': 'Hebe C4',
  'TG2807 C1': 'Helios C1',
  'TL5208 C2': 'Rhea C2',
  'TL5213 C4': 'Semele C4',
  'V99011 C4': 'Ulises C4',
  'FG1643 C4': 'Dionisio C4',
  '7018 C5': 'Venice C5',
};

// El YF3090-C1 reclamaba "Orión", pero ese nombre ya lo usa el G7012 C1, que
// está publicado y visible con él. El que se mueve es el nuevo. Altair mantiene
// la convención estelar del catálogo. Su slug /orion NO se toca: cambiarlo
// rompería los links que ya circulan.
const ORION_FIX = { modelo: 'YF3090-C1', nombre: 'Altair C1' };

// El G7013 C1 está cargado como dos productos distintos, con stock en los dos.
// Queda publicado Artemis (ficha destacada, con SEO trabajado) y se despublica
// la carga posterior. NO se borra: solo se saca de la vista.
const DUPLICADO = {
  modelo: 'G7013 C1',
  queda: 'atelier-artemis-tendencia',   // slug de la que sigue publicada
  nombreQueda: 'Artemis C1',
  despublicar: 'halley-c1',             // slug de la que se oculta
};

// Prisma, por defecto, devuelve la fila entera después de un update — y eso
// incluye columnas que el schema local tiene pero producción todavía no
// (baseCost). Pedir solo el id evita que el update explote por leer de más.
const soloId = { select: { id: true } };

const main = async () => {
  // select explícito, no `include`: el schema local tiene columnas que todavía
  // no están migradas en producción y un include las pediría todas.
  const rows = await prisma.webProduct.findMany({
    select: {
      id: true, name: true, slug: true, isActive: true,
      product: { select: { id: true, model: true, brand: true, stock: true, publishToWeb: true } },
    },
  });

  const reversa = [];
  const cambios = { nombre: [], marca: [], despublicado: [] };

  const out = `scripts/maintenance/reversa-nombres-tienda-${process.env.STAMP || 'sin-fecha'}.json`;
  // La reversa se escribe pase lo que pase: si el proceso se corta a mitad de
  // camino, lo peor que puede pasar es quedarse sin el registro de lo que ya
  // se escribió. Por eso el finally.
  try {

  for (const wp of rows) {
    const p = wp.product;
    const modelo = (p.model || '').trim();

    // ── nombre ──────────────────────────────────────────────
    let nombreNuevo = null;
    if (wp.slug === DUPLICADO.queda) nombreNuevo = DUPLICADO.nombreQueda;
    else if (modelo === ORION_FIX.modelo) nombreNuevo = ORION_FIX.nombre;
    else if (NOMBRES[modelo]) nombreNuevo = NOMBRES[modelo];

    if (nombreNuevo && nombreNuevo !== wp.name) {
      cambios.nombre.push([wp.name, nombreNuevo]);
      reversa.push({ tipo: 'webProduct.name', id: wp.id, antes: wp.name, despues: nombreNuevo });
      if (!DRY) await prisma.webProduct.update({ where: { id: wp.id }, data: { name: nombreNuevo }, ...soloId });
    }

    // ── marca ───────────────────────────────────────────────
    if (!MARCAS_AJENAS.includes(p.brand) && p.brand !== MARCA) {
      cambios.marca.push([p.brand, wp.name]);
      reversa.push({ tipo: 'product.brand', id: p.id, antes: p.brand, despues: MARCA });
      if (!DRY) await prisma.product.update({ where: { id: p.id }, data: { brand: MARCA }, ...soloId });
    }

    // ── duplicado ───────────────────────────────────────────
    if (wp.slug === DUPLICADO.despublicar && (wp.isActive || p.publishToWeb)) {
      cambios.despublicado.push(`${wp.name} (${modelo}) — stock ${p.stock} queda intacto`);
      reversa.push({
        tipo: 'duplicado', webProductId: wp.id, productId: p.id,
        antes: { isActive: wp.isActive, publishToWeb: p.publishToWeb },
        despues: { isActive: false, publishToWeb: false },
      });
      if (!DRY) {
        await prisma.webProduct.update({ where: { id: wp.id }, data: { isActive: false }, ...soloId });
        await prisma.product.update({ where: { id: p.id }, data: { publishToWeb: false }, ...soloId });
      }
    }
  }

  } finally {
    if (!DRY && reversa.length) writeFileSync(out, JSON.stringify(reversa, null, 2));
  }

  console.log(DRY ? '=== SIMULACRO, no se escribió nada ===\n' : '=== APLICADO ===\n');
  console.log(`Nombres corregidos: ${cambios.nombre.length}`);
  for (const [a, b] of cambios.nombre) console.log(`   ${a}  →  ${b}`);
  console.log(`\nMarca unificada a "${MARCA}": ${cambios.marca.length} productos`);
  const porMarca = {};
  for (const [antes] of cambios.marca) porMarca[antes] = (porMarca[antes] || 0) + 1;
  for (const [k, v] of Object.entries(porMarca)) console.log(`   ${v} venían como "${k}"`);
  console.log(`\nDespublicados por duplicado: ${cambios.despublicado.length}`);
  for (const d of cambios.despublicado) console.log(`   ${d}`);
  if (!DRY) console.log(`\nReversa escrita en ${out} (${reversa.length} filas)`);
};

main().finally(() => prisma.$disconnect());
