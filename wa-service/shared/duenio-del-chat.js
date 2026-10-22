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
 *   - DUEÑO = humano si el bot está apagado con motivo TOMADO_POR_PERSONA
 *     (`botOffReason`, shared/motivo-apagado.js). Hasta el 15/10/2026 se
 *     decidía por la etiqueta `[SISTEMA - BOT APAGADO]`, que también ponían el
 *     panel, la derivación, los errores y el guardrail, y nunca se limpiaba:
 *     el bot volvía a chats silenciados a propósito. Cualquier otro motivo, o
 *     ninguno, NO vuelve: ahí el silencio es la intención (o no la sabemos).
 *   - Solo cuentan los entrantes POSTERIORES a nuestro último saliente de
 *     cualquier tipo (persona, bot, plantilla): lo anterior ya se contestó.
 *   - La antigüedad máxima se mide desde el entrante MÁS NUEVO sin respuesta
 *     (15/10/2026: se medía desde el primero, y un cliente que escribió ayer y
 *     vuelve a escribir hoy quedaba en 'no' para siempre — ~195 chats en
 *     prod). La ventana del equipo, desde el PRIMERO de los que siguen
 *     vigentes (menos de 24 h).
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

const { whereSalienteHumano } = require('./remitentes');
const { filaDisparaTurno, contextoDeEntrante } = require('./clasificar-entrante');
const { recibido, ORDEN_DE_LLEGADA_DESC, llegoDespuesDe } = require('./orden-de-llegada');
const { MOTIVO_APAGADO, puedeVolverSolo, motivoValido, leerMotivo } = require('./motivo-apagado');

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

/** Cuántos entrantes posteriores a nuestro último saliente se miran. */
const ENTRANTES_A_REVISAR = 50;

const MIN = 60 * 1000;
const HORA = 60 * MIN;

/**
 * Pura: de las filas crudas, qué espera respuesta.
 *
 * @param {object} p
 * @param {{createdAt: Date|string}|null} p.ultimoSaliente  nuestro último OUTBOUND de cualquier tipo
 * @param {{createdAt: Date|string, senderName?: string}|null} p.ultimoHumano
 * @param {Array<{createdAt, type, content}>} p.entrantes  INBOUND (cualquier orden)
 */
function analizarEspera({ ultimoSaliente, ultimoHumano, entrantes }) {
    // Todo con la hora de LLEGADA al servidor (receivedAt, o createdAt en
    // filas viejas): el createdAt de un entrante es el reloj del teléfono del
    // cliente (15/10/2026, shared/orden-de-llegada.js).
    const corte = ultimoSaliente ? recibido(ultimoSaliente).getTime() : -Infinity;
    const disparan = (entrantes || [])
        .filter(f => recibido(f).getTime() > corte)
        .sort((a, b) => recibido(a) - recibido(b))
        // Una reacción o un "gracias" no arrancan el reloj ni hacen volver al
        // bot a contestarle un 👍 (15/10/2026).
        // Mismo contexto que el webhook (pregunta/plantilla pendiente, charla viva).
        .filter(f => filaDisparaTurno(f, contextoDeEntrante({ entrante: f, nuestroAnterior: ultimoSaliente || null })));
    const esperando = disparan.length ? disparan[disparan.length - 1] : null;
    return {
        desde: ultimoHumano ? recibido(ultimoHumano) : null,
        quien: (ultimoHumano && ultimoHumano.senderName) || null,
        esperandoFechas: disparan.map(f => recibido(f)),
        esperandoDesde: disparan.length ? recibido(disparan[0]) : null,
        esperando,
    };
}

/**
 * Lee de la base quién es el dueño del chat.
 *
 * @param {object} prisma
 * @param {{ id: string, botEnabled: boolean, botOffReason?: string|null }} chat
 *   Si `botOffReason` no viene en el objeto se lee de la base (tolerante a
 *   la columna ausente: sin columna → motivo desconocido → 'nadie').
 */
async function duenioDelChat(prisma, chat) {
    const vacio = { desde: null, quien: null, esperandoDesde: null, esperandoFechas: [], esperando: null };
    if (!chat) return { duenio: 'nadie', motivo: null, ...vacio };
    if (chat.botEnabled) return { duenio: 'bot', motivo: null, ...vacio };
    const motivo = Object.prototype.hasOwnProperty.call(chat, 'botOffReason')
        ? motivoValido(chat.botOffReason)
        : await leerMotivo(prisma, chat.id).catch(() => undefined);
    if (!puedeVolverSolo(motivo)) return { duenio: 'nadie', motivo: motivo || null, ...vacio };

    const [ultimoHumano, ultimoSaliente] = await Promise.all([
        prisma.whatsAppMessage.findFirst({
            where: { chatId: chat.id, direction: 'OUTBOUND', ...whereSalienteHumano() },
            orderBy: ORDEN_DE_LLEGADA_DESC,
            select: { createdAt: true, receivedAt: true, senderName: true },
        }).catch(() => null),
        prisma.whatsAppMessage.findFirst({
            where: { chatId: chat.id, direction: 'OUTBOUND' },
            orderBy: ORDEN_DE_LLEGADA_DESC,
            select: { createdAt: true, receivedAt: true, content: true, templateName: true },
        }).catch(() => null),
    ]);
    if (!ultimoHumano) return { duenio: 'nadie', motivo, ...vacio };

    const corte = ultimoSaliente || ultimoHumano;
    // Los MÁS NUEVOS primero: si hubiera más de ENTRANTES_A_REVISAR, lo que
    // importa es lo último que escribió el cliente.
    const entrantes = await prisma.whatsAppMessage.findMany({
        where: { chatId: chat.id, direction: 'INBOUND', ...llegoDespuesDe(recibido(corte)) },
        orderBy: ORDEN_DE_LLEGADA_DESC,
        take: ENTRANTES_A_REVISAR,
        select: { createdAt: true, receivedAt: true, type: true, content: true },
    }).catch(() => []);

    return { duenio: 'humano', motivo, ...analizarEspera({ ultimoSaliente: corte, ultimoHumano, entrantes }) };
}

/**
 * La decisión, pura.
 *
 * @param {object} p
 * @param {'bot'|'humano'|'nadie'} p.duenio
 * @param {Date|null} p.desde             último mensaje humano
 * @param {Date[]} [p.esperandoFechas]    entrantes que disparan turno sin respuesta (asc)
 * @param {Date|null} [p.esperandoDesde]  compat: un solo entrante esperando
 * @param {boolean} [p.excluido]          etiqueta de exclusión (Ya es cliente, Cancelar Bot…)
 * @param {Date} p.ahora
 * @param {(d: Date) => boolean} p.enHorario
 * @returns {{ accion: 'volver'|'esperar'|'no', esperarMs?: number, motivo: string }}
 */
function decidirVuelta({ duenio, desde, esperandoFechas, esperandoDesde, excluido, ahora, enHorario }) {
    if (duenio === 'bot') return { accion: 'no', motivo: 'el bot ya atiende este chat' };
    if (duenio !== 'humano' || !desde) return { accion: 'no', motivo: 'el bot no se apagó porque lo tomó una persona (o no se sabe por qué)' };
    if (excluido) return { accion: 'no', motivo: 'el chat tiene una etiqueta que excluye al bot' };
    const fechas = (esperandoFechas && esperandoFechas.length ? esperandoFechas : (esperandoDesde ? [esperandoDesde] : []))
        .map(f => new Date(f)).sort((a, b) => a - b);
    if (!fechas.length) return { accion: 'no', motivo: 'no hay un mensaje del cliente esperando' };
    const t = ahora.getTime();
    const tope = ANTIGUEDAD_MAXIMA_PARA_VOLVER_H * HORA;

    // La antigüedad, desde el MÁS NUEVO (15/10/2026).
    const masNuevo = fechas[fechas.length - 1];
    if (t - masNuevo.getTime() >= tope) {
        return { accion: 'no', motivo: `el último mensaje del cliente tiene más de ${ANTIGUEDAD_MAXIMA_PARA_VOLVER_H} h: no se contesta algo viejo` };
    }
    // La ventana del equipo, desde el primero que sigue vigente.
    const primero = fechas.find(f => t - f.getTime() < tope);
    const espera = t - primero.getTime();

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
    if (enHorario(primero)) {
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
    analizarEspera,
    MOTIVO_APAGADO,
    decidirVuelta,
};
