import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { SYSTEM_ACTOR } from '@/lib/actor';
import { PAUSA_POSPONER_DIAS, decidirPosponer } from '@/lib/embudo/respuesta';
import { ETIQUETA_POR_PLANTILLA } from '@/lib/embudo/playbook';

/**
 * LO QUE ANTES HACÍA UNA PERSONA al final del embudo, hecho por el sistema.
 *
 * Decisión de Ishtar (8/10/2026): "en embudo no debe haber nada para humano".
 * Hasta ese día el playbook terminaba en "Definir: ganado o perdido" y en
 * "sigue una persona" cuando el cliente contestaba; nadie tenía botón para lo
 * primero (111 tareas vencidas acumuladas) y lo segundo se cerró 11 veces en
 * un mes. Acá viven las dos acciones, firmadas 'Sistema' y auditadas.
 *
 * Perdido = etiqueta `TAG_PERDIDO_EMBUDO` en la ficha (lo saca del embudo,
 * `embudo.service.ts` la tiene en EXCLUSION_TAGS) + presupuestos pendientes
 * en `LOST` (lo saca de Oportunidades de Cierre, que solo mira
 * PENDING/CONFIRMED: misma regla que el botón ✓ de ese panel). La ficha queda
 * CONTACT: si vuelve a escribir, el bot lo atiende y una venta lo convierte.
 */
export const TAG_PERDIDO_EMBUDO = 'Perdido (embudo)';

/**
 * El 10 % del retome se gana RESPONDIENDO (Ishtar, 8/10/2026: "quiero
 * aprovechar el descuento con que respondan"). La etiqueta en la ficha es lo
 * que ve el vendedor para aplicarlo en la venta como descuento especial.
 */
export const TAG_RETOME_10 = 'Retome 10%';
export const PLANTILLA_RETOME = 'retomar_con_cupon';


async function etiquetar(clientId: string, nombre: string): Promise<void> {
    const tag = await prisma.tag.upsert({ where: { name: nombre }, update: {}, create: { name: nombre, color: '#78716c' }, select: { id: true } });
    await prisma.client.update({ where: { id: clientId }, data: { tags: { connect: { id: tag.id } } }, select: { id: true } });
}

/** Marca perdido a un lead del embudo. `motivo` va a la ficha tal cual. */
export async function cerrarComoPerdido(input: { clientId: string; motivo: string; palabrasDelCliente?: string | null }): Promise<void> {
    const { clientId, motivo, palabrasDelCliente } = input;
    const perdidos = await prisma.order.updateMany({
        where: { clientId, orderType: 'QUOTE', status: { in: ['PENDING', 'CONFIRMED'] }, isDeleted: false },
        data: { status: 'LOST' },
    });
    await etiquetar(clientId, TAG_PERDIDO_EMBUDO);
    const cita = palabrasDelCliente ? ` Dijo: «${palabrasDelCliente.replace(/\s+/g, ' ').trim().slice(0, 160)}».` : '';
    await prisma.interaction.create({
        data: {
            clientId, type: 'NOTE', userId: SYSTEM_ACTOR.id, userName: SYSTEM_ACTOR.name,
            content: `🔒 ${SYSTEM_ACTOR.name} cerró el embudo como PERDIDO: ${motivo}.${cita}${perdidos.count ? ` ${perdidos.count} presupuesto(s) marcado(s) perdido(s).` : ''} Si vuelve a escribir, el bot lo atiende; una venta lo convierte igual.`,
        },
    });
    // Cambia el estado de presupuestos: la fila de auditoría se espera.
    await logAudit({
        userId: SYSTEM_ACTOR.id, userName: SYSTEM_ACTOR.name, action: 'UPDATE', entityType: 'CONTACT', entityId: clientId,
        details: { origen: 'embudo', accion: 'perdido', motivo, presupuestosPerdidos: perdidos.count, palabrasDelCliente: palabrasDelCliente?.slice(0, 160) ?? null },
    });
}

/** Respondió al retome con el 10 %: queda reservado a su nombre en la ficha. Devuelve false si ya lo tenía. */
export async function reservarDescuentoRetome(input: { clientId: string; palabrasDelCliente: string | null; tagNames: string[] }): Promise<boolean> {
    if (input.tagNames.some(t => t.toLowerCase() === TAG_RETOME_10.toLowerCase())) return false;
    await etiquetar(input.clientId, TAG_RETOME_10);
    const cita = input.palabrasDelCliente ? ` Respondió: «${input.palabrasDelCliente.replace(/\s+/g, ' ').trim().slice(0, 160)}».` : '';
    await prisma.interaction.create({
        data: {
            clientId: input.clientId, type: 'NOTE', userId: SYSTEM_ACTOR.id, userName: SYSTEM_ACTOR.name,
            content: `🎁 ${SYSTEM_ACTOR.name} reservó el 10% de descuento del retome (plantilla ${PLANTILLA_RETOME}): el cliente respondió al mensaje.${cita} Aplicarlo en la venta como descuento especial.`,
        },
    });
    logAudit({
        userId: SYSTEM_ACTOR.id, userName: SYSTEM_ACTOR.name, action: 'UPDATE', entityType: 'CONTACT', entityId: input.clientId,
        details: { origen: 'embudo', accion: 'retome-10', palabrasDelCliente: input.palabrasDelCliente?.slice(0, 160) ?? null },
    }).catch(console.error);
    return true;
}

/**
 * El cliente pidió "más adelante": se pausa el seguimiento y queda anotado. Si
 * lo que contestó fue el retome, se le saca esa etiqueta: cuando vuelva de la
 * pausa se le ofrece el 10 % otra vez (hasta los 120 días del playbook).
 *
 * IDEMPOTENTE (19/10/2026): el motor relee la misma respuesta cada hora. La
 * pausa se cuenta desde el mensaje (`respuestaAt`), y si ya está aplicada
 * —o ya se anotó para ese mensaje— no se toca nada: ni la pausa, ni la ficha,
 * ni el AuditLog. Devuelve `null` cuando no hizo nada.
 */
export async function posponerSeguimiento(input: { clientId: string; chatId: string; palabrasDelCliente: string | null; respuestaAt: Date; now?: number }): Promise<Date | null> {
    const now = input.now ?? Date.now();
    const chat = await prisma.whatsAppChat.findUnique({ where: { id: input.chatId }, select: { chatLabels: true, followUpPausedUntil: true } });
    const respuestaIso = input.respuestaAt.toISOString();
    const yaRegistrada = (await prisma.auditLog.count({
        where: {
            entityType: 'CONTACT', entityId: input.clientId,
            AND: [
                { details: { path: ['origen'], equals: 'embudo' } },
                { details: { path: ['accion'], equals: 'posponer' } },
                { details: { path: ['respuestaAt'], equals: respuestaIso } },
            ],
        },
    })) > 0;
    const decision = decidirPosponer({ respuestaAt: input.respuestaAt, followUpPausedUntil: chat?.followUpPausedUntil ?? null, now, yaRegistrada });
    if (!decision.aplicar) return null;
    const { hasta } = decision;
    const etiquetaRetome = ETIQUETA_POR_PLANTILLA[PLANTILLA_RETOME]!;
    await prisma.whatsAppChat.update({
        where: { id: input.chatId },
        data: { followUpPausedUntil: hasta, chatLabels: (chat?.chatLabels ?? []).filter(l => l !== etiquetaRetome) },
        select: { id: true },
    });
    const cita = input.palabrasDelCliente ? ` Dijo: «${input.palabrasDelCliente.replace(/\s+/g, ' ').trim().slice(0, 160)}».` : '';
    await prisma.interaction.create({
        data: {
            clientId: input.clientId, type: 'NOTE', userId: SYSTEM_ACTOR.id, userName: SYSTEM_ACTOR.name,
            content: `⏸️ ${SYSTEM_ACTOR.name} pausó los seguimientos ${PAUSA_POSPONER_DIAS} días (hasta ${hasta.toISOString().slice(0, 10)}): el cliente pidió más adelante.${cita}`,
        },
    });
    logAudit({
        userId: SYSTEM_ACTOR.id, userName: SYSTEM_ACTOR.name, action: 'UPDATE', entityType: 'CONTACT', entityId: input.clientId,
        details: { origen: 'embudo', accion: 'posponer', hasta: hasta.toISOString(), respuestaAt: respuestaIso, palabrasDelCliente: input.palabrasDelCliente?.slice(0, 160) ?? null },
    }).catch(console.error);
    return hasta;
}
