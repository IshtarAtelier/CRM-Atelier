/**
 * Estado de la cuenta de Google Ads: campañas, términos de búsqueda que se
 * están pagando y negativas ya cargadas. SOLO LECTURA (no toca la cuenta).
 *
 * Para qué: contestar "¿hay que negativizar más?" con datos en vez de a ojo.
 * El 14/9/26 mostró que las dos campañas de Search ACTIVAS estaban casi sin
 * negativas (Multifocales: cero; Recetados: dos, y en EXACTA, que no frenan
 * las variantes), mientras las 2.239 negativas de la cuenta viven en campañas
 * pausadas o en Google Maps.
 *
 * No imprime ninguna credencial.
 *
 * Uso:  node scripts/checks/google-ads-estado.mjs
 */
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url),'utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')), l.slice(l.indexOf('=')+1).replace(/^["']|["']$/g,'')]));
const cid = (env.GOOGLE_ADS_CUSTOMER_ID||'').replace(/-/g,'');
const tok = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body: new URLSearchParams({ client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET, refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN, grant_type:'refresh_token' }) }).then(r=>r.json());
if (!tok.access_token) { console.error('No se pudo renovar el token:', tok.error, tok.error_description); process.exit(1); }
const H = { Authorization:`Bearer ${tok.access_token}`, 'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN, 'Content-Type':'application/json' };
if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) H['login-customer-id'] = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g,'');
const q = async (query) => {
  const r = await fetch(`https://googleads.googleapis.com/v24/customers/${cid}/googleAds:search`, { method:'POST', headers:H, body: JSON.stringify({ query }) });
  if (!r.ok) { console.error('HTTP', r.status, (await r.text()).slice(0,400)); return []; }
  return (await r.json()).results || [];
};
const plata = n => '$'+Math.round(n).toLocaleString('es-AR');
const hoy = new Date().toISOString().slice(0,10);
const d14 = new Date(Date.now()-14*864e5).toISOString().slice(0,10);

console.log(`=== CAMPAÑAS (${d14} → ${hoy}) ===`);
const camp = await q(`SELECT campaign.name, campaign.status, campaign.advertising_channel_type, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${d14}' AND '${hoy}'`);
const agg = new Map();
for (const r of camp) { const k=r.campaign.name; const a=agg.get(k)||{estado:r.campaign.status, tipo:r.campaign.advertisingChannelType, c:0,cl:0,im:0,cv:0};
  a.c+=Number(r.metrics.costMicros||0)/1e6; a.cl+=Number(r.metrics.clicks||0); a.im+=Number(r.metrics.impressions||0); a.cv+=Number(r.metrics.conversions||0); agg.set(k,a); }
[...agg.entries()].sort((a,b)=>b[1].c-a[1].c).forEach(([n,a])=>console.log(`${n.slice(0,34).padEnd(35)} ${String(a.estado).padEnd(8)} ${String(a.tipo).padEnd(16)} ${plata(a.c).padStart(11)} clics:${String(a.cl).padStart(5)} conv:${a.cv.toFixed(1).padStart(6)}`));

console.log(`\n=== TÉRMINOS DE BÚSQUEDA con clics (${d14} → ${hoy}) ===`);
const st = await q(`SELECT search_term_view.search_term, campaign.name, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE segments.date BETWEEN '${d14}' AND '${hoy}' AND metrics.clicks > 0 ORDER BY metrics.cost_micros DESC LIMIT 120`);
const term = new Map();
for (const r of st) { const k=r.searchTermView.searchTerm+' | '+r.campaign.name; const a=term.get(k)||{cl:0,c:0,cv:0}; a.cl+=Number(r.metrics.clicks||0); a.c+=Number(r.metrics.costMicros||0)/1e6; a.cv+=Number(r.metrics.conversions||0); term.set(k,a); }
console.log(`(${term.size} términos con clic)`);
[...term.entries()].sort((a,b)=>b[1].c-a[1].c).forEach(([k,a])=>{ const [t,c]=k.split(' | '); console.log(`${plata(a.c).padStart(10)}  clics:${String(a.cl).padStart(3)}  conv:${a.cv.toFixed(1).padStart(5)}  ${t.slice(0,52).padEnd(53)} ${c.slice(0,22)}`); });

console.log(`\n=== NEGATIVAS YA CARGADAS ===`);
const neg = await q(`SELECT campaign.name, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion WHERE campaign_criterion.negative = TRUE AND campaign_criterion.type = 'KEYWORD'`);
console.log(`A nivel campaña: ${neg.length}`);
neg.forEach(r=>console.log(`   ${String(r.campaign.name).slice(0,26).padEnd(27)} ${r.campaignCriterion.keyword.text} [${r.campaignCriterion.keyword.matchType}]`));
const negG = await q(`SELECT ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion WHERE ad_group_criterion.negative = TRUE AND ad_group_criterion.type = 'KEYWORD'`);
console.log(`A nivel grupo: ${negG.length}`);
negG.forEach(r=>console.log(`   ${String(r.adGroup.name).slice(0,26).padEnd(27)} ${r.adGroupCriterion.keyword.text} [${r.adGroupCriterion.keyword.matchType}]`));
console.log('\n=== NEGATIVAS POR CAMPAÑA ===');
const cuenta = new Map();
for (const r of neg) cuenta.set(r.campaign.name, (cuenta.get(r.campaign.name)||0)+1);
[...cuenta.entries()].sort((a,b)=>b[1]-a[1]).forEach(([n,c])=>console.log(`  ${String(c).padStart(5)}  ${n}`));
