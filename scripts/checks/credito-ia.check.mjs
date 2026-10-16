#!/usr/bin/env node
/**
 * IA sin crédito → WhatsApp a la dueña, una vez por episodio (16/10/2026).
 *
 * El 8/10/2026 la clave prepaga de Gemini llegó a cero: Google contestó 402
 * "prepayment credits are depleted", el bot se tragó el error del modelo, lo
 * contó como falla del chat y lo apagó al tercer turno. Nadie se enteró.
 *
 * Este check fija, sin base ni red:
 *   1. El clasificador (wa-service/shared/errores-ia.js y su espejo TS) con
 *      textos REALES de error de AI Studio y Vertex, y que los dos coincidan.
 *   2. La deduplicación (src/lib/ia/episodio-credito.ts) sobre un almacén con
 *      compare-and-set: dos instancias a la vez → un aviso; reinicio → nada;
 *      a las N horas → recordatorio; vuelta → un solo "volvió"; 429 suelto →
 *      nada, 429 sostenido → aviso.
 *   3. El bot: el error del modelo no se traga (graph.js lo lanza clasificado),
 *      'sin_credito' no apaga el chat ni cuenta como falla, y el monitor
 *      rescata los chats al volver el crédito.
 *   4. Autoprueba: un clasificador ingenuo y un almacén sin candado TIENEN que
 *      hacer fallar las pruebas; si no, el check no prueba nada.
 *
 * Uso: npm run check:credito-ia
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const js = require(resolve(raiz, 'wa-service/shared/errores-ia.js'));
const { crearMonitorDeCredito } = require(resolve(raiz, 'wa-service/shared/credito-ia.js'));
const ts = await import(resolve(raiz, 'src/lib/ia/errores-ia.ts'));
const ep = await import(resolve(raiz, 'src/lib/ia/episodio-credito.ts'));
const K = await import(resolve(raiz, 'src/lib/constants/ia-credito.ts'));

let fallas = 0;
const ok = (cond, msg) => { if (!cond) { fallas++; console.error(`  ✗ ${msg}`); } };

// ── 1. Clasificador ─────────────────────────────────────────────────────────
const CASOS = [
    // AI Studio, LangChain (@langchain/google-genai) — el del 8/10/2026.
    ['sin_credito', new Error('[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [402 Payment Required] Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.')],
    // SDK @google/genai: ApiError con status y el JSON en el mensaje.
    ['sin_credito', Object.assign(new Error('{"error":{"code":402,"message":"Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.","status":"FAILED_PRECONDITION"}}'), { status: 402 })],
    // La sonda: status + cuerpo.
    ['sin_credito', { status: 402, message: '[402 Payment Required] {"error":{"code":402,"message":"Your prepayment credits are depleted."}}' }],
    // Vertex sin facturación.
    ['sin_credito', new Error('[VertexAI.ClientError]: got status: 403 Forbidden. {"error":{"code":403,"message":"This API method requires billing to be enabled. Please enable billing on project #123456 by visiting https://console.developers.google.com/billing/enable?project=123456 then retry.","status":"PERMISSION_DENIED","details":[{"reason":"BILLING_DISABLED"}]}}')],
    ['sin_credito', new Error('The billing account for the owning project is disabled in state absent')],
    // Error envuelto (ErrorDeIA / cause).
    ['sin_credito', new Error('Falló el turno', { cause: { status: 402, message: 'Payment Required' } })],
    // Cuota: AI Studio 429 (dice "billing details" y NO es falta de crédito).
    ['cuota', new Error('[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [429 Too Many Requests] You exceeded your current quota, please check your plan and billing details.')],
    ['cuota', new Error('[VertexAI.ClientError]: got status: 429 Too Many Requests. {"error":{"code":429,"message":"Resource exhausted. Please try again later.","status":"RESOURCE_EXHAUSTED"}}')],
    ['cuota', Object.assign(new Error('Too Many Requests'), { status: 429 })],
    // Transitorios.
    ['transitorio', new Error('[GoogleGenerativeAI Error]: [503 Service Unavailable] The model is overloaded. Please try again later.')],
    ['transitorio', new Error('[VertexAI.GoogleGenerativeAIError]: got status: 500 Internal Server Error')],
    ['transitorio', new Error('Bot timeout: graph.invoke superó 30000ms')],
    ['transitorio', new TypeError('fetch failed')],
    // Otros: no son plata aunque lleven números.
    ['otro', new Error('[400 Bad Request] Invalid JSON payload received.')],
    ['otro', new Error('El presupuesto es de $88.429,50')],
    ['otro', new Error("Cannot read properties of undefined (reading 'content')")],
];

function correrClasificador(clasificar, nombre, silencioso = false) {
    let malas = 0;
    for (const [esperado, err] of CASOS) {
        const dio = clasificar(err);
        if (dio !== esperado) {
            malas++;
            if (!silencioso) console.error(`  ✗ ${nombre}: "${String(err.message || err.status).slice(0, 90)}…" → ${dio}, esperaba ${esperado}`);
        }
    }
    return malas;
}
console.log('1. Clasificador de errores de IA');
fallas += correrClasificador(js.clasificarErrorIA, 'wa-service');
fallas += correrClasificador(ts.clasificarErrorIA, 'CRM (TS)');
const err402 = new js.ErrorDeIA('sin_credito', CASOS[0][1]);
ok(js.claseDe(err402) === 'sin_credito', 'claseDe respeta la clase de un ErrorDeIA');
ok(js.esFallaDeSaldo('cuota') && js.esFallaDeSaldo('sin_credito') && !js.esFallaDeSaldo('transitorio'), 'esFallaDeSaldo');
// Paridad textual de los patrones (el espejo no puede divergir).
const patrones = (src) => (src.match(/const PATRONES_[A-Z_]+ = \[[\s\S]*?\];/g) || []).map(b => b.replace(/\s+/g, ''));
ok(JSON.stringify(patrones(readFileSync(resolve(raiz, 'wa-service/shared/errores-ia.js'), 'utf8')))
    === JSON.stringify(patrones(readFileSync(resolve(raiz, 'src/lib/ia/errores-ia.ts'), 'utf8'))), 'los patrones del JS y del TS son idénticos');

// ── 2. Deduplicación ────────────────────────────────────────────────────────
/** SystemSetting de mentira; `atomico=false` simula un upsert sin candado. */
function almacenFalso({ atomico = true } = {}) {
    const m = new Map();
    const tic = () => new Promise(r => setImmediate(r));
    return {
        m,
        async leer(k) { await tic(); return m.get(k) || ''; },
        async cambiarSi(k, esperado, nuevo) {
            if (atomico) { const ok = (m.get(k) || '') === esperado; if (ok) m.set(k, nuevo); await tic(); return ok; }
            await tic(); m.set(k, nuevo); return true; // lee y escribe sin mirar: dos ganadores
        },
    };
}

async function escenarioDedupe(almacen) {
    const t0 = new Date('2026-10-16T12:00:00Z');
    const r = {};
    // Dos instancias (bot + CRM, o dos réplicas) reportan el mismo 402 a la vez.
    const [a, b] = await Promise.all([
        ep.registrarFallaDeSaldo(almacen, 'sin_credito', t0),
        ep.registrarFallaDeSaldo(almacen, 'sin_credito', t0),
    ]);
    r.avisosSimultaneos = [a, b].filter(d => d.avisar).length;
    // "Reinicio": proceso nuevo, misma base, 10 min después.
    r.trasReinicio = (await ep.registrarFallaDeSaldo(almacen, 'sin_credito', new Date(t0.getTime() + 10 * 60000))).avisar;
    // Justo antes de las N horas: nada. A las N horas: recordatorio.
    const N = K.HORAS_ENTRE_AVISOS_SIN_CREDITO * 3600_000;
    r.antesDeN = (await ep.registrarFallaDeSaldo(almacen, 'sin_credito', new Date(t0.getTime() + N - 60000))).avisar;
    const rec = await ep.registrarFallaDeSaldo(almacen, 'sin_credito', new Date(t0.getTime() + N + 1000));
    r.recordatorio = rec.avisar && rec.tipo;
    // Vuelve: un solo "volvió" aunque dos lo reporten.
    const [v1, v2] = await Promise.all([ep.registrarExitoDeIA(almacen), ep.registrarExitoDeIA(almacen)]);
    r.vueltas = [v1, v2].filter(v => v.avisarVuelta).length;
    r.vueltaRepetida = (await ep.registrarExitoDeIA(almacen)).avisarVuelta;
    // Episodio nuevo después: avisa de nuevo como primero.
    const nuevo = await ep.registrarFallaDeSaldo(almacen, 'sin_credito', new Date(t0.getTime() + N + 3600_000));
    r.episodioNuevo = nuevo.avisar && nuevo.tipo;
    return r;
}

console.log('2. Deduplicación del aviso');
{
    const r = await escenarioDedupe(almacenFalso());
    ok(r.avisosSimultaneos === 1, `dos instancias a la vez → 1 aviso (dio ${r.avisosSimultaneos})`);
    ok(r.trasReinicio === false, 'tras un reinicio no se re-avisa');
    ok(r.antesDeN === false, `antes de ${K.HORAS_ENTRE_AVISOS_SIN_CREDITO} h no se re-avisa`);
    ok(r.recordatorio === 'recordatorio', `a las ${K.HORAS_ENTRE_AVISOS_SIN_CREDITO} h sale UN recordatorio (dio ${r.recordatorio})`);
    ok(r.vueltas === 1, `"volvió" sale una sola vez aunque dos lo reporten (dio ${r.vueltas})`);
    ok(r.vueltaRepetida === false, 'un segundo éxito no repite "volvió"');
    ok(r.episodioNuevo === 'primer_aviso', 'un episodio nuevo avisa de cero');

    const al = almacenFalso();
    const t0 = new Date('2026-10-16T12:00:00Z');
    const c1 = await ep.registrarFallaDeSaldo(al, 'cuota', t0);
    const c2 = await ep.registrarFallaDeSaldo(al, 'cuota', new Date(t0.getTime() + (K.MINUTOS_CUOTA_SOSTENIDA - 1) * 60000));
    const c3 = await ep.registrarFallaDeSaldo(al, 'cuota', new Date(t0.getTime() + (K.MINUTOS_CUOTA_SOSTENIDA + 1) * 60000));
    ok(!c1.avisar && !c2.avisar, 'un 429 suelto (pico de cuota) no avisa');
    ok(c3.avisar && c3.clase === 'cuota', `un 429 sostenido ${K.MINUTOS_CUOTA_SOSTENIDA} min sí avisa`);
    const vueltaSinAviso = almacenFalso();
    await ep.registrarFallaDeSaldo(vueltaSinAviso, 'cuota', t0);
    ok((await ep.registrarExitoDeIA(vueltaSinAviso)).avisarVuelta === false, 'si nunca se avisó la falta, no se avisa la vuelta');
    ok(vueltaSinAviso.m.get(K.CLAVE_CUOTA_DESDE) === '', 'un éxito reinicia el contador de cuota');
    ok((await ep.registrarFallaDeSaldo(almacenFalso(), 'transitorio', t0)).avisar === false, 'un transitorio nunca avisa');

    const d = { avisar: true, tipo: 'primer_aviso', clase: 'sin_credito', desde: t0 };
    const texto = ep.textoDelAviso(d, K.LINK_RECARGA_AI_STUDIO, '09:00');
    ok(!/\n/.test(texto) && !/\.$/.test(texto) && texto.length < 700, 'el texto entra en la plantilla nota_interna (un renglón, sin punto final, < 700)');
    ok(/Add funds/.test(texto) && texto.includes(K.LINK_RECARGA_AI_STUDIO) && /bot/.test(texto), 'el texto dice qué deja de andar y cómo cargar');
}

// ── 3. El bot ───────────────────────────────────────────────────────────────
console.log('3. El bot frente a la falta de crédito');
{
    const graph = readFileSync(resolve(raiz, 'wa-service/graph.js'), 'utf8');
    ok(/esFallaDeSaldo\(claseIA\)\)\s*throw new ErrorDeIA/.test(graph), 'graph.js lanza el error de saldo clasificado (no reintenta ni lo traga)');
    const bot = readFileSync(resolve(raiz, 'wa-service/bot-cloud.js'), 'utf8');
    const catchGrafo = bot.match(/catch \(graphErr\) \{([\s\S]*?)\} finally/);
    ok(catchGrafo && /claseDe\(graphErr\)[\s\S]*sinSaldo\([\s\S]*return;[\s\S]*result = \{ messages: \[\] \}/.test(catchGrafo[1]),
        'el catch de graph.invoke deriva la falta de saldo a sinSaldo ANTES de vaciar la salida');
    const cuerpoSinSaldo = (bot.match(/async function sinSaldo\([^)]*\) \{([\s\S]*?)\n    \}/) || [])[1] || '';
    ok(cuerpoSinSaldo && !/disableBotForChatById|fallaTransitoria|chatErrorCounts/.test(cuerpoSinSaldo),
        "'sin_credito' no apaga el bot del chat ni cuenta como falla");
    ok(cuerpoSinSaldo && !/sendViaCloud|transport\.sendMessage/.test(cuerpoSinSaldo), 'al cliente no le sale nada');
    const catchTurno = bot.slice(bot.lastIndexOf("console.error('  ❌ [BotCloud] Error en el turno:'"));
    ok(/esFallaDeSaldo\(claseIA\)[\s\S]*?sinSaldo[\s\S]*?return;[\s\S]*?fallaTransitoria/.test(catchTurno), 'el catch del turno también separa la falta de saldo de la falla del chat');
    ok(!/'Cuota agotada de API \(Error 429\)'/.test(bot), 'ya no se apaga el chat por un 429');

    // Monitor: reportes acotados, rescate al volver.
    let ahora = 1_000_000;
    const reportes = [];
    const rescates = [];
    let abiertoEnCrm = true;
    const mon = crearMonitorDeCredito({
        reloj: () => ahora,
        reportar: async (b) => { reportes.push(b); return true; },
        rescatar: async (desde) => { rescates.push(desde.getTime()); },
        episodioAbiertoEnCrm: async () => abiertoEnCrm,
    });
    await mon.falla('sin_credito', { detalle: '402' });
    ahora += 60_000;
    await mon.falla('sin_credito', { detalle: '402' });
    ok(reportes.length === 1, `dos fallas seguidas → un solo reporte al CRM (dio ${reportes.length})`);
    ok(await mon.revisar() === false && rescates.length === 0, 'con el episodio abierto en el CRM no se rescata');
    abiertoEnCrm = false;
    ok(await mon.revisar() === true && rescates[0] === 1_000_000, 'cuando el CRM cierra el episodio, se rescata desde el inicio');
    await mon.falla('cuota');
    await mon.exito();
    ok(rescates.length === 2 && reportes.at(-1).estado === 'ok', 'una llamada que anda reporta "ok" y rescata');
    ok(await mon.exito() === false, 'sin episodio, un éxito no hace nada');
}

// ── 4. Autoprueba ───────────────────────────────────────────────────────────
console.log('4. Autoprueba (el check tiene que poder fallar)');
{
    const ingenuo = (e) => (/429|RESOURCE_EXHAUSTED/.test(String(e && e.message)) ? 'cuota' : 'otro'); // el de antes
    ok(correrClasificador(ingenuo, 'ingenuo', true) > 0, 'el clasificador viejo (solo 429) es detectado como malo');
    const r = await escenarioDedupe(almacenFalso({ atomico: false }));
    ok(r.avisosSimultaneos > 1 || r.vueltas > 1, 'un almacén sin candado es detectado (dos avisos a la vez)');
}

if (fallas) {
    console.error(`\n✗ check:credito-ia — ${fallas} falla(s).`);
    process.exit(1);
}
console.log('\n✓ check:credito-ia — clasificador, dedupe y bot en orden.');
