/**
 * "Fulano respondió al seguimiento": aviso al equipo, en el momento.
 *
 * Pedido de Ishtar (8/10/2026): "cuando alguno responda, ¿podés informarle al
 * vendedor con un mensaje que diga 'tal habló'?". Va a la mensajería interna
 * del CRM, a UNA conversación grupal propia ("💬 Respuestas a seguimientos")
 * con el Asistente y todo el equipo (ADMIN + STAFF), así cualquiera que esté
 * trabajando lo ve y entra al chat. NO es una tarea: el embudo no deja nada
 * para tachar (decisión del mismo día); es una novedad que hay que leer.
 *
 * Por qué acá y no en la app: el wa-service es quien recibe el mensaje del
 * cliente, en el segundo en que llega. El motor de la app lo leería recién en
 * el tick de la hora siguiente.
 *
 * Espejo de lo que hace `InternalMessagingService.mensajeEnCanalDelSistema`
 * (src/services/internal-messaging.service.ts): mismo usuario Asistente
 * (`IA_EMAIL`), misma forma de reusar la conversación (kind GROUP + asunto +
 * creador). El wa-service no puede importar el .ts, así que se replica lo
 * mínimo. Nunca lanza: un aviso roto no puede frenar el guardado del mensaje.
 */
const IA_EMAIL = 'asistente@atelier.local';
const ROLES_EQUIPO = ['ADMIN', 'STAFF'];
const CANAL_RESPUESTAS = '💬 Respuestas a seguimientos';
const PLANTILLA_RETOME = 'retomar_con_cupon';
const FICHA_URL = (clientId) => `/admin/contactos?id=${clientId}`; // el link de la ficha es con ?id=, como en el resto del CRM

/** Texto del aviso. Puro, para poder probarlo. */
function textoDelAviso({ nombre, texto, tipo, plantilla, clientId }) {
    const dijo = tipo === 'TEXT' && texto
        ? `«${String(texto).replace(/\s+/g, ' ').trim().slice(0, 200)}»`
        : `[${String(tipo || 'mensaje').toLowerCase()}]`;
    const aQue = plantilla === PLANTILLA_RETOME
        ? ' al retome con el 10 % — **ya tiene el descuento reservado**, aplicarlo en la venta'
        : ' al seguimiento';
    return `💬 ${nombre} respondió${aQue}: ${dijo}\nEntrá al chat y seguilo: ${FICHA_URL(clientId)}`;
}

/**
 * Manda el aviso al canal. Devuelve true si salió.
 * @param {{ clientId: string, chatId: string, nombre: string, texto: string, tipo: string }} r
 */
async function avisarRespuestaAlEquipo(prisma, r) {
    try {
        const ia = await prisma.user.findUnique({ where: { email: IA_EMAIL }, select: { id: true, role: true } });
        if (!ia || ia.role !== 'SISTEMA') return false; // la app todavía no creó al Asistente
        const equipo = await prisma.user.findMany({ where: { role: { in: ROLES_EQUIPO } }, select: { id: true } });
        if (!equipo.length) return false;

        // ¿A qué toque respondió? El último saliente con plantilla de este chat.
        const ultimo = await prisma.whatsAppMessage.findFirst({
            where: { chatId: r.chatId, direction: 'OUTBOUND', templateName: { not: null } },
            orderBy: { createdAt: 'desc' }, select: { templateName: true },
        });
        const cuerpo = textoDelAviso({ ...r, plantilla: ultimo?.templateName || null });
        const ahora = new Date();

        let canal = await prisma.internalThread.findFirst({
            where: { kind: 'GROUP', subject: CANAL_RESPUESTAS, createdById: ia.id },
            select: { id: true, participants: { select: { userId: true, leftAt: true } } },
        });
        if (!canal) {
            canal = await prisma.internalThread.create({
                data: {
                    kind: 'GROUP', subject: CANAL_RESPUESTAS, createdById: ia.id, lastMessageAt: ahora,
                    participants: { create: [
                        { userId: ia.id, role: 'MEMBER', lastReadAt: ahora, createdAt: ahora },
                        ...equipo.map(u => ({ userId: u.id, role: 'MEMBER', createdAt: ahora })),
                    ] },
                },
                select: { id: true, participants: { select: { userId: true, leftAt: true } } },
            });
        } else {
            // Alguien nuevo en el equipo entra solo; quien salió del canal no se lo vuelve a meter.
            const conocidos = new Set(canal.participants.map(p => p.userId));
            const nuevos = equipo.filter(u => !conocidos.has(u.id));
            if (nuevos.length) await prisma.internalThreadParticipant.createMany({ data: nuevos.map(u => ({ threadId: canal.id, userId: u.id, role: 'MEMBER', createdAt: ahora })) });
        }

        await prisma.internalMessage.create({ data: { threadId: canal.id, senderId: ia.id, body: cuerpo, urgent: false, createdAt: ahora } });
        await prisma.internalThread.update({ where: { id: canal.id }, data: { lastMessageAt: ahora } });
        return true;
    } catch (e) {
        console.error('[Aviso respuesta] No se pudo avisar al equipo:', e.message);
        return false;
    }
}

module.exports = { avisarRespuestaAlEquipo, textoDelAviso, CANAL_RESPUESTAS, PLANTILLA_RETOME };
