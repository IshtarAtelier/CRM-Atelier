'use strict';

/**
 * Las columnas de WhatsAppChat que el wa-service puede dar por sentadas.
 *
 * Por qué (auditoría del 15/10/2026): sin `select`, Prisma pide TODAS las
 * columnas que conoce su cliente (generado con el schema del repo), y si el
 * wa-service sale antes que la migración, la base contesta P2022 y el
 * entrante se pierde (el webhook ya le dijo 200 a Meta). Toda llamada que
 * devuelve un chat lleva `select`: CHAT_BASE cuando el objeto viaja a otros
 * módulos, `{ id: true }` cuando el resultado no se usa. Lo vigila
 * `npm run check:select-wa`.
 *
 * REGLA: una columna entra acá recién cuando su migración YA está en
 * producción (verificado con information_schema). Las nuevas se leen con un
 * helper tolerante a la columna ausente, como `botOffReason` en
 * shared/motivo-apagado.js. Al 15/10/2026 producción tiene exactamente estas.
 */
const CHAT_BASE = Object.freeze({
    id: true,
    clientId: true,
    waId: true,
    profileName: true,
    lastMessageAt: true,
    status: true,
    unreadCount: true,
    createdAt: true,
    updatedAt: true,
    botEnabled: true,
    archived: true,
    chatLabels: true,
    realPhone: true,
    chatSummary: true,
    lastFollowUpAt: true,
    followUpPausedUntil: true,
    adTag: true,
    adSourceId: true,
    adSourceType: true,
    adCtwaClid: true,
    adHeadline: true,
    adSourceUrl: true,
    adReferralAt: true,
    lastInboundAt: true,
});

/** Para escrituras cuyo resultado no se usa: que no devuelvan la fila entera. */
const SOLO_ID = Object.freeze({ id: true });

/**
 * Columnas SIN las que el wa-service no puede guardar ni leer entrantes
 * (15/10/2026). Si `migrate deploy` falla al arrancar, shared/migrar-al-arrancar.js
 * consulta information_schema por ESTA lista: si están todas, arranca igual
 * (lo nuevo y tolerante —`botOffReason`/`botOffAt` del motivo, el lease
 * `botTurnoHasta`/`botTurnoPor`— degrada solo); si falta alguna, no arranca.
 * - WhatsAppChat: todo CHAT_BASE (lo pide cada lectura de chat).
 * - WhatsAppMessage.receivedAt: lo usan el orden de llegada y el dueño del
 *   chat en `orderBy`/`where`, sin camino tolerante.
 * Una columna nueva que se lea sin helper tolerante TIENE que sumarse acá.
 */
const COLUMNAS_REQUERIDAS = Object.freeze({
    WhatsAppChat: Object.freeze(Object.keys(CHAT_BASE)),
    WhatsAppMessage: Object.freeze(['id', 'chatId', 'createdAt', 'receivedAt']),
});

module.exports = { CHAT_BASE, SOLO_ID, COLUMNAS_REQUERIDAS };
