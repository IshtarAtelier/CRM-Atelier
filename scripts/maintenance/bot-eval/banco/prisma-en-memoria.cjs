'use strict';
/**
 * Un Prisma EN MEMORIA, suficiente para el turno del bot y la ruta de precios.
 *
 * No habla con ninguna base: cada modelo es un array. Entiende los filtros que
 * usan el wa-service y /api/bot/pricing (AND/OR/NOT, equals, in, notIn, not,
 * lt/lte/gt/gte, contains/startsWith/endsWith con mode insensitive, some/every/none
 * sobre relaciones embebidas), orderBy (con { sort, nulls }), take, y resuelve
 * las relaciones que pide el turno (chat → client → tags/prescriptions/interactions,
 * order → payments). Toda escritura queda en `registro.escrituras`.
 */

const RELACIONES = {
    whatsAppChat: { client: { modelo: 'client', uno: true, local: 'clientId' } },
    client: {
        tags: { modelo: 'tag', porIds: 'tagIds' },
        prescriptions: { modelo: 'prescription', clave: 'clientId' },
        interactions: { modelo: 'interaction', clave: 'clientId' },
        orders: { modelo: 'order', clave: 'clientId' },
    },
    order: { payments: { modelo: 'payment', clave: 'orderId' } },
    whatsAppMessage: { chat: { modelo: 'whatsAppChat', uno: true, local: 'chatId' } },
};

// Defaults del schema que el código da por hechos (@default(now()) etc.). Sin
// esto un saliente del bot quedaba sin receivedAt y el orden de llegada lo
// mandaba al fondo del historial.
const DEFAULTS = { whatsAppMessage: () => ({ receivedAt: new Date() }) };
const nuevaFila = (modelo) => ({ id: `cmem${(++contadorIds).toString().padStart(21, '0')}`, createdAt: new Date(), ...(DEFAULTS[modelo] ? DEFAULTS[modelo]() : {}) });
let contadorIds = 0;

function valor(v) { return v instanceof Date ? v.getTime() : v; }
function texto(v, insensible) { const s = v == null ? '' : String(v); return insensible ? s.toLowerCase() : s; }

function cumpleCampo(v, cond) {
    if (cond === null) return v === null || v === undefined;
    if (cond instanceof Date || typeof cond !== 'object') return valor(v) === valor(cond);
    if (Array.isArray(v) && (cond.some || cond.every || cond.none)) {
        if (cond.some) return v.some(x => cumple(x, cond.some));
        if (cond.every) return v.every(x => cumple(x, cond.every));
        if (cond.none) return !v.some(x => cumple(x, cond.none));
    }
    const ins = cond.mode === 'insensitive';
    for (const [op, c] of Object.entries(cond)) {
        switch (op) {
            case 'mode': break;
            case 'equals': if (valor(v) !== valor(c)) return false; break;
            case 'in': if (!c.map(valor).includes(valor(v))) return false; break;
            case 'notIn': if (v != null && c.map(valor).includes(valor(v))) return false; if (v == null) return false; break;
            case 'not': if (c !== null && typeof c === 'object' && !(c instanceof Date)) { if (v == null || cumpleCampo(v, c)) return false; } else if (valor(v) === valor(c) || (c === null && v == null)) return false; break;
            case 'lt': if (v == null || !(valor(v) < valor(c))) return false; break;
            case 'lte': if (v == null || !(valor(v) <= valor(c))) return false; break;
            case 'gt': if (v == null || !(valor(v) > valor(c))) return false; break;
            case 'gte': if (v == null || !(valor(v) >= valor(c))) return false; break;
            case 'contains': if (v == null || !texto(v, ins).includes(texto(c, ins))) return false; break;
            case 'startsWith': if (v == null || !texto(v, ins).startsWith(texto(c, ins))) return false; break;
            case 'endsWith': if (v == null || !texto(v, ins).endsWith(texto(c, ins))) return false; break;
            case 'has': if (!Array.isArray(v) || !v.includes(c)) return false; break;
            case 'hasSome': if (!Array.isArray(v) || !c.some(x => v.includes(x))) return false; break;
            case 'isEmpty': if (!Array.isArray(v) || (v.length === 0) !== c) return false; break;
            default:
                // Relación 1-a-1 con filtro anidado (p.ej. client: { name: ... })
                if (v && typeof v === 'object' && !Array.isArray(v)) return cumple(v, cond);
                return false;
        }
    }
    return true;
}

function cumple(fila, where) {
    if (!where) return true;
    for (const [k, c] of Object.entries(where)) {
        if (c === undefined) continue;
        if (k === 'AND') { if (!(Array.isArray(c) ? c : [c]).every(w => cumple(fila, w))) return false; continue; }
        if (k === 'OR') { if (!c.some(w => cumple(fila, w))) return false; continue; }
        if (k === 'NOT') { if ((Array.isArray(c) ? c : [c]).some(w => cumple(fila, w))) return false; continue; }
        if (!cumpleCampo(fila[k], c)) return false;
    }
    return true;
}

function ordenar(filas, orderBy) {
    if (!orderBy) return filas;
    const criterios = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap(o => Object.entries(o));
    return [...filas].sort((a, b) => {
        for (const [campo, spec] of criterios) {
            const dir = typeof spec === 'string' ? spec : spec.sort;
            const nulls = typeof spec === 'object' ? spec.nulls : null;
            const va = valor(a[campo]); const vb = valor(b[campo]);
            if (va == null && vb == null) continue;
            if (va == null) return nulls === 'first' ? -1 : 1;
            if (vb == null) return nulls === 'first' ? 1 : -1;
            if (va === vb) continue;
            const r = typeof va === 'string' ? va.localeCompare(vb, 'es') : (va < vb ? -1 : 1);
            return dir === 'desc' ? -r : r;
        }
        return 0;
    });
}

function crearPrismaEnMemoria({ registro }) {
    const tablas = new Map();
    const t = (m) => { if (!tablas.has(m)) tablas.set(m, []); return tablas.get(m); };
    let n = 0;

    function resolver(modelo, fila, spec) {
        if (!fila || !spec || typeof spec !== 'object') return fila;
        const out = { ...fila };
        const rels = RELACIONES[modelo] || {};
        for (const [k, v] of Object.entries(spec)) {
            const rel = rels[k];
            if (!rel || !v) continue;
            const sub = typeof v === 'object' ? v : {};
            if (rel.uno) {
                const f = t(rel.modelo).find(x => x.id === fila[rel.local]) || null;
                out[k] = f ? resolver(rel.modelo, f, sub.include || sub.select) : null;
            } else {
                let lista = rel.porIds ? t(rel.modelo).filter(x => (fila[rel.porIds] || []).includes(x.id))
                    : t(rel.modelo).filter(x => x[rel.clave] === fila.id);
                if (sub.where) lista = lista.filter(x => cumple(x, sub.where));
                lista = ordenar(lista, sub.orderBy);
                if (sub.take) lista = lista.slice(0, sub.take);
                out[k] = lista.map(x => resolver(rel.modelo, x, sub.include || sub.select));
            }
        }
        return out;
    }

    function anotar(modelo, op, args) {
        registro.escrituras.push({ modelo, op, where: args && args.where ? JSON.stringify(args.where).slice(0, 200) : null, data: args && (args.data || args.create) ? JSON.stringify(args.data || args.create).slice(0, 300) : null });
    }

    function aplicarData(fila, data) {
        for (const [k, v] of Object.entries(data || {})) {
            if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
                if ('increment' in v) { fila[k] = (fila[k] || 0) + v.increment; continue; }
                if ('set' in v) { fila[k] = v.set; continue; }
                if ('push' in v) { fila[k] = [...(fila[k] || []), ...[].concat(v.push)]; continue; }
                if ('connect' in v) {
                    const ids = [].concat(v.connect).map(x => x.id || x.name).filter(Boolean);
                    if (k === 'tags') fila.tagIds = [...new Set([...(fila.tagIds || []), ...ids.map(i => (t('tag').find(x => x.id === i || x.name === i) || {}).id).filter(Boolean)])];
                    continue;
                }
                if ('connectOrCreate' in v || 'create' in v || 'disconnect' in v) continue;
            }
            fila[k] = v;
        }
        return fila;
    }

    function modelo(nombre) {
        return {
            findUnique: async (a = {}) => resolver(nombre, t(nombre).find(x => cumple(x, a.where)) || null, a.include || a.select),
            findFirst: async (a = {}) => resolver(nombre, ordenar(t(nombre).filter(x => cumple(x, a.where)), a.orderBy)[0] || null, a.include || a.select),
            findMany: async (a = {}) => {
                let l = ordenar(t(nombre).filter(x => cumple(x, a.where)), a.orderBy);
                if (a.skip) l = l.slice(a.skip);
                if (a.take) l = l.slice(0, a.take);
                return l.map(x => resolver(nombre, x, a.include || a.select));
            },
            count: async (a = {}) => t(nombre).filter(x => cumple(x, a.where)).length,
            aggregate: async () => ({ _count: 0, _sum: {}, _max: {}, _min: {} }),
            groupBy: async () => [],
            create: async (a) => { anotar(nombre, 'create', a); const f = aplicarData(nuevaFila(nombre), a.data); t(nombre).push(f); return f; },
            createMany: async (a) => { anotar(nombre, 'createMany', a); for (const d of [].concat(a.data)) t(nombre).push(aplicarData(nuevaFila(nombre), d)); return { count: [].concat(a.data).length }; },
            update: async (a) => {
                anotar(nombre, 'update', a);
                const f = t(nombre).find(x => cumple(x, a.where));
                if (!f) { const e = new Error(`[memoria] ${nombre}.update: no existe`); e.code = 'P2025'; throw e; }
                return aplicarData(f, a.data);
            },
            updateMany: async (a) => { anotar(nombre, 'updateMany', a); const l = t(nombre).filter(x => cumple(x, a.where)); l.forEach(f => aplicarData(f, a.data)); return { count: l.length }; },
            upsert: async (a) => {
                anotar(nombre, 'upsert', a);
                const f = t(nombre).find(x => cumple(x, a.where));
                if (f) return aplicarData(f, a.update);
                const nueva = aplicarData(nuevaFila(nombre), { ...a.where, ...a.create });
                t(nombre).push(nueva);
                return nueva;
            },
            delete: async (a) => { anotar(nombre, 'delete', a); const l = t(nombre); const i = l.findIndex(x => cumple(x, a.where)); return i >= 0 ? l.splice(i, 1)[0] : null; },
            deleteMany: async (a = {}) => { anotar(nombre, 'deleteMany', a); const l = t(nombre); const quedan = l.filter(x => !cumple(x, a.where)); const c = l.length - quedan.length; tablas.set(nombre, quedan); return { count: c }; },
        };
    }

    const base = {
        _sembrar: (m, fila) => { const f = { ...fila }; t(m).push(f); return f; },
        _filas: (m) => t(m),
        _vaciar: (m) => tablas.set(m, []),
        $connect: async () => {},
        $disconnect: async () => {},
        $on: () => {},
        $use: () => {},
        $extends: () => proxy,
        $queryRaw: async () => [],
        $queryRawUnsafe: async () => [],
        $executeRaw: async (...a) => { registro.escrituras.push({ modelo: '$executeRaw', op: 'raw', data: String(a[0]).slice(0, 120) }); return 0; },
        $executeRawUnsafe: async (...a) => { registro.escrituras.push({ modelo: '$executeRaw', op: 'raw', data: String(a[0]).slice(0, 120) }); return 0; },
        $transaction: async (x) => (typeof x === 'function' ? x(proxy) : Promise.all(x)),
    };
    const modelos = new Map();
    const proxy = new Proxy(base, {
        get(obj, prop) {
            if (prop in obj) return obj[prop];
            if (typeof prop !== 'string' || prop === 'then') return undefined;
            if (!modelos.has(prop)) modelos.set(prop, modelo(prop));
            return modelos.get(prop);
        },
    });
    return proxy;
}

module.exports = { crearPrismaEnMemoria, cumple };
