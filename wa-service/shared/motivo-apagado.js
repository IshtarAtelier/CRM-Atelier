'use strict';

/**
 * POR QUÉ está apagado el bot en un chat: una sola definición.
 *
 * Auditoría del 15/10/2026: el barrido que devuelve el bot a un chat "tomado
 * por una persona" decidía mirando la etiqueta `[SISTEMA - BOT APAGADO]`. Esa
 * etiqueta no se limpia nunca y la ponían también el apagado manual del panel,
 * la derivación (`escalarAHumano`), `disable_bot_for_personal_chat`, los
 * errores persistentes, el guardrail y el 429. Simulado contra producción: 17
 * de 44 chats habrían recibido respuesta del bot — casi todos cierres
 * ("gracias chicos!", "Okis muchas gracias"), y algunos que una persona había
 * silenciado A PROPÓSITO desde el panel.
 *
 * Ahora cada camino que apaga el bot dice por qué (`botOffReason` +
 * `botOffAt` en WhatsAppChat) y cada camino que lo prende lo limpia. El bot
 * vuelve solo ÚNICAMENTE con TOMADO_POR_PERSONA. Un motivo desconocido (NULL:
 * los chats apagados antes de la migración, o un camino viejo que no lo
 * anota) NO vuelve: ante la duda, el silencio que alguien eligió se respeta.
 *
 * Espejo TypeScript para el CRM: `src/lib/whatsapp/motivo-apagado-bot.ts`
 * (mismos valores; lo fija `npm run check:vuelta-bot`).
 *
 * Tolerancia a la columna ausente (rollout: el wa-service y el CRM se
 * despliegan por separado y la migración la corre el CRM al arrancar): las
 * escrituras van por `actualizarChat`, un `updateMany` (no devuelve la fila,
 * así que no pide columnas que la base no tiene) que, si la base rechaza las
 * columnas nuevas, reintenta sin ellas y lo dice UNA vez en el log.
 */

const MOTIVO_APAGADO = Object.freeze({
    /** Una persona del equipo escribió (buzón, celular, WhatsApp Web). El único que vuelve solo. */
    TOMADO_POR_PERSONA: 'TOMADO_POR_PERSONA',
    /** Alguien lo apagó desde el panel. Silencio elegido: no vuelve solo. */
    APAGADO_MANUAL: 'APAGADO_MANUAL',
    /** El bot pidió ayuda / prometió algo que hace una persona (escalarAHumano, cancel_bot). */
    DERIVADO: 'DERIVADO',
    /** No es un consumidor final: proveedor, familiar, spam (disable_bot_for_personal_chat). */
    PERSONAL: 'PERSONAL',
    /** Turnos fallidos seguidos. */
    ERRORES: 'ERRORES',
    /** El guardrail de salida bloqueó la respuesta (datos internos, sospecha de bot). */
    GUARDRAIL: 'GUARDRAIL',
    /** Cuota/crédito de la IA agotado (429). */
    CREDITO: 'CREDITO',
    /** Una etiqueta con acción "apagar bot" o "Cancelar Bot". */
    ETIQUETA: 'ETIQUETA',
});

const VALORES = new Set(Object.values(MOTIVO_APAGADO));

/** Normaliza: lo que no es un motivo conocido es NULL (desconocido). */
function motivoValido(m) {
    return VALORES.has(m) ? m : null;
}

/** ¿El barrido puede devolver el bot a un chat apagado por este motivo? */
function puedeVolverSolo(motivo) {
    return motivo === MOTIVO_APAGADO.TOMADO_POR_PERSONA;
}

/** Datos para apagar el bot con su motivo. */
function datosDeApagado(motivo, ahora = new Date()) {
    return { botEnabled: false, botOffReason: motivoValido(motivo), botOffAt: ahora };
}

/** Datos para prenderlo: el motivo se limpia, siempre. */
function datosDePrendido() {
    return { botEnabled: true, botOffReason: null, botOffAt: null };
}

// ── Columnas opcionales ─────────────────────────────────────────────────────

const COLUMNAS_NUEVAS = ['botOffReason', 'botOffAt', 'botTurnoHasta', 'botTurnoPor'];
let columnasAusentes = false;
let avisado = false;

/**
 * ¿El error es "la base (o el cliente) no tiene esta columna"? P2022 es la
 * columna que falta en Postgres; "Unknown argument/field" es un cliente
 * generado con un schema viejo.
 */
function esColumnaAusente(e) {
    if (!e) return false;
    if (e.code === 'P2022') return true;
    const m = String(e.message || '');
    return /Unknown (argument|field|arg)|does not exist|column .* not found/i.test(m)
        && COLUMNAS_NUEVAS.some(c => m.includes(c));
}

function sinColumnasNuevas(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) if (!COLUMNAS_NUEVAS.includes(k)) out[k] = v;
    return out;
}

function marcarAusentes(e) {
    columnasAusentes = true;
    if (!avisado) {
        avisado = true;
        console.warn(`  ⚠️ [MotivoApagado] La base no tiene las columnas ${COLUMNAS_NUEVAS.join('/')} (¿falta la migración 20261015_motivo_apagado_y_turno_bot?). Se escribe sin el motivo: el barrido NO reactiva nada hasta que estén. (${String(e && e.message || '').slice(0, 120)})`);
    }
}

/** Solo para los checks. */
function _reiniciarEstadoColumnas() { columnasAusentes = false; avisado = false; }

function columnasDisponibles() { return !columnasAusentes; }

/**
 * `updateMany` de WhatsAppChat tolerante a las columnas nuevas ausentes.
 * Devuelve `{ count }` (0 si falla por otra cosa: lo loguea y no tira).
 */
async function actualizarChat(prisma, where, data) {
    if (!columnasAusentes) {
        try {
            return await prisma.whatsAppChat.updateMany({ where, data });
        } catch (e) {
            if (!esColumnaAusente(e)) throw e;
            marcarAusentes(e);
        }
    }
    const w = sinColumnasNuevas(where);
    // Si el WHERE dependía de una columna nueva, sin ella podría tocar de más:
    // no se escribe nada.
    if (Object.keys(w).length !== Object.keys(where || {}).length) return { count: 0 };
    const d = sinColumnasNuevas(data);
    if (!Object.keys(d).length) return { count: 0 };
    return prisma.whatsAppChat.updateMany({ where: w, data: d });
}

/**
 * Lee el motivo de un chat. `undefined` si la columna no existe; `null` si
 * existe y está vacía. Las dos cosas significan "no vuelve solo".
 */
async function leerMotivo(prisma, chatId) {
    if (columnasAusentes) return undefined;
    try {
        const r = await prisma.whatsAppChat.findUnique({ where: { id: chatId }, select: { botOffReason: true } });
        return r ? motivoValido(r.botOffReason) : null;
    } catch (e) {
        if (esColumnaAusente(e)) { marcarAusentes(e); return undefined; }
        throw e;
    }
}

module.exports = {
    MOTIVO_APAGADO,
    COLUMNAS_NUEVAS,
    motivoValido,
    puedeVolverSolo,
    datosDeApagado,
    datosDePrendido,
    esColumnaAusente,
    sinColumnasNuevas,
    marcarAusentes,
    columnasDisponibles,
    actualizarChat,
    leerMotivo,
    _reiniciarEstadoColumnas,
};
