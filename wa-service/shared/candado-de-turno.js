'use strict';

/**
 * Candado del turno del bot POR CHAT, en la base.
 *
 * Por qué (auditoría del 15/10/2026): el candado era un `Set` en memoria y los
 * timers del debounce también. Con dos instancias del wa-service (ya pasó con
 * los crons, ver crons-duplicados) el barrido de vueltas en A y el webhook en
 * B programaban cada uno su turno y el cliente recibía dos respuestas.
 *
 * Es un LEASE con vencimiento (`botTurnoHasta` / `botTurnoPor` en
 * WhatsAppChat), no un advisory lock: el turno dura decenas de segundos con
 * llamadas a la IA y a Meta en el medio, y no corre dentro de una
 * transacción. Si el proceso muere con el candado tomado, vence solo a los
 * `DURACION_MS` y el chat no queda trabado.
 *
 * Tomarlo es UN `updateMany` condicional (libre, vencido o ya mío): Postgres
 * lo hace atómico, así que de dos instancias gana una sola.
 *
 * Sin las columnas (rollout: el wa-service desplegado antes que la migración
 * del CRM) cae al candado en memoria de siempre y lo dice una vez en el log.
 */

const os = require('os');
const crypto = require('crypto');
const { esColumnaAusente, marcarAusentes, columnasDisponibles } = require('./motivo-apagado');

/**
 * Lo bastante largo para un turno entero (grafo 30 s + lectura de receta +
 * burbujas con pausas), lo bastante corto para que un proceso muerto no deje
 * el chat mudo mucho rato. Si un turno lo pasara, otra instancia podría
 * arrancar el suyo: el control "¿escribió de nuevo / contestó alguien?" de
 * antes de cada burbuja es la segunda red.
 */
const DURACION_MS = 3 * 60 * 1000;

function crearCandadoDeTurno({ prisma, instancia, duracionMs = DURACION_MS, reloj = () => new Date(), consola = console }) {
    const yo = instancia || `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString('hex')}`;
    const enMemoria = new Set();
    let avisado = false;

    function aMemoria(e) {
        marcarAusentes(e);
        if (!avisado) {
            avisado = true;
            consola.warn('  ⚠️ [Candado] Sin columnas botTurnoHasta/botTurnoPor: el candado del turno queda EN MEMORIA (no protege entre instancias).');
        }
    }

    /** @returns {Promise<boolean>} true si este proceso puede correr el turno */
    async function tomar(chatId) {
        if (enMemoria.has(chatId)) return false;
        if (columnasDisponibles()) {
            const ahora = reloj();
            try {
                const r = await prisma.whatsAppChat.updateMany({
                    where: {
                        id: chatId,
                        OR: [{ botTurnoHasta: null }, { botTurnoHasta: { lt: ahora } }, { botTurnoPor: yo }],
                    },
                    data: { botTurnoHasta: new Date(ahora.getTime() + duracionMs), botTurnoPor: yo },
                });
                if (!r || r.count !== 1) return false;
            } catch (e) {
                if (!esColumnaAusente(e)) {
                    // La base no respondió: mejor no correr que correr dos veces.
                    consola.error('  ❌ [Candado] No se pudo tomar el candado del turno:', e && e.message);
                    return false;
                }
                aMemoria(e);
            }
        }
        enMemoria.add(chatId);
        return true;
    }

    async function soltar(chatId) {
        enMemoria.delete(chatId);
        if (!columnasDisponibles()) return;
        try {
            await prisma.whatsAppChat.updateMany({
                where: { id: chatId, botTurnoPor: yo },
                data: { botTurnoHasta: null, botTurnoPor: null },
            });
        } catch (e) {
            if (esColumnaAusente(e)) aMemoria(e);
            else consola.error('  ⚠️ [Candado] No se pudo soltar el candado (vence solo):', e && e.message);
        }
    }

    /** ¿Lo tiene ESTE proceso? (para no pisar un turno propio desde el barrido) */
    function tengo(chatId) { return enMemoria.has(chatId); }

    return { tomar, soltar, tengo, instancia: yo };
}

module.exports = { crearCandadoDeTurno, DURACION_MS };
