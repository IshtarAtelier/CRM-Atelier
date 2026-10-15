'use strict';

/**
 * El agente de ventas ("Matías") sobre la API OFICIAL de WhatsApp.
 *
 * Es el turno de bot de `index.js` (grafo LangGraph + guardrails + envío) sin
 * nada de lo que la Cloud API vuelve innecesario: sin cola anti-ban, sin
 * Chromium, sin simulación de tipeo, sin seguimientos proactivos. Todo lo que
 * sale de acá pasa por `transport/cloud-transport.js`, que valida la ventana de
 * 24 h antes de gastar una llamada a Meta.
 *
 * Cómo se engancha (ver `cloud.js`): el webhook llama a una CADENA de
 * manejadores del entrante y cada uno decide si le toca. Este devuelve `true`
 * solo cuando se hace cargo del mensaje; si devuelve `false` (bot apagado,
 * bot apagado, chat excluido) el siguiente de la cadena —hoy el
 * auto-respondedor— tiene su chance. El bot ya NO se calla por horario:
 * atiende las 24 h (ver `handleInbound`).
 *
 * Reglas que este módulo garantiza:
 *  1. Nada sale sin pasar por el transporte cloud (ventana de 24 h incluida).
 *  2. `bot_enabled` (SystemSetting) se lee de la base EN CADA TURNO: la dueña
 *     lo apaga desde el panel y deja de contestar sin deploy. Si la bandera no
 *     se puede leer, el bot NO contesta (fail-safe).
 *  3. Un mismo mensaje no se contesta dos veces (dedup por wamid en la cadena
 *     de `cloud.js` + `botReplyingTo` + re-chequeo de mensajes nuevos).
 *  4. Solo se disparan mensajes ENTRANTES reales: los ecos del celular
 *     (`smb_message_echoes`) van por `persistEcho` y nunca llegan acá.
 *  5. Una falla del bot jamás rompe la persistencia del entrante ni el 200 del
 *     webhook: el turno corre desprendido y todo error termina en un log.
 */

const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const { graph, esFallaTransitoriaDeHerramienta } = require('./graph');
const { BotService } = require('./services/bot.service');
const { runOutputGuardrail } = require('./services/ai.service');
const { generateAndSaveHandoffSummary } = require('./tools');
const { TAGS_SIN_BOT } = require('./utils');
const { leerSalidaDelGrafo, armarRespuesta, crearTurno } = require('./shared/respuesta-del-turno');
const { escalarAHumano } = require('./shared/escalar');
const { clasificarEntrante, disparaTurno, entranteDeFila, filaDisparaTurno } = require('./shared/clasificar-entrante');
const { duenioDelChat, decidirVuelta, ANTIGUEDAD_MAXIMA_PARA_VOLVER_H } = require('./shared/duenio-del-chat');
const { isBusinessHours } = require('./shared/business-hours');
const { entroPorAnuncio, faseDeLaCharla, historiaNuestra, restriccionDeFase } = require('./shared/fase-de-la-charla');
const { mediaDescargable } = require('./shared/media');
const { esRemitenteHumano, whereSalienteHumano } = require('./shared/remitentes');
const { marcarTraspasoHumano, ETIQUETA_BOT_APAGADO } = require('./shared/traspaso-humano');
const { resolveWaMessageId } = require('./shared/message-id');
const { detectarTipoDeImagen } = require('./shared/tipo-de-imagen');
const { leerReceta, MAX_FOTOS_POR_LECTURA } = require('./shared/leer-receta');
const { urlDelMedio } = require('./shared/url-del-medio');

// Cuánto se espera antes de contestar, para juntar las burbujas que el cliente
// manda seguidas (mismo criterio que el transporte legacy). Configurable por
// entorno para poder probar la cadena sin esperar.
const DEBOUNCE_MS = Number(process.env.BOT_DEBOUNCE_MS || 25000);
// Corte duro del turno: si el grafo no cerró en este tiempo, se aborta EN SILENCIO.
const GRAPH_TIMEOUT_MS = Number(process.env.BOT_GRAPH_TIMEOUT_MS || 30000);
const RECURSION_LIMIT = 10;
// Cuántos mensajes del historial se le arman al modelo.
const HISTORY_SIZE = 30;
// Las imágenes van en base64 dentro del contexto: no pueden ser todas.
const MAX_IMAGENES_AL_MODELO = 3;
const MEDIA_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CONSECUTIVE_FAILED_TURNS = 3;
// Cada cuánto se refresca la config en memoria (la que muestra el panel).
const CONFIG_POLL_MS = 60 * 1000;
// Cada cuánto se barren los chats tomados por una persona con un cliente
// esperando (ver barrerVueltas). La ventana del equipo es de 20 min: un
// minuto de demora es despreciable y el barrido es una consulta indexada.
const BARRIDO_DE_VUELTAS_MS = 60 * 1000;
// Tope de chats por barrido: alcanza de sobra (hoy son decenas) y acota el
// costo si algo se descontrola.
const MAX_CHATS_POR_BARRIDO = 200;


/** Mimetype por extensión: la Cloud API decide imagen/documento por el mimetype. */
function guessMimetype(url = '') {
    const ext = String(url).split('?')[0].split('#')[0].split('.').pop().toLowerCase();
    switch (ext) {
        case 'png': return 'image/png';
        case 'webp': return 'image/webp';
        case 'gif': return 'image/gif';
        case 'pdf': return 'application/pdf';
        case 'mp4': return 'video/mp4';
        case 'jpg': case 'jpeg': default: return 'image/jpeg';
    }
}

/**
 * Sin mimetype, `cloud-api.mediaKind('')` clasifica cualquier URL como
 * DOCUMENTO y la foto de un armazón le llega al cliente como archivo adjunto.
 */
function adaptMedia(media) {
    if (!media) return null;
    if (media.mimetype) return media;
    if (media.url) return { ...media, mimetype: guessMimetype(media.url) };
    return media;
}

/**
 * @param {object} deps
 * @param {import('@prisma/client').PrismaClient} deps.prisma
 * @param {import('socket.io').Server} deps.io
 * @param {{ sendMessage: Function }} deps.transport transporte cloud
 * @param {Set<string>} deps.botReplyingTo
 * @param {(chatId: string) => void} deps.broadcastChatUpdate
 */
function createCloudBot({ prisma, io, transport, botReplyingTo, broadcastChatUpdate }) {
    // Estado que lee y escribe el panel (routes/api.js#GET|POST /agent).
    // `followupsEnabled` queda en false y no se usa: con la API oficial no hay
    // seguimientos proactivos por IA (fuera de la ventana solo entran plantillas).
    const agentState = {
        agentEnabled: false,
        followupsEnabled: false,
        agentPrompt: '',
        // Prompt PROPIO del agente de clientes existentes (SystemSetting
        // `bot_prompt_executive`). Si no existe, el ejecutivo usa su prompt por
        // defecto del repo, nunca el de ventas (ver graph.js).
        agentPromptExecutive: '',
        dailyContext: '',
        // El panel lo muestra y los crons del CRM lo obedecen. Vive en la base
        // (`SystemSetting.followups_enabled`); acá solo se cachea para
        // reportarlo por /api/status y por el socket.
        followupsEnabled: false,
    };

    const debounceTimers = new Map();   // chatId → Timeout
    const chatErrorCounts = new Map();  // chatId → turnos fallidos seguidos
    let configTimer = null;
    let barridoTimer = null;

    // ── Salida: SIEMPRE por el transporte cloud ─────────────────────────────
    // `options.chat` le ahorra al transporte la consulta de la ventana cuando ya
    // tenemos el chat; el chequeo de 24 h corre igual. `options.origen` es
    // obligatorio: el transporte rechaza el envío sin él, y si es 'llm' sanea
    // y pasa por el guardrail cada burbuja (shared/punto-de-salida.js).
    const sendViaCloud = (waId, content, media = null, options = {}) =>
        transport.sendMessage(waId, content, adaptMedia(media), options);

    const botService = new BotService({
        prisma, io, botReplyingTo,
        broadcastChatUpdate,
        generateAndSaveHandoffSummary,
        graph, agentState,
        sendMessage: sendViaCloud,
        sendTypingState: async () => null,
        TAGS_SIN_BOT,
    });
    botService.botDebounceTimers = debounceTimers;
    botService.chatErrorCounts = chatErrorCounts;

    const disableBotForChatById = (chatId, reason) => botService.disableBotForChatById(chatId, reason);

    // ── Config ──────────────────────────────────────────────────────────────

    /**
     * Lee la bandera maestra. Fail-safe: si la base no responde, el bot NO
     * contesta (mejor mudo que hablando cuando la dueña creía haberlo apagado).
     */
    async function isEnabled() {
        try {
            const row = await prisma.systemSetting.findUnique({ where: { key: 'bot_enabled' } });
            const on = row ? row.value === 'true' : false;
            agentState.agentEnabled = on;
            return on;
        } catch (e) {
            agentState.agentEnabled = false;
            console.error('[BotCloud] No se pudo leer bot_enabled — el bot NO contesta (fail-safe):', e.message);
            return false;
        }
    }

    /** Prompt y contexto del día. Si falla, quedan los valores en memoria. */
    async function loadConfig() {
        try {
            const [enabled, prompt, contexto, seguimientos, promptEjecutivo] = await Promise.all([
                prisma.systemSetting.findUnique({ where: { key: 'bot_enabled' } }),
                prisma.systemSetting.findUnique({ where: { key: 'bot_prompt' } }),
                prisma.systemSetting.findUnique({ where: { key: 'bot_daily_context' } }),
                prisma.systemSetting.findUnique({ where: { key: 'followups_enabled' } }),
                prisma.systemSetting.findUnique({ where: { key: 'bot_prompt_executive' } }),
            ]);
            agentState.agentEnabled = enabled ? enabled.value === 'true' : false;
            agentState.followupsEnabled = seguimientos ? seguimientos.value === 'true' : false;
            if (prompt) agentState.agentPrompt = prompt.value || '';
            // Sin fila = sin prompt propio (se usa el del repo). Se resetea a ''
            // para que borrar la clave desde la base surta efecto sin reiniciar.
            agentState.agentPromptExecutive = promptEjecutivo ? (promptEjecutivo.value || '') : '';
            if (contexto) agentState.dailyContext = contexto.value || '';
        } catch (e) {
            agentState.agentEnabled = false; // fail-safe, igual que isEnabled()
            console.error('[BotCloud] No se pudo cargar la config del bot:', e.message);
        }
        return agentState;
    }

    async function init() {
        await loadConfig();
        if (!configTimer) {
            configTimer = setInterval(() => loadConfig().catch(() => {}), CONFIG_POLL_MS);
            configTimer.unref?.();
        }
        if (!barridoTimer) {
            barridoTimer = setInterval(() => barrerVueltas().catch(e => console.error('  ❌ [BotCloud] Barrido de vueltas falló:', e.message)), BARRIDO_DE_VUELTAS_MS);
            barridoTimer.unref?.();
        }
        console.log(`🤖 [BotCloud] Agente ${agentState.agentEnabled ? 'ENCENDIDO' : 'apagado'} (SystemSetting bot_enabled) · debounce ${DEBOUNCE_MS}ms`);
        return agentState;
    }

    function stop() {
        if (configTimer) clearInterval(configTimer);
        configTimer = null;
        for (const t of debounceTimers.values()) clearTimeout(t);
        debounceTimers.clear();
        if (barridoTimer) clearInterval(barridoTimer);
        barridoTimer = null;
    }

    // ── Entrada: ¿le toca al bot este mensaje? ───────────────────────────────

    /**
     * Manejador de la cadena de `cloud.js`.
     *
     * @param {object} msg   entrante normalizado por transport/webhook.js
     * @param {{ chat: object }} res  lo que devolvió persistInbound
     * @returns {Promise<boolean>} true si el bot se hace cargo (corta la cadena)
     */
    async function handleInbound(msg, res) {
        const chat = res && res.chat;
        if (!chat) return false;

        if (!(await isEnabled())) return false;

        // ¿Es una CONSULTA? Una reacción, un "gracias" de cierre o el
        // contestador automático del negocio del cliente ("Hola! Estoy fuera
        // trabajando. Regreso mañana") se guardan (ya lo hizo persistInbound)
        // pero no disparan turno. Antes solo se miraba el tipo: el contestador
        // del cliente le programaba al bot un turno entero — y si el chat lo
        // tenía una vendedora, encima lo reactivaba. Definición única en
        // shared/clasificar-entrante.js (la usan también index.js y el
        // auto-respondedor).
        const ultimoNuestro = await prisma.whatsAppMessage.findFirst({
            where: { chatId: chat.id, direction: 'OUTBOUND' },
            orderBy: { createdAt: 'desc' },
            select: { content: true },
        }).catch(() => null);
        const clase = clasificarEntrante(msg, { ultimoNuestroPregunta: /\?\s*\W*$/.test(String((ultimoNuestro && ultimoNuestro.content) || '').trim()) });
        if (!disparaTurno(clase)) {
            console.log(`  🤏 [BotCloud] Entrante "${clase}" (tipo ${msg && msg.type}): se guarda, no se responde.`);
            return false;
        }

        // ATIENDE A TODA HORA (decisión de Ishtar, 5/9/2026).
        //
        // Antes se callaba fuera de horario y le dejaba el turno al
        // auto-respondedor. El problema: el auto-respondedor tiene su PROPIO
        // interruptor (`auto_responder_enabled`), y estaba apagado. O sea que
        // con el local cerrado no contestaba NADIE. Pasó el sábado 5/9 a las
        // 19:17 — el local cierra 17:00 los sábados — con una clienta que venía
        // de un anuncio de Meta preguntando por clip-ons: quedó sin respuesta.
        //
        // Dos candados independientes para el mismo silencio es un mal diseño:
        // el que apaga uno no se entera de que el otro también hace falta. Ahora
        // el bot atiende siempre, y el auto-respondedor queda como red para
        // cuando el bot está apagado (la cadena de `cloud.js` lo llama después).
        //
        // El bot SABE la hora: el prompt recibe [HORA_ACTUAL] y el horario del
        // local, así que dice que está cerrado sin que haya que callarlo.

        const fresh = await prisma.whatsAppChat.findUnique({
            where: { id: chat.id },
            select: { id: true, waId: true, realPhone: true, profileName: true, botEnabled: true, chatLabels: true, clientId: true },
        });
        if (!fresh) return false;
        if (!fresh.botEnabled && !(await evaluarVuelta(fresh)).vuelve) return false;

        if (await tieneExclusion(fresh, msg)) return false;

        programarTurno(fresh, msg);
        // La foto se empieza a leer YA, en paralelo a la espera del debounce:
        // así la lectura (10-25 s) casi nunca suma latencia al turno.
        if (String(msg.type || '').toLowerCase() === 'image') preleerFoto(fresh, msg);
        return true;
    }

    /**
     * Lecturas de recetas arrancadas apenas llegó la foto, por waMessageId.
     * `procesarRecetaDeLaFoto` las espera en vez de volver a pedirlas. Cada
     * entrada se va sola a los LECTURA_TTL_MS: si el turno se canceló (bot
     * apagado durante el debounce) nadie la consume.
     */
    const lecturasEnCurso = new Map();
    const fotosYaLeidas = new Set(); // fotos que ya pasaron por procesarRecetaDeLaFoto
    const LECTURA_TTL_MS = 10 * 60 * 1000;
    function preleerFoto(chat, msg) {
        const id = msg && msg.wamid;
        if (!id || lecturasEnCurso.has(id) || fotosYaLeidas.has(id)) return;
        const lectura = (async () => {
            // inbound.js ya bajó el medio y guardó el mensaje con su mediaUrl.
            const fila = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: id }, select: { mediaUrl: true } });
            const img = fila && await obtenerImagenDelMensaje({ waMessageId: id, mediaUrl: fila.mediaUrl }, chat.id);
            if (!img) return null;
            const t0 = Date.now();
            const r = await leerReceta({ base64: img.base64, mimeType: img.mimeType });
            console.log(`  👓 [LeerReceta] ${id} (adelantada): ${describirLectura(r)} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
            return r;
        })().catch(e => { console.error(`  ❌ [LeerReceta] adelantada ${id} falló:`, e.message); return null; });
        lecturasEnCurso.set(id, lectura);
        const t = setTimeout(() => lecturasEnCurso.delete(id), LECTURA_TTL_MS);
        t.unref?.();
    }

    const describirLectura = (r) => `${r.esReceta ? (r.legible ? `receta ${r.tipo}` : 'receta NO legible') : 'no es receta'} · ${r.modelo || r.error || '—'}`;

    /**
     * ¿Vuelve el bot a un chat que tomó una persona? Lo decide
     * shared/duenio-del-chat.js (regla única, ver ahí el porqué):
     *   - local ABIERTO: un entrante NO lo reactiva de inmediato; el equipo
     *     tiene VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN para contestar. Si
     *     nadie contestó, vuelve el bot y responde.
     *   - el local CERRÓ con el cliente esperando: vuelve.
     *   - local CERRADO desde antes: la regla del 17/9/2026, 3 h sin que
     *     escriba una persona.
     *
     * SOLO reactiva lo que apagó un traspaso humano (la etiqueta). Un chat
     * apagado por post-venta, reclamo o un tag sin bot sigue mudo.
     *
     * 'esperar' ya no arma un setTimeout (15/10/2026): se perdía en cada
     * redeploy y nadie volvía a mirar el chat. Lo retoma `barrerVueltas`, que
     * recalcula todo desde la base cada minuto.
     *
     * Dos instancias del wa-service pueden barrer a la vez (ya pasó con los
     * crons): la reactivación es un `updateMany` CONDICIONADO a
     * `botEnabled: false`, así que solo una gana el chat y programa el turno.
     *
     * @returns {Promise<{ vuelve: boolean, esperando: object|null }>}
     */
    async function evaluarVuelta(chat) {
        const duenio = await duenioDelChat(prisma, chat);
        const d = decidirVuelta({ ...duenio, ahora: new Date(), enHorario: isBusinessHours });
        const quien = chat.profileName || chat.waId;
        const esperando = duenio.esperando || null;

        if (d.accion === 'volver') {
            // Se va también la etiqueta: si quedara, el auto-resume de 24 h de la
            // otra vía seguiría viendo un chat "tomado por un humano" que ya no lo
            // está, y el buzón mostraría BOT APAGADO con el bot encendido.
            const sinEtiqueta = (chat.chatLabels || []).filter(l => l !== ETIQUETA_BOT_APAGADO);
            const r = await prisma.whatsAppChat.updateMany({
                where: { id: chat.id, botEnabled: false },
                data: { botEnabled: true, chatLabels: sinEtiqueta },
            }).catch(e => { console.error('  ⚠️ [BotCloud] No se pudo reactivar el bot:', e && e.message); return { count: 0 }; });
            if (!r || r.count !== 1) return { vuelve: false, esperando }; // lo ganó otro camino u otra instancia
            chat.botEnabled = true;
            chat.chatLabels = sinEtiqueta;
            console.log(`  🔄 [BotCloud] El bot vuelve en ${quien}: ${d.motivo} (último del equipo: ${duenio.quien || '—'}).`);
            broadcastChatUpdate(chat.id);
            return { vuelve: true, esperando };
        }

        if (d.accion === 'esperar') {
            console.log(`  ⏳ [BotCloud] ${quien} lo atiende ${duenio.quien || 'una persona'}: ${d.motivo}. Lo retoma el barrido en ~${Math.ceil(d.esperarMs / 60000)} min.`);
            return { vuelve: false, esperando };
        }

        console.log(`  🙋 [BotCloud] ${quien}: el bot no vuelve (${d.motivo}).`);
        return { vuelve: false, esperando };
    }

    /**
     * Cada BARRIDO_DE_VUELTAS_MS: los chats tomados por una persona con un
     * entrante reciente se vuelven a decidir con la base fresca. Es lo que
     * hace cumplir la ventana del equipo aunque el proceso se haya reiniciado.
     * Solo mira chats con entrantes de las últimas ANTIGUEDAD_MAXIMA_PARA_VOLVER_H.
     */
    let barriendo = false;
    async function barrerVueltas() {
        if (barriendo) return;
        barriendo = true;
        try {
            if (!(await isEnabled())) return;
            const desde = new Date(Date.now() - ANTIGUEDAD_MAXIMA_PARA_VOLVER_H * 60 * 60 * 1000);
            const chats = await prisma.whatsAppChat.findMany({
                where: { botEnabled: false, chatLabels: { has: ETIQUETA_BOT_APAGADO }, lastInboundAt: { gte: desde } },
                select: { id: true, waId: true, realPhone: true, profileName: true, botEnabled: true, chatLabels: true, clientId: true },
                orderBy: { lastInboundAt: 'asc' },
                take: MAX_CHATS_POR_BARRIDO,
            });
            for (const chat of chats) {
                if (debounceTimers.has(chat.id) || turnosEnCurso.has(chat.id)) continue;
                const { vuelve, esperando } = await evaluarVuelta(chat);
                if (!vuelve || !esperando) continue;
                const msg = { ...entranteDeFila(esperando), profileName: chat.profileName, from: chat.realPhone };
                if (await tieneExclusion(chat, msg)) continue;
                programarTurno(chat, msg, REINTENTO_CON_TURNO_EN_CURSO_MS);
            }
        } finally {
            barriendo = false;
        }
    }

    /**
     * Etiquetas que apagan el bot (de la ficha o del chat). Un mensaje que viene
     * de un anuncio de Meta las pisa: es una consulta nueva, no la vieja.
     */
    async function tieneExclusion(chat, msg) {
        const esDeAnuncio = /\[meta[^\]]*\]/i.test(msg && msg.text ? msg.text : '') || Boolean(msg && msg.referral);
        let tags = [];
        if (chat.clientId) {
            const client = await prisma.client.findUnique({
                where: { id: chat.clientId },
                select: { tags: { select: { name: true } } },
            }).catch(() => null);
            tags = (client && client.tags) || [];
        }
        const excluido = tags.some(t => TAGS_SIN_BOT.some(x => (t.name || '').toLowerCase().includes(x)))
            || (chat.chatLabels || []).some(l => TAGS_SIN_BOT.some(x => (l || '').toLowerCase().includes(x)));
        if (!excluido) return false;
        if (esDeAnuncio) {
            console.log(`  🎯 [BotCloud] Etiqueta de exclusión pisada por mensaje de anuncio en ${chat.waId}.`);
            return false;
        }
        console.log(`  🚫 [BotCloud] Chat ${chat.waId} excluido por etiqueta.`);
        return true;
    }

    /**
     * Candado por chat: los chats con un turno CORRIENDO. Un entrante que llega
     * mientras el modelo piensa no arranca un segundo turno en paralelo (dos
     * respuestas encimadas, dos lecturas de la misma receta): se reprograma
     * para después. El turno en curso, al terminar, ve que llegó algo nuevo y
     * descarta su respuesta (control "¿Escribió de nuevo mientras pensábamos?");
     * el reprogramado contesta todo junto.
     */
    const turnosEnCurso = new Set();
    // Cuánto se reintenta cuando el turno anterior todavía corre.
    const REINTENTO_CON_TURNO_EN_CURSO_MS = 3000;

    /** Junta las burbujas seguidas del cliente en un solo turno. */
    function programarTurno(chat, msg, esperaMs = DEBOUNCE_MS) {
        if (debounceTimers.has(chat.id)) clearTimeout(debounceTimers.get(chat.id));
        const waId = chat.waId;
        const profileName = msg.profileName || chat.profileName || 'Cliente';
        const realPhone = chat.realPhone || msg.from || null;
        const t = setTimeout(() => {
            debounceTimers.delete(chat.id);
            if (turnosEnCurso.has(chat.id)) {
                console.log(`  🔒 [BotCloud] ${profileName} ya tiene un turno corriendo: se reprograma.`);
                programarTurno(chat, msg, REINTENTO_CON_TURNO_EN_CURSO_MS);
                return;
            }
            turnosEnCurso.add(chat.id);
            processBotTurn(chat, waId, profileName, realPhone)
                .catch(e => console.error('  ❌ [BotCloud] Error async en processBotTurn:', e.message))
                .finally(() => turnosEnCurso.delete(chat.id));
        }, esperaMs);
        t.unref?.();
        debounceTimers.set(chat.id, t);
        console.log(`  🕒 [BotCloud] Respuesta programada para ${profileName} en ${esperaMs}ms.`);
    }

    // ── Imágenes del historial ──────────────────────────────────────────────

    function cachearMedia(chatId, item) {
        if (!chatId || !item) return item;
        if (!global.mediaCache) global.mediaCache = {};
        if (!Array.isArray(global.mediaCache[chatId])) global.mediaCache[chatId] = [];
        global.mediaCache[chatId].push(item);
        const t = setTimeout(() => {
            if (global.mediaCache[chatId]) {
                global.mediaCache[chatId] = global.mediaCache[chatId].filter(i => i !== item);
                if (global.mediaCache[chatId].length === 0) delete global.mediaCache[chatId];
            }
        }, MEDIA_CACHE_TTL_MS);
        t.unref?.();
        return item;
    }

    /**
     * La imagen que el cliente mandó, para que el modelo la VEA. Primero la
     * caché (la usa también save_prescription_data para adjuntar la receta a la
     * ficha); si no está, se baja del CRM.
     */
    async function obtenerImagenDelMensaje(m, chatId) {
        const cached = ((global.mediaCache || {})[chatId] || []).find(i => i.waMessageId === m.waMessageId);
        if (cached) return cached;
        if (!m.mediaUrl) return null;
        try {
            const axios = require('axios');
            // La URL la arma shared/url-del-medio.js: con la clave pelada de la
            // nube, `base + mediaUrl` apuntaba a un host inexistente.
            const url = urlDelMedio(m.mediaUrl);
            // Las fotos de los chats son sensibles: el CRM las sirve solo con sesión o con la clave del bot.
            const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 15 * 1024 * 1024, headers: { 'x-api-key': process.env.BOT_API_KEY } });
            // El tipo sale de los BYTES, no de la cabecera: las fotos de WhatsApp
            // se guardan sin extensión y el servidor las sirve como
            // application/octet-stream. Con el chequeo por cabecera el bot
            // descartaba la foto y el modelo nunca veía la receta (ver
            // shared/tipo-de-imagen.js). La cabecera queda como respaldo.
            const buffer = Buffer.from(r.data);
            const cabecera = (r.headers['content-type'] || '').split(';')[0].trim();
            const mimeType = detectarTipoDeImagen(buffer) || (cabecera.startsWith('image/') ? cabecera : null);
            if (!mimeType) {
                console.warn(`  ⚠️ [BotCloud] ${m.waMessageId}: el archivo no es una imagen reconocible (cabecera "${cabecera}"). No se le muestra al modelo.`);
                return null;
            }
            return cachearMedia(chatId, {
                waMessageId: m.waMessageId,
                base64: buffer.toString('base64'),
                mimeType,
                timestamp: Date.now(),
            });
        } catch (e) {
            console.error(`  ⚠️ [BotCloud] No se pudo recuperar la imagen ${m.waMessageId}: ${e.message}`);
            return null;
        }
    }

    /**
     * Historial en formato LangChain. Mismo armado que el transporte legacy:
     * timestamp visible, imágenes multimodales, limpieza de la marca [metaXxx]
     * y fusión de burbujas seguidas del bot para no gastar slots de contexto.
     */
    async function armarHistorial(mensajes, chatId) {
        const cronologicos = mensajes.slice().reverse();
        const imagenes = new Map();
        const candidatas = cronologicos
            .filter(m => m.direction !== 'OUTBOUND' && m.type === 'IMAGE')
            .slice(-MAX_IMAGENES_AL_MODELO);
        for (const m of candidatas) {
            const img = await obtenerImagenDelMensaje(m, chatId);
            if (img) imagenes.set(m.waMessageId, img);
        }

        const formatter = new Intl.DateTimeFormat('es-AR', {
            timeZone: 'America/Argentina/Cordoba',
            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });

        const crudos = cronologicos.map(m => {
            const ts = `[${formatter.format(new Date(m.createdAt))}] `;
            if (m.direction === 'OUTBOUND') {
                // Un saliente que escribió una PERSONA del equipo no puede
                // entrar como palabras del bot: si no, el modelo cree que él
                // cotizó, prometió una fecha o pidió la receta, y sigue desde
                // ahí — repitiendo o contradiciendo a la vendedora.
                if (esRemitenteHumano(m.senderName)) {
                    return { role: 'ai', content: `${ts}[Lo escribió ${m.senderName}, del equipo] ${m.content || ''}`.trim() };
                }
                return { role: 'ai', content: ts + (m.content || '') };
            }
            if (m.type === 'IMAGE') {
                const img = imagenes.get(m.waMessageId);
                if (img) {
                    return { role: 'human', multimodal: true, content: [
                        { type: 'text', text: `${ts}[Imagen adjunta. Mensaje del cliente: "${m.content || '(sin texto)'}"]` },
                        { type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } },
                    ] };
                }
                // Nunca decir "antigua": el modelo lo leía como que la RECETA era vieja.
                return { role: 'human', content: `${ts}[El cliente adjuntó una imagen que no podemos mostrarte en este turno. NO comentes su antigüedad, su fecha ni su contenido, y NO le pidas que te dicte los datos de la receta. Si ya la leíste antes en esta charla, usá esos valores y seguí normalmente. Texto que la acompañaba: "${m.content || '(sin texto)'}"]` };
            }
            if (m.type === 'AUDIO') return { role: 'human', content: `${ts}[El cliente envió un audio transcrito. Mensaje: ${m.content}]` };
            let limpio = m.content || '';
            if (/\[meta[^\]]*\]/i.test(limpio)) {
                limpio = limpio.replace(/\[meta[^\]]*\]/gi, '').trim();
                if (!limpio) limpio = 'Hola, vengo de un anuncio de Facebook/Instagram y estoy interesado.';
            }
            return { role: 'human', content: ts + (limpio || '[Mensaje vacío]') };
        });

        const fusionados = [];
        for (let i = 0; i < crudos.length; i++) {
            const cur = crudos[i];
            if (cur.role === 'ai') {
                let contenido = cur.content;
                while (i + 1 < crudos.length && crudos[i + 1].role === 'ai') {
                    i++;
                    contenido += '\n\n' + crudos[i].content;
                }
                fusionados.push(new AIMessage(contenido));
            } else {
                fusionados.push(cur.multimodal ? new HumanMessage({ content: cur.content }) : new HumanMessage(cur.content));
            }
        }
        return fusionados;
    }

    // ── Fallas ──────────────────────────────────────────────────────────────

    /**
     * El cliente NUNCA se entera de un error interno: el turno se aborta en
     * silencio y el bot queda activo. Recién tras varios turnos seguidos
     * fallidos se apaga el bot en ese chat y se avisa al panel.
     */
    async function fallaTransitoria(chat, waId, profileName, motivo) {
        const fallas = (chatErrorCounts.get(chat.id) || 0) + 1;
        chatErrorCounts.set(chat.id, fallas);
        if (fallas < MAX_CONSECUTIVE_FAILED_TURNS) {
            console.warn(`  🔇 [BotCloud] Turno abortado en silencio (${fallas}/${MAX_CONSECUTIVE_FAILED_TURNS}) para ${profileName || waId}. Motivo: ${motivo}`);
            return false;
        }
        chatErrorCounts.delete(chat.id);
        console.error(`  🛑 [BotCloud] ${MAX_CONSECUTIVE_FAILED_TURNS} turnos fallidos seguidos para ${profileName || waId}. Se apaga el bot en ese chat.`);
        await disableBotForChatById(chat.id, `Errores técnicos persistentes (${String(motivo).substring(0, 50)})`);
        if (io) io.emit('bot_error', { chatId: chat.id, name: profileName || 'Cliente', phone: waId, error: `Desactivado por errores persistentes: ${String(motivo).substring(0, 80)}` });
        return true;
    }

    // ── El turno ────────────────────────────────────────────────────────────

    // ── Lector dedicado de recetas ──────────────────────────────────────────
    // Apenas llega una foto, el SISTEMA la lee con su propio paso
    // (shared/leer-receta.js: reglas estrictas, modelo fino, validación de
    // rangos) y, si es una receta legible, la guarda con la foto. El agente de
    // ventas recibe la ficha ya con la receta: no tiene que "mirar la foto
    // mientras charla", decidir los valores ni acordarse de guardarla — que es
    // como se inventaron recetas y se preguntó "¿mono o multi?".
    //
    // Idempotente: cada foto deja la marca [foto:<waMessageId>] en la receta
    // (o en la tarea) y no se vuelve a guardar, ni por acá ni por la tool.
    async function procesarRecetaDeLaFoto(chatId, recientes, freshChat) {
        // Solo las fotos que llegaron en ESTE turno (después de nuestra última
        // respuesta), y se leen JUNTAS: una receta puede venir en dos fotos
        // (lejos en una, cerca en la otra) y leída de a una parecía monofocal.
        const nuestra = recientes.find(m => m.direction === 'OUTBOUND');
        const fotos = recientes
            .filter(m => m.direction === 'INBOUND' && m.type === 'IMAGE' && m.waMessageId && !fotosYaLeidas.has(m.waMessageId))
            .filter(m => !nuestra || m.createdAt > nuestra.createdAt)
            .slice(0, MAX_FOTOS_POR_LECTURA)
            .reverse(); // cronológico: la primera foto suele ser la principal
        if (!fotos.length) return null;
        fotos.forEach(f => fotosYaLeidas.add(f.waMessageId));

        const cache = (global.mediaCache || {})[chatId] || [];
        const imagenes = fotos.map(f => cache.find(i => i.waMessageId === f.waMessageId)).filter(Boolean);
        if (!imagenes.length) return null;
        const clientId = freshChat.clientId;
        if (!clientId) return null; // sin ficha no hay dónde guardarla (alta-de-ficha ya lo intentó)
        const marca = fotos.map(f => `[foto:${f.waMessageId}]`).join(' ');

        const yaGuardada = await prisma.prescription.findFirst({ where: { clientId, OR: fotos.map(f => ({ notes: { contains: `[foto:${f.waMessageId}]` } })) }, select: { id: true } });
        if (yaGuardada) return { guardada: true, yaEstaba: true };

        const t0 = Date.now();
        // Una sola foto: se usa la lectura que arrancó al llegar (ver preleerFoto).
        // Varias: se leen juntas, aunque cada una tenga su lectura adelantada.
        const adelantada = fotos.length === 1 ? lecturasEnCurso.get(fotos[0].waMessageId) : null;
        const r = (adelantada && await adelantada) || await leerReceta({ imagenes });
        fotos.forEach(f => lecturasEnCurso.delete(f.waMessageId));
        console.log(`  👓 [LeerReceta] ${marca}: ${describirLectura(r)} · ${adelantada ? 'esperada' : 'leída ahora'} en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        if (!r.esReceta) return null;

        if (!r.legible) {
            const yaHayTarea = await prisma.clientTask.findFirst({ where: { clientId, description: { contains: marca } }, select: { id: true } });
            if (!yaHayTarea) {
                await prisma.clientTask.create({ data: {
                    clientId, type: 'TASK', status: 'PENDING', dueDate: new Date(), createdBy: 'Bot',
                    description: `Leer receta a mano: el sistema no pudo leerla con seguridad${r.dudas ? ` (${r.dudas})` : ''}. ${marca}`,
                } }).catch(() => {});
            }
            return { guardada: false };
        }

        const v = r.valores;
        const { savePrescription } = require('./tools');
        const principal = imagenes[0];
        await savePrescription({
            clientId, tipoDeLente: r.tipo,
            odEsf: v.odEsf, odCil: v.odCil, odEje: v.odEje,
            oiEsf: v.oiEsf, oiCil: v.oiCil, oiEje: v.oiEje,
            add: v.add, odDip: v.dip, nearSphereOD: v.odCercaEsf, nearSphereOI: v.oiCercaEsf,
            notes: `Leída por el sistema de ${fotos.length > 1 ? `${fotos.length} fotos` : 'la foto'} de WhatsApp (${r.modelo})${r.dudas ? `. Dudas: ${r.dudas}` : ''} ${marca}`,
            imageBase64: principal.base64, imageMimeType: principal.mimeType,
        });
        return { guardada: true };
    }

    async function processBotTurn(chat, waId, profileName, realPhone) {
        // Momento en que arranca el turno: todo saliente humano posterior a
        // esto es una intervención que tiene que callar al bot (ver el control
        // de más abajo, antes de enviar).
        const comienzoDelTurno = Date.now();
        try {
            const freshChat = await prisma.whatsAppChat.findUnique({
                where: { id: chat.id },
                include: { client: { include: { tags: true, prescriptions: { orderBy: { date: 'desc' }, take: 3 }, interactions: { orderBy: { createdAt: 'desc' }, take: 5 } } } },
            });
            if (!freshChat || !freshChat.botEnabled) {
                console.log(`  🚫 [BotCloud] Turno cancelado para ${profileName || waId}: el bot está apagado en ese chat.`);
                return;
            }
            // La dueña pudo apagarlo durante el debounce.
            if (!(await isEnabled())) {
                console.log('  🚫 [BotCloud] Turno cancelado: bot_enabled se apagó durante el debounce.');
                return;
            }

            const recientes = await prisma.whatsAppMessage.findMany({
                where: { chatId: chat.id },
                orderBy: { createdAt: 'desc' },
                take: HISTORY_SIZE,
            });
            const masNuevoProcesado = recientes[0] || null;
            const messages = await armarHistorial(recientes, chat.id);

            // Si llegó una foto de receta, el sistema la lee y la guarda ANTES de
            // que hable el agente; después se recarga la ficha para que el agente
            // la vea en "RECETAS GUARDADAS". Si falla, el turno sigue igual.
            const lectura = await procesarRecetaDeLaFoto(chat.id, recientes, freshChat)
                .catch(e => { console.error('  ❌ [LeerReceta] falló (el turno sigue):', e.message); return null; });
            if (lectura && lectura.guardada && !lectura.yaEstaba && freshChat.clientId) {
                freshChat.client = await prisma.client.findUnique({
                    where: { id: freshChat.clientId },
                    include: { tags: true, prescriptions: { orderBy: { date: 'desc' }, take: 3 }, interactions: { orderBy: { createdAt: 'desc' }, take: 5 } },
                }).catch(() => freshChat.client);
            }

            // La cola de envíos del turno: las herramientas (send_product_photos)
            // encolan acá y nada sale hasta el bucle de burbujas de abajo.
            const turno = crearTurno();
            // La fase la decide el código con las filas CRUDAS (el historial ya
            // limpió la marca [metaXxx]). Ver shared/fase-de-la-charla.js.
            const porAnuncio = entroPorAnuncio(recientes);
            // "Ya hablamos" sale de la FIRMA de cada saliente, no de su texto
            // (15/10/2026): un saludo del bot que se parecía a la bienvenida de
            // Meta hacía que el turno siguiente volviera a saludar.
            const historia = historiaNuestra(recientes);
            const state = {
                messages,
                userPhone: realPhone || freshChat.realPhone || '',
                userName: profileName,
                waId,
                chatId: chat.id,
                entroPorAnuncio: porAnuncio,
                historiaNuestra: historia,
                fase: faseDeLaCharla(messages, { entroPorAnuncio: porAnuncio, yaHablamos: historia.yaHablamos }),
                customPrompt: agentState.agentPrompt,
                customPromptExecutive: agentState.agentPromptExecutive,
                dailyContext: agentState.dailyContext,
                clientData: freshChat.client || null,
                chatSummary: freshChat.chatSummary || null,
            };
            // Corte del turno que de verdad CORTA (10/10/2026). Antes era un
            // Promise.race: el turno "terminaba" a los 30 s pero el grafo seguía
            // corriendo de fondo, y una herramienta que mandaba fotos las
            // mandaba igual, sin respuesta del bot detrás. Ahora la señal llega
            // al grafo (LangGraph corta entre pasos y la pasa a los modelos y a
            // las herramientas) y el turno queda cancelado: lo encolado se tira.
            const abortar = new AbortController();
            // recursionLimit acá y no en compile(): LangGraph lo ignora en compile().
            const config = { configurable: { thread_id: waId, turno }, recursionLimit: RECURSION_LIMIT, signal: abortar.signal };

            let result;
            let reloj = null;
            try {
                result = await Promise.race([
                    graph.invoke(state, config),
                    new Promise((_, rej) => {
                        reloj = setTimeout(() => {
                            turno.cancelar();
                            abortar.abort(new Error(`Bot timeout: graph.invoke superó ${GRAPH_TIMEOUT_MS}ms`));
                            rej(new Error(`Bot timeout: graph.invoke superó ${GRAPH_TIMEOUT_MS}ms`));
                        }, GRAPH_TIMEOUT_MS);
                    }),
                ]);
            } catch (graphErr) {
                console.error(`  ❌ [BotCloud] graph.invoke: ${graphErr.message}`);
                turno.cancelar();
                result = { messages: [] };
            } finally {
                clearTimeout(reloj);
            }

            const salida = Array.isArray(result && result.messages) ? result.messages : [];

            // ── Apagado silencioso pedido por el propio agente ───────────────
            const pidioApagado = salida.some(m => Array.isArray(m.tool_calls) && m.tool_calls.some(c => c.name === 'disable_bot_for_personal_chat' || c.name === 'cancel_bot'));
            if (pidioApagado) {
                console.log(`  ⏹️ [BotCloud] Apagado silencioso (${chat.id}): no se responde nada.`);
                await disableBotForChatById(chat.id, 'Detección de chat personal/cancelación silenciosa');
                broadcastChatUpdate(chat.id);
                return;
            }

            // ── Caída REAL de una herramienta: silencio absoluto ─────────────
            //
            // Se clasifica con la señal que deja `safeToolRun` en el origen
            // (agent-tools.js), NO olfateando el texto del resultado. El patrón
            // anterior matcheaba \b404\b y \b500\b sueltos, y los precios de la
            // óptica los contienen: medido contra la base real, el 5,3% de los
            // productos y el 15% de los presupuestos de 3 opciones disparaban la
            // falsa alarma, y el turno se descartaba entero — el cliente no
            // recibía NADA. Lo cuida `npm run check:bot-errores`.
            const conError = salida.find(m => {
                const esTool = m.tool_call_id !== undefined || (typeof m.getType === 'function' && m.getType() === 'tool');
                return esTool && esFallaTransitoriaDeHerramienta(m);
            });
            if (conError) {
                console.log(`  ⏹️ [BotCloud] Error de API en herramienta (${chat.id}). Turno abortado en silencio.`);
                await fallaTransitoria(chat, waId, profileName, `Error de API en herramienta: ${String(conError.content || '').substring(0, 120)}`);
                return;
            }

            if (salida.length === 0 || turno.cancelado) {
                await fallaTransitoria(chat, waId, profileName, 'Respuesta vacía: posible timeout o límite de recursión');
                return;
            }

            // ── Qué quiere decir el turno → burbujas ─────────────────────────
            // Una sola función para los dos bots (shared/respuesta-del-turno.js):
            // lee la salida estructurada (responder_al_cliente / no_responder) o
            // el texto suelto, sanea, saca lo repetido, decide si hace falta
            // dejar una tarea y arma las burbujas — las fotos que encolaron las
            // herramientas primero, el texto del modelo después.
            //
            // No repetirse: se compara contra lo último del bot Y del equipo. El
            // 8/10 el bot le re-mandó al cliente, palabra por palabra, los
            // mensajes que le había escrito Mile.
            const dichoAntes = [
                ...recientes.filter(m => m.direction === 'OUTBOUND' && !esRemitenteHumano(m.senderName)).slice(0, 3),
                ...recientes.filter(m => m.direction === 'OUTBOUND' && esRemitenteHumano(m.senderName)).slice(0, 10),
            ].map(m => m.content || '');
            const lecturaDelGrafo = leerSalidaDelGrafo(result, messages.length);
            // La fase y el nombre los devuelve el grafo (los resolvió el agente
            // que respondió: el ejecutivo nunca tiene apertura).
            const restriccion = restriccionDeFase(result && result.fase, result && result.nombreSaludo);
            const respuesta = armarRespuesta({ salida: lecturaDelGrafo, encolados: turno.envios, dichoAntes, restriccion });
            if (respuesta.quitado.length) console.log(`  🧹 [BotCloud] Saneado de salida: ${respuesta.quitado.join(' · ')}`);
            if (respuesta.repetidas.length) console.log(`  🔄 [BotCloud] Ya lo había dicho, se saca: ${respuesta.repetidas.map(q => `"${q.slice(0, 50)}…"`).join(' · ')}`);

            if (respuesta.accion === 'callar') {
                console.log(`  🤐 [BotCloud] El modelo decidió no responder (${profileName}): ${String(respuesta.motivo || '').slice(0, 120)}`);
                chatErrorCounts.delete(chat.id);
                return;
            }
            if (respuesta.accion === 'rechazar') {
                // Otro idioma o una anotación del historial copiada: no se
                // rescata nada (el grafo ya le pidió una vez que la rehiciera).
                console.warn(`  🛑 [BotCloud] Respuesta rechazada (${profileName}): ${respuesta.motivo}`);
                await fallaTransitoria(chat, waId, profileName, `Salida rechazada: ${respuesta.motivo}`);
                return;
            }
            if (respuesta.accion !== 'enviar') {
                console.log('  ⏹️ [BotCloud] No quedó nada para decir (era todo repetido o interno). No se envía nada.');
                return;
            }

            // ── Guardrail de salida (del turno) ─────────────────────────────
            // El transporte vuelve a pasar cada burbuja del modelo por el
            // guardrail, pero las CONSECUENCIAS (apagar el bot, la nota en la
            // ficha, la tarea urgente) se deciden acá, mirando la respuesta
            // entera y antes de mandar la primera burbuja.
            const guardrail = runOutputGuardrail(respuesta.textoLLM);
            if (!guardrail.safe) {
                console.warn(`  ⚠️ [BotCloud] Respuesta bloqueada por el guardrail: ${guardrail.reason}`);
                if (guardrail.reason === 'Narración de Error Interno' || guardrail.reason === 'Solicitud de Dato Prohibido o Presentación Indebida') {
                    await fallaTransitoria(chat, waId, profileName, `Guardrail (${guardrail.reason})`);
                    return;
                }
                const esSospechaDeBot = guardrail.reason.includes('Revelación de Identidad');
                await disableBotForChatById(chat.id, `Brecha de seguridad (Guardrail: ${guardrail.reason})`);
                if (freshChat.clientId) {
                    // En la ficha va lo SANEADO: la nota la leen las vendedoras
                    // y el texto crudo puede traer justo lo que se bloqueó
                    // (antes se guardaba `responseText` tal cual salió del modelo).
                    await prisma.interaction.create({
                        data: {
                            clientId: freshChat.clientId,
                            type: 'NOTE',
                            userName: 'Bot',
                            content: `⚠️ [Output Guardrail] Bot desactivado. ${esSospechaDeBot ? 'El cliente sospecha que habla con un bot; se apagó en silencio.' : 'Se bloqueó una respuesta con datos internos.'} Respuesta bloqueada: "${respuesta.textoLLM.substring(0, 150)}..."`,
                        },
                    }).catch(e => console.error('[BotCloud] No se pudo guardar la nota del guardrail:', e.message));
                    if (esSospechaDeBot) {
                        await prisma.clientTask.create({
                            data: { clientId: freshChat.clientId, description: 'Acusación de IA: Cliente sospecha bot. Llamar urgente.', dueDate: new Date() },
                        }).catch(e => console.error('[BotCloud] No se pudo crear la tarea urgente:', e.message));
                    }
                }
                if (io) io.emit('bot_error', { chatId: chat.id, name: profileName || 'Cliente', phone: waId, error: esSospechaDeBot ? '🛡️ Sospecha de Bot (apagado silencioso)' : `Bloqueo de Seguridad (${guardrail.reason})` });
                broadcastChatUpdate(chat.id);
                return;
            }

            // ── ¿Escribió de nuevo mientras pensábamos? ─────────────────────
            // Solo cuentan los entrantes que DISPARAN TURNO (15/10/2026): con un
            // `count` de todo INBOUND, un 👍 o un "gracias" que llegaba
            // mientras el modelo pensaba tiraba la respuesta, y como esos no
            // programan turno, nadie contestaba nunca. Y si se descarta, se
            // GARANTIZA un turno programado: el handleInbound del mensaje nuevo
            // ya lo hizo casi siempre, pero si no (otra instancia, carrera con
            // el candado), lo programa este.
            if (masNuevoProcesado) {
                const nuevos = await prisma.whatsAppMessage.findMany({
                    where: { chatId: chat.id, direction: 'INBOUND', createdAt: { gt: masNuevoProcesado.createdAt } },
                    orderBy: { createdAt: 'desc' },
                    select: { type: true, content: true, createdAt: true },
                });
                const queDisparan = nuevos.filter(f => filaDisparaTurno(f));
                if (queDisparan.length > 0) {
                    console.log(`  ⏳ [BotCloud] Llegaron ${queDisparan.length} mensaje(s) nuevo(s): se descarta esta respuesta (fotos incluidas) y contesta el turno siguiente.`);
                    if (!debounceTimers.has(chat.id)) {
                        programarTurno(chat, { ...entranteDeFila(queDisparan[0]), profileName, from: realPhone }, REINTENTO_CON_TURNO_EN_CURSO_MS);
                    }
                    return; // botReplyingTo todavía no se marcó: no hay que limpiar nada
                }
            }

            // ── ¿CONTESTÓ UNA PERSONA mientras pensábamos? ──────────────────
            // El traspaso humano (routes/api.js y el eco del celular en
            // cloud.js) apaga el bot del chat y cancela el turno agendado, pero
            // no puede cancelar uno que YA está corriendo: entre que arranca
            // este turno y termina el modelo pasan 10-30 s, y en ese hueco una
            // vendedora puede contestar desde el teléfono. Medido el 16/9/2026
            // sobre 45 días: 2 casos así (7/9 y 9/9), los dos con el bot
            // hablando "0 minutos después" de la persona.
            // Se pregunta ANTES DE CADA BURBUJA, no una sola vez. El 17/9/2026
            // el control existía pero corría solo acá arriba: el turno arrancó
            // 12:08:21, Milena mandó un audio 12:08:23 —después de este
            // chequeo— y las dos burbujas salieron igual, 12:08:26 y 12:08:28,
            // encimadas con ella. Desde el 10/10/2026 las fotos de
            // send_product_photos pasan por acá también (antes salían desde
            // adentro del grafo, sin este control).
            const humanoSeAdelanto = async () => {
                const humano = await prisma.whatsAppMessage.findFirst({
                    where: {
                        chatId: chat.id,
                        direction: 'OUTBOUND',
                        ...whereSalienteHumano(),
                        createdAt: { gt: new Date(comienzoDelTurno) },
                    },
                    select: { senderName: true },
                }).catch(() => null);
                if (!humano) return false;
                console.log(`  🙋 [BotCloud] ${humano.senderName} contestó mientras el bot hablaba: se corta el turno y el bot se calla en este chat.`);
                // El MISMO helper que los otros dos caminos de traspaso: además
                // de apagar, deja la etiqueta que marca "acá entró una persona".
                await marcarTraspasoHumano({
                    prisma, chatId: chat.id, disableBotForChatById,
                    motivo: 'Intervención humana durante el turno del bot',
                });
                return true;
            };

            if (await humanoSeAdelanto()) return;

            // ── Promesa sin encargado → la tarea la crea el código ──────────
            // "Lo confirmo y te escribo en un ratito" solo vale si alguien va a
            // escribir. Si el modelo derivó o prometió sin llamar a pedir_ayuda /
            // create_task / report_complaint (o el grafo cortó un bucle con esa
            // frase), se escala desde acá: tarea, nota y aviso, y el bot se
            // aparta de este chat — igual que si hubiera llamado a pedir_ayuda.
            if (respuesta.escalar) {
                console.log(`  🙋 [BotCloud] ${respuesta.escalar.motivo}: se deja la tarea desde el código (${profileName}).`);
                await escalarAHumano(
                    { notifyAdminDown: transport.notifyAdminDown, disableBotForChatById },
                    { chatId: chat.id, motivo: respuesta.escalar.motivo },
                ).catch(e => console.error('  ❌ [BotCloud] No se pudo escalar:', e.message));
            }

            botReplyingTo.add(waId);

            const { burbujas } = respuesta;
            // Para el chequeo de idioma del punto de salida: la respuesta
            // entera del modelo, no cada burbuja suelta (15/10/2026).
            const respuestaCompleta = burbujas.filter(b => b.origen === 'llm').map(b => b.texto || '').join('\n\n');
            for (let i = 0; i < burbujas.length; i++) {
                const { texto: bloque, imagenes: urls, origen } = burbujas[i];

                // Lo que ya salió, salió; lo que falta, no. Cortar a mitad de
                // turno deja al cliente con media respuesta, y eso es mejor que
                // dos voces hablándole encima.
                if (await humanoSeAdelanto()) {
                    botReplyingTo.delete(waId);
                    return;
                }

                // Meta descarga la foto ELLA. Si la URL está muerta rechaza el
                // mensaje ENTERO —caption incluido— y el cliente no recibe nada.
                // Las que no se pueden bajar se descartan acá y el texto sale igual.
                const urlsVivas = [];
                for (const u of urls) {
                    if (await mediaDescargable(u)) urlsVivas.push(u);
                }
                if (urls.length && !urlsVivas.length && !bloque) continue;

                try {
                    if (urlsVivas.length > 0) {
                        for (let j = 0; j < urlsVivas.length; j++) {
                            const caption = j === 0 ? bloque : '';
                            let enviado = null;
                            let salioConFoto = true;
                            let captionEnviado = caption;
                            try {
                                enviado = await sendViaCloud(waId, caption, { url: urlsVivas[j] }, { chat: freshChat, origen, respuestaCompleta });
                            } catch (e) {
                                if (e.code === 'SALIDA_RECHAZADA') {
                                    // El texto no pasó, pero la foto no tiene la
                                    // culpa (15/10/2026): antes se iba la burbuja
                                    // entera, fotos incluidas. Sale sin caption.
                                    console.warn(`  🛑 [BotCloud] Caption rechazado (${e.motivo || e.message}): la foto sale sin texto.`);
                                    captionEnviado = '';
                                    try {
                                        enviado = await sendViaCloud(waId, '', { url: urlsVivas[j] }, { chat: freshChat, origen });
                                    } catch (e2) {
                                        console.error(`  ⚠️ [BotCloud] Falló la imagen ${urlsVivas[j].substring(0, 80)}: ${e2.message}`);
                                        continue;
                                    }
                                } else {
                                    // Una foto caída no puede voltear el turno: se manda el texto solo.
                                    console.error(`  ⚠️ [BotCloud] Falló la imagen ${urlsVivas[j].substring(0, 80)}: ${e.message}`);
                                    salioConFoto = false;
                                    if (caption) enviado = await sendViaCloud(waId, caption, null, { chat: freshChat, origen, respuestaCompleta }).catch(() => null);
                                }
                            }
                            // El tipo sale del envío REAL, no de la intención: cuando la
                            // foto falla y sale el texto solo, acá se anotaba igual
                            // 'IMAGE' y el buzón mostraba "Imagen de WhatsApp" en un
                            // mensaje que nunca llevó foto.
                            const contenido = (enviado && enviado.textoEnviado) || captionEnviado || '[Media]';
                            await guardarSaliente(chat.id, waId, enviado, contenido, salioConFoto ? 'IMAGE' : 'TEXT', salioConFoto ? urlsVivas[j] : null);
                        }
                    } else {
                        const enviado = await sendViaCloud(waId, bloque, null, { chat: freshChat, origen, respuestaCompleta });
                        await guardarSaliente(chat.id, waId, enviado, (enviado && enviado.textoEnviado) || bloque, 'TEXT');
                    }
                } catch (e) {
                    // El transporte no aprobó ESTA burbuja (saneado + guardrail
                    // por burbuja): se saltea y siguen las demás. Cualquier otro
                    // error sube como siempre.
                    if (e.code !== 'SALIDA_RECHAZADA') throw e;
                    console.warn(`  🛑 [BotCloud] Burbuja rechazada por el punto de salida: ${e.motivo || e.message}`);
                }

                if (i < burbujas.length - 1) await new Promise(r => setTimeout(r, 800));
            }

            // Margen para que el eco del propio envío no se lea como una persona.
            const t = setTimeout(() => botReplyingTo.delete(waId), 3000);
            t.unref?.();
            chatErrorCounts.delete(chat.id);
            broadcastChatUpdate(chat.id);
            console.log(`  ✅ [BotCloud] Respondido a ${profileName} con ${burbujas.length} mensaje(s).`);
        } catch (err) {
            botReplyingTo.delete(waId);
            console.error('  ❌ [BotCloud] Error en el turno:', err.message);
            if (err.code === 'WINDOW_CLOSED') {
                // No es una falla del bot: el cliente no escribe hace más de 24 h.
                // Fuera de la ventana solo entran plantillas, y las manda un humano.
                console.warn(`  ⏳ [BotCloud] Ventana de 24 h cerrada para ${waId}: el bot no insiste.`);
                return;
            }
            if (/429|RESOURCE_EXHAUSTED/.test(err.message || '')) {
                chatErrorCounts.delete(chat.id);
                await disableBotForChatById(chat.id, 'Cuota agotada de API (Error 429)');
                if (io) io.emit('bot_error', { chatId: chat.id, name: profileName || 'Cliente', phone: waId, error: 'Crédito Agotado (Error 429)' });
                return;
            }
            await fallaTransitoria(chat, waId, profileName, err.message).catch(() => {});
        }
    }

    /** Deja la burbuja del bot en el buzón, firmada. */
    // `mediaUrl` (10/10/2026): las fotos de armazones las mandaba la
    // herramienta y las guardaba con su URL; ahora salen por acá y la burbuja
    // sigue mostrando la imagen en el buzón.
    async function guardarSaliente(chatId, waId, enviado, contenido, tipo, mediaUrl = null) {
        if (!enviado) return;
        try {
            const waMessageId = resolveWaMessageId(enviado, { waId, direction: 'OUTBOUND', content: contenido });
            await prisma.whatsAppMessage.upsert({
                where: { waMessageId },
                update: mediaUrl ? { senderName: 'Bot', mediaUrl } : { senderName: 'Bot' },
                create: { chatId, direction: 'OUTBOUND', type: tipo, content: contenido, waMessageId, senderName: 'Bot', status: 'SENT', ...(mediaUrl ? { mediaUrl } : {}) },
            });
        } catch (e) {
            console.error('[BotCloud] No se pudo guardar el saliente del bot:', e.message);
        }
    }

    return {
        init, stop, loadConfig, isEnabled,
        agentState,
        handleInbound,
        processBotTurn,
        disableBotForChatById,
        runOutputGuardrail,
        generateAndSaveHandoffSummary,
        graph,
        sendMessage: sendViaCloud,
    };
}

module.exports = { createCloudBot, guessMimetype, adaptMedia };
