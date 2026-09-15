/**
 * Auditoría de fondo de la cuenta de Google Ads: no cuánto se gastó, sino si
 * el gasto puede rendir. SOLO LECTURA (no toca la cuenta, no imprime secretos).
 *
 * Mira lo que ningún reporte de gasto muestra:
 *  1. Qué cuenta Google como "conversión" y cuáles son PRINCIPALES (las que la
 *     puja automática persigue). Acá apareció el hallazgo del 14/9/2026: de
 *     1.589 conversiones en 90 días, 790 eran "cómo llegar" en Maps y 574
 *     clics en el botón de llamar. WhatsApp —lo único parecido a un lead— eran
 *     48. Ventas: cero.
 *  2. Si las compras reales se están subiendo al canal offline. Estaban en cero.
 *  3. Con qué estrategia puja cada campaña: MAXIMIZE_CONVERSIONS persiguiendo
 *     esas conversiones es comprar la indicación de Maps más barata que haya.
 *  4. Concordancia de las palabras clave: dónde se va la plata de verdad.
 *  5. A qué ubicaciones se muestra.
 *
 * Uso:  node scripts/checks/google-ads-auditoria.mjs [--dias 90]
 */
import { readFileSync } from 'node:fs';

const iDias = process.argv.indexOf('--dias');
const DIAS = iDias !== -1 ? Number(process.argv[iDias + 1]) : 90;

const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n').filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const cid = (env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
if (!cid || !env.GOOGLE_ADS_REFRESH_TOKEN) { console.error('Faltan credenciales GOOGLE_ADS_* en .env'); process.exit(1); }

const tok = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
        client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
        refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
}).then((r) => r.json());
if (!tok.access_token) { console.error('No se pudo renovar el token de Google.'); process.exit(1); }

const H = { Authorization: `Bearer ${tok.access_token}`, 'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN, 'Content-Type': 'application/json' };
if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) H['login-customer-id'] = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');

const q = async (query) => {
    const r = await fetch(`https://googleads.googleapis.com/v24/customers/${cid}/googleAds:search`, {
        method: 'POST', headers: H, body: JSON.stringify({ query }),
    });
    if (!r.ok) {
        const t = await r.text();
        let msg = t.slice(0, 200);
        try { msg = JSON.parse(t).error?.details?.[0]?.errors?.[0]?.message || msg; } catch { /* el crudo sirve */ }
        console.error('  ⚠️ ' + msg);
        return [];
    }
    return (await r.json()).results || [];
};

const plata = (n) => '$' + Math.round(n || 0).toLocaleString('es-AR');
const HOY = new Date().toISOString().slice(0, 10);
const DESDE = new Date(Date.now() - DIAS * 864e5).toISOString().slice(0, 10);
console.log(`Cuenta ${cid} · ventana ${DESDE} → ${HOY}\n`);

// ── 1. Qué se cuenta como conversión ────────────────────────────────────────
console.log('═══ 1. QUÉ CUENTA GOOGLE COMO "CONVERSIÓN" ═══');
const acciones = await q(`SELECT conversion_action.name, conversion_action.type, conversion_action.category,
  conversion_action.primary_for_goal FROM conversion_action WHERE conversion_action.status != 'REMOVED'`);
const principales = acciones.filter((r) => r.conversionAction.primaryForGoal !== false);
const secundarias = acciones.filter((r) => r.conversionAction.primaryForGoal === false);
console.log(`PRINCIPALES (${principales.length}) — son las que la puja automática persigue:`);
for (const r of principales) console.log(`   · ${r.conversionAction.name}  [${r.conversionAction.category}]`);
console.log(`\nSECUNDARIAS (${secundarias.length}) — NO cuentan para optimizar:`);
for (const r of secundarias) console.log(`   · ${r.conversionAction.name}  [${r.conversionAction.category}]`);

// ── 2. De dónde salen las conversiones que se reportan ──────────────────────
console.log('\n═══ 2. DE DÓNDE SALEN LAS CONVERSIONES ═══');
const cv = await q(`SELECT segments.conversion_action_name, metrics.conversions
  FROM campaign WHERE segments.date BETWEEN '${DESDE}' AND '${HOY}' AND metrics.conversions > 0`);
const porAccion = new Map();
for (const r of cv) {
    const n = r.segments?.conversionActionName || '(sin acción)';
    porAccion.set(n, (porAccion.get(n) || 0) + Number(r.metrics?.conversions || 0));
}
const total = [...porAccion.values()].reduce((s, c) => s + c, 0);
[...porAccion.entries()].sort((a, b) => b[1] - a[1]).forEach(([n, c]) =>
    console.log(`  ${c.toFixed(1).padStart(9)}  ${(Math.round((c / total) * 100) + '%').padStart(5)}  ${n}`));
console.log(`  ${total.toFixed(1).padStart(9)}         TOTAL`);

// ── 3. ¿Llegan las ventas del CRM? ─────────────────────────────────────────
console.log('\n═══ 3. VENTAS REALES SUBIDAS DESDE EL CRM ═══');
const off = await q(`SELECT conversion_action.name, conversion_action.status, conversion_action.primary_for_goal,
  metrics.all_conversions FROM conversion_action WHERE conversion_action.type IN ('UPLOAD_CLICKS','UPLOAD_CALLS')`);
if (!off.length) console.log('  No hay ninguna acción de conversión por subida.');
for (const r of off) {
    const c = r.conversionAction;
    console.log(`  ${String(c.name).padEnd(34)} ${c.status.padEnd(9)} ${c.primaryForGoal === false ? 'SECUNDARIA' : 'principal '}  registradas: ${Number(r.metrics?.allConversions || 0).toFixed(0)}`);
}

// ── 4. Con qué puja cada campaña ───────────────────────────────────────────
console.log('\n═══ 4. PUJA Y PRESUPUESTO (campañas activas) ═══');
for (const r of await q(`SELECT campaign.name, campaign.advertising_channel_type, campaign.bidding_strategy_type,
  campaign_budget.amount_micros FROM campaign WHERE campaign.status = 'ENABLED'`)) {
    console.log(`  ${String(r.campaign.name).padEnd(24)} ${String(r.campaign.advertisingChannelType).padEnd(9)} ${String(r.campaign.biddingStrategyType).padEnd(22)} ${plata(Number(r.campaignBudget?.amountMicros || 0) / 1e6)}/día`);
}

// ── 5. Dónde se va la plata por concordancia ───────────────────────────────
console.log('\n═══ 5. CONCORDANCIA DE LAS PALABRAS CLAVE ═══');
const mt = new Map();
for (const r of await q(`SELECT ad_group_criterion.keyword.match_type, metrics.cost_micros
  FROM keyword_view WHERE segments.date BETWEEN '${DESDE}' AND '${HOY}' AND campaign.status = 'ENABLED'`)) {
    const t = r.adGroupCriterion?.keyword?.matchType || '?';
    const a = mt.get(t) || { n: 0, c: 0 };
    a.n++; a.c += Number(r.metrics?.cost_micros ?? r.metrics?.costMicros ?? 0) / 1e6;
    mt.set(t, a);
}
[...mt.entries()].sort((a, b) => b[1].c - a[1].c).forEach(([t, a]) =>
    console.log(`  ${t.padEnd(10)} ${String(a.n).padStart(6)} filas   ${plata(a.c).padStart(12)}`));

// ── 6. Ubicaciones ─────────────────────────────────────────────────────────
console.log('\n═══ 6. UBICACIONES ═══');
const geo = await q(`SELECT campaign.name, campaign_criterion.location.geo_target_constant, campaign_criterion.negative
  FROM campaign_criterion WHERE campaign_criterion.type = 'LOCATION' AND campaign.status = 'ENABLED'`);
const ids = [...new Set(geo.map((r) => r.campaignCriterion?.location?.geoTargetConstant).filter(Boolean))];
const nombres = new Map();
if (ids.length) {
    for (const r of await q(`SELECT geo_target_constant.resource_name, geo_target_constant.canonical_name
      FROM geo_target_constant WHERE geo_target_constant.resource_name IN (${ids.map((i) => `'${i}'`).join(',')})`)) {
        nombres.set(r.geoTargetConstant.resourceName, r.geoTargetConstant.canonicalName);
    }
}
for (const r of geo) {
    const rn = r.campaignCriterion?.location?.geoTargetConstant;
    console.log(`  ${String(r.campaign.name).slice(0, 26).padEnd(27)} ${r.campaignCriterion.negative ? 'EXCLUIDA' : 'incluida'}  ${nombres.get(rn) || rn}`);
}
console.log('');
