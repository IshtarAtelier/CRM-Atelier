'use strict';

/**
 * ¿Quién atiende este chat — el bot o una persona del equipo — y cuándo puede
 * volver el bot?
 *
 * Una sola definición para el bot cloud (y para cualquier otro camino que
 * quiera saberlo). Antes la regla vivía suelta en `bot-cloud.js`
 * (`puedeVolverSolo`): "3 horas después del último mensaje de una persona, el
 * primer entrante reactiva el bot". Dos problemas (auditoría del 10/10/2026):
 *
 *  1. En horario del local, 3 horas de silencio de la vendedora no significan
 *     que nadie atiende: el cliente escribía a las 11, la vendedora le había
 *     contestado a las 8, y el bot se metía en el acto, pisándola. Con el
 *     local abierto, el equipo tiene que tener la primera oportunidad.
 *  2. Lo que disparaba la vuelta era CUALQUIER entrante, incluido el
 *     contestador automático del negocio del cliente. Eso lo resuelve
 *     `clasificar-entrante.js`: acá solo llegan consultas.
 *
 * La regla ahora:
 *   - DUEÑO = humano si el chat tiene la etiqueta de traspaso
 *     (`ETIQUETA_BOT_APAGADO`) y el bot apagado. Un chat apagado por otra cosa
 *     (post-venta, reclamo, etiqueta sin bot) no tiene dueño humano en este
 *     sentido y el bot NO vuelve: ahí el silencio es la intención.
 *   - EN HORARIO del local: un entrante NO reactiva al bot de inmediato. Se
 *     espera `VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN` desde el primer
 *     entrante sin respuesta; si en ese lapso una persona contestó, el chat
 *     sigue siendo suyo. Si no, vuelve el bot y contesta.
 *   - FUERA DE HORARIO: la regla vigente desde el 17/9/2026 — vuelve si pasaron
 *     `HORAS_PARA_VOLVER_FUERA_DE_HORARIO` desde el último mensaje de una persona.
 *
 * El horario es el de `business-hours.js` (el mismo que usa el
 * auto-respondedor). El vigilante del CRM que prende el bot a la hora de cierre
 * (`src/lib/whatsapp/vigilar-horario-bot.ts`, `npm run check:horario-bot`) no
 * se toca: decide sobre la bandera global, esto sobre un chat.
 *
 * Lo fija `npm run check:duenio-chat` (la decisión es pura, sin base ni red).
 */

const { ETIQUETA_BOT_APAGADO } = require('./traspaso-humano');
const { whereSalienteHumano } = require('./remitentes');

/**
 * Cuánto se espera, con el local ABIERTO, a que alguien del equipo conteste
 * antes de que vuelva el bot. 20 minutos es un valor de partida elegido por
 * criterio (NO medido): lo bastante largo para que una vendedora que está
 * atendiendo en el mostrador llegue a mirar el teléfono, lo bastante corto
 * para que el cliente no quede esperando. Si se cambia, cambiarlo acá.
 */
const VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN = 20;

/** Regla vigente fuera de horario (Ishtar, 17/9/2026). */
const HORAS_PARA_VOLVER_FUERA_DE_HORARIO = 3;

const MIN = 60 * 1000;
const HORA = 60 * MIN;

/**
 * Lee de la base quién es el dueño del chat.
 *
 * @param {object} prisma
 * @param {{ id: string, botEnabled: boolean, chatLabels?: string[] }} chat
 * @returns {Promise<{
 *   duenio: 'bot'|'humano'|'nadie',
 *   desde: Date|null,           // último mensaje de una persona del equipo
 *   quien: string|null,         // su firma
 *   esperandoDesde: Date|null,  // primer entrante del cliente sin respuesta humana
 * }>}
 */
async function duenioDelChat(prisma, chat) {
    const vacio = { desde: null, quien: null, esperandoDesde: null };
    if (!chat) return { duenio: 'nadie', ...vacio };
    if (chat.botEnabled) return { duenio: 'bot', ...vacio };
    if (!(chat.chatLabels || []).includes(ETIQUETA_BOT_APAGADO)) return { duenio: 'nadie', ...vacio };

    const ultimoHumano = await prisma.whatsAppMessage.findFirst({
        where: { chatId: chat.id, direction: 'OUTBOUND', ...whereSalienteHumano() },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, senderName: true },
    }).catch(() => null);
    if (!ultimoHumano) return { duenio: 'nadie', ...vacio };

    const esperando = await prisma.whatsAppMessage.findFirst({
        where: { chatId: chat.id, direction: 'INBOUND', createdAt: { gt: ultimoHumano.createdAt } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
    }).catch(() => null);

    return {
        duenio: 'humano',
        desde: new Date(ultimoHumano.createdAt),
        quien: ultimoHumano.senderName || null,
        esperandoDesde: esperando ? new Date(esperando.createdAt) : null,
    };
}

/**
 * La decisión, pura.
 *
 * @param {object} p
 * @param {'bot'|'humano'|'nadie'} p.duenio
 * @param {Date|null} p.desde           último mensaje humano
 * @param {Date|null} p.esperandoDesde  primer entrante sin respuesta humana
 * @param {Date} p.ahora
 * @param {(d: Date) => boolean} p.enHorario
 * @returns {{ accion: 'volver'|'esperar'|'no', esperarMs?: number, motivo: string }}
 */
function decidirVuelta({ duenio, desde, esperandoDesde, ahora, enHorario }) {
    if (duenio === 'bot') return { accion: 'no', motivo: 'el bot ya atiende este chat' };
    if (duenio !== 'humano' || !desde) return { accion: 'no', motivo: 'el bot se apagó por otra cosa que un traspaso' };
    const t = ahora.getTime();

    if (enHorario(ahora)) {
        if (!esperandoDesde) return { accion: 'no', motivo: 'no hay un mensaje del cliente esperando' };
        const espera = t - esperandoDesde.getTime();
        const ventana = VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN * MIN;
        if (espera >= ventana) {
            return { accion: 'volver', motivo: `local abierto y nadie del equipo contestó en ${Math.round(espera / MIN)} min` };
        }
        return { accion: 'esperar', esperarMs: ventana - espera, motivo: `local abierto: el equipo tiene ${VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN} min para contestar` };
    }

    const horas = (t - desde.getTime()) / HORA;
    if (horas >= HORAS_PARA_VOLVER_FUERA_DE_HORARIO) {
        return { accion: 'volver', motivo: `local cerrado y ${horas.toFixed(1)} h sin que conteste una persona` };
    }
    return { accion: 'no', motivo: `local cerrado: la persona escribió hace ${horas.toFixed(1)} h (vuelve a las ${HORAS_PARA_VOLVER_FUERA_DE_HORARIO} h)` };
}

module.exports = {
    VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN,
    HORAS_PARA_VOLVER_FUERA_DE_HORARIO,
    duenioDelChat,
    decidirVuelta,
};
