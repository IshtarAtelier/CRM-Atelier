'use strict';
/**
 * Entorno AISLADO para correr el turno real del bot de WhatsApp sin que nada
 * salga de la máquina, salvo las llamadas a Gemini.
 *
 * Qué reemplaza (antes de que se cargue un solo módulo del wa-service):
 *   - `wa-service/db.js` y `@prisma/client` → una base EN MEMORIA (prisma-en-memoria.cjs).
 *     Las escrituras quedan en memoria y en el registro `escrituras`.
 *   - `wa-service/transport/cloud-transport.js` → transporte falso: pasa por el
 *     MISMO punto de salida que el real (`conPuntoDeSalida`) y solo registra.
 *   - `axios` → cliente falso que atiende el CRM (`/api/bot/*`) acá adentro.
 *     `/pricing` corre la RUTA REAL del repo (src/app/api/bot/pricing/route.ts)
 *     contra la base en memoria cargada con el catálogo de producción.
 *     Todo lo demás (tareas, notas, quejas, PDFs…) se registra y devuelve un OK realista.
 *   - `nodemailer` → no manda nada.
 *   - Guardia de red: `fetch`, `http.request` y `https.request` solo pueden ir a
 *     Gemini (generativelanguage.googleapis.com). Cualquier otro destino se
 *     registra en `bloqueos` y falla (o, para el HEAD de fotos del sitio, se
 *     contesta 200 sin salir).
 *
 * No hay forma de que un mensaje llegue a WhatsApp: el transporte real nunca se carga.
 */

const path = require('path');
const Module = require('module');
const http = require('http');
const https = require('https');
const { crearPrismaEnMemoria } = require('./prisma-en-memoria.cjs');

const RAIZ = path.resolve(__dirname, '../../../..');
const WA = path.join(RAIZ, 'wa-service');
const CRM_FALSO = 'http://crm-falso.invalid/api/bot';

const HOSTS_PERMITIDOS = new Set(['generativelanguage.googleapis.com', 'aiplatform.googleapis.com', 'oauth2.googleapis.com']);
const hostPermitido = (h) => HOSTS_PERMITIDOS.has(h) || /^[a-z0-9-]+-aiplatform\.googleapis\.com$/.test(h);

function crearEntorno({ fixtures, modeloFalso = null }) {
    const registro = { escrituras: [], crm: [], envios: [], bloqueos: [], pricing: [], mails: [] };
    const prisma = crearPrismaEnMemoria({ registro });

    // ── Datos de producción (solo lectura, ya volcados a JSON) ──
    for (const p of fixtures.productos) prisma._sembrar('product', { ...p, webProducts: p.webProducts || [] });
    prisma._sembrar('systemSetting', { key: 'bot_enabled', value: 'true' });
    for (const s of fixtures.settings) if (s.key !== 'bot_enabled') prisma._sembrar('systemSetting', s);
    for (const t of fixtures.tags) prisma._sembrar('tag', t);

    // ── Guardia de red ──
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        if (hostPermitido(url.hostname)) return fetchOriginal(input, init);
        registro.bloqueos.push({ via: 'fetch', url: url.origin + url.pathname, metodo: (init && init.method) || 'GET' });
        if (url.hostname.endsWith('atelieroptica.com.ar') && (init && init.method) === 'HEAD') {
            return new Response(null, { status: 200, headers: { 'content-type': 'image/jpeg' } });
        }
        throw new Error(`[entorno aislado] red bloqueada: ${url.hostname}`);
    };
    for (const mod of [http, https]) {
        for (const fn of ['request', 'get']) {
            const orig = mod[fn];
            mod[fn] = function (...args) {
                const a = args[0];
                const host = typeof a === 'string' ? new URL(a).hostname : (a instanceof URL ? a.hostname : (a && (a.hostname || a.host)) || '');
                if (hostPermitido(String(host).split(':')[0])) return orig.apply(this, args);
                registro.bloqueos.push({ via: `${mod === https ? 'https' : 'http'}.${fn}`, url: String(host) });
                throw new Error(`[entorno aislado] red bloqueada: ${host}`);
            };
        }
    }

    // ── Rutas del CRM ──
    let jiti = null;
    async function rutaDePricing() {
        if (!jiti) {
            const { createJiti } = require(path.join(RAIZ, 'node_modules/jiti'));
            jiti = createJiti(__filename, { alias: { '@': path.join(RAIZ, 'src') }, fsCache: false, moduleCache: true });
        }
        return jiti.import(path.join(RAIZ, 'src/app/api/bot/pricing/route.ts'));
    }
    async function tipoDeReceta() {
        await rutaDePricing();
        return jiti.import(path.join(RAIZ, 'src/lib/receta/tipo-de-lente.ts'));
    }

    let seq = 0;
    const id = (pre) => `c${pre}${Date.now().toString(36)}${(++seq).toString(36).padStart(4, '0')}fakeid`.slice(0, 25);

    async function atenderCrm(metodo, url, { params, data } = {}) {
        const ruta = url.replace(CRM_FALSO, '');
        registro.crm.push({ metodo, ruta, params: params || null, data: data || null, t: Date.now() });
        if (metodo === 'GET' && ruta === '/pricing') {
            const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
            const { GET } = await rutaDePricing();
            const res = await GET(new Request(`http://local/api/bot/pricing?${qs}`));
            const json = await res.json();
            registro.pricing.push({ params: params || {}, respuesta: json });
            return { status: 200, data: json };
        }
        if (metodo === 'GET' && ruta === '/clients') {
            const tel = String((params && params.phone) || '').replace(/\D/g, '').slice(-8);
            const c = tel ? prisma._filas('client').find(x => String(x.phone || '').replace(/\D/g, '').endsWith(tel)) : null;
            return { status: 200, data: c ? { found: true, client: c } : { found: false } };
        }
        if (metodo === 'POST' && ruta === '/clients') {
            if (data && data.id) {
                const c = prisma._filas('client').find(x => x.id === data.id);
                if (c) Object.assign(c, data);
                return { status: 200, data: c || data };
            }
            const c = prisma._sembrar('client', { id: id('cl'), status: 'CONTACT', ...data, createdAt: new Date() });
            return { status: 200, data: { client: c } };
        }
        if (metodo === 'GET' && ruta === '/orders') {
            const cid = params && params.clientId;
            const o = cid ? prisma._filas('order').find(x => x.clientId === cid && !x.isDeleted) : null;
            if (!o) return { status: 200, data: { found: false } };
            return { status: 200, data: { found: true, order: o, financials: o._financials || null } };
        }
        if (metodo === 'POST' && ruta === '/prescriptions') {
            const p = data || {};
            const { tipoDeRecetaSegunNumeros } = await tipoDeReceta();
            const fila = prisma._sembrar('prescription', {
                id: id('rx'), clientId: p.clientId, date: new Date(),
                sphereOD: p.odEsf ?? null, cylinderOD: p.odCil ?? null, axisOD: p.odEje ?? null,
                sphereOI: p.oiEsf ?? null, cylinderOI: p.oiCil ?? null, axisOI: p.oiEje ?? null,
                addition: p.add ?? null, additionOD: null, additionOI: null, pd: p.odDip || p.oiDip || null,
                nearSphereOD: null, nearSphereOI: null,
                prescriptionType: tipoDeRecetaSegunNumeros(p, p.tipoDeLente), notes: p.notes || null,
            });
            return { status: 200, data: fila };
        }
        if (metodo === 'POST' && /^\/orders\/[^/]+\/send-pdf$/.test(ruta)) return { status: 200, data: { success: true, sent: true } };
        if (metodo === 'POST' && ruta === '/orders') return { status: 200, data: { success: true, order: { id: id('or'), orderType: 'QUOTE', ...data } } };
        if (metodo === 'POST') return { status: 200, data: { success: true, id: id('x'), ...(data || {}) } };
        return { status: 200, data: { success: true } };
    }

    function crearClienteAxios() {
        const llamar = (metodo) => async (url, a, b) => {
            const cfg = metodo === 'GET' || metodo === 'DELETE' ? (a || {}) : (b || {});
            const data = metodo === 'GET' || metodo === 'DELETE' ? undefined : a;
            if (!String(url).startsWith(CRM_FALSO)) {
                registro.bloqueos.push({ via: 'axios', url: String(url).split('?')[0], metodo });
                const e = new Error(`[entorno aislado] axios bloqueado: ${url}`);
                e.code = 'ECONNREFUSED';
                throw e;
            }
            const r = await atenderCrm(metodo, String(url), { params: cfg.params, data });
            return { ...r, headers: {}, config: cfg };
        };
        const inst = {
            get: llamar('GET'), delete: llamar('DELETE'), post: llamar('POST'), put: llamar('PUT'), patch: llamar('PATCH'),
            request: (cfg) => llamar(String(cfg.method || 'GET').toUpperCase())(cfg.url, cfg.data ?? cfg, cfg),
            defaults: { headers: { common: {} } },
            interceptors: { request: { use() {} }, response: { use() {} } },
        };
        return inst;
    }
    const axiosFalso = Object.assign((cfg) => crearClienteAxios().request(cfg), crearClienteAxios(), {
        create: () => crearClienteAxios(),
        isAxiosError: () => false,
    });
    axiosFalso.default = axiosFalso;

    const nodemailerFalso = {
        createTransport: () => ({
            sendMail: async (m) => { registro.mails.push({ to: m && m.to, subject: m && m.subject }); return { messageId: 'falso' }; },
            verify: async () => true,
        }),
    };

    // ── Transporte falso, con el MISMO punto de salida que el real ──
    let enviarHook = null;
    function crearTransporte() {
        const { conPuntoDeSalida } = require(path.join(WA, 'shared/punto-de-salida'));
        let n = 0;
        const crudo = async (waId, texto, media, opts) => {
            const id = `wamid.FALSO${Date.now()}${++n}`;
            const envio = { waId, texto: texto || '', media: media ? (media.url || media.mediaUrl || '[media]') : null, origen: opts && opts.origen, t: Date.now(), id };
            registro.envios.push(envio);
            if (enviarHook) enviarHook(envio);
            return { messages: [{ id }] };
        };
        return {
            init: async () => {}, refreshStatus: async () => {}, getStatus: () => ({ status: 'FALSO' }),
            sendMessage: conPuntoDeSalida(crudo, { transporte: 'falso' }),
            sendTypingState: async () => null,
            notifyAdminDown: async (...a) => { registro.escrituras.push({ modelo: 'notifyAdminDown', op: 'aviso', args: a.map(String).join(' | ').slice(0, 200) }); },
            getClient: () => null,
        };
    }

    // ── Interceptor de módulos: ANTES de cargar el wa-service ──
    const transporteFalso = { mod: null };
    const reemplazos = new Map([
        [path.join(WA, 'db.js'), () => ({ prisma })],
        [path.join(WA, 'transport/cloud-transport.js'), () => transporteFalso.mod || (transporteFalso.mod = crearTransporte())],
    ]);
    const loadOriginal = Module._load;
    Module._load = function (request, parent, isMain) {
        if (request === 'axios') return axiosFalso;
        if (modeloFalso && request === '@langchain/google-genai') return modeloFalso;
        if (request === 'nodemailer') return nodemailerFalso;
        if (request === '@prisma/client') return { PrismaClient: function () { return prisma; }, Prisma: {} };
        let resuelto = null;
        try { resuelto = Module._resolveFilename(request, parent, isMain); } catch { /* lo resuelve el original */ }
        if (resuelto && reemplazos.has(resuelto)) return reemplazos.get(resuelto)();
        return loadOriginal.apply(this, arguments);
    };
    // La ruta del CRM (src/lib/db.ts) toma este cliente si existe.
    globalThis.prisma = prisma;

    return {
        prisma, registro, CRM_FALSO,
        transporte: () => transporteFalso.mod || (transporteFalso.mod = crearTransporte()),
        alEnviar: (fn) => { enviarHook = fn; },
    };
}

module.exports = { crearEntorno, RAIZ, WA, CRM_FALSO };
