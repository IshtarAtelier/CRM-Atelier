/**
 * EL CORTE: prende la API oficial en producción, de una sola corrida.
 *
 *   node scripts/maintenance/whatsapp-api-oficial/prender-api-oficial.mjs
 *
 * Hace, en orden:
 *   1. Sube al servicio "Pagina Web" de Railway (el wa-service) las variables
 *      de la Cloud API leídas del .env local + WA_TRANSPORT=cloud.
 *   2. Espera a que el redeploy levante y /health diga transport:cloud.
 *   3. Da de alta el webhook en Meta (POST /{app}/subscriptions con el token
 *      app_id|app_secret) apuntando a /webhook/whatsapp del servicio.
 *   4. Suscribe la app a la WABA (idempotente) y verifica todo.
 *
 * VOLVER ATRÁS: `railway variables --service "Pagina Web" --set WA_TRANSPORT=webjs`
 * y redeploy — el sistema vuelve al transporte viejo tal cual estaba.
 *
 * No imprime ningún secreto.
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';

const APP_ID = process.env.WA_CLOUD_APP_ID || '1036999705858814';
const SECRET = process.env.META_APP_SECRET || '';
const TOKEN = process.env.WA_CLOUD_TOKEN || '';
const WABA = process.env.WA_CLOUD_WABA_ID || '';
const VERIFY = process.env.WA_CLOUD_VERIFY_TOKEN || '';
const PHONE_ID = process.env.WA_CLOUD_PHONE_NUMBER_ID || '';
const SERVICE = 'Pagina Web';
const PUBLIC_URL = 'https://magnificent-courage-production-83d7.up.railway.app';
const V = process.env.WA_CLOUD_API_VERSION || 'v21.0';

for (const [k, v] of Object.entries({ META_APP_SECRET: SECRET, WA_CLOUD_TOKEN: TOKEN, WA_CLOUD_WABA_ID: WABA, WA_CLOUD_VERIFY_TOKEN: VERIFY, WA_CLOUD_PHONE_NUMBER_ID: PHONE_ID })) {
    if (!v) { console.error(`Falta ${k} en el .env.`); process.exit(1); }
}

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

// ── 1. Variables en Railway (dispara el redeploy) ────────────────────────────
console.log('1/4 Subiendo variables a Railway…');
execFileSync('railway', ['variables', '--service', SERVICE,
    '--set', 'WA_TRANSPORT=cloud',
    '--set', `WA_CLOUD_TOKEN=${TOKEN}`,
    '--set', `WA_CLOUD_PHONE_NUMBER_ID=${PHONE_ID}`,
    '--set', `WA_CLOUD_WABA_ID=${WABA}`,
    '--set', `WA_CLOUD_VERIFY_TOKEN=${VERIFY}`,
    '--set', `META_APP_SECRET=${SECRET}`,
], { stdio: ['ignore', 'ignore', 'inherit'] });
console.log('   ✔ variables cargadas (el servicio redeploya solo)');

// ── 2. Esperar el deploy ─────────────────────────────────────────────────────
console.log('2/4 Esperando a que el servicio levante con la API oficial (hasta 5 min)…');
let ok = false;
for (let i = 0; i < 60; i++) {
    await dormir(5000);
    try {
        const h = await (await fetch(`${PUBLIC_URL}/health`, { signal: AbortSignal.timeout(8000) })).json();
        if (h.transport === 'cloud') { console.log(`   ✔ arriba: whatsapp=${h.whatsapp} phone=${h.phone || '?'}`); ok = true; break; }
        if (i % 6 === 5) console.log(`   … sigue en transporte viejo (deploy en curso)`);
    } catch { if (i % 6 === 5) console.log('   … reiniciando'); }
}
if (!ok) { console.error('✖ El servicio no levantó con transport:cloud en 5 min. Mirar logs: railway logs --service "Pagina Web"'); process.exit(1); }

// ── 3. Webhook en Meta ───────────────────────────────────────────────────────
console.log('3/4 Dando de alta el webhook en Meta…');
const appToken = `${APP_ID}|${SECRET}`;
const params = new URLSearchParams({
    object: 'whatsapp_business_account',
    callback_url: `${PUBLIC_URL}/webhook/whatsapp`,
    verify_token: VERIFY,
    fields: 'messages',
    access_token: appToken,
});
const sub = await fetch(`https://graph.facebook.com/${V}/${APP_ID}/subscriptions?${params}`, { method: 'POST' });
const subJson = await sub.json();
if (!sub.ok || !subJson.success) { console.error('✖ Webhook rechazado:', JSON.stringify(subJson.error || subJson).slice(0, 300)); process.exit(1); }
console.log('   ✔ webhook verificado y suscrito (campo messages)');

// ── 4. App ↔ WABA y verificación final ───────────────────────────────────────
console.log('4/4 Verificación final…');
await fetch(`https://graph.facebook.com/${V}/${WABA}/subscribed_apps?access_token=${TOKEN}`, { method: 'POST' }).catch(() => {});
const st = await (await fetch(`https://graph.facebook.com/${V}/${PHONE_ID}?fields=platform_type,status&access_token=${TOKEN}`)).json();
console.log(`   número: ${st.platform_type} · ${st.status}`);
console.log('\n✅ API OFICIAL PRENDIDA. Probar: mandar un WhatsApp al número de la tienda y mirar el buzón del CRM.');
