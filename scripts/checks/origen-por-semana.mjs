// ────────────────────────────────────────────────────────────────────────────
// Clientes nuevos y ventas cobradas por etiqueta de origen ("¿Dónde nos
// conocieron?"), semana a semana y mes a mes. SOLO LEE.
//
// Para qué (28/9/2026): evaluar el experimento de Google Maps pausada (desde el
// 15/9 23:55). La hipótesis de Ishtar es que mostrarse en Maps trae gente al
// local; las vendedoras cargan a esa gente como "Calle" (en 9 semanas nadie
// eligió "Google Maps"), así que lo que se mira es Calle + Google Maps por
// semana contra la línea base con Maps prendida (4-5 clientes Calle/semana).
//
// Llama a `AttributionService.porCanal()` REAL, la misma cuenta que la tabla
// "por canal" de /admin/analitica/atribucion, solo que por semana y por mes:
//   - clientes nuevos = fichas CREADAS en el período, por su origen;
//   - ventas cobradas = órdenes con algún pago EN el período (filas de Payment,
//     porque Order.paid no prueba cobro), imputadas al origen del cliente.
//     Una venta con seña en una semana y saldo en otra cuenta en las dos.
//
// Uso:
//   node --env-file=.env --experimental-strip-types --import ./scripts/checks/_alias.mjs \
//     scripts/checks/origen-por-semana.mjs [--prod] [--desde 2026-07-20] [--json salida.json]
// Sin --prod lee la base local (DATABASE_URL); con --prod, PROD_DATABASE_URL.
// Pedir OK antes de --prod.
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const valor = (flag, porDefecto) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : porDefecto;
};
const usarProd = args.includes('--prod');
const DESDE = valor('--desde', '2026-07-20');
const JSON_OUT = valor('--json', null);

const url = usarProd ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(`Falta ${usarProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el entorno (--env-file).`);
  process.exit(1);
}
// src/lib/db.ts reusa `globalThis.prisma`: el service lee de la base elegida acá.
globalThis.prisma = new PrismaClient({ datasourceUrl: url });

const { AttributionService } = await import('../../src/services/attribution.service.ts');
const { CONTACT_SOURCES, SIN_ORIGEN } = await import('../../src/lib/contact-source.ts');
const { formatearPrecio } = await import('../../src/lib/format-precio.ts');

/** Medianoche de Argentina (-03:00 fijo, sin horario de verano). */
const diaAR = (iso) => new Date(`${iso}T00:00:00-03:00`);
const isoAR = (d) => d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ahora = new Date();

// Maps: prendida hasta el 15/9 23:55; Google entero frenado por pago del 8 al 15/9.
const MAPS_PAUSADA = diaAR('2026-09-16');
const GOOGLE_FRENADO = [diaAR('2026-09-08'), diaAR('2026-09-16')];
const estadoMaps = (desde, hasta) => {
  if (desde >= MAPS_PAUSADA) return 'Maps PAUSADA';
  if (desde >= GOOGLE_FRENADO[0] && hasta <= GOOGLE_FRENADO[1]) return 'Google frenado (pago)';
  if (hasta > MAPS_PAUSADA) return 'Maps pausada desde el 16';
  if (hasta > GOOGLE_FRENADO[0] && desde < GOOGLE_FRENADO[1]) return 'Google frenado desde el 8';
  return 'Maps prendida';
};

/**
 * Un origen escrito a mano en una ficha vieja ("REFERIDA MATI", "Carrito Web",
 * "Sistema Anterior"…) no es un canal del vocabulario y no tiene etiqueta: se
 * junta en una sola columna para que el reporte siga siendo por etiqueta. El
 * detalle de esos textos sale aparte al final.
 */
const TEXTO_LIBRE = 'Texto libre (sin etiqueta)';
const textosLibres = new Map();

async function periodo(etiqueta, desde, hasta, extra = {}) {
  const { canales } = await AttributionService.porCanal(desde, hasta);
  const porCanal = {};
  for (const c of canales) {
    if (c.esSubfila) continue;
    const clave = c.esCanonico || c.canal === SIN_ORIGEN ? c.canal : TEXTO_LIBRE;
    const acc = (porCanal[clave] ??= { nuevos: 0, ventas: 0, cobrado: 0 });
    acc.nuevos += c.clientesNuevos;
    acc.ventas += c.ventasCobradas;
    acc.cobrado += Math.round(c.cobrado);
    if (clave === TEXTO_LIBRE && extra.contarTextoLibre) {
      const t = (textosLibres.get(c.canal) ?? { nuevos: 0, ventas: 0, cobrado: 0 });
      t.nuevos += c.clientesNuevos;
      t.ventas += c.ventasCobradas;
      t.cobrado += Math.round(c.cobrado);
      textosLibres.set(c.canal, t);
    }
  }
  delete extra.contarTextoLibre;
  return { etiqueta, desde: isoAR(desde), hasta: isoAR(new Date(hasta.getTime() - 1)), parcial: hasta > ahora, porCanal, ...extra };
}

// ── Semanas (lunes a domingo) ───────────────────────────────────────────────
const semanas = [];
for (let d = diaAR(DESDE); d < ahora; d = new Date(d.getTime() + 7 * 864e5)) {
  const hasta = new Date(d.getTime() + 7 * 864e5);
  semanas.push(await periodo(`sem ${ddmm(isoAR(d))}`, d, hasta, { maps: estadoMaps(d, hasta) }));
}

// ── Meses con movimiento ────────────────────────────────────────────────────
// Se le pregunta a la base QUÉ meses tienen fichas o pagos, y se consulta solo
// esos. El 28/9/2026 un pago con fecha 07/2008 (un 2026 mal tipeado) hacía
// arrancar el reporte 18 años antes: cientos de meses vacíos y ~440 consultas
// a producción para nada. Un mes con datos y sin otro mes con datos a ±2 se
// marca: casi seguro es una fecha mal cargada, no actividad real.
const filasMeses = await globalThis.prisma.$queryRaw`
  SELECT DISTINCT to_char(f AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') AS mes
  FROM (
    SELECT "createdAt" AS f FROM "Client" WHERE "isDeleted" = false
    UNION ALL
    SELECT "date" AS f FROM "Payment"
  ) t
  ORDER BY 1`;
const numeroDeMes = (ym) => { const [yy, mm] = ym.split('-').map(Number); return yy * 12 + mm; };
const activos = filasMeses.map((r) => r.mes).filter((ym) => diaAR(`${ym}-01`) < ahora);
const meses = [];
for (const ym of activos) {
  const [yy, mm] = ym.split('-').map(Number);
  const [y2, m2] = mm === 12 ? [yy + 1, 1] : [yy, mm + 1];
  const f = await periodo(`${String(mm).padStart(2, '0')}/${yy}`, diaAR(`${ym}-01`), diaAR(`${y2}-${String(m2).padStart(2, '0')}-01`), { contarTextoLibre: true });
  const aislado = !activos.some((otro) => otro !== ym && Math.abs(numeroDeMes(otro) - numeroDeMes(ym)) <= 2);
  meses.push(aislado ? { ...f, etiqueta: `${f.etiqueta} (fecha sospechosa)`, sospechosa: true } : f);
}

await globalThis.prisma.$disconnect();

// ── Salida ──────────────────────────────────────────────────────────────────
const ORDEN = [...CONTACT_SOURCES.filter((c) => c !== 'Google Maps'), SIN_ORIGEN];
const canalesPresentes = (filas) => {
  const vistos = new Set(filas.flatMap((f) => Object.keys(f.porCanal)));
  const ordenados = ORDEN.filter((c) => vistos.has(c));
  return ['Google Maps', ...ordenados.filter((c) => c !== 'Google Maps'), ...[...vistos].filter((c) => !ORDEN.includes(c) && c !== 'Google Maps').sort()];
};
const celda = (f, canal, campo) => f.porCanal[canal]?.[campo] ?? 0;
const total = (f, campo) => Object.values(f.porCanal).reduce((s, x) => s + x[campo], 0);

function tabla(titulo, filas, campo, fmt = String, conMaps = false) {
  const canales = canalesPresentes(filas);
  console.log(`\n${titulo}`);
  console.log(['período', ...canales, 'TOTAL', ...(conMaps ? ['Maps'] : [])].join(' | '));
  for (const f of filas) {
    console.log([
      f.etiqueta + (f.parcial ? '*' : ''),
      ...canales.map((c) => fmt(celda(f, c, campo))),
      fmt(total(f, campo)),
      ...(conMaps ? [f.maps] : []),
    ].join(' | '));
  }
}

console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} · semanas desde ${ddmm(DESDE)} · (*) período en curso`);

console.log('\nEXPERIMENTO MAPS — clientes nuevos Calle + Google Maps por semana');
console.log('semana | Calle | Google Maps | juntos | ventas cobradas (Calle+Maps) | Maps');
for (const f of semanas) {
  const calle = celda(f, 'Calle', 'nuevos');
  const maps = celda(f, 'Google Maps', 'nuevos');
  const ventas = celda(f, 'Calle', 'ventas') + celda(f, 'Google Maps', 'ventas');
  console.log(`${f.etiqueta}${f.parcial ? '*' : ''} | ${calle} | ${maps} | ${calle + maps} | ${ventas} | ${f.maps}`);
}

tabla('CLIENTES NUEVOS por semana y origen', semanas, 'nuevos', String, true);
tabla('VENTAS COBRADAS por semana y origen (órdenes con pago en la semana)', semanas, 'ventas', String, true);
tabla('COBRADO por semana y origen', semanas, 'cobrado', formatearPrecio, true);
tabla('CLIENTES NUEVOS por mes y origen', meses, 'nuevos');
tabla('VENTAS COBRADAS por mes y origen', meses, 'ventas');
tabla('COBRADO por mes y origen', meses, 'cobrado', formatearPrecio);

const libres = [...textosLibres.entries()].sort((a, b) => b[1].nuevos + b[1].ventas - (a[1].nuevos + a[1].ventas));
if (libres.length) {
  console.log(`\n${TEXTO_LIBRE}: ${libres.length} textos distintos (todo el período)`);
  for (const [texto, v] of libres) console.log(`  ${texto} | nuevos ${v.nuevos} | ventas ${v.ventas} | ${formatearPrecio(v.cobrado)}`);
}

if (JSON_OUT) {
  const detalleLibre = Object.fromEntries(libres);
  writeFileSync(JSON_OUT, JSON.stringify({ base: usarProd ? 'produccion' : 'local', generado: ahora.toISOString(), semanas, meses, textoLibre: detalleLibre }, null, 2));
  console.log(`\nJSON: ${JSON_OUT}`);
}
