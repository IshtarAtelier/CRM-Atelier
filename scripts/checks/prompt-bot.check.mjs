/**
 * Lint de los prompts del bot de WhatsApp. Solo lee.
 *
 *   npm run check:prompt-bot            → los prompts del REPO (sin base ni red)
 *   npm run check:prompt-bot -- --prod  → además el prompt VIVO de producción
 *                                         (GET /api/agent del wa-service con BOT_API_KEY)
 *
 * Qué mira lo define src/lib/whatsapp/lint-prompt.ts (una sola lista para CI,
 * el cron diario y este script): lo que un prompt NO puede decir (nombre propio,
 * "te paso con el equipo", "¿mono o multi?", cotizar sin receta…) y lo que
 * TIENE que decir (receta obligatoria, A.V. no es adición, pedir_ayuda…).
 *
 * Por qué existe (10/9/2026): el prompt vivo se edita desde el panel y nadie lo
 * versiona. Convivían, con "prioridad absoluta", reglas opuestas — y el modelo
 * eligió la mala en producción. Esto es lo que grita cuando vuelve a pasar.
 *
 * Los prompts del repo son PARCIALES (cada módulo aporta una parte), así que a
 * ellos solo se les exige que no digan nada prohibido. El prompt vivo, que es
 * el que de verdad manda, tiene que cumplir también con lo obligatorio.
 */
import { readFileSync } from 'node:fs';
import { lintPromptDelBot, describirHallazgos } from '../../src/lib/whatsapp/lint-prompt.ts';

// Los comentarios `//` de los .js quedan afuera: describen casos MALOS a
// propósito (el "Soy Matías de Atelier Óptica" que se corrigió) y no son prompt.
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\r\n/g, '\n').replace(/^\s*\/\/.*$/gm, '');
const fallas = [];
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => { fallas.push(m); console.log(`  ❌ ${m}`); };

// CORE_RULES va pegado al final de TODO prompt (vivo o del repo), así que se
// lintea aparte: si alguien mete ahí una regla prohibida, la mete en todos.
const graph = leer('../../wa-service/graph.js');
const core = graph.match(/const CORE_RULES = `([\s\S]*?)`;/)?.[1];
if (!core) mal('no se encontró CORE_RULES en wa-service/graph.js');

const DEL_REPO = [
    ['CORE_RULES (graph.js)', core || ''],
    ['prompts/salesPrompt.js', leer('../../wa-service/prompts/salesPrompt.js')],
    ['prompts/executivePrompt.js', leer('../../wa-service/prompts/executivePrompt.js')],
    ['prompts/context-modules.js', leer('../../wa-service/prompts/context-modules.js')],
];

console.log('Prompts del repo (solo lo prohibido):');
for (const [nombre, texto] of DEL_REPO) {
    const h = lintPromptDelBot(texto, { soloProhibido: true });
    if (!h.length) ok(nombre);
    for (const linea of describirHallazgos(h)) mal(`${nombre}: ${linea}`);
}

// Lo que las reglas obligatorias exigen tiene que existir al menos en el prompt
// por defecto + CORE_RULES: si el prompt vivo se borra, eso es lo que responde.
console.log('\nPrompt por defecto + CORE_RULES (lo obligatorio):');
{
    const h = lintPromptDelBot(DEL_REPO[1][1] + core);
    if (!h.length) ok('salesPrompt + CORE_RULES cumplen todas las reglas obligatorias');
    for (const linea of describirHallazgos(h)) mal(`por defecto: ${linea}`);
}

if (process.argv.includes('--prod')) {
    console.log('\nPrompt VIVO de producción:');
    const base = process.env.WA_SERVER_URL_PROD || process.env.WA_SERVER_URL;
    const key = process.env.BOT_API_KEY;
    if (!base || !key) mal('faltan WA_SERVER_URL (o WA_SERVER_URL_PROD) y BOT_API_KEY en el entorno');
    else {
        try {
            const r = await fetch(`${base}/api/agent`, { headers: { 'x-api-key': key } });
            const j = await r.json();
            const vivo = String(j.prompt || '');
            if (vivo.trim().length <= 300) mal(`el prompt vivo tiene ${vivo.length} caracteres: el bot está usando el del repo`);
            const h = lintPromptDelBot(vivo);
            if (!h.length) ok(`prompt vivo (${vivo.length} caracteres) sin hallazgos`);
            for (const linea of describirHallazgos(h)) mal(`vivo: ${linea}`);
        } catch (e) {
            mal(`no se pudo leer el prompt vivo: ${e.message}`);
        }
    }
}

console.log('');
if (fallas.length) {
    console.error(`❌ ${fallas.length} problema(s) en los prompts del bot. Cada uno es una decisión de Ishtar que el prompt contradice o le falta.`);
    process.exit(1);
}
console.log('✅ Los prompts del bot respetan las reglas.');
