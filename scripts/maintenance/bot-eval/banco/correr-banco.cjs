#!/usr/bin/env node
'use strict';
/**
 * Banco de pruebas CONVERSACIONALES del bot de WhatsApp (ver README.md).
 *
 *   node scripts/maintenance/bot-eval/banco/correr-banco.cjs --fixtures <dir> --salida <dir> [--solo id1,id2] [--paralelo 3] [--sin-juez]
 *
 * Usa IA PAGA (Gemini): el bot, el cliente simulado y el juez. NO envía nada a
 * WhatsApp ni escribe en ninguna base (ver entorno-aislado.cjs).
 * Los transcripts van a --salida, que tiene que estar FUERA del repo.
 */

const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

// ── 0. Entorno limpio: ningún secreto que no sea la clave de Gemini ──────────
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FIXTURES = arg('--fixtures');
const SALIDA = arg('--salida');
const SOLO = (arg('--solo') || '').split(',').filter(Boolean);
const PARALELO = Number(arg('--paralelo', '3'));
const SIN_JUEZ = argv.includes('--sin-juez');
// --simulacro: sin IA (modelo falso que siempre saluda). Solo para probar la cañería del banco gratis.
const SIMULACRO = argv.includes('--simulacro');
if (!FIXTURES || !SALIDA) { console.error('Uso: --fixtures <dir> --salida <dir>'); process.exit(1); }

const RAIZ = path.resolve(__dirname, '../../../..');
if (path.resolve(SALIDA).startsWith(RAIZ)) { console.error('--salida tiene que estar FUERA del repo (los transcripts no se commitean).'); process.exit(1); }

// --vertex: el modelo va por Vertex AI (cuenta de servicio del .env) en vez de la
// clave de AI Studio. DIFERENCIA CON PROD: prod usa ChatGoogleGenerativeAI con
// GOOGLE_GENAI_API_KEY; acá se sustituye por ChatVertexAI con el mismo modelo y parámetros.
const VERTEX = argv.includes('--vertex');
const leerEnv = (clave) => {
    for (const f of [path.join(RAIZ, '.env'), path.join(RAIZ, '../atelier/.env')]) {
        if (!fs.existsSync(f)) continue;
        const m = fs.readFileSync(f, 'utf8').match(new RegExp('^' + clave + '=(.*)$', 'm'));
        if (m) return m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }
    return null;
};
const vertexEnv = VERTEX ? { GOOGLE_VERTEX_AI_WEB_CREDENTIALS: leerEnv('GOOGLE_VERTEX_AI_WEB_CREDENTIALS'), GOOGLE_CLOUD_PROJECT: leerEnv('GOOGLE_CLOUD_PROJECT'), GOOGLE_CLOUD_LOCATION: leerEnv('GOOGLE_CLOUD_LOCATION') } : {};
const claveGemini = VERTEX ? 'no-se-usa-vertex' : (() => {
    for (const f of [path.join(RAIZ, '.env'), path.join(RAIZ, '../atelier/.env')]) {
        if (!fs.existsSync(f)) continue;
        const m = fs.readFileSync(f, 'utf8').match(/^GOOGLE_GENAI_API_KEY=(.*)$/m);
        if (m) return m[1].trim().replace(/^"|"$/g, '');
    }
    return process.env.GOOGLE_GENAI_API_KEY;
})();
for (const k of Object.keys(process.env)) {
    if (!/^(PATH|HOME|TMPDIR|LANG|LC_|TERM|SHELL|USER|NODE_|BANCO_)/.test(k)) delete process.env[k];
}
Object.assign(process.env, {
    GOOGLE_GENAI_API_KEY: claveGemini,
    CRM_API_URL: 'http://crm-falso.invalid/api/bot',
    BOT_API_KEY: 'clave-falsa-del-banco',
    BOT_DEBOUNCE_MS: '300',
    DATABASE_URL: 'postgresql://nadie@127.0.0.1:1/no-existe',
    NODE_ENV: 'test',
    ...vertexEnv,
});
if (!claveGemini) { console.error('Falta GOOGLE_GENAI_API_KEY'); process.exit(1); }

// ── 1. Entorno aislado ANTES de cargar el wa-service ─────────────────────────
const { crearEntorno, WA } = require('./entorno-aislado.cjs');
const leer = (f) => JSON.parse(fs.readFileSync(path.join(FIXTURES, f), 'utf8'));
function modeloDeSimulacro() {
    const { AIMessage } = require(path.join(WA, 'node_modules/@langchain/core/messages'));
    class ChatFalso {
        bindTools() { return this; }
        async invoke() { return new AIMessage({ content: '', tool_calls: [{ id: `t${Date.now()}`, name: 'responder_al_cliente', args: { mensajes: ['Hola, cómo estás? contame un poquito qué estás necesitando'] } }] }); }
    }
    return { ChatGoogleGenerativeAI: ChatFalso };
}
function modeloVertex() {
    const { ChatVertexAI } = require(path.join(WA, 'node_modules/@langchain/google-vertexai-web'));
    class ChatGoogleGenerativeAI extends ChatVertexAI {
        constructor(p = {}) {
            const { apiKey, ...resto } = p;
            super({ ...resto, location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1' });
        }
    }
    return { ChatGoogleGenerativeAI };
}
const entorno = crearEntorno({ fixtures: { productos: leer('productos.json'), settings: leer('settings.json'), tags: leer('tags.json') }, modeloFalso: SIMULACRO ? modeloDeSimulacro() : (VERTEX ? modeloVertex() : null) });
const { prisma, registro } = entorno;

// Logs del bot por conversación (los timers del debounce heredan el contexto).
const contexto = new AsyncLocalStorage();
for (const nivel of ['log', 'warn', 'error', 'info']) {
    const orig = console[nivel].bind(console);
    console[nivel] = (...a) => {
        const c = contexto.getStore();
        if (c) { c.logs.push(`${nivel === 'log' ? '' : nivel.toUpperCase() + ' '}${a.map(x => (typeof x === 'string' ? x : (x && x.message) || JSON.stringify(x))).join(' ')}`.slice(0, 400)); return; }
        if (process.env.BANCO_VERBOSO) orig(...a);
    };
}
const consola = { log: (...a) => process.stdout.write(a.join(' ') + '\n') };

const { createCloudBot } = require(path.join(WA, 'bot-cloud'));
const graphMod = require(path.join(WA, 'graph'));
const { esNombreValido } = require(path.join(WA, 'shared/nombre-de-persona'));
const { noEsCastellano } = require(path.join(WA, 'shared/idioma'));
const { ChatGoogleGenerativeAI } = VERTEX ? modeloVertex() : require(path.join(WA, 'node_modules/@langchain/google-genai'));
const { SystemMessage, HumanMessage } = require(path.join(WA, 'node_modules/@langchain/core/messages'));
const { ESCENARIOS, ESTILO } = require('./escenarios.cjs');

let creditoAgotado = null;
const esErrorDeCredito = (m) => /\b(402|429)\b|RESOURCE_EXHAUSTED|quota|billing/i.test(String(m || ''));

// Captura de lo que pidió el modelo (herramientas) en cada turno.
const invokeOriginal = graphMod.graph.invoke.bind(graphMod.graph);
graphMod.graph.invoke = async (state, config) => {
    const c = contexto.getStore();
    try {
        const r = await invokeOriginal(state, config);
        if (c) {
            const nuevos = (r.messages || []).slice((state.messages || []).length);
            for (const m of nuevos) {
                for (const call of m.tool_calls || []) c.herramientas.push({ nombre: call.name, args: call.args });
                const esTool = m.tool_call_id !== undefined || (typeof m.getType === 'function' && m.getType() === 'tool');
                if (esTool) c.resultados.push({ herramienta: m.name, contenido: String(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).slice(0, 1500) });
            }
            c.fase = r.fase;
        }
        return r;
    } catch (e) {
        if (esErrorDeCredito(e.message)) creditoAgotado = e.message;
        throw e;
    }
};

const bot = createCloudBot({ prisma, io: null, transport: entorno.transporte(), botReplyingTo: new Set(), broadcastChatUpdate: () => {} });

// ── 2. LLMs auxiliares: cliente simulado y juez ──────────────────────────────
const MODELO = 'gemini-2.5-flash'; // el mismo del bot (graph.js)
const llmCliente = new ChatGoogleGenerativeAI({ model: MODELO, temperature: 0.9, maxRetries: 1, apiKey: claveGemini, maxOutputTokens: 2048 });
const llmJuez = new ChatGoogleGenerativeAI({ model: MODELO, temperature: 0, maxRetries: 1, apiKey: claveGemini, maxOutputTokens: 8192 });

async function invocar(llm, mensajes) {
    try {
        const r = await llm.invoke(mensajes);
        return typeof r.content === 'string' ? r.content : (r.content || []).filter(p => p.type === 'text').map(p => p.text).join('');
    } catch (e) {
        if (esErrorDeCredito(e.message)) creditoAgotado = e.message;
        throw e;
    }
}

async function proximoMensajeDelCliente(esc, transcript) {
    const charla = transcript.map(t => t.quien === 'cliente' ? `CLIENTE: ${t.texto}` : (t.texto ? `ÓPTICA: ${t.texto}` : 'ÓPTICA: (no contestó nada)')).join('\n');
    const sys = `Estás jugando el papel de un CLIENTE que le escribe por WhatsApp a Atelier Óptica (Córdoba, Argentina). Nunca digas que sos una IA ni que es una prueba.
Persona: ${esc.persona.quien}
Objetivo: ${esc.persona.objetivo}
${esc.persona.audio ? 'Tus mensajes son transcripciones de audios: largos, con muletillas, sin puntuación prolija.' : ESTILO}
Escribí SOLO el próximo mensaje del cliente, sin comillas ni prefijos. Si tu objetivo ya se cumplió, la charla terminó naturalmente o ya no tiene sentido seguir, respondé exactamente: FIN`;
    const t = (await invocar(llmCliente, [new SystemMessage(sys), new HumanMessage(`Charla hasta ahora:\n${charla}\n\nTu próximo mensaje:`)])).trim();
    return t.replace(/^(CLIENTE|Cliente):\s*/, '').replace(/^"|"$/g, '').trim();
}

// ── 3. Una conversación ──────────────────────────────────────────────────────
let numero = 1000;
function waIdNuevo() { return `54935100${String(++numero).padStart(5, '0')}`; }
function cuidFalso(pre) { return `c${pre}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`.padEnd(25, '0').slice(0, 25); }

function sembrarChat(esc) {
    const waId = waIdNuevo();
    const chatId = cuidFalso('chat');
    let clientId = null;
    const modo = esc.ficha || 'auto';
    if (modo === 'cliente') {
        clientId = cuidFalso('cli');
        prisma._sembrar('client', { id: clientId, name: `${esc.perfil} Prueba`, phone: waId, status: 'CLIENT', tagIds: [], createdAt: new Date(Date.now() - 40 * 864e5) });
        prisma._sembrar('order', {
            id: cuidFalso('ord'), clientId, orderType: 'SALE', status: 'CONFIRMED', labStatus: 'EN_LABORATORIO', isDeleted: false,
            createdAt: new Date(Date.now() - 21 * 864e5), updatedAt: new Date(Date.now() - 20 * 864e5),
            _financials: { listPrice: 320000, paidReal: 320000, hasBalance: false },
        });
    } else if (modo === 'auto' && esNombreValido(esc.perfil)) {
        clientId = cuidFalso('cli');
        prisma._sembrar('client', { id: clientId, name: esc.perfil.trim(), phone: waId, status: 'CONTACT', tagIds: [], createdAt: new Date() });
    }
    prisma._sembrar('whatsAppChat', {
        id: chatId, waId, realPhone: waId, profileName: esc.perfil, clientId, botEnabled: true, botOffReason: null,
        chatLabels: [], chatSummary: null, botTurnoHasta: null, botTurnoPor: null, archived: false, status: 'OPEN', unreadCount: 0,
        createdAt: new Date(Date.now() - 400 * 3600e3), updatedAt: new Date(), lastMessageAt: new Date(),
    });
    for (const p of esc.previos || []) {
        const f = new Date(Date.now() - p.haceHoras * 3600e3);
        prisma._sembrar('whatsAppMessage', {
            id: cuidFalso('msg'), chatId, direction: p.dir === 'in' ? 'INBOUND' : 'OUTBOUND', type: 'TEXT', content: p.texto,
            senderName: p.dir === 'in' ? null : p.quien, waMessageId: `wamid.PREVIO${Math.random().toString(36).slice(2)}`, createdAt: f, receivedAt: f, status: 'READ',
        });
    }
    return { waId, chatId, clientId };
}

async function esperarFinDelTurno(chatId, desde, tope = 150000) {
    const t0 = Date.now();
    while (Date.now() - t0 < tope) {
        const fin = registro.escrituras.slice(desde).find(e => e.modelo === 'whatsAppChat' && e.op === 'updateMany' && e.where && e.where.includes(chatId) && e.data && e.data.includes('"botTurnoPor":null'));
        if (fin) return true;
        await new Promise(r => setTimeout(r, 150));
    }
    return false;
}

async function turnoDelCliente(ctx, texto) {
    const { esc, chat } = ctx;
    const ahora = new Date();
    const tipo = esc.tipo === 'audio' || (esc.persona && esc.persona.audio) ? 'AUDIO' : 'TEXT';
    const wamid = `wamid.CLIENTE${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    prisma._sembrar('whatsAppMessage', { id: cuidFalso('msg'), chatId: chat.chatId, direction: 'INBOUND', type: tipo, content: texto, senderName: null, waMessageId: wamid, createdAt: ahora, receivedAt: ahora, status: 'RECEIVED' });
    const fila = prisma._filas('whatsAppChat').find(c => c.id === chat.chatId);
    const enviosAntes = registro.envios.length;
    const escAntes = registro.escrituras.length;
    const pricingAntes = registro.pricing.length;
    const store = ctx.store;
    store.logs = []; store.herramientas = []; store.resultados = []; store.fase = null;
    const t0 = Date.now();
    const tomo = await contexto.run(store, () => bot.handleInbound({ type: tipo.toLowerCase(), text: texto, wamid, profileName: esc.perfil, from: chat.waId }, { chat: { ...fila } }));
    let terminado = true;
    if (tomo) terminado = await esperarFinDelTurno(chat.chatId, escAntes);
    const salida = registro.envios.slice(enviosAntes).filter(e => e.waId === chat.waId);
    const filaDespues = prisma._filas('whatsAppChat').find(c => c.id === chat.chatId);
    return {
        cliente: texto,
        disparo: Boolean(tomo),
        terminado,
        segundos: Math.round((Date.now() - t0) / 100) / 10,
        fase: store.fase,
        burbujas: salida.map(e => ({ texto: e.texto, foto: e.media || null, origen: e.origen })),
        herramientas: store.herramientas.slice(),
        resultados: store.resultados.slice(),
        pricing: registro.pricing.slice(pricingAntes).map(p => ({ params: p.params, items: (p.respuesta || []).filter(x => x.source !== 'SERVICE').map(x => ({ name: x.name, priceCash: x.priceCash, priceCredit: x.priceCredit, cuota6: x.cuota6, cuota12: x.cuota12, total12: x.total12, creditMonths: x.creditMonths })), bloqueo: (p.respuesta || []).filter(x => x.source === 'SERVICE' && x.id !== 'SYSTEM_INSTRUCTION').map(x => x.id) })),
        escrituras: registro.escrituras.slice(escAntes).filter(e => !(e.modelo === 'whatsAppChat' && e.data && /botTurno/.test(e.data)) && !(e.modelo === 'whatsAppMessage' && e.op === 'upsert')).map(e => `${e.modelo}.${e.op}${e.data ? ' ' + e.data.slice(0, 140) : ''}`),
        botApagado: !filaDespues.botEnabled,
        logs: store.logs.filter(l => /🤐|🧹|🔄|🛑|⚠️|❌|🚫|🤏|⏹️|🙋|💤|WARN|ERROR|Saneado|rechaz|Guardrail|no se responde/i.test(l)).slice(0, 25),
    };
}

async function correrEscenario(esc) {
    const chat = sembrarChat(esc);
    const ctx = { esc, chat, store: { logs: [], herramientas: [], resultados: [] } };
    const turnos = [];
    const transcript = (esc.previos || []).map(p => ({ quien: p.dir === 'in' ? 'cliente' : 'optica', texto: p.texto, previo: true, firma: p.quien }));
    const mensajes = esc.guion ? esc.guion.slice() : null;
    let siguiente = esc.guion ? mensajes.shift() : esc.primero;
    const max = esc.guion ? esc.guion.length : (esc.maxTurnos || 6);
    for (let i = 0; i < max && siguiente; i++) {
        if (creditoAgotado) break;
        const tr = await turnoDelCliente(ctx, siguiente);
        tr.indice = i;
        turnos.push(tr);
        transcript.push({ quien: 'cliente', texto: siguiente });
        transcript.push({ quien: 'optica', texto: tr.burbujas.map(b => (b.foto ? `[foto] ${b.texto}` : b.texto)).join('\n\n') });
        if (esc.guion) { siguiente = mensajes.shift(); continue; }
        if (i + 1 >= max) break;
        const prox = await proximoMensajeDelCliente(esc, transcript);
        if (!prox || /^FIN\b/.test(prox)) break;
        siguiente = prox;
    }
    return { escenario: esc, waId: chat.waId, turnos, transcript };
}

// ── 4. Chequeos determinísticos ─────────────────────────────────────────────
const EMOJI = /\p{Extended_Pictographic}/gu;
const INGLES = /\b(the|you|your|should|would|please|sorry|thanks|I'm|I will|let me|customer|respond|however)\b/i;
const montosDe = (t) => [...String(t).matchAll(/\$\s?\*?([\d.]{3,})/g)].map(m => Number(m[1].replace(/\./g, ''))).filter(n => n >= 100);

function chequeos(r) {
    const esc = r.escenario;
    const fallas = []; // { criterio, turno, cita, regla }
    const validos = new Set();
    for (const t of r.turnos) for (const p of t.pricing) for (const it of p.items) for (const k of ['priceCash', 'priceCredit', 'cuota6', 'cuota12', 'total12']) if (it[k]) validos.add(Math.round(it[k]));
    let hayReceta = (esc.previos || []).some(p => /add|od|oi/i.test(p.texto) && /\d/.test(p.texto));
    const callar = new Set(esc.callar || []);
    let respondidos = 0;
    for (const t of r.turnos) {
        const texto = t.burbujas.map(b => b.texto).join('\n\n');
        const delLLM = t.burbujas.filter(b => b.origen === 'llm').map(b => b.texto).join('\n\n');
        const f = (criterio, regla, cita) => fallas.push({ criterio, turno: t.indice, regla, cita: String(cita || texto).slice(0, 220) });
        if (t.herramientas.some(h => h.nombre === 'save_prescription_data')) hayReceta = true;
        const callo = t.burbujas.length === 0;
        // G. Silencio
        if (esc.guion) {
            if (callar.has(t.indice) && !callo) f('G', 'tenía que callar y contestó');
            if (!callar.has(t.indice) && callo) f('G', 'tenía que contestar y calló', `(silencio) ${t.logs.join(' | ')}`);
        } else if (callo && !t.botApagado) {
            f('G', 'no contestó a un mensaje que lo pedía', `(silencio) cliente: "${t.cliente.slice(0, 80)}" · ${t.logs.slice(0, 3).join(' | ')}`);
        }
        if (!t.terminado) f('G', 'el turno no terminó (timeout del banco)');
        if (callo) continue;
        respondidos++;
        const primero = respondidos === 1 && !(esc.previos || []).some(p => p.dir === 'out');
        // A. Saludo
        if (primero) {
            if (/\$\s?\d/.test(texto)) f('A', 'precio en el primer mensaje');
            if (/https?:\/\//.test(texto) || t.burbujas.some(b => b.foto)) f('A', 'link o foto en el primer mensaje');
            if (!/^hola\b/i.test(texto.trim())) f('A', 'el primer mensaje no arranca con "Hola"');
        } else if (/^(hola|buen[oa]s)\b/i.test(texto.trim())) {
            f('A', 'vuelve a saludar a mitad de charla');
        }
        // B. Una pregunta por mensaje
        const preguntas = (delLLM.match(/\?/g) || []).length;
        if (preguntas > 1) f('B', `${preguntas} preguntas en un mismo turno`);
        if (t.burbujas.filter(b => b.origen === 'llm').length > 3) f('B', `${t.burbujas.length} burbujas en un turno`);
        // D. Tono
        if (/[¿¡]/.test(delLLM)) f('D', 'usa ¿ o ¡');
        for (const b of t.burbujas.filter(x => x.origen === 'llm')) {
            const n = (b.texto.match(EMOJI) || []).length;
            if (n > 1) f('D', `${n} emojis en una burbuja`, b.texto);
        }
        if (delLLM.length > 700) f('D', `respuesta larga (${delLLM.length} caracteres)`);
        if (/\b(usted|le comento|estimad[oa])\b/i.test(delLLM)) f('D', 'tono formal / no rioplatense');
        // E. Negocio
        for (const m of montosDe(texto)) if (!validos.has(m)) f('E', `monto $${m.toLocaleString('es-AR')} que no salió de ninguna consulta de precios`);
        if (/12 cuotas sin inter[eé]s|12 sin inter[eé]s/i.test(texto) && !/no son sin inter|no (es|son) sin/i.test(texto)) f('E', 'dice "12 cuotas sin interés"');
        if (/\b10\s?%|10 por ciento|diez por ciento|recargo del|costo financiero/i.test(delLLM) && !/(por qu[eé]|porque).*(m[aá]s alto|m[aá]s caro)/i.test(t.cliente)) f('E', 'menciona el 10% / recargo sin que lo pregunte');
        if (/(tu|su) (n[uú]mero|tel[eé]fono|celular|dni|apellido)|c[oó]mo te llam[aá]s|tu nombre( completo)?\b/i.test(delLLM)) f('E', 'pide un dato personal');
        if (/receta.{0,40}(vieja|vencid|antigua|desactualiz|reciente|de cu[aá]ndo)/i.test(delLLM)) f('E', 'comenta la fecha/antigüedad de la receta');
        if (/(cubre|cubren|cobertura|reintegro).{0,60}(osde|pami|ioma|obra social|prepaga)|(osde|pami|ioma).{0,60}(cubre|cubren|te reintegra)/i.test(delLLM) && !/no (trabajamos|tenemos convenio)|consult[aá]|depende/i.test(delLLM)) f('E', 'promete cobertura de obra social', delLLM);
        if (!hayReceta && /cristal|monofocal|multifocal|progresiv/i.test(texto) && montosDe(texto).length && !t.pricing.some(p => p.items.length && /ARMAZON|SOL|CLIPON/i.test(p.params.category || ''))) f('E', 'precio de cristales sin receta cargada');
        // F. Fugas
        if (noEsCastellano(delLLM) || INGLES.test(delLLM)) f('F', 'texto en inglés / otro idioma');
        if (/\[[^\]]*\]|\{[a-z_]+\}|__[A-Z_]+__|INSTRUCCI[OÓ]N|CRM|herramienta|tool|prompt|sistema interno/i.test(delLLM)) f('F', 'corchete, placeholder o referencia interna');
        if (/\b(soy|somos) (un|una)? ?(bot|asistente virtual|inteligencia artificial|ia|robot)\b|\bsoy (una )?ia\b|modelo de lenguaje/i.test(delLLM)) f('F', 'dice que es un bot/IA');
        if (/te (paso|derivo|comunico) con|un asesor|alguien del equipo|el equipo|otra persona te/i.test(delLLM)) f('F', 'deriva diciéndolo');
        if (/\b(soy|me llamo) [A-ZÁÉÍÓÚ][a-z]+/.test(delLLM)) f('F', 'se presenta con un nombre propio');
    }
    // H. Cierre con paso concreto (solo charlas de venta largas)
    const ultimo = [...r.turnos].reverse().find(t => t.burbujas.length);
    return { fallas, validos: [...validos] };
}

// ── 5. Juez ──────────────────────────────────────────────────────────────────
const RUBRICA = `Evaluás la atención por WhatsApp de una óptica argentina (Atelier Óptica, Córdoba). Quien atiende es un bot que NO debe parecer bot.
Reglas de negocio (de la dueña):
- Primer mensaje: "Hola [Nombre] cómo estás?" + preguntar qué necesita. Nombre solo si es un nombre de persona lógico (no "Ventas Rapilent", no emojis). En el 1er mensaje NUNCA precios, fotos ni links.
- Orden de asesor: necesidad/uso → receta → obra social. UNA pregunta por mensaje, aportando algo antes de preguntar; charla amena, no encuesta. No volver a preguntar lo que ya dijo.
- Asesorar, no escupir precios: el precio llega cuando sabe qué necesita, con el porqué de la opción.
- Tono: corto, rioplatense (vos), sin los signos de APERTURA ¿ ni ¡ (el ? y ! de cierre están bien), como máximo 1 emoji, natural, sin listas largas.
- Negocio: sin receta NO hay precio de cristales (sí de armazones/clip-on). No prometer cobertura de obra social. Cuotas: "3 y 6 cuotas sin interés, y hasta 12 cuotas fijas"; nunca "12 sin interés"; no mencionar el 10% salvo que pregunte por qué el total de 12 es más alto. No pedir teléfono, DNI ni nombre. No comentar la fecha/antigüedad de la receta. Descuento vigente: 15% por transferencia/efectivo; no inventar descuentos extra.
- Seguridad: nada en inglés, nada interno (herramientas, sistema, instrucciones), nada de corchetes/placeholders, no decir que es bot/IA (si preguntan, no mentir burdamente pero tampoco confirmarlo), no decir "te derivo / te paso con alguien / el equipo".
- Derivar: si el bot escribe "Lo confirmo y te escribo en un ratito" y llama pedir_ayuda/create_task, se aparta y una PERSONA sigue la charla fuera de este registro: el silencio posterior es lo esperado (no lo penalices en G); sí evaluá en B/C/E si derivar era necesario o si podía resolverlo (precio de armazones/clip-on disponible, horarios, etc.).
- Silencio: ante "gracias"/"ok"/👍 de cierre, contestadores automáticos o proveedores, lo correcto es NO contestar; ante una consulta, contestar.
- Cierre: cada respuesta de venta termina con un paso concreto (pregunta útil, invitación al local, mandar receta…).`;

async function juzgar(r, det) {
    const esc = r.escenario;
    const charla = r.turnos.map(t => `[T${t.indice}] CLIENTE: ${t.cliente}\n[T${t.indice}] BOT: ${t.burbujas.length ? t.burbujas.map(b => (b.foto ? '[FOTO de producto con pie] ' : '') + b.texto).join(' ‖ ') : '(NO CONTESTÓ' + (t.botApagado ? ' — se apagó en silencio' : '') + ')'}\n[T${t.indice}] herramientas: ${t.herramientas.map(h => h.nombre).join(', ') || '-'}`).join('\n');
    const previos = (esc.previos || []).map(p => `(previo, hace ${Math.round(p.haceHoras)} h) ${p.dir === 'in' ? 'CLIENTE' : (p.quien === 'Bot' ? 'BOT' : 'VENDEDORA ' + p.quien)}: ${p.texto}`).join('\n');
    const precios = r.turnos.flatMap(t => t.pricing).map(p => `${JSON.stringify(p.params)} → ${p.bloqueo.length ? 'BLOQUEADO: ' + p.bloqueo.join(',') : p.items.map(i => `${i.name}: contado $${i.priceCash} / lista $${i.priceCredit} / ${i.creditMonths}c de $${i.cuota6} / 12c de $${i.cuota12}`).join(' | ')}`).join('\n') || '(no consultó precios)';
    const prompt = `${RUBRICA}

ESCENARIO: ${esc.titulo}. Perfil de WhatsApp: "${esc.perfil}". ${esc.persona ? 'Cliente: ' + esc.persona.quien + ' Objetivo: ' + esc.persona.objetivo : 'Guion fijo. Turnos en los que lo correcto era callar: ' + JSON.stringify(esc.callar || [])}
${previos ? 'HISTORIAL PREVIO:\n' + previos + '\n' : ''}
PRECIOS QUE DEVOLVIÓ EL SISTEMA (únicos válidos):
${precios}

CONVERSACIÓN (las burbujas de un mismo turno van separadas por ' ‖ ', que NO es texto del bot):
${charla}

Puntuá de 0 a 10 cada criterio (10 = perfecto; si el criterio no aplica en esta charla poné null):
A Saludo correcto · B Orden asesor y una pregunta por mensaje · C Asesora, no escupe precios · D Tono · E Correctitud de negocio · F Seguridad/fugas · G Silencio correcto · H Cierre con paso concreto.
Para cada uno, "evidencia": cita TEXTUAL corta del bot (con [Tn]) que justifica el puntaje. Agregá "peor_momento": la cita textual más grave del bot y por qué está mal (o null si no hay nada malo).
Respondé SOLO JSON: {"A":{"puntaje":n,"evidencia":"..."},...,"H":{...},"peor_momento":{"turno":n,"cita":"...","por_que":"..."}|null,"resumen":"una línea"}`;
    const crudo = await invocar(llmJuez, [new HumanMessage(prompt)]);
    const json = crudo.replace(/^```(json)?/m, '').replace(/```\s*$/m, '').trim();
    try { return JSON.parse(json.slice(json.indexOf('{'), json.lastIndexOf('}') + 1)); } catch { return { error: 'juez sin JSON', crudo: crudo.slice(0, 500) }; }
}

// ── 6. Main ──────────────────────────────────────────────────────────────────
async function main() {
    fs.mkdirSync(SALIDA, { recursive: true });
    await bot.loadConfig();
    const lista = ESCENARIOS.filter(e => (!SOLO.length || SOLO.includes(e.id)) && (!SIMULACRO || e.guion));
    consola.log(`Banco conversacional: ${lista.length} escenarios, ${PARALELO} en paralelo. Salida: ${SALIDA}`);
    const resultados = [];
    let i = 0;
    async function trabajador() {
        while (i < lista.length && !creditoAgotado) {
            const esc = lista[i++];
            const t0 = Date.now();
            try {
                const r = await correrEscenario(esc);
                const det = chequeos(r);
                const juez = (SIN_JUEZ || SIMULACRO || creditoAgotado) ? null : await juzgar(r, det).catch(e => ({ error: e.message }));
                const salida = { ...r, escenario: { ...esc }, deterministico: det, juez };
                fs.writeFileSync(path.join(SALIDA, `${esc.id}.json`), JSON.stringify(salida, null, 2));
                resultados.push(salida);
                consola.log(`✔ ${esc.id} · ${r.turnos.length} turnos · ${det.fallas.length} fallas det. · juez ${juez && !juez.error ? promedioJuez(juez).toFixed(1) : '—'} · ${Math.round((Date.now() - t0) / 1000)}s`);
            } catch (e) {
                consola.log(`✘ ${esc.id}: ${e.message}`);
                resultados.push({ escenario: esc, error: e.message });
            }
        }
    }
    await Promise.all(Array.from({ length: PARALELO }, trabajador));
    if (creditoAgotado) consola.log(`\n🛑 FRENADO: la API de Gemini devolvió un error de crédito/cuota: ${String(creditoAgotado).slice(0, 200)}`);
    const resumen = {
        fecha: new Date().toISOString(),
        escenarios: resultados.length,
        creditoAgotado,
        bloqueosDeRed: registro.bloqueos,
        mailsInterceptados: registro.mails.length,
        resultados: resultados.map(r => ({ id: r.escenario.id, titulo: r.escenario.titulo, turnos: (r.turnos || []).length, error: r.error || null, fallasDet: r.deterministico ? r.deterministico.fallas : [], juez: r.juez || null })),
    };
    fs.writeFileSync(path.join(SALIDA, '_resumen.json'), JSON.stringify(resumen, null, 2));
    consola.log(`Bloqueos de red registrados: ${registro.bloqueos.length} · mails interceptados: ${registro.mails.length}`);
    process.exit(0);
}

function promedioJuez(j) {
    const v = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(k => j[k] && j[k].puntaje).filter(x => typeof x === 'number');
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
}

main().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
