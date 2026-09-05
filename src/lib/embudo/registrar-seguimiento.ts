import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';
import { ETIQUETA_POR_PLANTILLA, NOMBRE_CORTO_PLANTILLA, esPlantillaDeSeguimiento } from './playbook';
import { cerrarTareaDelEmbudo } from './sincronizar-tareas';

/**
 * Deja el rastro de un seguimiento ENVIADO. Es lo que hace que la tarjeta del
 * embudo se mueva sola: el clasificador (leads-pipeline.ts) lee las etiquetas
 * del chat, y sin esta escritura mandar una plantilla no cambiaba nada — la
 * tarjeta avanzaba solo por el reloj y decía "Sin contactar" aunque el
 * vendedor le hubiera escrito tres veces.
 *
 * Con WhatsApp Web esta etiqueta la escribía `wa-service/followups/sender.js`
 * después de cada envío automático. Con la API oficial el que manda es una
 * persona desde el buzón, así que el rastro se deja acá, en el mismo request
 * que confirmó el envío.
 *
 * Qué deja:
 *  - la etiqueta del escalón en el chat (SEGUIMIENTO_DIA_1/4/15);
 *  - una Interaction FOLLOWUP firmada en la ficha (quién, qué plantilla);
 *  - las tareas FOLLOWUP pendientes de esa persona, canceladas (ya se hizo);
 *  - el AuditLog.
 *
 * Plantillas que no son de seguimiento (pedido listo, presupuesto, etc.) no
 * pasan por acá: no son toques del embudo.
 */
export async function registrarSeguimientoEnviado(input: {
    chatId: string;
    plantilla: string;
    actor: Actor;
}): Promise<{ registrado: boolean; clientId: string | null }> {
    const { chatId, plantilla, actor } = input;
    if (!esPlantillaDeSeguimiento(plantilla)) return { registrado: false, clientId: null };

    const chat = await prisma.whatsAppChat.findUnique({
        where: { id: chatId },
        select: { id: true, clientId: true, chatLabels: true },
    });
    if (!chat) return { registrado: false, clientId: null };

    const etiqueta = ETIQUETA_POR_PLANTILLA[plantilla]!;
    const nombreCorto = NOMBRE_CORTO_PLANTILLA[plantilla] ?? plantilla;

    // La etiqueta se SUMA, no reemplaza: el clasificador toma la más alta y así
    // un segundo toque no borra la evidencia del primero.
    if (!chat.chatLabels.includes(etiqueta)) {
        await prisma.whatsAppChat.update({
            where: { id: chat.id },
            data: { chatLabels: [...chat.chatLabels, etiqueta], lastFollowUpAt: new Date() },
        });
    } else {
        await prisma.whatsAppChat.update({ where: { id: chat.id }, data: { lastFollowUpAt: new Date() } });
    }

    if (chat.clientId) {
        await prisma.interaction.create({
            data: {
                clientId: chat.clientId,
                type: 'FOLLOWUP',
                userId: actor.id,
                userName: actor.name,
                content: `📲 ${actor.name} envió el seguimiento "${nombreCorto}" por WhatsApp (plantilla ${plantilla})`,
            },
        });
        await prisma.clientTask.updateMany({
            where: { clientId: chat.clientId, type: 'FOLLOWUP', status: 'PENDING' },
            data: { status: 'CANCELLED' },
        });
        // La tarea del embudo (type 'TASK', la que sí se ve en el dashboard y
        // en la ficha) se cierra AHORA, atribuida a quien mandó el mensaje —
        // no hace falta esperar a la sincronización de mañana.
        await cerrarTareaDelEmbudo(chat.clientId, actor.name).catch(console.error);
        logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'NOTIFY',
            entityType: 'CONTACT',
            entityId: chat.clientId,
            details: { origen: 'embudo', plantilla, etiqueta, chatId: chat.id },
        }).catch(console.error);
    }

    return { registrado: true, clientId: chat.clientId };
}
