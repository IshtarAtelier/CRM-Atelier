/**
 * Qué campañas, conjuntos y anuncios hay en la cuenta publicitaria.
 *
 *   node scripts/checks/ver-campanias-meta.mjs
 *
 * SOLO LEE. No crea, no pausa y no modifica nada: es de scripts/checks/.
 *
 * Existe para poder diseñar las placas de campaña sabiendo qué se está
 * pautando de verdad, en vez de inventar anuncios que no existen. Los tamaños
 * que hacen falta salen de dónde se muestra cada conjunto.
 *
 * Usa META_ADS_TOKEN, que es el de Ads — NO el de publicación. Son distintos y
 * confundirlos es el error más caro posible acá.
 *
 * Nunca imprime el token ni parte de él.
 */
import 'dotenv/config';

const API = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.META_ADS_TOKEN || process.env.META_ACCESS_TOKEN;
const CUENTA = process.env.META_AD_ACCOUNT_ID;

if (!TOKEN || !CUENTA) {
    console.error('Faltan META_ADS_TOKEN y/o META_AD_ACCOUNT_ID en el .env');
    process.exit(1);
}

// META_AD_ACCOUNT_ID puede traer VARIAS cuentas separadas por coma — así está
// hoy en el .env. Pasarlo entero a la API da "Object with ID ... does not
// exist", que no sugiere para nada cuál es el problema real.
const cuentas = CUENTA.split(',')
    .map(c => c.trim())
    .filter(Boolean)
    .map(c => (c.startsWith('act_') ? c : `act_${c}`));

async function api(ruta, params = {}) {
    const qs = new URLSearchParams({ ...params, access_token: TOKEN });
    const res = await fetch(`${API}${ruta}?${qs}`, { signal: AbortSignal.timeout(30000) });
    const json = await res.json().catch(() => ({}));
    if (json.error) throw new Error(String(json.error.message || 'error').slice(0, 200));
    return json;
}

for (const actId of cuentas) {
    try {
        const cuenta = await api(`/${actId}`, { fields: 'name,account_status' }).catch(() => null);
        console.log(`\n═══ ${actId}${cuenta?.name ? ` · ${cuenta.name}` : ''} ═══\n`);

        const camps = await api(`/${actId}/campaigns`, {
            fields: 'name,status,objective,effective_status',
            limit: '50',
        });

        const lista = camps.data || [];
        if (!lista.length) {
            console.log('  (sin campañas)');
            continue;
        }

        console.log(`  ${lista.length} campaña(s):\n`);
        for (const c of lista) {
            const activa = c.effective_status === 'ACTIVE';
            console.log(`  ${activa ? '🟢' : '⚪'} ${c.name}`);
            console.log(`     objetivo: ${c.objective || '—'} · estado: ${c.effective_status}`);

            const sets = await api(`/${c.id}/adsets`, {
                fields: 'name,effective_status',
                limit: '25',
            }).catch(() => ({ data: [] }));

            for (const s of sets.data || []) {
                console.log(`       └ ${s.effective_status === 'ACTIVE' ? '🟢' : '⚪'} ${s.name}`);
            }
            console.log('');
        }
    } catch (e) {
        console.error(`  ❌ ${actId}: ${e.message}`);
        process.exitCode = 1;
    }
}
