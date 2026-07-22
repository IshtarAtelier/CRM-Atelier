#!/usr/bin/env node
/**
 * Reporte de campañas de Meta Ads (solo lectura, Marketing API oficial).
 *
 * Requiere env vars (NO hardcodear jamás):
 *   META_ADS_TOKEN       token del usuario de sistema (ads_read alcanza)
 *   META_AD_ACCOUNT_ID   id de la cuenta publicitaria, formato act_XXXXXXXXX
 *
 * Uso:
 *   node scripts/ads/meta_report.js                 → últimos 7 días
 *   node scripts/ads/meta_report.js --days 30       → últimos 30 días
 *   node scripts/ads/meta_report.js --level adset   → por conjunto (default: campaign)
 *
 * Solo hace GET a /insights y /campaigns — no puede modificar nada.
 */

const TOKEN = process.env.META_ADS_TOKEN;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const API = 'https://graph.facebook.com/v21.0';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

async function get(path, params = {}) {
  const url = new URL(`${API}/${path}`);
  url.searchParams.set('access_token', TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(`Meta API: ${json.error.message} (code ${json.error.code})`);
  return json;
}

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

async function main() {
  if (!TOKEN || !ACCOUNT) {
    console.error('Faltan META_ADS_TOKEN y/o META_AD_ACCOUNT_ID en el entorno.');
    process.exit(1);
  }
  const days = Number(arg('days', 7));
  const level = arg('level', 'campaign');

  const insights = await get(`${ACCOUNT}/insights`, {
    level,
    date_preset: days === 7 ? 'last_7d' : days === 30 ? 'last_30d' : undefined,
    time_range: [7, 30].includes(days)
      ? undefined
      : JSON.stringify({
          since: new Date(Date.now() - days * 864e5).toISOString().slice(0, 10),
          until: new Date().toISOString().slice(0, 10),
        }),
    fields:
      'campaign_name,adset_name,spend,impressions,reach,frequency,clicks,ctr,cpc,actions,cost_per_action_type',
    limit: '100',
  });

  console.log(`\n=== Meta Ads · ${level} · últimos ${days} días ===\n`);
  if (!insights.data?.length) {
    console.log('Sin actividad en el período (¿campañas pausadas o cuenta sin gasto?).');
    return;
  }

  for (const row of insights.data) {
    const buys = row.actions?.find((a) => a.action_type === 'purchase')?.value;
    const leads = row.actions?.find((a) => a.action_type === 'lead')?.value;
    const msgs = row.actions?.find((a) =>
      a.action_type.includes('messaging_conversation_started'),
    )?.value;
    const cpa = row.cost_per_action_type?.find((a) => a.action_type === 'purchase')?.value;

    console.log(`▸ ${row.campaign_name}${row.adset_name ? ` › ${row.adset_name}` : ''}`);
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
  console.error(e.message);
  process.exit(1);
});
