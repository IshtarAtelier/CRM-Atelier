/**
 * Paso a paso para dejar como PRINCIPALES solo las conversiones que son un
 * cliente (WhatsApp, Conversación iniciada, compra web) y pasar a SECUNDARIAS
 * las señales de interés (cómo llegar, clics de llamar, visitas, YouTube).
 *
 * SOLO LECTURA. Lee la cuenta y arma la lista de lo que hay que cambiar EN EL
 * PANEL de Google Ads, una acción por renglón. Por qué no lo cambia solo: se
 * probó el 15/9/26 con validateOnly, acción por acción — las 10 que hay que
 * pasar a secundarias son de origen GOOGLE_HOSTED / CALL_FROM_ADS /
 * YOUTUBE_HOSTED y la API responde MUTATE_NOT_ALLOWED. Solo se editan a mano.
 *
 * ⚠️ Hacerlo REINICIA el aprendizaje de las campañas Search (pujan por
 * conversiones): la columna cae ~85% y hay 2-4 semanas de valle. Decisión de
 * Ishtar (15/9/26): recién con dos semanas de etiquetas `google:*` en el CRM
 * (`node scripts/checks/google-ads-etiquetas-quincena.mjs --prod`).
 *
 * Uso: node scripts/checks/google-ads-conversiones-checklist.mjs
 */
import { readFileSync } from 'node:fs';

const PRINCIPALES = new Set(['WhatsApp', 'Conversación iniciada', 'Atelier Optica - Web (web) purchase']);
const SECUNDARIAS = new Set(['Clicks to call', 'Local actions - Website visits', 'Local actions - Directions', 'Local actions - Other engagements', 'Indicaciones de Maps de campaña inteligente', 'Calls from Smart Campaign Ads', 'Clics de llamada de anuncios de campaña inteligente', 'Clics de llamada de Maps de campaña inteligente', 'YouTube channel subscriptions', 'YouTube follow-on views']);

const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));
const cid = (env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET, refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN, grant_type: 'refresh_token' }) }).then((r) => r.json());
if (!tok.access_token) { console.error('No se pudo renovar el token de Google Ads.'); process.exit(1); }
const H = { Authorization: `Bearer ${tok.access_token}`, 'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN, 'Content-Type': 'application/json' };
if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) H['login-customer-id'] = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');
const r = await fetch(`https://googleads.googleapis.com/v24/customers/${cid}/googleAds:search`, { method: 'POST', headers: H, body: JSON.stringify({ query: `SELECT conversion_action.name, conversion_action.primary_for_goal, conversion_action.category FROM conversion_action WHERE conversion_action.status != 'REMOVED'` }) });
if (!r.ok) { console.error('No pude leer las acciones:', (await r.text()).slice(0, 300)); process.exit(1); }
const acciones = ((await r.json()).results || []).map((x) => x.conversionAction);

const pendientes = [];
console.log('ESTADO ACTUAL');
for (const a of acciones) {
    const esPrincipal = a.primaryForGoal !== false;
    const objetivo = PRINCIPALES.has(a.name) ? true : SECUNDARIAS.has(a.name) ? false : null;
    const ok = objetivo === null || objetivo === esPrincipal;
    console.log(`  ${ok ? '✓' : '✖'} ${a.name.padEnd(52)} ${esPrincipal ? 'PRINCIPAL ' : 'secundaria'}${ok ? '' : `   → tiene que ser ${objetivo ? 'PRINCIPAL' : 'secundaria'}`}`);
    if (!ok) pendientes.push({ nombre: a.name, aPrincipal: objetivo });
}
if (!pendientes.length) { console.log('\n✅ Ya está como tiene que estar. Nada para tocar.'); process.exit(0); }
console.log(`\nPASO A PASO EN GOOGLE ADS (${pendientes.length} cambios, uno por vez)`);
console.log('  0. Abrí ads.google.com → cuenta "Atelier Optica" → Objetivos (menú izquierdo) → Conversiones → Resumen.');
console.log('     Vas a ver la tabla de acciones. La columna "Acción de conversión" tiene el nombre; a la derecha, la columna "Principal / Secundaria".');
pendientes.forEach((p, i) => {
    console.log(`  ${i + 1}. Buscá la fila "${p.nombre}". Hacé clic en su nombre → en el panel que se abre, "Editar configuración" → "Principal o secundaria" → elegí "${p.aPrincipal ? 'Acción principal' : 'Acción secundaria'}" → Guardar.`);
});
console.log('  ' + (pendientes.length + 1) + '. Volvé a correr este script: tiene que decir "Ya está como tiene que estar".');
console.log('\nOJO: desde ese momento la columna "Conversiones" de las campañas cae ~85%. No es que dejaron de funcionar: dejaron de contar humo. No toques la puja ni el presupuesto por 2-4 semanas.');
