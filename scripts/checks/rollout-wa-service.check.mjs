/**
 * Toda llamada del wa-service a `whatsAppChat` que devuelve una fila lleva
 * `select` explícito. Sin base, sin red, sin .env, sin node_modules (también
 * en CI): solo lee el código fuente.
 *
 *   npm run check:rollout-wa
 *
 * Dos capas, las dos acá:
 *   1. el wa-service migra la base ANTES de cargar el transporte, y si no
 *      puede, no arranca (shared/migrar-al-arrancar.js);
 *   2. toda llamada a whatsAppChat que devuelve filas lleva `select`.
 *
 * Por qué (auditoría del 15/10/2026): el wa-service genera su cliente Prisma
 * con el schema del repo. Si sale a producción antes que la migración, una
 * lectura sin `select` pide TODAS las columnas que el cliente conoce —también
 * las nuevas— y la base contesta P2022 ("column does not exist").
 * persistInbound (transport/inbound.js) hacía eso con cada entrante, y como el
 * webhook ya le contestó 200 a Meta, el mensaje se perdía. Hoy el wa-service
 * migra al arrancar (shared/migrar-al-arrancar.js); esto es la segunda capa:
 * aunque la migración falle o se fuerce el arranque, leer y guardar chats sigue
 * andando con las columnas viejas.
 *
 * Ojo: `update`, `upsert`, `create` y `delete` TAMBIÉN devuelven la fila entera
 * (RETURNING de todas las columnas), así que también necesitan `select`.
 * `include` sin `select` no alcanza: trae todas las columnas del chat.
 * Las variantes `*Many` / `count` / `aggregate` no devuelven filas del chat.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WA = path.join(RAIZ, 'wa-service');

const OPERACIONES = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'update', 'upsert', 'create', 'delete'];
const MODELOS = ['whatsAppChat'];

/** Excluidos A PROPÓSITO, cada uno con su razón. */
const EXCLUIDOS = {
    'index.js': 'transporte legacy (WhatsApp Web): start.js no lo carga sin WA_ALLOW_LEGACY=1, y volver a él exige migrar a mano',
    'test_followups.js': 'script manual de prueba: no corre dentro del servicio',
    'test_meta_chats.js': 'script manual de prueba: no corre dentro del servicio',
};

function archivos(dir) {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...archivos(p));
        else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
}

/**
 * Devuelve el texto con comentarios y el CONTENIDO de los strings en blanco
 * (mismas posiciones), para contar llaves sin que un "{" en un texto engañe.
 * Los template literals con ${} se dejan como código adentro de las llaves.
 */
export function limpiar(src) {
    const out = src.split('');
    let i = 0;
    const tapar = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
    const pila = []; // template literals abiertos
    while (i < src.length) {
        const c = src[i], d = src[i + 1];
        if (pila.length && pila[pila.length - 1].enTexto) {
            const ini = i;
            while (i < src.length && src[i] !== '`' && !(src[i] === '$' && src[i + 1] === '{')) { if (src[i] === '\\') i++; i++; }
            tapar(ini, i);
            if (src[i] === '`') { pila.pop(); i++; } else { pila[pila.length - 1].enTexto = false; pila[pila.length - 1].prof = 0; i += 2; }
            continue;
        }
        if (c === '/' && d === '/') { const ini = i; while (i < src.length && src[i] !== '\n') i++; tapar(ini, i); continue; }
        if (c === '/' && d === '*') { const ini = i; i = src.indexOf('*/', i + 2); i = i === -1 ? src.length : i + 2; tapar(ini, i); continue; }
        if (c === '"' || c === "'") {
            const ini = ++i;
            while (i < src.length && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') i++; i++; }
            tapar(ini, i); i++; continue;
        }
        if (c === '`') { pila.push({ enTexto: true }); i++; continue; }
        if (pila.length && !pila[pila.length - 1].enTexto) {
            const t = pila[pila.length - 1];
            if (c === '{') t.prof++;
            else if (c === '}') { if (t.prof === 0) { t.enTexto = true; i++; continue; } t.prof--; }
        }
        i++;
    }
    return out.join('');
}

/** Claves de primer nivel del objeto literal que empieza en `ini` (un '{'). */
function clavesDePrimerNivel(txt, ini) {
    let prof = 0;
    const claves = [];
    let esperandoClave = true;
    for (let i = ini; i < txt.length; i++) {
        const c = txt[i];
        if (c === '{' || c === '(' || c === '[') { prof++; if (prof > 1) esperandoClave = false; continue; }
        if (c === '}' || c === ')' || c === ']') { prof--; if (prof === 0) return claves; continue; }
        if (prof !== 1) continue;
        if (c === ',') { esperandoClave = true; continue; }
        if (esperandoClave && /[A-Za-z_$.]/.test(c)) {
            const m = /^(\.\.\.)?[A-Za-z_$][\w$]*/.exec(txt.slice(i));
            if (m) { claves.push(m[0]); i += m[0].length - 1; esperandoClave = false; }
        } else if (esperandoClave && c === '.') {
            const m = /^\.\.\.[A-Za-z_$][\w$.]*/.exec(txt.slice(i));
            if (m) { claves.push(m[0]); i += m[0].length - 1; esperandoClave = false; }
        }
    }
    return claves;
}

/** Encuentra las llamadas sin `select` en un fuente. */
export function llamadasSinSelect(src) {
    const txt = limpiar(src);
    const re = new RegExp(`\\.(${MODELOS.join('|')})\\s*\\.\\s*(${OPERACIONES.join('|')})\\s*\\(`, 'g');
    const fallas = [];
    let m;
    while ((m = re.exec(txt))) {
        const linea = txt.slice(0, m.index).split('\n').length;
        let j = m.index + m[0].length;
        while (/\s/.test(txt[j])) j++;
        if (txt[j] !== '{') { fallas.push({ linea, op: `${m[1]}.${m[2]}`, razon: 'el argumento no es un objeto literal (no se puede ver si lleva select)' }); continue; }
        const claves = clavesDePrimerNivel(txt, j);
        if (!claves.includes('select')) {
            fallas.push({ linea, op: `${m[1]}.${m[2]}`, razon: claves.includes('include') ? 'usa include sin select (trae todas las columnas)' : 'sin select' });
        }
    }
    return fallas;
}

// ── Autoprueba del detector (que pueda fallar) ──────────────────────────────
let errores = 0;
const prueba = (nombre, src, esperadas) => {
    const n = llamadasSinSelect(src).length;
    if (n !== esperadas) { errores++; console.log(`  ❌ autoprueba "${nombre}": esperaba ${esperadas} falla(s), dio ${n}`); }
};
prueba('findUnique sin select', 'await prisma.whatsAppChat.findUnique({ where: { waId } });', 1);
prueba('con select', 'await prisma.whatsAppChat.findUnique({ where: { waId }, select: { id: true } });', 0);
prueba('select anidado no cuenta', 'prisma.whatsAppChat.findFirst({ where: { client: { select: 1 } } })', 1);
prueba('update sin select', 'prisma.whatsAppChat.update({ where: { id }, data })', 1);
prueba('upsert con select', 'tx.whatsAppChat.upsert({ where: { waId }, create: {}, update: {}, select: SEL })', 0);
prueba('include sin select', 'prisma.whatsAppChat.findUnique({ where: { id }, include: { client: true } })', 1);
prueba('argumento variable', 'prisma.whatsAppChat.findMany(args)', 1);
prueba('updateMany no devuelve filas', 'prisma.whatsAppChat.updateMany({ where: {}, data: {} })', 0);
prueba('comentario no cuenta', '// prisma.whatsAppChat.findUnique({ where: { id } })\nconst a = 1;', 0);
prueba('string con llave', "prisma.whatsAppChat.update({ where: { id: '}' }, data: { a: `x${'{'}` } })", 1);
prueba('select shorthand', 'prisma.whatsAppChat.findUnique({ where, select })', 0);
prueba('select con spread', 'prisma.whatsAppChat.findUnique({ where, select: { ...SEL, a: true } })', 0);

// ── El código de verdad ─────────────────────────────────────────────────────
let total = 0;
const listado = [];
for (const f of archivos(WA)) {
    const rel = path.relative(WA, f);
    if (EXCLUIDOS[rel]) continue;
    for (const x of llamadasSinSelect(fs.readFileSync(f, 'utf8'))) {
        total++;
        listado.push(`  ❌ wa-service/${rel}:${x.linea} ${x.op} — ${x.razon}`);
    }
}

// ── Capa 1: migrar al arrancar ──────────────────────────────────────────────
console.log('El wa-service migra antes de arrancar');
const { migrarAlArrancar } = require('../../wa-service/shared/migrar-al-arrancar.js');
const mudo = { log() {}, warn() {}, error() {} };
const capa1 = async () => {
    const correrQue = (resultados) => { let n = 0; const f = () => resultados[Math.min(n++, resultados.length - 1)]; f.veces = () => n; return f; };
    const base = { env: { DATABASE_URL: 'postgres://x' }, schema: '/app/prisma/schema.prisma', esperas: [0, 0, 0], esperar: async () => {}, consola: mudo,
        verificar: async () => ({ ok: false, faltan: ['WhatsAppMessage.receivedAt'] }), avisar: async () => true };
    const casos = [
        ['migra bien → arranca', { correr: correrQue([{ ok: true }]) }, true, 1],
        ['falla dos veces (lock de otra instancia) y después anda → arranca', { correr: correrQue([{ ok: false, error: 'lock' }, { ok: false, error: 'lock' }, { ok: true }]) }, true, 3],
        ['falla siempre + columnas presentes → arranca (con aviso)', { correr: correrQue([{ ok: false, error: 'pooler sin advisory lock' }]), verificar: async () => ({ ok: true, faltan: [] }) }, true, 4],
        ['falla siempre + faltan columnas → NO arranca', { correr: correrQue([{ ok: false, error: 'x' }]), verificar: async () => ({ ok: false, faltan: ['WhatsAppChat.lastInboundAt'] }) }, false, 4],
        ['falla siempre + no se pudo verificar → NO arranca', { correr: correrQue([{ ok: false, error: 'x' }]), verificar: async () => ({ ok: false, faltan: [], error: 'conexión' }) }, false, 4],
        ['falla siempre → NO arranca (Meta reintenta; arrancar perdería entrantes)', { correr: correrQue([{ ok: false, error: 'x' }]) }, false, 4],
        ['falla siempre con WA_ARRANCAR_SIN_MIGRAR=1 → arranca igual', { correr: correrQue([{ ok: false, error: 'x' }]), env: { DATABASE_URL: 'x', WA_ARRANCAR_SIN_MIGRAR: '1' } }, true, 4],
        ['WA_SALTEAR_MIGRACION=1 → no migra', { correr: correrQue([{ ok: false }]), env: { DATABASE_URL: 'x', WA_SALTEAR_MIGRACION: '1' } }, true, 0],
        ['sin schema → NO arranca', { correr: correrQue([{ ok: true }]), schema: null }, false, 0],
    ];
    for (const [nombre, o, arrancar, veces] of casos) {
        const r = await migrarAlArrancar({ ...base, ...o });
        const v = o.correr.veces();
        if (r.arrancar !== arrancar || v !== veces) { errores++; console.log(`  ❌ ${nombre} (arrancar=${r.arrancar}, intentos=${v})`); }
        else console.log(`  ✅ ${nombre}`);
    }
    // Peor caso antes de decidir: holgado dentro del healthcheck de Railway (300 s).
    const { ESPERAS_ENTRE_INTENTOS_MS: E, TOPE_POR_INTENTO_MS: T } = require('../../wa-service/shared/migrar-al-arrancar.js');
    const peor = (E.length + 1) * T + E.reduce((a, b) => a + b, 0);
    if (!T || peor > 200000) { errores++; console.log(`  ❌ peor caso de migración ${Math.round(peor / 1000)} s: no entra holgado en el healthcheck de 300 s`); }
    else console.log(`  ✅ peor caso de migración ${Math.round(peor / 1000)} s (healthcheck 300 s)`);
    // La lista de columnas requeridas cubre CHAT_BASE y receivedAt.
    const { CHAT_BASE, COLUMNAS_REQUERIDAS: REQ } = require('../../wa-service/shared/columnas-chat.js');
    const faltaReq = Object.keys(CHAT_BASE).filter(c => !REQ.WhatsAppChat.includes(c));
    if (faltaReq.length || !REQ.WhatsAppMessage.includes('receivedAt')) { errores++; console.log('  ❌ COLUMNAS_REQUERIDAS no cubre CHAT_BASE + WhatsAppMessage.receivedAt'); }
    else console.log('  ✅ COLUMNAS_REQUERIDAS cubre CHAT_BASE y WhatsAppMessage.receivedAt');
    // start.js tiene que esperar la migración ANTES de cargar el transporte.
    const start = fs.readFileSync(path.join(WA, 'start.js'), 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '');
    const iMig = start.indexOf('migrarAlArrancar(');
    const iCloud = start.indexOf("require('./cloud')");
    if (iMig === -1 || iCloud === -1 || iCloud < iMig || !/\.then\(/.test(start.slice(iMig, iCloud))) { errores++; console.log('  ❌ start.js carga el transporte sin esperar migrarAlArrancar()'); }
    else console.log('  ✅ start.js carga el transporte recién después de migrar');
    // Migraciones que tocan las tablas del bot: aditivas e idempotentes
    // (corren en cada arranque de cada instancia).
    const dirMig = path.join(RAIZ, 'prisma', 'migrations');
    for (const d of fs.readdirSync(dirMig).filter(x => x >= '20261015')) {
        const f = path.join(dirMig, d, 'migration.sql');
        if (!fs.existsSync(f)) continue;
        const sql = fs.readFileSync(f, 'utf8').replace(/--.*$/gm, '');
        if (!/"WhatsApp(Chat|Message)"/.test(sql)) continue;
        const malas = sql.split(';').map(x => x.trim()).filter(Boolean).filter(x => /"WhatsApp(Chat|Message)"/.test(x))
            .filter(x => /DROP|RENAME|SET NOT NULL|ALTER COLUMN .* TYPE/i.test(x) || (/ADD COLUMN/i.test(x) && !/IF NOT EXISTS/i.test(x)) || (/ADD COLUMN/i.test(x) && /NOT NULL/i.test(x) && !/DEFAULT/i.test(x)));
        if (malas.length) { errores++; console.log(`  ❌ ${d}: no es aditiva/idempotente → ${malas[0].slice(0, 90)}`); }
        else console.log(`  ✅ ${d}: aditiva e idempotente`);
    }
};
await capa1();

console.log('select explícito en whatsAppChat (wa-service)');
for (const [f, r] of Object.entries(EXCLUIDOS)) console.log(`  ↪ excluido wa-service/${f}: ${r}`);
listado.forEach(l => console.log(l));
if (errores || total) {
    console.log(`\n❌ ${total} llamada(s) sin select${errores ? ` y ${errores} control(es) del arranque o autoprueba(s) rota(s)` : ''}.`);
    if (total) console.log('   Agregá `select` con las columnas que de verdad usás: sin él, un deploy del wa-service antes que la migración pierde entrantes (P2022).');
    process.exit(1);
}
console.log('✅ El wa-service migra antes de arrancar y toda llamada que devuelve un chat pide columnas explícitas.');
