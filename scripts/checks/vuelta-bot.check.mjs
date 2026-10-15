/**
 * Cuándo vuelve el bot a un chat apagado, y que nunca corran dos turnos a la
 * vez. Pruebas de COMPORTAMIENTO: se corre el código de verdad
 * (shared/vuelta-del-bot.js, shared/candado-de-turno.js) contra una base
 * falsa en memoria. Sin base, sin red, sin .env (también en CI).
 *
 *   npm run check:vuelta-bot
 *
 * Por qué (auditoría del 15/10/2026): el barrido devolvía el bot a cualquier
 * chat con la etiqueta [SISTEMA - BOT APAGADO], que ponían también el panel,
 * la derivación, los errores y el guardrail. Simulado contra producción: 17
 * de 44 chats habrían recibido respuesta del bot, casi todos cierres
 * ("gracias chicos!"). Y la exclusión ("Ya es cliente") se miraba DESPUÉS de
 * prender el bot. Los checks de antes eran regex sobre el código fuente: un
 * refactor que mantuviera las palabras los pasaba aunque el comportamiento
 * estuviera roto.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const motivo = require('../../wa-service/shared/motivo-apagado.js');
const { MOTIVO_APAGADO } = motivo;
const { crearVueltaDelBot } = require('../../wa-service/shared/vuelta-del-bot.js');
const { crearCandadoDeTurno } = require('../../wa-service/shared/candado-de-turno.js');
const { esRemitenteHumano } = require('../../wa-service/shared/remitentes.js');
const { ETIQUETA_BOT_APAGADO } = require('../../wa-service/shared/traspaso-humano.js');

let fallas = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => { fallas++; console.log(`  ❌ ${m}`); };
const check = (m, cond) => (cond ? ok(m) : mal(m));

// ── Base falsa ──────────────────────────────────────────────────────────────
const NUEVAS = motivo.COLUMNAS_NUEVAS;
function baseFalsa({ chats = [], mensajes = [], sinColumnas = false } = {}) {
    const escrituras = [];
    const tocaNuevas = (o) => JSON.stringify(o || {}).match(new RegExp(`"(${NUEVAS.join('|')})"`));
    const falta = (o) => {
        if (sinColumnas && tocaNuevas(o)) {
            const e = new Error(`The column \`WhatsAppChat.${tocaNuevas(o)[1]}\` does not exist in the current database.`);
            e.code = 'P2022';
            throw e;
        }
    };
    const cumple = (c, where) => Object.entries(where || {}).every(([k, v]) => {
        if (k === 'OR') return v.some(w => cumple(c, w));
        if (v && typeof v === 'object' && !(v instanceof Date)) {
            if ('gte' in v) return c[k] && new Date(c[k]) >= v.gte;
            if ('lt' in v) return c[k] && new Date(c[k]) < v.lt;
            if ('gt' in v) return c[k] && new Date(c[k]) > v.gt;
            return true;
        }
        return (c[k] ?? null) === v;
    });
    const elegir = (c, select) => (select ? Object.fromEntries(Object.keys(select).map(k => [k, c[k] ?? null])) : { ...c });
    const msgCumple = (m, where) => {
        if (where.chatId && m.chatId !== where.chatId) return false;
        if (where.direction && m.direction !== where.direction) return false;
        if (where.senderName && !esRemitenteHumano(m.senderName)) return false;
        if (where.createdAt && where.createdAt.gt && !(new Date(m.createdAt) > where.createdAt.gt)) return false;
        return true;
    };
    const ordenar = (arr, orderBy) => {
        const dir = orderBy && orderBy.createdAt === 'asc' ? 1 : -1;
        return [...arr].sort((a, b) => dir * (new Date(a.createdAt) - new Date(b.createdAt)));
    };
    const prisma = {
        whatsAppChat: {
            async findUnique({ where, select }) { falta(select); const c = chats.find(x => cumple(x, where)); return c ? elegir(c, select) : null; },
            async findMany({ where, select, take }) { falta(where); falta(select); return chats.filter(c => cumple(c, where)).slice(0, take || 1e9).map(c => elegir(c, select)); },
            async updateMany({ where, data }) {
                falta(where); falta(data);
                const hits = chats.filter(c => cumple(c, where));
                for (const c of hits) Object.assign(c, data);
                escrituras.push({ where, data, count: hits.length });
                return { count: hits.length };
            },
        },
        whatsAppMessage: {
            async findFirst({ where, orderBy }) { return ordenar(mensajes.filter(m => msgCumple(m, where)), orderBy)[0] || null; },
            async findMany({ where, orderBy, take }) { return ordenar(mensajes.filter(m => msgCumple(m, where)), orderBy).slice(0, take || 1e9); },
        },
    };
    return { prisma, escrituras, chats };
}

// Miércoles 14/10/2026, hora de Córdoba (UTC−3). Abierto de 9 a 19 (simplificado).
const art = (hhmm, dia = '2026-10-14') => new Date(`${dia}T${hhmm}:00.000-03:00`);
const enHorario = (d) => { const h = (d.getUTCHours() + 21) % 24; return h >= 9 && h < 19; };
const silencio = { log() {}, warn() {}, error() {} };

/** Un chat apagado con `motivo`, una vendedora a las 10:00 y `entrantes` después. */
function escenario({ botOffReason, labels = [ETIQUETA_BOT_APAGADO], entrantes = [], salientes = [], sinColumnas = false, excluido = false }) {
    const chat = { id: 'c1', waId: '549351000', profileName: 'Cliente', realPhone: '549351000', botEnabled: false, chatLabels: labels, clientId: 'k1', botOffReason, botOffAt: art('10:00'), lastInboundAt: art('11:00') };
    const mensajes = [
        { chatId: 'c1', direction: 'OUTBOUND', senderName: 'Mile', createdAt: art('10:00'), content: 'Te paso los precios' },
        ...salientes.map(([h, senderName, content = '']) => ({ chatId: 'c1', direction: 'OUTBOUND', senderName, createdAt: art(h), content })),
        ...entrantes.map(([h, content, type = 'TEXT']) => ({ chatId: 'c1', direction: 'INBOUND', createdAt: art(h), content, type })),
    ];
    const base = baseFalsa({ chats: [chat], mensajes, sinColumnas });
    let excluyoAntes = null;
    const vuelta = crearVueltaDelBot({
        prisma: base.prisma,
        enHorario,
        reloj: () => art('11:30'),
        consola: silencio,
        tieneExclusion: async () => { excluyoAntes = base.escrituras.length === 0; return excluido; },
    });
    return { ...base, vuelta, chat, excluyoAntes: () => excluyoAntes };
}

async function corre(opts, msg = null) {
    motivo._reiniciarEstadoColumnas();
    const e = escenario(opts);
    const leido = await e.vuelta.leerChat({ id: 'c1' });
    const r = await e.vuelta.evaluarVuelta(leido, msg);
    return { ...e, r };
}

const CONSULTA = [['11:00', 'y cuánto sale el clip?']];

console.log('\nElegibilidad del barrido: solo vuelve lo que tomó una persona');
for (const m of [MOTIVO_APAGADO.DERIVADO, MOTIVO_APAGADO.APAGADO_MANUAL, MOTIVO_APAGADO.ERRORES, MOTIVO_APAGADO.GUARDRAIL, MOTIVO_APAGADO.PERSONAL, MOTIVO_APAGADO.CREDITO, MOTIVO_APAGADO.ETIQUETA]) {
    const { r, escrituras, chats } = await corre({ botOffReason: m, entrantes: CONSULTA });
    check(`apagado por ${m}, con la etiqueta vieja y una consulta esperando 30 min → NO vuelve y no se escribe nada`, !r.vuelve && escrituras.length === 0 && chats[0].botEnabled === false);
}
{
    const { r, escrituras } = await corre({ botOffReason: null, entrantes: CONSULTA });
    check('motivo desconocido (NULL: los chats de antes de la migración) → NO vuelve', !r.vuelve && escrituras.length === 0);
}
{
    const { r, chats } = await corre({ botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA, entrantes: CONSULTA });
    check('TOMADO_POR_PERSONA + consulta sin respuesta 30 min con el local abierto → VUELVE', r.vuelve && chats[0].botEnabled === true);
    check('…y al volver se limpian el motivo y la etiqueta', chats[0].botOffReason === null && chats[0].botOffAt === null && !chats[0].chatLabels.includes(ETIQUETA_BOT_APAGADO));
}
for (const t of ['gracias chicos!', 'Okis muchas gracias', 'Graciasss', 'Bueno,  espero tu aviso.  Saludos.', 'Vuelvo a analizar y te aviso', 'Cualquier cosa me comunico. Muchas gracias', 'Veo', 'Excelente', 'Bueno']) {
    const { r, escrituras } = await corre({ botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA, entrantes: [['11:00', t]] });
    check(`TOMADO_POR_PERSONA pero el cliente cerró con "${t}" → NO vuelve`, !r.vuelve && escrituras.length === 0);
}
{
    const { r, escrituras, chats, excluyoAntes } = await corre({ botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA, entrantes: CONSULTA, labels: [ETIQUETA_BOT_APAGADO, 'Ya es cliente'], excluido: true });
    check('con exclusión ("Ya es cliente") → NO vuelve y botEnabled sigue en false', !r.vuelve && chats[0].botEnabled === false && escrituras.length === 0);
    check('…la exclusión se mira ANTES de cualquier escritura', excluyoAntes() === true);
}
{
    // La vendedora contestó la consulta a las 11:10 y el cliente dijo "dale".
    const { r } = await corre({ botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA, entrantes: [['10:30', 'cuánto sale?']], salientes: [['11:10', 'Mile', 'Sale $50.000']] });
    check('una consulta ya contestada por la persona no hace volver al bot', !r.vuelve);
}
{
    // Una plantilla de seguimiento (saliente de sistema) también cuenta como "ya le escribimos".
    const { r } = await corre({ botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA, entrantes: [['10:30', 'cuánto sale?']], salientes: [['10:40', 'Bot', 'Hola! seguís interesado?']] });
    check('solo cuentan los entrantes posteriores a nuestro ÚLTIMO saliente de cualquier tipo (bot incluido)', !r.vuelve);
}
{
    const { r } = await corre({ botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA, entrantes: [['11:20', 'y cuánto sale el clip?']] });
    check('consulta de hace 10 min con el local abierto → ESPERA al equipo', !r.vuelve && r.decision.accion === 'esperar');
}
{
    // Sin las columnas (wa-service desplegado antes que la migración): nada vuelve.
    const { r, escrituras } = await corre({ botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA, entrantes: CONSULTA, sinColumnas: true });
    check('sin la columna botOffReason → NO vuelve (conservador) y no explota', !r.vuelve && escrituras.length === 0);
    const e = escenario({ botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA, entrantes: CONSULTA, sinColumnas: true });
    check('sin la columna, el barrido no encuentra chats (en vez de caer al criterio de la etiqueta)', (await e.vuelta.chatsParaBarrer(10)).length === 0);
    motivo._reiniciarEstadoColumnas();
}
{
    motivo._reiniciarEstadoColumnas();
    const e = escenario({ botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA, entrantes: CONSULTA });
    e.chats.push({ id: 'c2', botEnabled: false, botOffReason: MOTIVO_APAGADO.APAGADO_MANUAL, chatLabels: [ETIQUETA_BOT_APAGADO], lastInboundAt: art('11:00') });
    const ids = (await e.vuelta.chatsParaBarrer(10)).map(c => c.id);
    check('el barrido solo levanta chats TOMADO_POR_PERSONA (no los apagados del panel con la misma etiqueta)', ids.length === 1 && ids[0] === 'c1');
}
{
    // Dos instancias barren a la vez: la reactivación la gana una sola.
    motivo._reiniciarEstadoColumnas();
    const e = escenario({ botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA, entrantes: CONSULTA });
    const a = await e.vuelta.leerChat({ id: 'c1' });
    const b = await e.vuelta.leerChat({ id: 'c1' });
    const [ra, rb] = await Promise.all([e.vuelta.evaluarVuelta(a), e.vuelta.evaluarVuelta(b)]);
    check('dos barridos simultáneos: vuelve en UNO solo', [ra.vuelve, rb.vuelve].filter(Boolean).length === 1);
}

console.log('\nApagar y prender: el motivo se anota y se limpia');
{
    motivo._reiniciarEstadoColumnas();
    const base = baseFalsa({ chats: [{ id: 'c1', botEnabled: true, botOffReason: null }] });
    await motivo.actualizarChat(base.prisma, { id: 'c1' }, motivo.datosDeApagado(MOTIVO_APAGADO.DERIVADO));
    check('datosDeApagado anota motivo y fecha', base.chats[0].botEnabled === false && base.chats[0].botOffReason === 'DERIVADO' && base.chats[0].botOffAt instanceof Date);
    await motivo.actualizarChat(base.prisma, { id: 'c1' }, motivo.datosDePrendido());
    check('datosDePrendido lo limpia', base.chats[0].botEnabled === true && base.chats[0].botOffReason === null);
    check('un motivo inventado queda como desconocido (NULL)', motivo.datosDeApagado('LO_QUE_SEA').botOffReason === null);
    const sin = baseFalsa({ chats: [{ id: 'c1', botEnabled: true }], sinColumnas: true });
    motivo._reiniciarEstadoColumnas();
    const r = await motivo.actualizarChat(sin.prisma, { id: 'c1' }, motivo.datosDeApagado(MOTIVO_APAGADO.ERRORES));
    check('sin las columnas, apagar igual apaga (sin el motivo)', r.count === 1 && sin.chats[0].botEnabled === false);
    motivo._reiniciarEstadoColumnas();
}
{
    // BotService.disableBotForChatById: el que usan todos los caminos del wa-service.
    const { BotService } = require('../../wa-service/services/bot.service.js');
    motivo._reiniciarEstadoColumnas();
    const base = baseFalsa({ chats: [{ id: 'c1', botEnabled: true }, { id: 'c2', botEnabled: false, botOffReason: 'DERIVADO' }] });
    const svc = new BotService({ prisma: base.prisma, broadcastChatUpdate: () => {} });
    const log = console.log; console.log = () => {};
    await svc.disableBotForChatById('c1', 'una persona escribió', MOTIVO_APAGADO.TOMADO_POR_PERSONA);
    await svc.disableBotForChatById('c2', 'una persona escribió', MOTIVO_APAGADO.TOMADO_POR_PERSONA);
    console.log = log;
    check('BotService.disableBotForChatById guarda el motivo', base.chats[0].botOffReason === 'TOMADO_POR_PERSONA');
    check('…y NO pisa el motivo de un chat ya apagado por otra cosa (derivado sigue derivado)', base.chats[1].botOffReason === 'DERIVADO');
}
{
    const { readFileSync } = await import('node:fs');
    const ts = readFileSync(new URL('../../src/lib/whatsapp/motivo-apagado-bot.ts', import.meta.url), 'utf8');
    const valoresTs = [...ts.matchAll(/^\s+([A-Z_]+): '([A-Z_]+)',$/gm)].map(m => m[2]).sort();
    const valoresJs = Object.values(MOTIVO_APAGADO).sort();
    check('el espejo del CRM (motivo-apagado-bot.ts) tiene los mismos motivos', JSON.stringify(valoresTs) === JSON.stringify(valoresJs));
}

console.log('\nCandado del turno en la base: nunca dos turnos a la vez');
{
    motivo._reiniciarEstadoColumnas();
    let ahora = art('11:00');
    const base = baseFalsa({ chats: [{ id: 'c1', botTurnoHasta: null, botTurnoPor: null }] });
    const A = crearCandadoDeTurno({ prisma: base.prisma, instancia: 'A', reloj: () => ahora, duracionMs: 60000, consola: silencio });
    const B = crearCandadoDeTurno({ prisma: base.prisma, instancia: 'B', reloj: () => ahora, duracionMs: 60000, consola: silencio });
    const [ta, tb] = await Promise.all([A.tomar('c1'), B.tomar('c1')]);
    check('dos instancias piden el turno a la vez: lo obtiene UNA', [ta, tb].filter(Boolean).length === 1);
    check('la misma instancia no corre dos turnos del mismo chat', !(await A.tomar('c1')));
    await A.soltar('c1');
    check('al soltar, la otra lo puede tomar', await B.tomar('c1'));
    // B "muere" sin soltar: vence solo.
    ahora = art('11:05');
    const A2 = crearCandadoDeTurno({ prisma: base.prisma, instancia: 'A2', reloj: () => ahora, duracionMs: 60000, consola: silencio });
    check('un candado de un proceso muerto vence solo (el chat no queda trabado)', await A2.tomar('c1'));
    await A2.soltar('c1');
    check('soltar libera las columnas', base.chats[0].botTurnoHasta === null && base.chats[0].botTurnoPor === null);
}
{
    motivo._reiniciarEstadoColumnas();
    const base = baseFalsa({ chats: [{ id: 'c1' }], sinColumnas: true });
    const A = crearCandadoDeTurno({ prisma: base.prisma, instancia: 'A', consola: silencio });
    check('sin las columnas cae al candado en memoria: toma', await A.tomar('c1'));
    check('…y no deja correr un segundo turno en el mismo proceso', !(await A.tomar('c1')));
    await A.soltar('c1');
    check('…y se suelta', await A.tomar('c1'));
    motivo._reiniciarEstadoColumnas();
}
{
    const base = { whatsAppChat: { async updateMany() { throw new Error('connection refused'); } } };
    const A = crearCandadoDeTurno({ prisma: base, instancia: 'A', consola: silencio });
    check('si la base no responde, NO corre el turno (mejor uno menos que dos)', !(await A.tomar('c1')));
}

console.log('\nCableado (lo único que se mira en el código)');
{
    const { readFileSync } = await import('node:fs');
    const bc = readFileSync(new URL('../../wa-service/bot-cloud.js', import.meta.url), 'utf8');
    check('bot-cloud.js decide la vuelta con shared/vuelta-del-bot.js y el turno con shared/candado-de-turno.js', bc.includes("require('./shared/vuelta-del-bot')") && bc.includes("require('./shared/candado-de-turno')") && !bc.includes('turnosEnCurso'));
    check('ninguna decisión de bot-cloud.js lee la etiqueta [SISTEMA - BOT APAGADO]', !bc.includes('ETIQUETA_BOT_APAGADO'));
}

console.log('');
if (fallas) { console.log(`❌ ${fallas} falla(s).`); process.exit(1); }
console.log('✅ Vuelta del bot y candado del turno en orden.');
