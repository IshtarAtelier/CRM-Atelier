/**
 * Da de alta en Meta las plantillas del catálogo (src/lib/whatsapp/templates.ts)
 * que todavía no existen. Pega al wa-service (POST /api/templates), que es el
 * único que habla con Graph. Sin --apply solo muestra qué mandaría.
 *
 *   npx tsx scripts/maintenance/whatsapp-api-oficial/crear-plantillas.ts [--solo nombre] [--apply]
 *
 * Las plantillas con encabezado DOCUMENT/IMAGE necesitan un archivo de ejemplo
 * subido a Meta (header_handle). Eso se hace UNA vez a mano desde el WhatsApp
 * Manager (Crear plantilla → subir muestra) o con la Resumable Upload API; acá
 * se deja el placeholder y el script las saltea con aviso.
 */
import 'dotenv/config';
import { WHATSAPP_TEMPLATES, TEMPLATE_LANGUAGE, toMetaComponents } from '../../../src/lib/whatsapp/templates';

const WA = process.env.WA_SERVER_URL || 'http://127.0.0.1:3100';
const KEY = process.env.BOT_API_KEY || process.env.WA_API_KEY || '';
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const soloIdx = args.indexOf('--solo');
const solo = soloIdx >= 0 ? args[soloIdx + 1] : null;

async function wa(path: string, init: RequestInit = {}) {
    const res = await fetch(`${WA}${path}`, { ...init, headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, ...(init.headers || {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
    return json;
}

async function main() {
    const existentes: { name: string; language: string; status: string }[] = await wa('/api/templates/sync', { method: 'POST' }).catch(e => {
        console.error('No se pudo sincronizar con Meta:', e.message);
        console.error('¿El wa-service corre con WA_TRANSPORT=cloud y WA_CLOUD_WABA_ID?');
        process.exit(1);
    });
    const ya = new Set(existentes.map(t => `${t.name}|${t.language}`));

    for (const def of Object.values(WHATSAPP_TEMPLATES)) {
        if (solo && def.name !== solo) continue;
        const key = `${def.name}|${TEMPLATE_LANGUAGE}`;
        if (ya.has(key)) { console.log(`= ${def.name}: ya existe en Meta (${existentes.find(t => t.name === def.name)?.status})`); continue; }
        if (def.header) {
            console.log(`! ${def.name}: lleva encabezado ${def.header} → crearla desde el WhatsApp Manager subiendo un ${def.header === 'DOCUMENT' ? 'PDF' : 'imagen'} de muestra. Texto del cuerpo:\n   ${def.body}`);
            continue;
        }
        const payload = { name: def.name, language: TEMPLATE_LANGUAGE, category: def.category, components: toMetaComponents(def) };
        if (!apply) { console.log(`+ ${def.name} (dry-run):`, JSON.stringify(payload, null, 2)); continue; }
        try {
            const r = await wa('/api/templates', { method: 'POST', body: JSON.stringify(payload) });
            console.log(`✔ ${def.name} enviada a aprobar:`, r?.meta?.status || r);
            // Meta mira ráfagas: una pausa entre altas.
            await new Promise(r => setTimeout(r, 4000));
        } catch (e: any) {
            console.error(`✖ ${def.name}:`, e.message);
        }
    }
}
main();
