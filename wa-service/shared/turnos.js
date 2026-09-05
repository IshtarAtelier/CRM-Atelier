/**
 * Turnos en el local: cuándo se pueden dar y cómo se guardan.
 *
 * Un turno es un `ClientTask` con `type: 'TURNO'` y `dueDate` = fecha Y HORA
 * exactas. No se inventó una tabla nueva a propósito: `ClientTask` ya tiene
 * fecha, ya se ve en la ficha del cliente, ya la barren los crons cada hora y
 * ya tiene el campo `type` (hoy: TASK, FOLLOWUP, REVIEW_REQUEST). Sumar un
 * valor a ese campo no necesita migración.
 *
 * LAS FRANJAS SON PREFERIDAS, NO UN MURO (regla de Ishtar, 5/9/2026). De 9 a 11
 * y de 16 a 20 hay DOS profesionales atendiendo, así que el cliente espera
 * menos. Pero si no le sirven, se le da turno en cualquier hora que el local
 * esté abierto: perder la visita por defender una franja es peor que atender
 * con una sola persona. Los sábados, en lo posible, evitarlos.
 */

const { isBusinessHours } = require('./business-hours');

/** Franjas con dos profesionales. [desde, hasta) en hora local. */
const FRANJAS_PREFERIDAS = [[9, 11], [16, 20]];

const TZ = 'America/Argentina/Cordoba';

/** Hora y día de la semana de una fecha, en hora de Córdoba. */
function enHoraLocal(fecha) {
    const d = new Date(new Date(fecha).toLocaleString('en-US', { timeZone: TZ }));
    return { dia: d.getDay(), hora: d.getHours() + d.getMinutes() / 60, fecha: d };
}

/** `true` si cae en una franja con dos profesionales. */
function esFranjaPreferida(fecha) {
    const { hora } = enHoraLocal(fecha);
    return FRANJAS_PREFERIDAS.some(([desde, hasta]) => hora >= desde && hora < hasta);
}

/**
 * ¿Se puede dar este turno? Devuelve `{ ok, motivo, preferida }`.
 *
 * Solo se rechaza lo IMPOSIBLE (local cerrado, fecha pasada o ilegible). Una
 * hora fuera de las franjas se acepta y se marca `preferida: false`, para que
 * quien lo mire sepa que ese turno se atiende con una sola persona.
 */
function validarTurno(fecha, ahora = new Date()) {
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return { ok: false, motivo: 'La fecha del turno no se entiende.' };
    if (d.getTime() < ahora.getTime()) return { ok: false, motivo: 'Ese horario ya pasó.' };
    if (!isBusinessHours(d)) return { ok: false, motivo: 'El local está cerrado en ese horario (Lun a Vie 9 a 20, Sáb 9 a 17, domingo cerrado).' };

    const { dia } = enHoraLocal(d);
    return {
        ok: true,
        preferida: esFranjaPreferida(d),
        esSabado: dia === 6,
        motivo: null,
    };
}

/** "viernes 12/09 a las 10:30" — para el mensaje al cliente y para la agenda. */
function textoDelTurno(fecha) {
    const d = new Date(fecha);
    // Las partes se piden por separado: el formato junto de es-AR devuelve
    // "martes 08-09" (con guion), que se lee como un rango, no como una fecha.
    const dia = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'long' }).format(d);
    const diaMes = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(d);
    const hora = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    return `${dia} ${diaMes} a las ${hora}`;
}

module.exports = { FRANJAS_PREFERIDAS, validarTurno, esFranjaPreferida, textoDelTurno, enHoraLocal };
