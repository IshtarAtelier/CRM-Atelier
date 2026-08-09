/**
 * Gasto publicitario mes a mes — SOLO LECTURA.
 *
 * Para qué: fijar y revisar el techo de inversión. El promedio se calcula sobre
 * los meses COMPLETOS; el mes en curso se muestra aparte y no promedia, porque
 * si no el techo sale siempre más bajo de lo real.
 *
 * Cada cuenta se informa EN SU MONEDA. No se convierte a pesos a propósito: el
 * costo efectivo de un dólar de pauta depende de impuestos y del tipo de cambio
 * del momento, así que convertir acá inventaría un número que después nadie
 * puede auditar. El techo se fija por cuenta, en su moneda.
 *
 * Va por `scripts/ads/lib/*_client.js` como exige `scripts/ads/CLAUDE.md`
 * (prohibido fetch directo). En serie, nunca en paralelo. No imprime tokens.
 *
 * Uso:  node --env-file=.env scripts/checks/gasto-mensual-ads.mjs [--meses 6]
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { get } = require('../ads/lib/meta_client');
const { search } = require('../ads/lib/google_client');

const arg = (nombre, def) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};

const MESES = Math.min(24, Math.max(2, Number(arg('meses', 6))));

/** Primer día del mes, `MESES` meses atrás. El mes en curso queda incluido. */
function rango() {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - (MESES - 1), 1);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { desde: iso(desde), hasta: iso(hoy), mesActual: iso(hoy).slice(0, 7) };
}

const { desde, hasta, mesActual } = rango();

/** Cuentas de Meta: el .env trae las dos separadas por coma. */
const CUENTAS_META = (process.env.META_AD_ACCOUNT_ID || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const fmt = (n, moneda) =>
  moneda === 'USD'
    ? `US$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    : `$${Math.round(n).toLocaleString('es-AR')}`;

/** Promedio de los meses completos (excluye el mes en curso). */
function resumen(porMes, moneda, etiqueta) {
  const completos = [...porMes.entries()].filter(([mes]) => mes !== mesActual).sort();
  const enCurso = porMes.get(mesActual) ?? 0;

  console.log(`\n▸ ${etiqueta} (${moneda})`);
  if (!completos.length && !enCurso) {
    console.log('   sin gasto en el período');
    return null;
  }
  for (const [mes, monto] of completos) {
    console.log(`   ${mes}   ${fmt(monto, moneda).padStart(14)}`);
  }
  if (enCurso) console.log(`   ${mesActual}   ${fmt(enCurso, moneda).padStart(14)}   (mes en curso, parcial — no promedia)`);

  if (!completos.length) {
    console.log('   sin meses completos para promediar');
    return null;
  }
  const total = completos.reduce((a, [, m]) => a + m, 0);
  const promedio = total / completos.length;
  console.log(`   ${'─'.repeat(30)}`);
  console.log(`   promedio de ${completos.length} meses completos: ${fmt(promedio, moneda)}`);
  return { promedio, moneda, meses: completos.length };
}

const resultados = [];

// ── Meta, una cuenta por vez (la regla prohíbe paralelismo) ──
for (const cuenta of CUENTAS_META) {
  try {
    const info = await get(cuenta, { fields: 'name,currency' });
    const insights = await get(`${cuenta}/insights`, {
      fields: 'spend',
      time_increment: 'monthly',
      time_range: JSON.stringify({ since: desde, until: hasta }),
      level: 'account',
    });
    const porMes = new Map();
    for (const fila of insights.data ?? []) {
      const mes = String(fila.date_start).slice(0, 7);
      porMes.set(mes, (porMes.get(mes) ?? 0) + Number(fila.spend || 0));
    }
    const r = resumen(porMes, info.currency, `Meta · ${info.name}`);
    if (r) resultados.push({ ...r, etiqueta: `Meta ${info.name}` });
  } catch (err) {
    console.log(`\n▸ Meta ${cuenta}: no se pudo leer — ${err instanceof Error ? err.message : err}`);
  }
}

// ── Google Ads ──
try {
  const filas = await search(`
    SELECT segments.month, metrics.cost_micros, customer.currency_code, customer.descriptive_name
    FROM customer
    WHERE segments.date BETWEEN '${desde}' AND '${hasta}'
    ORDER BY segments.month
  `);
  const porMes = new Map();
  let moneda = 'ARS';
  let nombre = 'Google Ads';
  for (const fila of filas) {
    moneda = fila.customer?.currencyCode || moneda;
    nombre = fila.customer?.descriptiveName || nombre;
    const mes = String(fila.segments?.month || '').slice(0, 7);
    if (!mes) continue;
    porMes.set(mes, (porMes.get(mes) ?? 0) + Number(fila.metrics?.costMicros || 0) / 1_000_000);
  }
  const r = resumen(porMes, moneda, `Google Ads · ${nombre}`);
  if (r) resultados.push({ ...r, etiqueta: 'Google Ads' });
} catch (err) {
  console.log(`\n▸ Google Ads: no se pudo leer — ${err instanceof Error ? err.message : err}`);
}

// ── Techo propuesto ──
console.log(`\n${'═'.repeat(52)}`);
console.log('TECHO = promedio mensual, por cuenta y en su moneda');
console.log('═'.repeat(52));
for (const r of resultados) {
  console.log(`  ${r.etiqueta.padEnd(34)} ${fmt(r.promedio, r.moneda).padStart(14)}`);
}
console.log('\nNo se suman entre sí: son monedas distintas y el costo efectivo');
console.log('de cada una depende de impuestos y tipo de cambio.');
