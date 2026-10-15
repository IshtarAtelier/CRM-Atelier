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
import { createRequire } from 'node:module';
import { lintPromptDelBot, describirHallazgos, contradiccionesConCoreRules, herramientasParaRecetaIlegible } from '../../src/lib/whatsapp/lint-prompt.ts';
const require = createRequire(import.meta.url);
// Lo que decide si graph.js usa el prompt vivo o lo descarta (15/10/2026).
const { motivoParaDescartarPromptCustom, promptDeVentas, promptVivoActivo } = require('../../wa-service/shared/prompt-custom.js');

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
    // El bloque de saludo de la apertura (10/10/2026) también es prompt.
    ['shared/fase-de-la-charla.js', leer('../../wa-service/shared/fase-de-la-charla.js')],
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

// El filtro que descarta el prompt custom (shared/prompt-custom.js). El
// 15/10/2026 el prompt vivo se descartaba ENTERO, en silencio, por la frase
// que prohíbe inventarse un título ("ni un título (óptica, contactóloga…)").
console.log('\nFiltro del prompt custom (descarta autopresentaciones, no prohibiciones):');
{
    const relleno = 'Atendés por WhatsApp a quien escribe a la óptica. '.repeat(10);
    const CASOS = [
        ['Nunca te inventes un nombre propio, un apellido ni un título (óptica, contactóloga, doctora).', false, 'la prohibición del prompt vivo'],
        ['Nunca digas que sos contactóloga.', false, 'prohibición con verbo de presentación'],
        ['No te presentes como Matías Turchi.', false, 'prohibición con apellido'],
        ['Soy Matías Turchi, de Atelier Óptica.', true, 'autopresentación con apellido'],
        ['Te habla Mile, contactóloga de la óptica.', true, 'autopresentación con título'],
        ['Saludos\n— Matías, Óptico Contactólogo\n', true, 'firma con título'],
        ['Sos el ejecutivo de cuentas de Atelier.', true, 'rol de otro agente'],
    ];
    for (const [frase, descarta, porque] of CASOS) {
        const motivo = motivoParaDescartarPromptCustom(`${relleno}\n${frase}`);
        if (Boolean(motivo) === descarta) ok(`${descarta ? 'descarta' : 'usa'}: ${porque}`);
        else mal(`${porque}: esperaba ${descarta ? 'descartar' : 'usar'} y ${motivo ? `descartó (${motivo})` : 'lo usó'}`);
    }
    if (motivoParaDescartarPromptCustom('corto')) ok('un prompt de menos de 301 caracteres se descarta');
    else mal('un prompt corto debería descartarse');
    if (/motivoParaDescartarPromptCustom\(custom\)/.test(graph) && /console\.warn\(`[^`]*DESCARTADO/.test(graph) && !/FORBIDDEN_IN_CUSTOM_PROMPT/.test(graph)) ok('graph.js decide con motivoParaDescartarPromptCustom y loguea cada descarte');
    else mal('graph.js no usa motivoParaDescartarPromptCustom o no avisa cuando descarta');
}

// Qué prompt usa el bot de ventas: el del repo, salvo bot_prompt_activo='true'
// (15/10/2026). Se prueba la función que usa bot-cloud.js, no el código.
console.log('\nPrompt de ventas: el del repo salvo bot_prompt_activo=true');
{
    const vivo = 'Atendés por WhatsApp a quien escribe a la óptica. '.repeat(10);
    const sinFila = promptDeVentas({ activo: promptVivoActivo(null), vivo });
    if (sinFila.fuente === 'repo' && sinFila.custom === '') ok('sin la fila bot_prompt_activo → prompt del REPO (lo que hace hoy producción)');
    else mal('sin bot_prompt_activo el bot debería usar el prompt del repo');
    if (promptDeVentas({ activo: promptVivoActivo({ value: 'false' }), vivo }).fuente === 'repo' && promptDeVentas({ activo: promptVivoActivo({ value: 'si' }), vivo }).fuente === 'repo') ok("cualquier valor que no sea 'true' → repo");
    else mal("solo 'true' activa el prompt vivo");
    const on = promptDeVentas({ activo: promptVivoActivo({ value: 'true' }), vivo });
    if (on.fuente === 'vivo' && on.custom === vivo) ok("bot_prompt_activo='true' → prompt VIVO");
    else mal("con bot_prompt_activo='true' debería usarse el vivo");
    if (promptDeVentas({ activo: true, vivo: 'corto' }).fuente === 'repo') ok('activo pero descartado por el filtro → repo');
    else mal('un vivo descartable no puede usarse aunque esté activo');
}

// La contradicción receta ilegible: pedir_ayuda (vivo) vs create_task (CORE_RULES #7).
console.log('\nContradicción receta ilegible (pedir_ayuda vs create_task):');
{
    const t = herramientasParaRecetaIlegible(core || '');
    if (t.has('create_task')) ok("CORE_RULES #7: receta ilegible → 'create_task'");
    else mal("no se encontró en CORE_RULES qué hacer con una receta ilegible (¿cambió #7?)");
    const vivoMalo = "El tipo de lente lo dice la RECETA. Si no pudiste leerla, no finjas que sí ni le pases la decisión: llamá a 'pedir_ayuda' y no des precios de cristales.";
    if (contradiccionesConCoreRules(vivoMalo, core || '').length === 1) ok('detecta el vivo que manda pedir_ayuda contra CORE_RULES');
    else mal('no detecta la contradicción pedir_ayuda vs create_task');
    if (contradiccionesConCoreRules("Si no podés leerla, usá 'create_task' y seguí.", core || '').length === 0) ok('un vivo alineado con CORE_RULES no da contradicción');
    else mal('falso positivo en un vivo alineado');
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
            const descarte = motivoParaDescartarPromptCustom(vivo);
            if (descarte) mal(`el filtro DESCARTARÍA el prompt vivo: ${descarte}`);
            else ok('el filtro de graph.js no descarta el prompt vivo');
            // promptFuente lo devuelve el wa-service desde el 15/10/2026; uno
            // viejo no lo manda (y usa el del repo por el filtro viejo).
            console.log(`  ℹ️  el bot de ventas contesta con el prompt ${j.promptFuente === 'vivo' ? 'VIVO' : j.promptFuente === 'repo' ? 'del REPO (bot_prompt_activo no está en true)' : 'del REPO (wa-service anterior al 15/10/2026: no informa promptFuente)'}`);
            for (const c of contradiccionesConCoreRules(vivo, core || '')) mal(`vivo vs CORE_RULES: ${c}`);
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
