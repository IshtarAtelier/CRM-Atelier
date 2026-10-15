/**
 * Cuando un seguimiento AUTOMÁTICO no llega, el sistema se hace a un lado.
 *
 * El motor (`/api/cron/seguimientos`, CRM) manda la plantilla y registra el
 * escalón (etiqueta SEGUIMIENTO_DIA_x + lastFollowUpAt) en cuanto Meta la
 * ACEPTA. El rechazo llega después, por webhook de estado. Si no se deshace
 * el registro, el embudo cree que la persona fue contactada, el escalón
 * siguiente (invitación al local, último toque) sale encima de un mensaje que
 * nunca llegó, y nadie le escribe a mano.
 *
 * Primer caso real (11/9/2026, primer tick del motor en modo real): a Sofia
 * Meta le rechazó el primer toque con 130472 ("el cliente pidió no recibir
 * marketing"), y la ficha quedó con SEGUIMIENTO_DIA_1 como si hubiera llegado.
 *
 * Qué se hace: se saca la etiqueta del escalón y `lastFollowUpAt`, así el
 * tablero lo vuelve a mostrar en "para hoy" para una PERSONA; y se pausa el
 * motor 30 días para esa charla (`followUpPausedUntil`): insistir con otra
 * plantilla a quien Meta ya frenó es lo que más le pega a la calidad del
 * número. El aviso al equipo lo manda `persistStatus` como con cualquier
 * rechazo.
 *
 * Espejo de `ETIQUETA_POR_PLANTILLA` (src/lib/embudo/playbook.ts): el
 * wa-service no puede importar el .ts.
 */
const ETIQUETA_POR_PLANTILLA = {
    seguimiento_presupuesto: 'SEGUIMIENTO_DIA_1',
    seguimiento_lentes_sin_receta: 'SEGUIMIENTO_DIA_1',
    seguimiento_lentes_con_receta: 'SEGUIMIENTO_DIA_1',
    seguimiento_carrito: 'SEGUIMIENTO_DIA_1',
    invitacion_local_v4: 'SEGUIMIENTO_DIA_4',
    ultimo_seguimiento: 'SEGUIMIENTO_DIA_15',
    retomar_con_cupon: 'SEGUIMIENTO_RETOME',
};
const REMITENTE_AUTOMATICO = 'Sistema';
/** Espejo de LABEL_SIN_SEGUIMIENTO (src/lib/seguimientos/politica.ts). */
const LABEL_SIN_SEGUIMIENTO = 'SIN_SEGUIMIENTO';
const PAUSA_DIAS = 30;

/** true si este saliente es un seguimiento que mandó el motor solo. */
function esSeguimientoAutomatico(row) {
    return Boolean(row && row.senderName === REMITENTE_AUTOMATICO && row.templateName && ETIQUETA_POR_PLANTILLA[row.templateName]);
}

/**
 * Deshace el registro del escalón y pausa el motor para ese chat.
 * @returns {Promise<{etiqueta:string, pausadoHasta:Date}|null>}
 */
async function deshacerSeguimientoFallido(prisma, row, { deCuenta = false, definitivo = false } = {}) {
    if (!esSeguimientoAutomatico(row)) return null;
    const etiqueta = ETIQUETA_POR_PLANTILLA[row.templateName];
    const chat = await prisma.whatsAppChat.findUnique({ where: { id: row.chatId }, select: { chatLabels: true } });
    if (!chat) return null;
    // Si el problema es de la CUENTA (pago, plantilla pausada, token), no es
    // culpa de este número: se deshace el escalón y listo, el motor reintenta
    // cuando la cuenta esté bien. La pausa de 30 días es solo para los
    // rechazos propios del número (no tiene WhatsApp, pidió no recibir marketing).
    // `definitivo`: el cliente pidió a Meta no recibir marketing de este
    // negocio (código 130472). Medido el 8/10/2026: 19 de 36 rechazos del mes.
    // Pausarlo 30 días solo garantiza otro rechazo en 30 días: se apaga el
    // seguimiento de esa persona (misma etiqueta que el botón "Sin seguimiento").
    const pausadoHasta = deCuenta || definitivo ? null : new Date(Date.now() + PAUSA_DIAS * 86400000);
    const etiquetas = (chat.chatLabels || []).filter(l => l !== etiqueta);
    if (definitivo && !etiquetas.includes(LABEL_SIN_SEGUIMIENTO)) etiquetas.push(LABEL_SIN_SEGUIMIENTO);
    await prisma.whatsAppChat.update({
        where: { id: row.chatId },
        data: {
            chatLabels: etiquetas,
            lastFollowUpAt: null,
            ...(pausadoHasta ? { followUpPausedUntil: pausadoHasta } : {}),
        },
    });
    return { etiqueta, pausadoHasta, definitivo };
}

module.exports = { deshacerSeguimientoFallido, esSeguimientoAutomatico, ETIQUETA_POR_PLANTILLA, PAUSA_DIAS, LABEL_SIN_SEGUIMIENTO };
