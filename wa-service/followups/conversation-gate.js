/**
 * Compuerta de conversación: decide si CORRESPONDE mandar un seguimiento,
 * leyendo la charla — antes solo se usaba el LLM para redactar, nunca para
 * decidir, y un "no me interesa" dicho en el chat no frenaba nada salvo que
 * un humano cargara el tag a mano.
 *
 * Cuatro veredictos, en el orden en que protegen al cliente:
 *   CANCEL   — dijo que no, ya compró (acá o en otro lado) o pidió que no lo
 *              contacten → muere TODA la secuencia (etiqueta SIN_SEGUIMIENTO,
 *              que respetan los 5 sistemas de envío) y queda auditado en la ficha.
 *   POSTPONE — pidió retomar más adelante ("cuando cobre", "después de las
 *              vacaciones") → la tarea se corre a esa fecha, no se cancela.
 *   SKIP     — no ahora: un humano está gestionando el chat, hay una pregunta
 *              del cliente sin responder (un seguimiento genérico encima de una
 *              pregunta ignorada es lo peor que se puede mandar), o la compuerta
 *              falló → fail-closed: no se manda, se reintenta al ciclo siguiente.
 *   SEND     — charla viva o neutra → se manda, opcionalmente con una pista de
 *              adaptación (ej: "quiere lentes de contacto, no anteojos") que el
 *              redactor incorpora.
 *
 * Dos capas: primero patrones duros deterministas (gratis, sin LLM) para los
 * pedidos inequívocos de no contacto; después Gemini a temperatura 0 con salida
 * JSON validada. Cualquier error, timeout o JSON inválido degrada a SKIP.
 */

const { prisma } = require('../db');
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const { withTimeout } = require('../utils');
const { MODEL_NAME, GATE_TIMEOUT_MS, GATE_LOOKBACK_MESSAGES } = require('./config');

// ──────────────────────────────────────────────
// Capa 1: frenos duros deterministas
// ──────────────────────────────────────────────
// Solo frases inequívocas de "no me contacten". Lo ambiguo lo juzga el LLM con
// el contexto completo: "no me interesa" NO está acá a propósito — "no me
// interesa el color, mandame cualquiera" cancelaba toda la secuencia por
// coincidencia parcial. El LLM cancela igual cuando el "no me interesa" es
// genuino (verificado en pruebas en vivo).
const HARD_STOP_PATTERNS = [
    /no (me )?(escribas|escriban|contactes|contacten|molestes|molesten)/i,
    /dej(a|á) de (escribir|mandar|molestar|insistir)/i,
    /no quiero (mas|más) mensajes/i,
    /no quiero que me (escriban|contacten|llamen)/i,
    /sacame de (la lista|los contactos)/i,
    /basta de (mensajes|escribir|insistir)/i,
];

function findHardStop(inboundMessages) {
    for (const msg of inboundMessages) {
        const text = msg.content || '';
        const hit = HARD_STOP_PATTERNS.find(p => p.test(text));
        if (hit) return text.substring(0, 120);
    }
    return null;
}

// ──────────────────────────────────────────────
// Capa 2: juicio con contexto (Gemini, temp 0)
// ──────────────────────────────────────────────
let _model = null;
function getGateModel() {
    if (!_model) {
        _model = new ChatGoogleGenerativeAI({
            model: MODEL_NAME,
            temperature: 0,          // decisión, no creatividad
            // gemini-2.5-flash gasta tokens de razonamiento internos que
            // descuentan de este presupuesto: con 250 la respuesta JSON llegaba
            // TRUNCADA y el parser la rechazaba (fail-closed permanente).
            maxOutputTokens: 1024,
            apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY,
        });
    }
    return _model;
}

const GATE_SYSTEM_PROMPT =
    "Sos el auditor de seguimientos de una óptica. Tu ÚNICA tarea es leer una conversación de WhatsApp y decidir si corresponde mandarle HOY un mensaje de seguimiento comercial a este cliente.\n\n" +
    "Respondé SOLO un objeto JSON válido, sin markdown ni texto extra, con esta forma exacta:\n" +
    '{"decision":"SEND|SKIP|POSTPONE|CANCEL","signal":"INTERESTED|NEUTRAL|NOT_INTERESTED|BOUGHT_ELSEWHERE|ALREADY_BOUGHT|DO_NOT_CONTACT|POSTPONED|UNANSWERED_QUESTION|HUMAN_ACTIVE|OTHER","reason":"una frase corta en español","adaptHint":null,"postponeDays":null}\n\n' +
    "CRITERIOS (en este orden):\n" +
    "1. CANCEL — el cliente dijo que NO le interesa, que ya compró (acá o en otro lado), que lo dejen de contactar, o muestra fastidio ante seguimientos anteriores. También si la conversación revela que nunca fue un cliente potencial (proveedor, consulta laboral, número equivocado).\n" +
    "2. POSTPONE — pidió explícitamente retomar más adelante ('cuando cobre', 'después de las vacaciones', 'el mes que viene'). Estimá postponeDays (entero, 1 a 30).\n" +
    "3. SKIP — la última palabra la tiene el NEGOCIO y hace falta un HUMANO con datos: el cliente preguntó algo puntual que nadie respondió (un precio, si aceptan una obra social, stock de un color, horarios) o un vendedor está claramente en medio de una gestión (coordinando pago, envío, turno). Mandarle un seguimiento genérico encima de eso sería pésimo.\n" +
    "4. SEND — todo lo demás: charla viva, neutra, o sin respuesta del cliente. IMPORTANTE: si el cliente expresó una PREFERENCIA de producto distinta a lo cotizado (quiere lentes de contacto en vez de anteojos, otro modelo, es para otra persona, pidió que le armen otra opción), eso NO es SKIP: es SEND con adaptHint describiendo en una frase qué adaptar — el mensaje de seguimiento va a retomar exactamente ese pedido.\n\n" +
    "REGLAS:\n" +
    "- Ante la duda entre SEND y CANCEL, elegí SKIP (no mandar hoy sin matar la secuencia).\n" +
    "- Un cliente que simplemente no respondió NO es NOT_INTERESTED: el silencio es NEUTRAL, y se le puede escribir (SEND).\n" +
    "- adaptHint solo si hay algo concreto que adaptar; si no, null.\n" +
    "- postponeDays solo con decision POSTPONE; si no, null.";

const VALID_DECISIONS = ['SEND', 'SKIP', 'POSTPONE', 'CANCEL'];

function parseGateResponse(raw) {
    try {
        let cleaned = (raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        // Extraer el primer objeto JSON aunque venga rodeado de prosa: a
        // temperatura 0 una respuesta con texto alrededor se repetiría igual en
        // cada ciclo y dejaría la tarea en SKIP permanente.
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start === -1 || end <= start) return null;
        cleaned = cleaned.slice(start, end + 1);
        const parsed = JSON.parse(cleaned);
        // Tolerar decision en minúscula/mixta
        if (typeof parsed.decision === 'string') parsed.decision = parsed.decision.toUpperCase().trim();
        if (!VALID_DECISIONS.includes(parsed.decision)) return null;
        return {
            decision: parsed.decision,
            signal: typeof parsed.signal === 'string' ? parsed.signal : 'OTHER',
            reason: typeof parsed.reason === 'string' ? parsed.reason.substring(0, 200) : '',
            adaptHint: typeof parsed.adaptHint === 'string' && parsed.adaptHint.trim() ? parsed.adaptHint.substring(0, 200) : null,
            postponeDays: Number.isFinite(parsed.postponeDays) ? Math.min(30, Math.max(1, Math.round(parsed.postponeDays))) : null,
        };
    } catch {
        return null;
    }
}

/**
 * Evalúa si corresponde mandar un seguimiento a este chat.
 * NUNCA lanza: cualquier fallo degrada a SKIP (fail-closed).
 *
 * @param {Object} params
 * @param {Object} params.chat - WhatsAppChat (id, chatSummary opcional)
 * @param {Array}  params.recentMessages - Últimos mensajes (desc) del chat
 * @param {string} params.context - Qué se está por mandar (para el prompt)
 * @returns {Promise<{decision, signal, reason, adaptHint, postponeDays}>}
 */
async function evaluateConversationGate({ chat, recentMessages, context }) {
    const messages = (recentMessages || []).slice(0, GATE_LOOKBACK_MESSAGES);
    const inbound = messages.filter(m => m.direction === 'INBOUND');

    // Sin mensajes del cliente no hay nada que juzgar: dejamos pasar y que los
    // filtros de elegibilidad existentes (contacto frío, etc.) hagan su trabajo.
    if (inbound.length === 0) {
        return { decision: 'SEND', signal: 'NEUTRAL', reason: 'Sin mensajes entrantes para evaluar', adaptHint: null, postponeDays: null };
    }

    // Capa 1: frenos duros, sin LLM
    const hardStop = findHardStop(inbound);
    if (hardStop) {
        return { decision: 'CANCEL', signal: 'DO_NOT_CONTACT', reason: `Pedido explícito del cliente: "${hardStop}"`, adaptHint: null, postponeDays: null };
    }

    // Capa 2: juicio con contexto
    try {
        const historial = messages
            .slice()
            .reverse()
            .map(m => `[${m.direction === 'OUTBOUND' ? 'Óptica' : 'Cliente'}]: ${m.content || '(media)'}`)
            .join('\n');

        let userPrompt = '';
        if (chat?.chatSummary) userPrompt += `RESUMEN PREVIO DE LA CONVERSACIÓN: ${chat.chatSummary}\n\n`;
        userPrompt += `CONVERSACIÓN RECIENTE (la última línea es el último mensaje):\n${historial}\n\n`;
        userPrompt += `SEGUIMIENTO QUE SE QUIERE MANDAR: ${context || 'seguimiento comercial'}\n\nDecidí.`;

        const response = await withTimeout(
            getGateModel().invoke([new SystemMessage(GATE_SYSTEM_PROMPT), new HumanMessage(userPrompt)]),
            GATE_TIMEOUT_MS,
            'Timeout en compuerta de conversación'
        );

        const verdict = parseGateResponse(response.content.toString());
        if (!verdict) {
            return { decision: 'SKIP', signal: 'OTHER', reason: 'Respuesta de la compuerta inválida (fail-closed)', adaptHint: null, postponeDays: null };
        }
        return verdict;
    } catch (err) {
        // Fail-closed: si no pudimos evaluar, hoy no se manda. La tarea queda
        // viva y el ciclo siguiente vuelve a intentar.
        return { decision: 'SKIP', signal: 'OTHER', reason: `Compuerta falló: ${err.message} (fail-closed)`, adaptHint: null, postponeDays: null };
    }
}

/**
 * Aplica el veredicto CANCEL: etiqueta SIN_SEGUIMIENTO (la respetan los 5
 * sistemas de envío), cancela las tareas automáticas pendientes del cliente y
 * deja el porqué auditado en la ficha.
 */
async function applyCancelVerdict({ chat, clientId, clientName, verdict }) {
    try {
        const labels = [...(chat.chatLabels || [])];
        if (!labels.includes('SIN_SEGUIMIENTO')) labels.push('SIN_SEGUIMIENTO');
        await prisma.whatsAppChat.update({
            where: { id: chat.id },
            data: { chatLabels: labels },
        });

        if (clientId) {
            await prisma.clientTask.updateMany({
                where: {
                    clientId,
                    status: { in: ['PENDING', 'SENDING'] },
                    OR: [
                        { type: 'FOLLOWUP' },
                        { type: 'TASK', createdBy: 'Sistema (Pasivo)', description: { startsWith: '[Extracción Inteligente]' } },
                    ],
                },
                data: { status: 'CANCELLED', updatedAt: new Date() },
            });

            await prisma.interaction.create({
                data: {
                    clientId,
                    type: 'NOTE',
                    content: `🚦 [BOT] Seguimientos automáticos cancelados por lectura de la conversación.\nMotivo: ${verdict.reason}\n(señal: ${verdict.signal}; se aplicó SIN_SEGUIMIENTO — reactivar sacando la etiqueta del chat)`,
                    userName: 'Bot',
                },
            });
        }

        console.log(`  🚦 [Gate] Secuencia CANCELADA para ${clientName || chat.waId}: ${verdict.reason}`);
    } catch (err) {
        console.error(`  ❌ [Gate] No se pudo aplicar la cancelación para ${clientName || chat.waId}:`, err.message);
    }
}

module.exports = { evaluateConversationGate, applyCancelVerdict };
