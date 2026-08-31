#!/usr/bin/env node
/**
 * Un precio no es una caída del servidor.
 *
 * El bot decide, después de cada herramienta, si el resultado fue una falla de
 * red (abortar el turno EN SILENCIO, el cliente no recibe nada) o un resultado
 * de negocio (contestarle al cliente). Esa decisión se venía tomando olfateando
 * el texto del resultado, y el texto de un presupuesto contiene precios:
 *
 *     • Precio contado: *$88.500*     →  matchea `\b500\b`
 *     • Precio contado: *$144.500*    →  matchea `\b500\b`
 *     Pedido N° 404 entregado          →  matchea `\b404\b`
 *
 * Medido contra la base real: el 5,3% de los productos dispara la falsa alarma
 * él solo, y un presupuesto de 3 opciones al azar la dispara el 15% de las
 * veces. Cuando se dispara, el turno se descarta entero y el cliente NO recibe
 * nada; a la tercera vez seguida el bot se apaga en ese chat con el motivo
 * falso "Errores técnicos persistentes" (index.js → handleTransientBotFailure).
 *
 * La señal correcta ya existía y no se usaba: `safeToolRun` (agent-tools.js)
 * separa red de negocio en el origen —relanza lo de red con el prefijo
 * "Network Error:" (y ToolNode lo marca con `status === 'error'`) y devuelve lo
 * de negocio como texto marcado "[INSTRUCCIÓN INTERNA]"—. La definición única
 * vive en `wa-service/graph.js` → `esFallaTransitoriaDeHerramienta`.
 *
 * Este check:
 *   1. corre el clasificador contra resultados reales y falla si clasifica mal;
 *   2. verifica que graph.js no haya vuelto a olfatear números sueltos;
 *   3. lista (sin fallar) qué otros archivos siguen con la copia vieja.
 *
 * Corre sin base y sin red.
 * Uso: npm run check:bot-errores
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const require = createRequire(import.meta.url);
const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../..');

// graph.js arrastra el módulo de Prisma y dotenv, que loguean al importarse.
// El check no toca la base (si no hay base, Prisma solo avisa y sigue): se
// filtra ese ruido para que la salida sea únicamente la del check.
const RUIDO = /injected env|Prisma/;
const logReal = console.log;
const errReal = console.error;
console.log = (...a) => { if (!(typeof a[0] === 'string' && RUIDO.test(a[0]))) logReal(...a); };
console.error = (...a) => { if (!(typeof a[0] === 'string' && RUIDO.test(a[0]))) errReal(...a); };

const { esFallaTransitoriaDeHerramienta } = require(resolve(raiz, 'wa-service/graph.js'));

let fallas = 0;
const fallar = (msg) => { fallas++; console.error(`❌ ${msg}`); };

if (typeof esFallaTransitoriaDeHerramienta !== 'function') {
    fallar('wa-service/graph.js no exporta esFallaTransitoriaDeHerramienta.');
    process.exit(1);
}

// ── Detectores históricos, para mostrar qué arregló el cambio ────────────────
// El que vivía en graph.js: daba por caída de red cualquier texto con "Error",
// incluidos los errores de negocio que el LLM tiene que leer.
const detectorViejoGraph = (msg) => {
    const c = ((msg && msg.content) || '').toString();
    return (msg && msg.status === 'error') || c.includes('Error') || c.includes('ECONNREFUSED')
        || c.includes('getaddrinfo') || c.includes('timeout');
};
// El que vive en index.js / routes/api.js / bot-cloud.js: además matchea los
// números 404 y 500 sueltos en cualquier parte del texto.
const detectorViejoNumerico = (msg) => {
    const c = ((msg && msg.content) || '').toString();
    return (msg && msg.status === 'error')
        || /getaddrinfo|ECONNREFUSED|Network Error|\b404\b|\b500\b/.test(c);
};

// ── 1. Corpus: resultados reales de las herramientas del bot ─────────────────
// `true`  = falla transitoria de infraestructura → abortar el turno.
// `false` = resultado de negocio → el bot TIENE que contestarle al cliente.
const CASOS = [
    // ── Presupuestos: el caso que dejaba mudo al bot ─────────────────────────
    ['presupuesto de 3 opciones con precios en 500', false, { name: 'get_price_list', content:
        '[INSTRUCCIÓN INTERNA] Abajo tenés los precios del sistema ya formateados. Envialos al cliente TAL CUAL están.\n\n'
        + '*Opción 1 – Helena Negro*\n• Precio contado: *$88.500*\n• 6 cuotas sin interés de *$14.750* (total *$88.500*)\n\n'
        + '*Opción 2 – Amaris Carey*\n• Precio contado: *$144.500*\n• 6 cuotas sin interés de *$24.084* (total *$144.500*)\n\n'
        + '*Opción 3 – Varilux Comfort Max*\n• Precio contado: *$212.500*\n• 6 cuotas sin interés de *$35.417* (total *$212.500*)' }],
    ['presupuesto SIN el encabezado interno (texto pelado)', false, { name: 'get_price_list', content:
        '*Opción 1 – Cápsula Escarlata Ámbar*\n• Precio contado: *$49.500*\n• 6 cuotas sin interés de *$8.250* (total *$49.500*)' }],
    ['pie de foto con precio terminado en 500', false, { name: 'send_product_photos', content:
        '*Kazwini Helena Negro*\n• Precio contado: *$88.500*' }],
    ['pedido cuyo NÚMERO es 404', false, { name: 'get_order_status', content:
        '[INSTRUCCIÓN INTERNA] Datos EXACTOS y verificados del sistema para el pedido N° 404. Estado: entregado.' }],
    ['saldo de $500 justos', false, { name: 'get_order_status', content:
        '[INSTRUCCIÓN INTERNA] Datos EXACTOS del sistema. Saldo pendiente: $500' }],

    // ── Errores de negocio: son resultados EXITOSOS para el modelo ───────────
    ['error de negocio de safeToolRun (contiene la palabra "Error")', false, { name: 'create_task', content:
        '[INSTRUCCIÓN INTERNA] Error al ejecutar la herramienta: falta el clientId. Continuá la conversación con normalidad sin mencionar errores técnicos al cliente.' }],
    ['error de negocio serializado como objeto', false, { name: 'convert_into_lead', content:
        '{"success":false,"error":"[INSTRUCCIÓN INTERNA] El nombre no es válido, parece una frase. Preguntale al cliente su nombre de pila de forma natural."}' }],
    ['búsqueda sin resultados', false, { name: 'get_price_list', content:
        '[INSTRUCCIÓN INTERNA] No se encontraron productos para esta búsqueda. Intentá con otra categoría o sin filtro de búsqueda.' }],
    ['saldo no verificable (apagado deliberado, no es falla de red)', false, { name: 'get_order_status', content:
        '[INSTRUCCIÓN INTERNA] No se pudo obtener el saldo verificado del sistema. TERMINANTEMENTE PROHIBIDO informar montos.' }],
    ['resultado vacío', false, { name: 'add_tags', content: '' }],
    ['content nulo', false, { name: 'add_tags', content: null }],
    ['mensaje inexistente', false, null],

    // ── Fallas de infraestructura de verdad ──────────────────────────────────
    ['ECONNREFUSED relanzado por safeToolRun', true, { name: 'get_price_list', status: 'error', content:
        'Network Error: request to http://localhost:3000/api/bot/pricing failed, reason: connect ECONNREFUSED 127.0.0.1:3000' }],
    ['DNS caído sin status (getaddrinfo)', true, { name: 'get_order_status', content:
        'Network Error: getaddrinfo ENOTFOUND api.atelieroptica.com.ar' }],
    ['socket hang up marcado por ToolNode', true, { name: 'save_prescription_data', status: 'error', content:
        'Error: socket hang up' }],
    ['ETIMEDOUT crudo', true, { name: 'get_price_list', content: 'Error: connect ETIMEDOUT 34.117.0.1:443' }],
    ['fetch failed de undici', true, { name: 'send_product_photos', content: 'TypeError: fetch failed' }],
    ['503 anunciado como status code', true, { name: 'get_price_list', content:
        'Error: Request failed with status code 503' }],
    ['500 anunciado como status code', true, { name: 'get_price_list', content:
        'AxiosError: Request failed with status code 500' }],
    ['cuota de la API de Google agotada', true, { name: 'save_prescription_data', status: 'error', content:
        '[GoogleGenerativeAI Error]: 429 RESOURCE_EXHAUSTED: Quota exceeded' }],
    ['timeout de la request', true, { name: 'get_order_status', content: 'timeout of 30000ms exceeded' }],
    ['la tool tiró y ToolNode la marcó (texto cualquiera)', true, { name: 'create_quote', status: 'error', content:
        'Cannot read properties of undefined (reading id)' }],
];

console.log('\n— El detector de fallas de herramienta del bot —\n');

let ok = 0;
const rescatados = [];
for (const [nombre, esperado, msg] of CASOS) {
    const obtenido = esFallaTransitoriaDeHerramienta(msg);
    if (obtenido !== esperado) {
        fallar(`${nombre}: esperaba ${esperado}, dio ${obtenido}`);
        continue;
    }
    ok++;
    const viejoGraph = detectorViejoGraph(msg);
    const viejoNum = detectorViejoNumerico(msg);
    const antesFallaba = viejoGraph !== esperado || viejoNum !== esperado;
    if (antesFallaba) {
        const culpables = [viejoGraph !== esperado && 'graph', viejoNum !== esperado && 'numérico'].filter(Boolean);
        rescatados.push(nombre);
        console.log(`  ✓ ${nombre}  → ${obtenido}  (el detector ${culpables.join(' y el ')} decía ${!esperado})`);
    } else {
        console.log(`  ✓ ${nombre}  → ${obtenido}`);
    }
}

if (rescatados.length) {
    console.log(`\n  ${rescatados.length} de ${CASOS.length} casos estaban mal clasificados antes del arreglo.`);
    console.log('  Cada uno de ellos era un turno descartado: el cliente no recibía NADA.');
}

// ── 2. graph.js no puede volver a olfatear números sueltos ───────────────────
const OLFATEOS_PROHIBIDOS = [
    [/includes\((['"])404\1\)/, `includes('404')`],
    [/includes\((['"])50[03]\1\)/, `includes('500') / includes('503')`],
    [/\\b(?:404|500)\\b/, `\\b404\\b / \\b500\\b dentro de un regex`],
    [/includes\((['"])Error\1\)/, `includes('Error')`],
];

const fuenteGraph = readFileSync(resolve(raiz, 'wa-service/graph.js'), 'utf8');
// El bloque de comentarios explica el bug citando los patrones: se mira el código.
const codigoGraph = fuenteGraph
    .split('\n')
    .filter(l => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');

for (const [patron, etiqueta] of OLFATEOS_PROHIBIDOS) {
    if (patron.test(codigoGraph)) {
        fallar(`wa-service/graph.js volvió a clasificar por texto con ${etiqueta}. Usá esFallaTransitoriaDeHerramienta.`);
    }
}
if (!fallas) console.log('\n  ✓ graph.js no clasifica errores olfateando el texto del resultado');

// ── 3. Quién sigue con la copia vieja (informativo, no falla) ────────────────
function archivosJs(dir, acc = []) {
    let entradas;
    try { entradas = readdirSync(dir); } catch { return acc; }
    for (const e of entradas) {
        if (e === 'node_modules' || e === '.git' || e.startsWith('.')) continue;
        const p = resolve(dir, e);
        let st;
        try { st = statSync(p); } catch { continue; }
        if (st.isDirectory()) archivosJs(p, acc);
        else if (e.endsWith('.js')) acc.push(p);
    }
    return acc;
}

const pendientes = [];
for (const archivo of archivosJs(resolve(raiz, 'wa-service'))) {
    if (archivo.endsWith('wa-service/graph.js')) continue;
    const lineas = readFileSync(archivo, 'utf8').split('\n');
    lineas.forEach((linea, i) => {
        if (linea.trimStart().startsWith('//') || linea.trimStart().startsWith('*')) return;
        for (const [patron, etiqueta] of OLFATEOS_PROHIBIDOS) {
            if (patron.test(linea)) {
                pendientes.push(`${relative(raiz, archivo)}:${i + 1}  (${etiqueta})`);
                return;
            }
        }
    });
}

if (pendientes.length) {
    console.log(`\n⚠️  PENDIENTE: ${pendientes.length} lugar(es) siguen clasificando por texto en vez de`);
    console.log('   llamar a esFallaTransitoriaDeHerramienta de wa-service/graph.js:');
    for (const p of pendientes) console.log(`   • ${p}`);
    console.log('   (informativo: este check no falla por ellos)');
} else {
    console.log('\n  ✓ ningún otro archivo del wa-service clasifica errores por texto');
}

if (fallas) {
    console.error(`\n❌ ${fallas} falla(s). Un precio no puede leerse como una caída del servidor.`);
    process.exit(1);
}

console.log(`\n✅ ${ok}/${CASOS.length} resultados clasificados correctamente. Ningún precio se lee como falla de red.\n`);
process.exit(0);
