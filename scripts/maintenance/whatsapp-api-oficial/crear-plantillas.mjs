/**
 * Da de alta en Meta las plantillas del catálogo (`src/lib/whatsapp/templates.ts`)
 * que todavía no existen. Habla DIRECTO con Graph (no necesita el wa-service
 * corriendo): usa `WA_CLOUD_TOKEN` + `WA_CLOUD_WABA_ID` del `.env`.
 *
 *   node scripts/maintenance/whatsapp-api-oficial/crear-plantillas.mjs            # dry-run
 *   node scripts/maintenance/whatsapp-api-oficial/crear-plantillas.mjs --apply
 *   node scripts/maintenance/whatsapp-api-oficial/crear-plantillas.mjs --apply --solo pedido_listo
 *
 * Las plantillas con encabezado de documento (PDF) necesitan una **muestra**
 * subida a Meta: el script genera un PDF mínimo, lo sube por la Resumable
 * Upload API (`/{app_id}/uploads`) y usa el handle como `header_handle`. Por eso
 * no hace falta cargarlas a mano en el WhatsApp Manager.
 *
 * Entre alta y alta espera `PAUSA_MS` (30 s por defecto): Meta castiga las
 * ráfagas, y una cuenta bajo observación no debe crear diez cosas en un minuto.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';

const V = process.env.WA_CLOUD_API_VERSION || 'v21.0';
const GRAPH = 'https://graph.facebook.com';
const TOKEN = process.env.WA_CLOUD_TOKEN || '';
const WABA = process.env.WA_CLOUD_WABA_ID || '';
const APP_ID = process.env.WA_CLOUD_APP_ID || '1036999705858814'; // app con el producto WhatsApp
const PAUSA_MS = Number(process.env.PAUSA_MS || 30000);

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const solo = args.includes('--solo') ? args[args.indexOf('--solo') + 1] : null;

if (!TOKEN || !WABA) {
    console.error('Faltan WA_CLOUD_TOKEN o WA_CLOUD_WABA_ID en el .env.');
    process.exit(1);
}

// ── Catálogo: se lee del .ts para no duplicar los textos ─────────────────────
// (parseo simple: el archivo es un objeto literal; se extrae con una función
// evaluada en un módulo aislado sería más limpio, pero acá alcanza con importar
// el .ts transpilado a mano. Para no depender de tsx, se replica la lectura.)
function cargarCatalogo() {
    const src = readFileSync(new URL('../../../src/lib/whatsapp/templates.ts', import.meta.url), 'utf8');
    const inicio = src.indexOf('export const WHATSAPP_TEMPLATES = {');
    const fin = src.indexOf('} as const satisfies', inicio);
    if (inicio < 0 || fin < 0) throw new Error('No se pudo leer el catálogo de plantillas');
    const cuerpo = src.slice(src.indexOf('{', inicio), fin + 1);
    // El literal es JSON-compatible salvo por claves sin comillas y comas finales.
    // eslint-disable-next-line no-new-func
    return new Function(`return (${cuerpo})`)();
}

const CATALOGO = cargarCatalogo();
const LANG = 'es_AR';

// ── Graph ────────────────────────────────────────────────────────────────────
async function graph(path, init = {}) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(`${GRAPH}/${V}/${path}${sep}access_token=${TOKEN}`, init);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${path.split('?')[0]} → ${r.status} ${j?.error?.message || ''} (code ${j?.error?.code || '?'})`);
    return j;
}

/** PDF mínimo válido, solo para que Meta tenga una muestra del encabezado. */
function pdfDeMuestra(titulo) {
    const texto = `BT /F1 14 Tf 60 760 Td (${titulo}) Tj ET`;
    const objs = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        `<< /Length ${texto.length} >>\nstream\n${texto}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach(o => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
}

/** Sube una muestra y devuelve el handle que Meta pide en `example.header_handle`. */
async function subirMuestra(buffer, filename, mime) {
    const sesion = await graph(`${APP_ID}/uploads?file_name=${encodeURIComponent(filename)}&file_length=${buffer.length}&file_type=${encodeURIComponent(mime)}`, { method: 'POST' });
    const r = await fetch(`${GRAPH}/${V}/${sesion.id}`, {
        method: 'POST',
        headers: { Authorization: `OAuth ${TOKEN}`, file_offset: '0', 'Content-Type': 'application/octet-stream' },
        body: buffer,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.h) throw new Error(`subida de muestra: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    return j.h;
}

function componentes(def, handle) {
    const out = [];
    if (def.header === 'DOCUMENT') out.push({ type: 'HEADER', format: 'DOCUMENT', example: { header_handle: [handle] } });
    if (def.header === 'IMAGE') out.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [handle] } });
    out.push({ type: 'BODY', text: def.body, example: { body_text: [def.params.map(p => p.example)] } });
    if (def.footer) out.push({ type: 'FOOTER', text: def.footer });
    if (def.buttons?.length) {
        out.push({
            type: 'BUTTONS',
            buttons: def.buttons.map(b => b.type === 'URL'
                ? { type: 'URL', text: b.text, url: b.url }
                : { type: 'QUICK_REPLY', text: b.text }),
        });
    }
    return out;
}

const dormir = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    const existentes = await graph(`${WABA}/message_templates?fields=name,language,status&limit=200`);
    const ya = new Map((existentes.data || []).map(t => [`${t.name}|${t.language}`, t.status]));

    const pendientes = Object.values(CATALOGO).filter(d => (!solo || d.name === solo) && !ya.has(`${d.name}|${LANG}`));
    const listas = Object.values(CATALOGO).filter(d => ya.has(`${d.name}|${LANG}`));
    listas.forEach(d => console.log(`=  ${d.name}: ya existe (${ya.get(`${d.name}|${LANG}`)})`));
    if (!pendientes.length) { console.log('\nNo falta ninguna.'); return; }

    console.log(`\nFaltan ${pendientes.length}: ${pendientes.map(d => d.name).join(', ')}`);
    if (!APPLY) { console.log('\n(dry-run) Con --apply se dan de alta, esperando ' + PAUSA_MS / 1000 + 's entre cada una.'); return; }

    for (const [i, def] of pendientes.entries()) {
        try {
            let handle = null;
            if (def.header) {
                handle = await subirMuestra(pdfDeMuestra(`Atelier Optica - ${def.name}`), `${def.name}.pdf`, 'application/pdf');
            }
            const r = await graph(`${WABA}/message_templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: def.name, language: LANG, category: def.category, components: componentes(def, handle) }),
            });
            console.log(`✔ ${def.name} → ${r.status || 'enviada a aprobar'} (id ${r.id})`);
        } catch (e) {
            console.error(`✖ ${def.name}: ${e.message}`);
        }
        if (i < pendientes.length - 1) await dormir(PAUSA_MS);
    }
}
main().catch(e => { console.error(e.message); process.exit(1); });
