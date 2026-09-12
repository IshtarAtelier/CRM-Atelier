/**
 * Cuando alguien RESPONDE a un seguimiento, el vendedor tiene que enterarse.
 *
 * Pedido de Ishtar (12/9/2026): "los que respondan con interés: tenés que
 * crearle una tarea al vendedor, si no el embudo se pierde". Ejemplo del
 * primer día del motor: Sole contestó "Hola sí me parece bien, solo me quedó
 * una duda que es el índice de los orgánicos" y nadie tenía una tarea.
 *
 * Regla: la PRIMERA respuesta del cliente después del último seguimiento
 * (`chat.lastFollowUpAt`, lo deja registrar-seguimiento.ts para envíos de
 * persona o del motor) crea una tarea del vendedor con el texto de la
 * respuesta. No se filtra por "interés": decidir si es interés o un "no,
 * gracias" es trabajo del vendedor, y las dos cosas piden una acción (seguir
 * o cerrar como perdido). Una tarea por respuesta; si el cliente manda tres
 * burbujas seguidas, la primera ya la creó y las otras no suman.
 */
const CREADO_POR = 'Sistema (Embudo)';
const PREFIJO = '💬 Respondió al seguimiento';

/** ¿Este entrante es la primera respuesta después del último seguimiento? (`chatAntes` = el chat ANTES de registrar el entrante) */
function esPrimeraRespuestaAlSeguimiento(chatAntes) {
    if (!chatAntes || !chatAntes.lastFollowUpAt) return false;
    if (!chatAntes.lastInboundAt) return true;
    return chatAntes.lastInboundAt.getTime() < chatAntes.lastFollowUpAt.getTime();
}

/**
 * Crea la tarea del vendedor. Devuelve la tarea o null si no correspondía.
 * @param {{ clientId: string|null, lastFollowUpAt: Date|null, lastInboundAt: Date|null }} chatAntes
 * @param {{ texto: string, tipo: string }} entrante
 */
async function crearTareaPorRespuesta(prisma, chatAntes, entrante) {
    if (!chatAntes || !chatAntes.clientId || !esPrimeraRespuestaAlSeguimiento(chatAntes)) return null;
    const resumen = entrante.tipo === 'TEXT'
        ? `«${String(entrante.texto || '').replace(/\s+/g, ' ').trim().slice(0, 160)}»`
        : `[${String(entrante.tipo || 'mensaje').toLowerCase()}]`;
    // Sin duplicar: una viva por cliente con este prefijo.
    const viva = await prisma.clientTask.findFirst({
        where: { clientId: chatAntes.clientId, status: 'PENDING', description: { startsWith: PREFIJO } },
        select: { id: true },
    });
    if (viva) return null;
    return prisma.clientTask.create({
        data: {
            clientId: chatAntes.clientId,
            type: 'TASK',
            status: 'PENDING',
            dueDate: new Date(),
            createdBy: CREADO_POR,
            description: `${PREFIJO}: ${resumen} — contestarle y definir (seguir / ganado / perdido).`,
        },
    });
}

module.exports = { esPrimeraRespuestaAlSeguimiento, crearTareaPorRespuesta, PREFIJO, CREADO_POR };
