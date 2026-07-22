#!/usr/bin/env node
/**
 * Reporte de campañas de Google Ads (solo lectura, GAQL).
 *
 * Requiere las env vars de scripts/ads/lib/google_client.js (developer token,
 * OAuth, customer id) — ver scripts/ads/CLAUDE.md.
 *
 * Uso:
 *   node scripts/ads/google_report.js               → últimos 7 días
 *   node scripts/ads/google_report.js --days 30     → últimos 30 días
 *   node scripts/ads/google_report.js --json        → salida JSON cruda (para pipes)
 */

const { search, GoogleAdsApiError } = require('./lib/google_client');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function usage(msg) {
  console.error(msg);
  console.error('Uso: node scripts/ads/google_report.js [--days N] [--json]');
  process.exit(1);
}

/** Fecha AAAA-MM-DD en la TZ de la cuenta (Argentina). */
function arDate(msAgo = 0) {
  return new Date(Date.now() - msAgo).toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

async function main() {
  const daysArg = arg('days', '7');
  const days = Number(daysArg);
  if (!Number.isFinite(days) || days <= 0) usage(`--days debe ser un número positivo (recibido: "${daysArg}").`);
  const asJson = process.argv.includes('--json');

  // GAQL solo lectura. El rango custom va con BETWEEN en la TZ de la cuenta.
  // N días completos hasta AYER, igual que los presets LAST_N_DAYS (que también
  // excluyen hoy) — así --days 8 no cambia de semántica respecto de --days 7.
  const dateFilter =
    days === 7
      ? 'segments.date DURING LAST_7_DAYS'
      : days === 30
        ? 'segments.date DURING LAST_30_DAYS'
        : `segments.date BETWEEN '${arDate(days * 864e5)}' AND '${arDate(864e5)}'`;

  const rows = await search(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE ${dateFilter} AND metrics.impressions > 0
    ORDER BY metrics.cost_micros DESC
  `);

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  console.log(`\n=== Google Ads · campañas · últimos ${days} días ===\n`);
  if (!rows.length) {
    console.log('Sin actividad en el período (¿campañas pausadas o cuenta sin gasto?).');
    return;
  }

  for (const row of rows) {
    const c = row.campaign || {};
    const m = row.metrics || {};
    const spend = Number(m.costMicros || 0) / 1e6;
    const conversions = Number(m.conversions || 0);
    const convValue = Number(m.conversionsValue || 0);
    const cpa = conversions > 0 ? spend / conversions : null;

    console.log(`▸ ${c.name} ${c.status !== 'ENABLED' ? `(${c.status})` : ''}`);
    console.log(
      `  Gasto $${fmt(spend)} · ${fmt(m.impressions)} impresiones · ${fmt(m.clicks)} clicks (CTR ${(Number(m.ctr || 0) * 100).toFixed(2)}%)`,
    );
    console.log(
      `  Resultados: ${
        conversions > 0
          ? `${conversions.toFixed(1)} conversiones (CPA $${fmt(cpa)}) · valor $${fmt(convValue)}`
          : 'sin conversiones registradas'
      }\n`,
    );
  }
}

main().catch((e) => {
  const msg = e instanceof GoogleAdsApiError ? `${e.message}\n${e.guidance}` : e.message;
  console.error(msg);
  process.exit(1);
});
