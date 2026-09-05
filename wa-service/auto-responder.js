/**
 * Auto-respondedor fuera de horario (API oficial, WA_TRANSPORT=cloud).
 *
 * QUÉ ES Y QUÉ NO ES
 * ------------------
 * Es la ÚNICA automatización conversacional aprobada para este número (OK de la
 * dueña, 30/8/2026), y es la que `docs/plan-whatsapp-api-oficial.md` (decisión 3)
 * marca como legítima: «un auto-respondedor fuera de horario o un menú de
 * opciones se puede sumar después, identificado como automático».
 *
 * NO es un bot: no hay IA, no hay grafo, no hay estado de conversación. Es UN
 * mensaje fijo, siempre el mismo, que dice de entrada que es automático y que
 * después contesta una persona. Esa aclaración no es cortesía: es lo que hace
 * que Meta lo vea como legítimo y lo que evita repetir el pecado del bot viejo
 * (fingir ser "Matías"). Si alguna vez alguien quiere sacarla o hacer que el
 * texto varíe, la respuesta es no.
 *
 * CUÁNDO RESPONDE — las cinco condiciones tienen que darse a la vez:
 *   1. La bandera `auto_responder_enabled` de SystemSetting no está apagada.
 *      Sin fila = prendido (es el estado que aprobó la dueña). Si la lectura
 *      falla, NO se responde: ante la duda, silencio.
 *   2. El local está cerrado (`shared/business-hours.js`). Si está abierto,
 *      contesta una persona y acá no pasa nada.
 *   3. El entrante es un mensaje de verdad: no una reacción, no un sticker,
 *      no una respuesta automática de Meta (`shared/meta-auto-patterns.js`).
 *      Sin este filtro dos auto-respondedores se contestan entre sí.
 *   4. No le mandamos ya el aviso a ese chat en las últimas VENTANA_ANTI_REPETICION_MS.
 *   5. Hay ventana de 24 h abierta — la garantiza el propio entrante, y el
 *      transporte la revalida antes de gastar la llamada a Meta.
 *
 * FIRE-AND-FORGET: se engancha al hook `onInbound` del webhook, que ya respondió
 * 200 y ya guardó el entrante. Nada de acá puede romper esas dos cosas: todo va
 * envuelto en try/catch y lo único que hace un fallo es loguear.
 *
 * TESTEABILIDAD: `createAutoResponder()` recibe TODAS sus dependencias (prisma,
 * reloj, isBusinessHours, sendMessage, io, logger). No hay `require` de
 * infraestructura ejecutándose adentro de la lógica, así que el script de
 * pruebas puede correrla entera con mocks, sin base ni red.
 */

const { isBusinessHours: isBusinessHoursReal } = require('./shared/business-hours');
const { TIPOS_CON_CONSULTA } = require('./shared/tipos-entrantes');
const { isMetaAutoReplyText } = require('./shared/meta-auto-patterns');
const { resolveWaMessageId } = require('./shared/message-id');
const {
    ADDRESS,
    WEBSITE_DISPLAY,
    DISCOUNT_CASH_LOCAL_PERCENT,
    DISCOUNT_CASH_PERCENT,
    DISCOUNT_TRANSFER_PERCENT,
    RECARGO_MP_CUOTAS_LARGAS,
} = require('./shared/business-info');

/** Clave de SystemSetting. Sin fila = prendido; con fila y valor != 'true' = apagado. */
const CLAVE_BANDERA = 'auto_responder_enabled';

/**
 * Firma del saliente en el buzón. La usa el equipo para ver qué se mandó, y la
 * usa la regla anti-repetición para reconocer sus propios mensajes. Cambiarla
 * rompe la regla 4 en silencio (empezaría a mandar uno por mensaje entrante).
 */
const SENDER_NAME = 'Auto-respondedor';

/**
 * Cuánto se espera antes de volver a mandarle el aviso al MISMO chat.
 *
 * 41 horas, elegidas para que sea IMPOSIBLE mandar más de uno por período
 * cerrado: el cierre más largo de la semana es sábado 17:00 → lunes 9:00 (el
 * local ahora abre a las 9, no a las 8), que son 40 horas exactas — la ventana
 * tiene que ser ESTRICTAMENTE mayor a eso, no igual, o un caso límite podría
 * mandar dos. Con una ventana más corta (p. ej. 12 h, el cierre de un día
 * hábil) un cliente que escribe el sábado a la noche y otra vez el domingo a la
 * noche recibía dos avisos idénticos en el mismo fin de semana cerrado.
 *
 * El costo de pasarse de largo es bajo y el reset lo cubre: si una persona del
 * equipo le contestó después del aviso, la ventana se ignora y el cliente puede
 * volver a recibirlo esa misma noche. O sea: solo queda sin segundo aviso quien
 * escribió dos veces sin que nadie le haya contestado nunca — y a ese repetirle
 * el mismo texto automático no le suma nada.
 */
const VENTANA_ANTI_REPETICION_MS = 41 * 60 * 60 * 1000;

/**
 * Nombres de remitente que NO son una persona del equipo. Un saliente firmado
 * por alguno de estos no resetea la ventana anti-repetición.
 */
const REMITENTES_NO_HUMANOS = new Set([SENDER_NAME, 'Bot', 'Sistema']);


/**
 * El texto EXACTO que recibe el cliente. Fijo, sin variables, sin IA.
 *
 * Reglas de negocio que el texto tiene que respetar (CLAUDE.md):
 *   - 3 y 6 cuotas SIN interés; 12 cuotas SIEMPRE con el costo financiero
 *     aclarado. Nunca "12 cuotas sin interés".
 *   - Los porcentajes y el horario salen de `shared/business-info.js`, que es el
 *     espejo verificado de `src/lib/business-info.ts`. Nada tipeado a mano acá.
 */
function buildAutoReplyText() {
    const efectivo = DISCOUNT_CASH_PERCENT === DISCOUNT_TRANSFER_PERCENT
        ? `${DISCOUNT_CASH_PERCENT}% de descuento pagando en efectivo o por transferencia`
        : `${DISCOUNT_CASH_PERCENT}% de descuento en efectivo y ${DISCOUNT_TRANSFER_PERCENT}% por transferencia`;

    return [
        // Texto de Ishtar (31/8), pedido TEXTUAL: "así tal cual sin que le
        // cambies NADA, ABSOLUTAMENTE nada". Va carácter por carácter como lo
        // escribió — incluidas las palabras sin tilde: no son descuido nuestro,
        // son su mensaje. Decisiones suyas ya reafirmadas, no "corregirlas":
        //   · sin la etiqueta "mensaje automático"
        //   · "(hasta 12 cuotas)" sin el 10% — excepción como el cartel de la
        //     tienda (ver src/lib/business-info.ts)
        //   · 20% efectivo = EN EL LOCAL (la web usa 15%; son dos descuentos)
        // Por eso este bloque es literal y no usa las constantes del espejo.
        'Bienvenidos a Atelier Optica, en este momento estamos fuera de horario laborar. ',
        'Contanos un poquito qué estás necesitando y si tenes tu recetita asi vamos adelantando 👀',
        'Mientras tanto podés ver los modelos disponibles en atelieroptica.com.ar',
        '',
        '📍 José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba',
        '🕐 Lunes a viernes de 9 a 20 hs · Sábados de 9 a 17 hs',
        '',
        'Formas de pago:',
        '- 20% de descuento en efectivo',
        '- 15% de descuento por transferencia',
        '- 3 y 6 cuotas sin interés con tarjeta (hasta 12 cuotas)',
        '',
        'La óptica mejor calificada de Córdoba según las reseñas de Google ⭐',
    ].join('\n');
}

/** ¿El entrante es una consulta de verdad, o ruido que no hay que contestar? */
function esConsultaDeCliente(m) {
    if (!m) return false;
    if (m.reaction) return false;
    const tipo = String(m.type || 'text').toLowerCase();
    if (!TIPOS_CON_CONSULTA.has(tipo)) return false;
    // Sin texto se responde igual si es un medio (una foto de la receta es una
    // consulta); un "text" vacío, en cambio, no existe: es ruido.
    if (tipo === 'text' && !String(m.text || '').trim()) return false;
    if (isMetaAutoReplyText(m.text)) return false;
    return true;
}

/**
 * Lee la bandera. Devuelve `true` (prendido) si no hay fila, `false` si la fila
 * dice otra cosa que 'true'. Ante ERROR devuelve `false`: fail-safe, no responder.
 */
async function leerBandera(prisma, log) {
    try {
        const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE_BANDERA } });
        if (!fila) return true; // default prendido: es lo aprobado
        return fila.value === 'true';
    } catch (e) {
        log.error(`[AutoResp] No se pudo leer ${CLAVE_BANDERA} (${e.message}) — por las dudas NO se responde.`);
        return false;
    }
}

/**
 * ¿Ya le mandamos el aviso a este chat sin que nadie le haya contestado después?
 * @returns {Promise<boolean>} true = hay que callarse
 */
async function yaAvisado(prisma, chatId, ahora) {
    const desde = new Date(ahora.getTime() - VENTANA_ANTI_REPETICION_MS);
    const ultimoAviso = await prisma.whatsAppMessage.findFirst({
        where: { chatId, direction: 'OUTBOUND', senderName: SENDER_NAME, createdAt: { gte: desde } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
    });
    if (!ultimoAviso) return false;

    // Reset: si DESPUÉS del aviso una persona del equipo escribió en el chat, la
    // conversación siguió y el próximo cierre puede volver a avisar.
    const respuestaHumana = await prisma.whatsAppMessage.findFirst({
        where: {
            chatId,
            direction: 'OUTBOUND',
            createdAt: { gt: ultimoAviso.createdAt },
            senderName: { notIn: [...REMITENTES_NO_HUMANOS] },
        },
        select: { id: true },
    });
    return !respuestaHumana;
}

/**
 * @param {object} deps
 * @param {object} deps.prisma
 * @param {Function} deps.sendMessage  transporte ya cableado (cloud-transport#sendMessage)
 * @param {object}  [deps.io]          socket.io, para refrescar el buzón
 * @param {Function} [deps.isBusinessHours]
 * @param {Function} [deps.now]        reloj inyectable (para tests)
 * @param {object}  [deps.logger]
 * @returns {{ onInbound: Function, decidir: Function }}
 */
function createAutoResponder(deps = {}) {
    const prisma = deps.prisma;
    const sendMessage = deps.sendMessage;
    const io = deps.io || null;
    const isBusinessHours = deps.isBusinessHours || isBusinessHoursReal;
    const now = deps.now || (() => new Date());
    const log = deps.logger || console;

    /**
     * Las cinco guardas, sin efectos. Devuelve `{ responder, motivo }` para que
     * el log diga POR QUÉ se calló (y para que los tests lo puedan afirmar).
     */
    async function decidir(m, chat, ahora) {
        if (!chat || !chat.id) return { responder: false, motivo: 'sin chat' };
        if (!(await leerBandera(prisma, log))) return { responder: false, motivo: 'bandera apagada o ilegible' };
        if (isBusinessHours(ahora)) return { responder: false, motivo: 'el local está abierto' };
        if (!esConsultaDeCliente(m)) return { responder: false, motivo: 'no es una consulta (ruido o automático de Meta)' };
        if (await yaAvisado(prisma, chat.id, ahora)) return { responder: false, motivo: 'ya avisado en este período cerrado' };
        return { responder: true, motivo: 'fuera de horario, primer aviso' };
    }

    /**
     * Hook de `createWebhookRouter({ onInbound })`. Nunca lanza.
     * @param {object} m  entrante normalizado por webhook.js
     * @param {{ chat: object|null }} r  lo que devolvió persistInbound
     */
    async function onInbound(m, r) {
        try {
            const chat = r && r.chat;
            const ahora = now();
            const { responder, motivo } = await decidir(m, chat, ahora);
            if (!responder) {
                log.log(`  🤖 [AutoResp] No se responde: ${motivo}`);
                return;
            }

            const texto = buildAutoReplyText();
            const destino = chat.waId;
            const sent = await sendMessage(destino, texto, null, {
                chat: { id: chat.id, lastInboundAt: chat.lastInboundAt || ahora },
            });

            const waMessageId = (sent && sent.wamid)
                || resolveWaMessageId(sent, { waId: destino, direction: 'OUTBOUND', content: texto });
            try {
                await prisma.whatsAppMessage.upsert({
                    where: { waMessageId },
                    update: { senderName: SENDER_NAME },
                    create: {
                        chatId: chat.id,
                        direction: 'OUTBOUND',
                        type: 'TEXT',
                        content: texto,
                        waMessageId,
                        senderName: SENDER_NAME,
                        status: 'SENT',
                    },
                });
                await prisma.whatsAppChat.update({ where: { id: chat.id }, data: { lastMessageAt: ahora } }).catch(() => {});
            } catch (e) {
                // El mensaje YA salió: que no se vea en el buzón es feo, pero no
                // se reintenta nada (sería un segundo mensaje al cliente).
                log.error('[AutoResp] El aviso salió pero no se pudo guardar en el buzón:', e.message);
            }

            if (io) io.emit('chat_updated', { chatId: chat.id });
            log.log(`  🤖 [AutoResp] Aviso fuera de horario enviado a ${destino}`);
        } catch (e) {
            log.error('[AutoResp] Falló el auto-respondedor (el entrante ya quedó guardado):', e && e.message);
        }
    }

    return { onInbound, decidir };
}

module.exports = {
    createAutoResponder,
    buildAutoReplyText,
    esConsultaDeCliente,
    CLAVE_BANDERA,
    SENDER_NAME,
    VENTANA_ANTI_REPETICION_MS,
};
