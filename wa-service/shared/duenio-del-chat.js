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
 * Quién la hace cumplir (15/10/2026): antes era un `setTimeout` en memoria
 * del wa-service. Un redeploy en esos 20 minutos lo borraba y el cliente
 * quedaba sin respuesta; y si vencía con el local ya cerrado, la regla de 3 h
 * contestaba 'no' sin reprogramar nada (cliente 19:50 de un viernes, vendedora
 * 19:00 → a las 20:10 'no' y silencio hasta el lunes). Ahora el estado vive
 * SOLO en la base — "hay un entrante que dispara turno sin respuesta de una
 * persona" — y `bot-cloud.js` lo barre cada minuto (`barrerVueltas`). Y la
 * decisión ya no devuelve 'no' mientras el cliente espera: devuelve 'esperar'
 * y el barrido la vuelve a hacer. Al cruzar el cierre con el cliente
 * esperando, vuelve el bot (no se aplica la regla de 3 h: esa es para quien
 * escribe CON el local cerrado). Nada más viejo que
 * `ANTIGUEDAD_MAXIMA_PARA_VOLVER_H` se contesta.
 *
 * El horario es el de `business-hours.js` (el mismo que usa el
 * auto-respondedor). El vigilante del CRM que prende el bot a la hora de cierre
 * (`src/lib/whatsapp/vigilar-horario-bot.ts`, `npm run check:horario-bot`) no
 * se toca: decide sobre la bandera global, esto sobre un chat.
 *
 * Lo fija `npm run check:entrantes` (la decisión es pura, sin base ni red).
 */

const { ETIQUETA_BOT_APAGADO } = require('./traspaso-humano');
const { whereSalienteHumano } = require('./remitentes');
const { filaDisparaTurno } = require('./clasificar-entrante');

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

/**
 * Un entrante más viejo que esto ya no hace volver al bot: contestarle a
 * alguien un mensaje de ayer como si nada es peor que no contestar (misma
 * regla que "nada viejo se reenvía", y es la ventana de 24 h de Meta: pasado
 * ese plazo el texto libre ni siquiera sale).
 */
const ANTIGUEDAD_MAXIMA_PARA_VOLVER_H = 24;

/** Cuántos entrantes posteriores a la persona se miran para hallar el que espera. */
const ENTRANTES_A_REVISAR = 50;

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
 *   esperandoDesde: Date|null,  // primer entrante que dispara turno sin respuesta humana
 *   esperando?: object|null,    // esa fila (type, content, createdAt)
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

    // El que espera es el primer entrante que DISPARA TURNO (15/10/2026): una
    // reacción o un "gracias" viejos no pueden arrancar el reloj, ni hacer
    // volver al bot a contestarle un 👍.
    const posteriores = await prisma.whatsAppMessage.findMany({
        where: { chatId: chat.id, direction: 'INBOUND', createdAt: { gt: ultimoHumano.createdAt } },
        orderBy: { createdAt: 'asc' },
        take: ENTRANTES_A_REVISAR,
        select: { createdAt: true, type: true, content: true },
    }).catch(() => []);
    const esperando = posteriores.find(f => filaDisparaTurno(f)) || null;

    return {
        duenio: 'humano',
        desde: new Date(ultimoHumano.createdAt),
        quien: ultimoHumano.senderName || null,
        esperandoDesde: esperando ? new Date(esperando.createdAt) : null,
        esperando,
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
    if (!esperandoDesde) return { accion: 'no', motivo: 'no hay un mensaje del cliente esperando' };
    const t = ahora.getTime();
    const espera = t - esperandoDesde.getTime();
    if (espera >= ANTIGUEDAD_MAXIMA_PARA_VOLVER_H * HORA) {
        return { accion: 'no', motivo: `el mensaje del cliente tiene más de ${ANTIGUEDAD_MAXIMA_PARA_VOLVER_H} h: no se contesta algo viejo` };
    }

    if (enHorario(ahora)) {
        const ventana = VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN * MIN;
        if (espera >= ventana) {
            return { accion: 'volver', motivo: `local abierto y nadie del equipo contestó en ${Math.round(espera / MIN)} min` };
        }
        return { accion: 'esperar', esperarMs: ventana - espera, motivo: `local abierto: el equipo tiene ${VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN} min para contestar` };
    }

    // Cerró con el cliente esperando: el equipo tuvo su oportunidad con el
    // local abierto y ya no va a contestar. La regla de 3 h es para quien
    // escribe CON el local cerrado; aplicársela a este lo dejaba sin
    // respuesta hasta el día siguiente.
    if (enHorario(esperandoDesde)) {
        return { accion: 'volver', motivo: `el local cerró con el cliente esperando desde hace ${Math.round(espera / MIN)} min` };
    }

    const horas = (t - desde.getTime()) / HORA;
    if (horas >= HORAS_PARA_VOLVER_FUERA_DE_HORARIO) {
        return { accion: 'volver', motivo: `local cerrado y ${horas.toFixed(1)} h sin que conteste una persona` };
    }
    // 'esperar', no 'no': el cliente sigue esperando y el barrido vuelve a
    // decidir cuando se cumplan las horas.
    return {
        accion: 'esperar',
        esperarMs: Math.ceil((HORAS_PARA_VOLVER_FUERA_DE_HORARIO - horas) * HORA),
        motivo: `local cerrado: la persona escribió hace ${horas.toFixed(1)} h (vuelve a las ${HORAS_PARA_VOLVER_FUERA_DE_HORARIO} h)`,
    };
}

module.exports = {
    VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN,
    HORAS_PARA_VOLVER_FUERA_DE_HORARIO,
    ANTIGUEDAD_MAXIMA_PARA_VOLVER_H,
    duenioDelChat,
    decidirVuelta,
};
