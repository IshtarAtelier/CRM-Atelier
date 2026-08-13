/**
 * Posventa: a los 10 días de entregado el pedido, preguntar cómo va la adaptación.
 *
 * En multifocales los 10 días son EL momento. El que no se adapta no se queja:
 * deja el anteojo en un cajón y la óptica se entera tres meses después, cuando ya
 * no hay nada que ajustar y sí un cliente perdido. Preguntando a tiempo, el
 * problema se resuelve con una visita y un ajuste sin cargo.
 *
 * ESTE MÓDULO NO ENVÍA NADA. Solo crea la ClientTask '[POSVENTA] ...' con
 * createdBy 'Sistema (Retención)' — a propósito, para no construir un sexto
 * sistema de seguimientos. Quien la redacta, la pasa por la compuerta de
 * conversación y la manda es `smart-task-executor.js`, y con eso hereda gratis:
 * la cola anti-ban, la ventana horaria, el interruptor de pánico
 * `followups_enabled`, la etiqueta SIN_SEGUIMIENTO y el corte por contacto frío.
 * El prefijo y el creador ya están en las dos listas blancas de `config.js`.
 */

const { prisma } = require('../db');
const { TAGS_SIN_BOT } = require('../utils');
const { pickSpreadDueDate } = require('./task-generator');
const { evaluarElegibilidad } = require('./politica');
const { abrirTurnos } = require('./retencion-exclusion');

const DIA_MS = 24 * 60 * 60 * 1000;

/** A los cuántos días de la entrega se pregunta. */
const POSVENTA_DIAS = Number(process.env.POSVENTA_DIAS) || 10;

/**
 * Cuánto se tolera llegar tarde, en días. Es un techo, no un piso: un
 * "cómo venís con los anteojos nuevos?" a los 40 días no es posventa, es un
 * mensaje raro que suena a error (misma razón que TIER_GRACE_HOURS en los
 * seguimientos de presupuesto). Si el barrido estuvo caído más que esto, esa
 * entrega se da por perdida y no se le escribe.
 */
const POSVENTA_VENTANA_DIAS = Number(process.env.POSVENTA_VENTANA_DIAS) || 4;

/**
 * Tope de tareas nuevas por día. El volumen normal es de entregas (decenas por
 * mes), así que nunca debería tocarlo; está para la PRIMERA corrida, que ve de
 * golpe toda la ventana de entregas ya vencidas, y para el caso de que alguien
 * marque veinte pedidos como entregados de una sentada. Se cuenta en la base,
 * no en memoria: el tope vale aunque el proceso se reinicie diez veces.
 */
const POSVENTA_MAX_POR_DIA = Number(process.env.POSVENTA_MAX_POR_DIA) || 10;

const CREADO_POR = 'Sistema (Retención)';
const PREFIJO = '[POSVENTA]';

/**
 * 'post-venta', 'postventa', 'ya es cliente' y 'cerrado' describen EXACTAMENTE
 * al que acaba de retirar su pedido. Heredando TAGS_SIN_BOT tal cual, este flujo
 * no le escribiría nunca a nadie. El resto de la lista (proveedor, spam, no bot,
 * personal, familiar…) sí corta, y se hereda para que un tag de exclusión nuevo
 * valga acá sin tener que acordarse de este archivo.
 */
const TAGS_QUE_NO_CORTAN_POSVENTA = ['post-venta', 'postventa', 'ya es cliente', 'cerrado'];
const TAGS_EXCLUSION = TAGS_SIN_BOT.filter(t => !TAGS_QUE_NO_CORTAN_POSVENTA.includes(t));

/** Cristales que exigen adaptación: son los que justifican la pregunta. */
const RX_PROGRESIVO = /multifocal|bifocal|progresiv|ocupacional/i;

function tieneCristales(items) {
    // La regla del proyecto: un ítem con `eye` cargado es un cristal (se factura
    // por ojo). Un pedido sin cristales es un armazón suelto o un accesorio, y
    // ahí no hay adaptación que preguntar.
    return items.some(i => i.eye);
}

function esProgresivo(items) {
    return items.some(i => i.eye && (
        i.additionVal != null ||
        RX_PROGRESIVO.test(i.productTypeSnapshot || '') ||
        RX_PROGRESIVO.test(i.productNameSnapshot || '')
    ));
}

function primerNombre(nombre) {
    return ((nombre || '').trim().split(/\s+/)[0]) || '';
}

/**
 * Busca las transiciones a "Entregado" ocurridas dentro de la ventana.
 *
 * No hay columna `deliveredAt` en Order, y `updatedAt` no sirve: se mueve con
 * cualquier reedición posterior del pedido (un nº de operación corregido a los
 * 20 días haría "entregado hoy" algo de hace tres semanas). El único registro
 * fechado de la entrega es el AuditLog que escribe `updateOrder`, y ahí el
 * entityId ES el orderId.
 *
 * Se exige que `from.labStatus` NO fuera ya DELIVERED: el audit log arma
 * `to: { labStatus: data.labStatus ?? prevState.labStatus }`, así que una
 * edición cualquiera de un pedido ya entregado también deja `to.labStatus`
 * en DELIVERED. Sin este filtro, cada edición contaría como una entrega nueva.
 */
async function buscarEntregas(desde, hasta) {
    const transiciones = await prisma.auditLog.findMany({
        where: {
            entityType: 'ORDER',
            action: 'STATUS_CHANGE',
            createdAt: { gte: desde, lte: hasta },
            details: { path: ['to', 'labStatus'], equals: 'DELIVERED' },
        },
        select: { entityId: true, createdAt: true, details: true },
        orderBy: { createdAt: 'asc' },
    });

    const entregas = new Map(); // orderId -> fecha de la PRIMERA entrega
    for (const t of transiciones) {
        const detalle = t.details || {};
        if (detalle.from && detalle.from.labStatus === 'DELIVERED') continue;
        if (!entregas.has(t.entityId)) entregas.set(t.entityId, t.createdAt);
    }
    return entregas;
}

/**
 * Barrido de posventa. Se corre junto al resto de los crons de seguimientos.
 * Nunca lanza: cualquier error se loguea y la corrida siguiente reintenta (la
 * ventana de POSVENTA_VENTANA_DIAS está justamente para eso).
 */
async function generarTareasPosventa() {
    console.log(`\n[Posventa] Buscando entregas de hace ${POSVENTA_DIAS} a ${POSVENTA_DIAS + POSVENTA_VENTANA_DIAS} días...`);

    try {
        const now = new Date();
        const hasta = new Date(now.getTime() - POSVENTA_DIAS * DIA_MS);
        const desde = new Date(now.getTime() - (POSVENTA_DIAS + POSVENTA_VENTANA_DIAS) * DIA_MS);

        const entregas = await buscarEntregas(desde, hasta);
        if (entregas.size === 0) {
            console.log('[Posventa] Sin entregas en la ventana.\n');
            return;
        }

        // Cupo del día. Mismo anclaje horario que el task-generator: Argentina es
        // UTC-3 fija (sin horario de verano), así que el día se corre 3 horas.
        const ART_OFFSET_MS = 3 * 60 * 60 * 1000;
        const artNow = new Date(now.getTime() - ART_OFFSET_MS);
        const inicioDiaART = new Date(Date.UTC(artNow.getUTCFullYear(), artNow.getUTCMonth(), artNow.getUTCDate()) + ART_OFFSET_MS);

        const creadasHoy = await prisma.clientTask.count({
            where: { createdBy: CREADO_POR, description: { startsWith: PREFIJO }, createdAt: { gte: inicioDiaART } },
        });
        let cupoRestante = POSVENTA_MAX_POR_DIA - creadasHoy;
        if (cupoRestante <= 0) {
            console.log(`[Posventa] Cupo diario agotado (${creadasHoy}/${POSVENTA_MAX_POR_DIA}).\n`);
            return;
        }

        const orders = await prisma.order.findMany({
            where: {
                id: { in: [...entregas.keys()] },
                isDeleted: false,
                // Que siga entregado hoy: si alguien lo volvió atrás (se rehízo
                // el cristal, se corrigió una carga), el cliente no tiene el
                // anteojo puesto y preguntarle cómo se adapta es absurdo.
                labStatus: 'DELIVERED',
            },
            select: {
                id: true,
                clientId: true,
                items: { select: { eye: true, additionVal: true, productTypeSnapshot: true, productNameSnapshot: true } },
                // Un caso de posventa abierto significa que YA hay una persona
                // ocupándose del problema. Un "cómo venís con los anteojos?"
                // automático encima de eso es la peor cara que puede poner el local.
                postSaleCases: { select: { id: true } },
                client: {
                    select: {
                        id: true,
                        name: true,
                        tags: { select: { name: true } },
                        whatsappChats: {
                            // Sin orderBy el chat sale en orden arbitrario: los
                            // clientes con dos chats (@c.us y @lid) quedaban
                            // evaluados contra el chat equivocado.
                            orderBy: { lastMessageAt: 'desc' },
                            select: {
                                id: true,
                                chatLabels: true,
                                followUpPausedUntil: true,
                                lastFollowUpAt: true,
                            },
                        },
                    },
                },
            },
        });

        // Los dos filtros que necesitan otra tabla se resuelven en una consulta
        // cada uno, no una por cliente: el barrido corre cada 30 minutos.
        const clientIds = [...new Set(orders.map(o => o.clientId).filter(Boolean))];

        // Un solo toque de retención por cliente cada 14 días, compartido con los
        // demás flujos (`retencion-exclusion.js`). La posventa es la de mayor
        // prioridad —su ventana es de días y no vuelve— así que además de mirar
        // si el turno está libre, le corre la fecha a lo que esté pendiente y
        // pueda esperar (renovación, segundo par). También es el dedup del propio
        // flujo: creada la tarea, la ventana no la vuelve a crear.
        const turnos = await abrirTurnos(clientIds, 'POSVENTA', { now });

        const chatIds = orders.flatMap(o => (o.client?.whatsappChats || []).slice(0, 1).map(c => c.id));
        const chatsConInbound = chatIds.length
            ? await prisma.whatsAppMessage.findMany({
                where: { chatId: { in: chatIds }, direction: 'INBOUND' },
                select: { chatId: true },
                distinct: ['chatId'],
            })
            : [];
        const tieneInbound = new Set(chatsConInbound.map(m => m.chatId));

        let creadas = 0;
        let frenadasPorCupo = 0;

        // De la más vieja a la más nueva: si el cupo corta, se atiende primero a
        // quien hace más tiempo que espera (y a quien menos ventana le queda).
        const ordenadas = orders.slice().sort((a, b) => entregas.get(a.id) - entregas.get(b.id));

        for (const order of ordenadas) {
            const client = order.client;
            if (!client) continue;

            if (!tieneCristales(order.items)) continue;
            if (order.postSaleCases.length > 0) continue;

            const chat = (client.whatsappChats || [])[0];
            if (!chat) continue; // sin WhatsApp no hay por dónde: es trabajo de mostrador

            // Los filtros comunes los decide la POLÍTICA. Dos particularidades de
            // la posventa, expresadas como PARÁMETROS y no como una copia con
            // otros umbrales:
            //  · la lista de etiquetas es la recortada (para este flujo,
            //    "post-venta" y "ya es cliente" describen al destinatario, no lo excluyen);
            //  · `mirarConvertido` apagado: le escribe justamente a quien acaba de comprar.
            const veredicto = await evaluarElegibilidad({
                client, chat, now,
                tagsExclusion: TAGS_EXCLUSION,
                mirarConvertido: false,
                // El contacto frío ya viene resuelto en lote (`tieneInbound`):
                // repetir la query por cliente sería una por pedido entregado.
                exigirEntrante: false,
                // Este flujo mira la entrega, no la actividad del chat: el cliente
                // acaba de retirar y es normal que haya escrito hace poco.
                actividadHoras: 0,
            });
            if (!veredicto.ok) continue;

            // Contacto frío: nunca nos escribió. El ejecutor lo cancelaría igual,
            // pero cancelándolo deja una tarea muerta en la ficha del cliente.
            if (!tieneInbound.has(chat.id)) continue;

            const turno = turnos.disponible(client.id);
            if (!turno.ok) {
                console.log(`  ⏭️ [Posventa] ${client.name}: ${turno.motivo}`);
                continue;
            }

            if (cupoRestante <= 0) { frenadasPorCupo++; continue; }

            // Toma el turno (y corre para adelante lo menos urgente que haya
            // pendiente) recién ahora, cuando ya sabemos que la tarea se crea.
            if (!(await turnos.tomar(client.id))) continue;

            const fechaEntrega = entregas.get(order.id);
            const dias = Math.round((now.getTime() - new Date(fechaEntrega).getTime()) / DIA_MS);
            const nombre = primerNombre(client.name) || 'el cliente';
            const producto = esProgresivo(order.items) ? 'multifocales' : 'anteojos nuevos';

            // La descripción es literalmente el pedido que lee el redactor del
            // ejecutor, así que se escribe como una instrucción para él, no como
            // una nota interna: todo lo que diga acá puede terminar en el mensaje.
            const description =
                `${PREFIJO} ${nombre} retiró sus ${producto} hace ${dias} días. ` +
                `Preguntale cómo viene la adaptación y si necesita algún ajuste del armazón ` +
                `(el ajuste es sin cargo). Una sola pregunta, sin ofrecerle nada más.`;

            // Vencimiento repartido en la franja de envío de hoy (9 a 19 AR).
            // Domingo, o si el horario sorteado ya pasó, vence ahora: la ventana
            // horaria real la vuelve a chequear el ejecutor antes de mandar.
            let dueDate = pickSpreadDueDate(now);
            if (!dueDate || now > dueDate) dueDate = new Date(now.getTime());

            await prisma.clientTask.create({
                data: {
                    clientId: client.id,
                    description,
                    type: 'TASK',   // el ejecutor solo levanta type 'TASK'
                    status: 'PENDING',
                    dueDate,
                    createdBy: CREADO_POR,
                },
            });

            creadas++;
            cupoRestante--;

            const dueAR = dueDate.toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
            console.log(`  ✅ [Posventa] Tarea creada: ${client.name} (${producto}, entregado hace ${dias} días) — vence ${dueAR} AR`);

            if (global.io) {
                global.io.emit('task_created', { clientId: client.id, description });
            }
        }

        const nota = frenadasPorCupo > 0 ? ` · ${frenadasPorCupo} frenadas por el cupo diario` : '';
        console.log(`[Posventa] Finalizado. Tareas creadas: ${creadas}${nota}\n`);

    } catch (err) {
        console.error('❌ Error en Posventa:', err.message);
    }
}

module.exports = { generarTareasPosventa };
