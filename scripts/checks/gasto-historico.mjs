/**
 * Gasto publicitario mes a mes — SOLO LECTURA.
 *
 * Para qué: el techo de inversión acordado con la dueña es "el promedio de lo
 * que venimos invirtiendo en total". Ese número no se estima: se mide. Este
 * chequeo trae el gasto mensual de las TRES cuentas (Meta ARS, Meta USD y
 * Google Ads) y calcula el promedio de los meses CERRADOS — el mes en curso se
 * muestra aparte porque está incompleto y bajaría el promedio sin motivo.
 *
 * Las cuentas se informan en su moneda nativa, sin convertir: el costo efectivo
 * del dólar depende de la situación impositiva y una tasa inventada acá haría
 * que el techo esté mal. Si hace falta un total único, la conversión la decide
 * quien conoce ese costo.
 *
 * Va por `scripts/ads/lib/*_client.js` como exige `scripts/ads/CLAUDE.md` y
 * corre las consultas de a una (la regla prohíbe paralelismo entre scripts de
 * ads). No escribe nada y no imprime credenciales.
 *
 * Uso:  node --env-file=.env scripts/checks/gasto-historico.mjs [--meses 6]
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { get } = require('../ads/lib/meta_client');
const { search } = require('../ads/lib/google_client');

const CUENTAS_META = [
  ['Meta ARS', 'act_901723834933651', 'ARS'],
  ['Meta USD', 'act_2107444353167176', 'USD'],
];

function arg(nombre, def) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const MESES = Math.max(2, Math.min(24, Number(arg('meses', 6))));

/** 'YYYY-MM-DD' del primer día del mes, `atras` meses hacia atrás. */
function primerDia(atras) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - atras);
  return d.toISOString().slice(0, 10);
}
const HOY = new Date().toISOString().slice(0, 10);
const DESDE = primerDia(MESES - 1);
const MES_ACTUAL = HOY.slice(0, 7);

const fmt = (n, moneda) =>
  moneda === 'USD'
    ? `US$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
    : `$${Math.round(n).toLocaleString('es-AR')}`;

/** Imprime la serie mensual y devuelve el promedio de los meses cerrados. */
function informar(titulo, porMes, moneda) {
  console.log(`\n▸ ${titulo}`);
  const meses = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (!meses.length) {
    console.log('   (sin gasto en el período)');
    return 0;
  }
  const cerrados = meses.filter(([m]) => m !== MES_ACTUAL);
  for (const [mes, monto] of meses) {
    const parcial = mes === MES_ACTUAL ? '  ← mes en curso, parcial' : '';
    console.log(`   ${mes}  ${fmt(monto, moneda).padStart(14)}${parcial}`);
  }
  if (!cerrados.length) {
    console.log('   (todavía no hay un mes cerrado para promediar)');
    return 0;
  }
  const promedio = cerrados.reduce((a, [, v]) => a + v, 0) / cerrados.length;
  console.log(`   ${'promedio'.padEnd(7)} ${fmt(promedio, moneda).padStart(14)}  (${cerrados.length} meses cerrados)`);
  return promedio;
}

console.log(`Gasto publicitario · desde ${DESDE} hasta ${HOY}`);

const promedios = [];

// ── Meta: una cuenta por vez, nunca en paralelo ──
for (const [nombre, cuenta, moneda] of CUENTAS_META) {
  const porMes = new Map();
  try {
    const r = await get(`${cuenta}/insights`, {
      fields: 'spend',
      time_increment: 'monthly',
      time_range: JSON.stringify({ since: DESDE, until: HOY }),
      level: 'account',
    });
    for (const fila of r.data ?? []) {
      const mes = String(fila.date_start).slice(0, 7);
      porMes.set(mes, (porMes.get(mes) ?? 0) + Number(fila.spend || 0));
    }
  } catch (err) {
    console.log(`\n▸ ${nombre}: no se pudo leer — ${err instanceof Error ? err.message : err}`);
    continue;
  }
  promedios.push([nombre, informar(`${nombre} (${cuenta})`, porMes, moneda), moneda]);
}

// ── Google Ads ──
{
  const porMes = new Map();
  try {
    const filas = await search(`
      SELECT segments.month, metrics.cost_micros
      FROM campaign
      WHERE segments.date BETWEEN '${DESDE}' AND '${HOY}'
    `);
    for (const f of filas) {
      const mes = String(f.segments?.month ?? '').slice(0, 7);
      if (!mes) continue;
      porMes.set(mes, (porMes.get(mes) ?? 0) + Number(f.metrics?.costMicros ?? 0) / 1_000_000);
    }
  } catch (err) {
    console.log(`\n▸ Google Ads: no se pudo leer — ${err instanceof Error ? err.message : err}`);
  }
  if (porMes.size) promedios.push(['Google Ads', informar('Google Ads (ARS)', porMes, 'ARS'), 'ARS']);
}

// ── Resumen: el techo ──
console.log('\n' + '─'.repeat(58));
console.log('TECHO = promedio mensual de los meses cerrados, por cuenta:');
for (const [nombre, promedio, moneda] of promedios) {
  console.log(`   ${nombre.padEnd(12)} ${fmt(promedio, moneda).padStart(14)} / mes`);
}
const totalArs = promedios.filter(([, , m]) => m === 'ARS').reduce((a, [, v]) => a + v, 0);
const totalUsd = promedios.filter(([, , m]) => m === 'USD').reduce((a, [, v]) => a + v, 0);
console.log(`\n   Total en ARS: ${fmt(totalArs, 'ARS')} / mes`);
if (totalUsd) console.log(`   Total en USD: ${fmt(totalUsd, 'USD')} / mes  (sin convertir a propósito)`);
