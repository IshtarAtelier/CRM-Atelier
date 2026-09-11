/**
 * Contrato entre las HERRAMIENTAS del bot y las RUTAS del CRM. Solo lee.
 *
 *   node scripts/checks/contrato-tools-bot.check.mjs
 *
 * El problema que resuelve, con nombre y apellido: el 9/9/2026 se midió que el
 * bot había creado CERO presupuestos en 30 días, contra 827 hechos por
 * personas. No era que no quisiera — cada llamada le rebotaba con 400. La
 * descripción de `create_quote` decía "items (array con los productos
 * cotizados)" y "si no tiene ficha, llamala igual sin clientId", mientras la
 * ruta exigía `clientId` y un `productId` del catálogo en CADA ítem.
 *
 * Nadie podía darse cuenta: la descripción es el contrato que lee el MODELO y
 * vive en wa-service; la validación vive en el CRM. Son dos archivos que nadie
 * cambia junto, en dos servicios distintos, y el síntoma es silencioso — el bot
 * sigue conversando como si nada.
 *
 * Este check ata las dos puntas: por cada ruta de /api/bot, saca los campos que
 * valida como obligatorios (`if (!campo …) → 400`) y verifica que la
 * descripción de la herramienta que la llama los nombre. No prueba que el
 * modelo obedezca; prueba que al menos se le haya DICHO.
 */
import { readFileSync as leerCrudo } from 'node:fs';
import { join } from 'node:path';

/**
 * Leer normalizando los finales de línea.
 *
 * El repo se clona con `core.autocrlf` activo: en un checkout limpio (CI, un
 * worktree nuevo) los archivos vienen con CRLF aunque en la copia de trabajo se
 * vean con LF. Un patrón que termine en `",\n` no matchea `",\r\n`, y el check
 * pasa en la máquina de quien lo escribió y falla en CI diciendo cualquier cosa
 * — exactamente lo que pasó la primera vez que se subió este archivo.
 */
const readFileSync = (ruta, enc = 'utf8') => leerCrudo(ruta, enc).replace(/\r\n/g, '\n');

const RAIZ = new URL('../../', import.meta.url).pathname;
const fallas = [];
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => { fallas.push(m); console.log(`  ❌ ${m}`); };

/** Qué herramienta llama a qué ruta. Se mantiene a mano a propósito: es el mapa
 *  del contrato, y que alguien tenga que tocarlo al agregar una tool es la idea. */
/**
 * `derivados`: campos que la ruta exige pero que el MODELO no tiene que
 * conocer, porque los arma el código de la herramienta a partir de otro dato.
 * Van declarados uno por uno, con de dónde salen: si mañana alguien borra esa
 * derivación, el campo deja de llegar y este check no lo va a ver — por eso el
 * comentario es parte del contrato, no decoración.
 */
const CONTRATO = [
    { tool: 'create_quote', ruta: 'orders/route.ts', metodo: 'POST' },
    { tool: 'save_prescription_data', ruta: 'prescriptions/route.ts', metodo: 'POST' },
    { tool: 'create_task', ruta: 'tasks/route.ts', metodo: 'POST' },
    { tool: 'add_interaction', ruta: 'interactions/route.ts', metodo: 'POST' },
    {
        tool: 'agendar_turno', ruta: 'tasks/route.ts', metodo: 'POST',
        // El turno se guarda como ClientTask: `description` la arma tools.js
        // ("📅 TURNO <cuándo> — <motivo>") a partir de fechaHora y motivo.
        derivados: ['description'],
    },
    {
        tool: 'send_quote_pdf', ruta: 'orders/[id]/send-pdf/route.ts', metodo: 'POST',
        // `formattedPhone` lo deriva tools.js del chatId (`chatId.split('@')[0]`)
        // a propósito: al modelo NUNCA se le pide un teléfono — es la regla que
        // evita que mande el PDF al número que leyó en una receta.
        derivados: ['formattedPhone'],
    },
];

/**
 * Campos que la ruta lee DENTRO de cada ítem del array (`it.productId`,
 * `it.eye`). Sin esto el check no habría atrapado el bug que lo motivó: la
 * descripción vieja de `create_quote` SÍ nombraba 'items' y 'clientId' — lo que
 * faltaba era decir que cada ítem tiene que traer el `productId` del catálogo,
 * un nivel más adentro. Un contrato no se cumple nombrando el sobre: hay que
 * decir qué va adentro.
 */
function camposDeItem(fuente) {
    const campos = new Set();
    for (const m of fuente.matchAll(/\b(?:it|item|linea|l)\s*(?::\s*any)?\s*\)?\s*=>[\s\S]{0,200}?\b(?:it|item|linea|l)\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
        campos.add(m[1]);
    }
    for (const m of fuente.matchAll(/\bit\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) campos.add(m[1]);
    return [...campos];
}

/** Campos que la ruta rechaza con 400 si faltan: `if (!a || !b)`. */
function camposObligatorios(fuente) {
    const campos = new Set();
    // if (!clientId || !items || items.length === 0)
    for (const m of fuente.matchAll(/if\s*\(([^)]*?)\)\s*\{[\s\S]{0,220}?status:\s*400/g)) {
        for (const c of m[1].matchAll(/!\s*([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
            const nombre = c[1];
            if (['res', 'body', 'request', 'req', 'session', 'user'].includes(nombre)) continue;
            campos.add(nombre);
        }
    }
    return [...campos];
}

const toolsSrc = readFileSync(join(RAIZ, 'wa-service/agent-tools.js'), 'utf8');

console.log('\nContrato herramientas del bot ↔ rutas del CRM\n');
for (const { tool, ruta, metodo, derivados = [] } of CONTRATO) {
    let fuente;
    try {
        fuente = readFileSync(join(RAIZ, 'src/app/api/bot', ruta), 'utf8');
    } catch {
        mal(`${tool}: no existe la ruta src/app/api/bot/${ruta}`);
        continue;
    }
    // Solo el cuerpo del método que corresponde.
    const desde = fuente.indexOf(`export async function ${metodo}`);
    const cuerpo = desde >= 0 ? fuente.slice(desde) : fuente;
    const obligatorios = camposObligatorios(cuerpo);

    // La descripción que lee el modelo.
    const i = toolsSrc.indexOf(`name: "${tool}"`);
    if (i < 0) { mal(`${tool}: no se encontró la herramienta en agent-tools.js`); continue; }
    const trozo = toolsSrc.slice(i, i + 4000);
    const desc = (trozo.match(/description:\s*"([\s\S]*?)",\n/) || [])[1] || '';
    if (!desc) { mal(`${tool}: no se pudo leer su description`); continue; }

    // Un campo derivado no tiene por qué estar en la descripción, pero SÍ tiene
    // que seguir armándose en el código de la herramienta.
    const toolsImpl = readFileSync(join(RAIZ, 'wa-service/tools.js'), 'utf8');
    for (const d of derivados) {
        if (!toolsImpl.includes(d)) {
            mal(`${tool}: '${d}' está declarado como derivado pero ya no se arma en wa-service/tools.js`);
        }
    }
    const deItem = camposDeItem(cuerpo).filter(c => !['length', 'map', 'filter', 'some', 'find', 'id'].includes(c));
    const faltan = obligatorios.filter(c => !desc.includes(c) && !derivados.includes(c));
    const faltanDeItem = deItem.filter(c => !desc.includes(c));
    if (obligatorios.length === 0) {
        ok(`${tool}: la ruta no exige campos con 400 (nada que contrastar)`);
    } else if (faltanDeItem.length > 0) {
        mal(`${tool}: la ruta lee [${faltanDeItem.join(', ')}] dentro de cada ítem y la descripción NO lo dice → el modelo manda ítems incompletos y la ruta los rechaza`);
    } else if (faltan.length === 0) {
        const detalle = derivados.length
            ? ` (${obligatorios.join(', ')}; ${derivados.join(', ')} lo deriva el código)`
            : ` (${obligatorios.join(', ')}${deItem.length ? ` · por ítem: ${deItem.join(', ')}` : ''})`;
        ok(`${tool}: el contrato cierra${detalle}`);
    } else {
        mal(`${tool}: la ruta rechaza sin [${faltan.join(', ')}] y la descripción NO los nombra → toda llamada del bot va a fallar con 400`);
    }
}

console.log('');
if (fallas.length) {
    console.error(`❌ ${fallas.length} contrato(s) rotos. El bot va a llamar y la ruta va a rechazar, en silencio.`);
    process.exit(1);
}
console.log('✅ Cada herramienta le dice al modelo lo que su ruta exige.');
