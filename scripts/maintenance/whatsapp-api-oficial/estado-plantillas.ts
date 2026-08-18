/**
 * Sincroniza las plantillas con Meta y muestra el estado de cada una del
 * catálogo. Solo lee.
 *   npx tsx scripts/maintenance/whatsapp-api-oficial/estado-plantillas.ts
 */
import 'dotenv/config';
import { WHATSAPP_TEMPLATES, TEMPLATE_LANGUAGE } from '../../../src/lib/whatsapp/templates';

const WA = process.env.WA_SERVER_URL || 'http://127.0.0.1:3100';
const KEY = process.env.BOT_API_KEY || process.env.WA_API_KEY || '';

async function main() {
    const res = await fetch(`${WA}/api/templates/sync`, { method: 'POST', headers: { 'x-api-key': KEY } });
    const list: { name: string; language: string; status: string; category: string }[] = await res.json();
    if (!res.ok) { console.error('Error:', list); process.exit(1); }
    const byName = new Map(list.map(t => [`${t.name}|${t.language}`, t]));
    console.log('Plantilla'.padEnd(24), 'Inventario'.padEnd(11), 'Estado en Meta');
    for (const def of Object.values(WHATSAPP_TEMPLATES)) {
        const t = byName.get(`${def.name}|${TEMPLATE_LANGUAGE}`);
        console.log(def.name.padEnd(24), def.inventario.padEnd(11), t ? `${t.status} (${t.category})` : 'FALTA');
    }
    const extra = list.filter(t => !(t.name in WHATSAPP_TEMPLATES));
    if (extra.length) console.log('\nEn Meta pero no en el catálogo:', extra.map(t => `${t.name} [${t.status}]`).join(', '));
}
main();
