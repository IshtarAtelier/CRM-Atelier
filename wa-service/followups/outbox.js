/**
 * Outbox de envíos proactivos — Fase 1 del motor de seguimientos (12/8/2026).
 *
 * El problema que resuelve: un mensaje aprobado podía esperar hasta 13 horas en
 * la cola EN RAM del anti-ban (pausas de lote, límite horario, retención
 * nocturna), y cada deploy reinicia el bot y evaporaba lo encolado sin dejar
 * rastro. Era la causa real de "a veces no sale nada".
 *
 * Contrato:
 *   - `sender.js` PERSISTE la fila (QUEUED) al aprobar el envío, la pasa a
 *     SENDING cuando el preflight da vía libre (segundos antes del envío
 *     físico) y la cierra en SENT / SKIPPED / FAILED con el motivo.
 *   - Al ARRANCAR el proceso, `recuperarPendientes()`:
 *       · QUEUED  → se reenvía por el camino normal completo (guardrail,
 *         revalidación, compuerta del claim). El claimStamp persistido
 *         reconstruye el preflight: si otra corrida ya tomó la tarea, el
 *         token no coincide y el envío se descarta solo. Cero duplicados.
 *       · SENDING → INCIERTO: el proceso murió entre el vía-libre y el
 *         registro del resultado; el mensaje QUIZÁ salió. Nunca se reenvía a
 *         ciegas — se marca SKIPPED y la ClientTask asociada vuelve sola por
 *         el mecanismo de stale-claim (45 min), con la compuerta re-evaluando.
 *
 * TODO acá es best-effort deliberado: la outbox es el cinturón de seguridad
 * del envío, no su camino crítico. Si la DB hipa, el envío sigue; solo se
 * pierde la trazabilidad de esa fila (y queda logueado).
 */

const { prisma } = require('../db');

/**
 * Registra un envío aprobado. Devuelve el id de la fila o null si falló.
 */
async function persistir({ waId, chatId, clientId, taskId, origen, contenido, mediaUrl, label, clientName, claimStamp }) {
    try {
        const fila = await prisma.envioProgramado.create({
            data: {
                waId,
                chatId: chatId || null,
                clientId: clientId || null,
                taskId: taskId || null,
                origen: origen || 'MANUAL',
                contenido,
                mediaUrl: mediaUrl || null,
                label: label || null,
                clientName: clientName || null,
                claimStamp: claimStamp || null,
            },
            select: { id: true },
        });
        return fila.id;
    } catch (e) {
        console.error('[Outbox] No se pudo persistir el envío:', e.message);
        return null;
    }
}

/**
 * Actualiza el estado de una fila. `motivo` va a lastError (también para
 * SKIPPED: es el "porqué no salió", no siempre un error).
 */
async function marcar(id, estado, motivo = null) {
    if (!id) return;
    try {
        await prisma.envioProgramado.update({
            where: { id },
            data: {
                estado,
                lastError: motivo ? String(motivo).substring(0, 500) : null,
                ...(estado === 'SENDING' ? { intentos: { increment: 1 } } : {}),
            },
        });
    } catch (e) {
        console.error(`[Outbox] No se pudo marcar ${id} → ${estado}:`, e.message);
    }
}

/**
 * Recuperación al arrancar el proceso. Ver el contrato de arriba.
 * `enviar` es `sendFollowUp` inyectado (evita el require circular con sender).
 */
async function recuperarPendientes(enviar) {
    try {
        // 1. SENDING huérfanos = inciertos. Nunca reenviar a ciegas.
        const inciertos = await prisma.envioProgramado.updateMany({
            where: { estado: 'SENDING' },
            data: { estado: 'SKIPPED', lastError: 'Reinicio del proceso con el envío en curso: resultado incierto, no se reenvía (la tarea se re-toma sola por stale-claim)' },
        });
        if (inciertos.count > 0) {
            console.warn(`[Outbox] ${inciertos.count} envío(s) en curso al morir el proceso anterior → marcados inciertos (no se reenvían).`);
        }

        // 2. QUEUED = aprobados que nunca salieron. Reenvío por el camino
        // normal completo; el claim persistido protege de duplicados.
        const colgados = await prisma.envioProgramado.findMany({
            where: { estado: 'QUEUED' },
            orderBy: { createdAt: 'asc' },
        });
        if (colgados.length === 0) {
            console.log('[Outbox] Sin envíos pendientes de procesos anteriores.');
            return { inciertos: inciertos.count, reenviados: 0 };
        }

        console.log(`[Outbox] Recuperando ${colgados.length} envío(s) que quedaron encolados en el proceso anterior…`);
        let reenviados = 0;
        for (const fila of colgados) {
            const resultado = await enviar({
                waId: fila.waId,
                text: fila.contenido,
                chatId: fila.chatId,
                label: fila.label || 'SEGUIMIENTO_RECUPERADO',
                clientName: fila.clientName || fila.waId,
                followUpType: `${fila.origen} (recuperado)`,
                claim: fila.taskId ? { taskId: fila.taskId, claimStamp: fila.claimStamp } : undefined,
                outboxId: fila.id, // reusar la fila: el resultado pisa esta misma
            });
            if (resultado?.sent) reenviados++;
        }
        console.log(`[Outbox] Recuperación terminada: ${reenviados}/${colgados.length} reenviado(s); el resto quedó SKIPPED con su motivo.`);
        return { inciertos: inciertos.count, reenviados };
    } catch (e) {
        console.error('[Outbox] Error en la recuperación al arrancar:', e.message);
        return { inciertos: 0, reenviados: 0 };
    }
}

/**
 * Resumen del estado de la outbox para el ciclo de observabilidad.
 */
async function resumen(desdeMinutos = 35) {
    const desde = new Date(Date.now() - desdeMinutos * 60000);
    const filas = await prisma.envioProgramado.groupBy({
        by: ['estado'],
        where: { updatedAt: { gte: desde } },
        _count: { _all: true },
    });
    const porEstado = Object.fromEntries(filas.map(f => [f.estado, f._count._all]));
    const pendientes = await prisma.envioProgramado.count({ where: { estado: 'QUEUED' } });
    return { porEstado, pendientes };
}

module.exports = { persistir, marcar, recuperarPendientes, resumen };
