#!/usr/bin/env node
/**
 * Reporte de campañas de Meta Ads (solo lectura).
 *
 * Requiere env vars (ver scripts/ads/CLAUDE.md):
 *   META_ADS_TOKEN       token de lectura (ads_read)
 *   META_AD_ACCOUNT_ID   cuenta publicitaria (act_XXXXXXXXX)
 *   META_APP_SECRET      opcional, habilita appsecret_proof
 *
 * Uso:
 *   node scripts/ads/meta_report.js                 → últimos 7 días
 *   node scripts/ads/meta_report.js --days 30       → últimos 30 días
 *   node scripts/ads/meta_report.js --level adset   → por conjunto (default: campaign)
 *   node scripts/ads/meta_report.js --json          → salida JSON cruda (para pipes)
 */

const { getAllPages, accountId, MetaApiError } = require('./lib/meta_client');

const VALID_LEVELS = ['campaign', 'adset', 'ad'];
// La Insights API rechaza fields de granularidad más fina que `level`
// (p.ej. adset_name con level=campaign da error #100) — armar por nivel.
const FIELDS_BY_LEVEL = {
  campaign: 'campaign_name,spend,impressions,reach,frequency,clicks,ctr,cpc,actions,cost_per_action_type',
  adset: 'campaign_name,adset_name,spend,impressions,reach,frequency,clicks,ctr,cpc,actions,cost_per_action_type',
  ad: 'campaign_name,adset_name,ad_name,spend,impressions,reach,frequency,clicks,ctr,cpc,actions,cost_per_action_type',
};

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

/** Fecha AAAA-MM-DD en America/Argentina/Buenos_Aires (Meta interpreta time_range en la TZ de la cuenta). */
function arDate(msAgo = 0) {
  return new Date(Date.now() - msAgo).toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

function action(row, type) {
  return row.actions?.find((a) => a.action_type === type)?.value;
}

function usage(msg) {
  console.error(msg);
  console.error('Uso: node scripts/ads/meta_report.js [--days N] [--level campaign|adset|ad] [--json]');
  process.exit(1);
}

async function main() {
  const daysArg = arg('days', '7');
  const days = Number(daysArg);
  if (!Number.isFinite(days) || days <= 0) usage(`--days debe ser un número positivo (recibido: "${daysArg}").`);

  const level = arg('level', 'campaign');
  if (!VALID_LEVELS.includes(level)) usage(`--level debe ser uno de: ${VALID_LEVELS.join(', ')} (recibido: "${level}").`);

  const asJson = process.argv.includes('--json');
  const acct = accountId();

  const params = {
    level,
    fields: FIELDS_BY_LEVEL[level],
    limit: '100',
  };
  if (days === 7) params.date_preset = 'last_7d';
  else if (days === 30) params.date_preset = 'last_30d';
  else {
    params.time_range = JSON.stringify({ since: arDate(days * 864e5), until: arDate(0) });
  }

  const rows = await getAllPages(`${acct}/insights`, params);

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  console.log(`\n=== Meta Ads · ${level} · últimos ${days} días ===\n`);
  if (!rows.length) {
    console.log('Sin actividad en el período (¿campañas pausadas o cuenta sin gasto?).');
    return;
  }

  for (const row of rows) {
    const buys = action(row, 'purchase');
    const leads = action(row, 'lead');
    const msgs = row.actions?.find((a) => a.action_type.includes('messaging_conversation_started'))?.value;
    const cpa = row.cost_per_action_type?.find((a) => a.action_type === 'purchase')?.value;

    const label = [row.campaign_name, row.adset_name, row.ad_name].filter(Boolean).join(' › ');
    console.log(`▸ ${label}`);
    console.log(
      `  Gasto $${fmt(row.spend)} · ${fmt(row.impressions)} impresiones · frec ${Number(row.frequency || 0).toFixed(1)} · ${fmt(row.clicks)} clicks (CTR ${Number(row.ctr || 0).toFixed(2)}%)`,
    );
    const results = [
      buys ? `${buys} compras${cpa ? ` (CPA $${fmt(cpa)})` : ''}` : null,
      msgs ? `${msgs} conversaciones WA` : null,
      leads ? `${leads} leads` : null,
    ].filter(Boolean);
    console.log(`  Resultados: ${results.length ? results.join(' · ') : 'sin conversiones registradas'}\n`);
  }
}

main().catch((e) => {
  const msg = e instanceof MetaApiError ? `${e.message}\n${e.guidance}` : e.message;
  console.error(msg);
  process.exit(1);
});
