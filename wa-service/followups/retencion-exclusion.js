/**
 * Exclusión mutua de los flujos de retención (§8 del plan).
 *
 * Posventa, renovación, cumpleaños y segundo par miran la MISMA base instalada y
 * corren en el mismo cron. Sin una regla común, al mismo cliente le caen tres
 * mensajes distintos en la misma semana — la forma más rápida de que silencie el
 * número, que es la línea comercial del local. La regla es una sola:
 * UN toque de retención por cliente cada 14 días.
 *
 * Cuando dos flujos se pelean el mismo turno, gana el más urgente:
 *
 *     posventa > renovación > cumpleaños > segundo par
 *
 * El pedido de reseña NO es uno de estos flujos: se decidió que lo haga una
 * persona (ver el comentario en `config.js`), así que no pide turno ni lo gasta.
 *
 * El orden NO es de importancia comercial sino de VENTANA. La posventa a los 10
 * días de la entrega sirve esa semana y nunca más; la renovación tiene una
 * ventana de meses y no pierde nada esperando dos. Por eso el que llega con más
 * urgencia le corre la fecha al que puede esperar, en vez de resignar su turno.
 *
 * Este módulo NO crea ni envía nada: dice si el cliente tiene el turno libre y,
 * cuando hace falta, empuja para adelante la tarea del flujo menos urgente.
 */

const { prisma } = require('../db');
const { TAGS_SIN_BOT } = require('../utils');

const DIA_MS = 24 * 60 * 60 * 1000;

/** Firma de todos los flujos de retención. Está en la lista blanca de config.js. */
const CREADO_POR_RETENCION = 'Sistema (Retención)';

/** Un solo toque de retención por cliente cada N días. */
const RETENCION_EXCLUSION_DIAS = Number(process.env.RETENCION_EXCLUSION_DIAS) || 14;

/**
 * A partir de acá una tarea abierta se considera abandonada y deja de bloquear
 * el turno del cliente. Es la válvula de escape: si algo se traba, el peor caso
 * es que el cliente quede sin retención dos meses, no para siempre.
 */
const PENDIENTE_MAX_DIAS = Number(process.env.RETENCION_PENDIENTE_MAX_DIAS) || 60;

/**
 * Los flujos, con su prefijo de tarea y su prioridad (número más chico = más
 * urgente). El prefijo tiene que coincidir EXACTAMENTE con el que está en
 * AUTO_SENDABLE_TASK_PREFIXES de config.js, o el ejecutor no levanta la tarea.
 *
 * `prioridad: null` = la tarea NO es un mensaje: es una nota para que la atienda
 * una persona, así que no gasta el turno del cliente ni la bloquea. Es el caso de
 * '[RENOVACION MANUAL]' (clientes de mostrador, sin chat), que por eso tampoco
 * está en la lista blanca del ejecutor. Sin esta fila caería en el 'DESCONOCIDO'
 * de abajo y una nota para el mostrador dejaría al cliente sin retención por dos
 * semanas.
 */
const FLUJOS_RETENCION = {
    // El carrito va primero: su ventana es de horas (72h y el carrito está
    // muerto), contra los días de la posventa y los meses de la renovación.
    CARRITO:           { prefijo: '[CARRITO]',           prioridad: 1 },
    POSVENTA:          { prefijo: '[POSVENTA]',          prioridad: 2 },
    RENOVACION:        { prefijo: '[RENOVACION]',        prioridad: 3 },
    CUMPLE:            { prefijo: '[CUMPLE]',            prioridad: 4 },
    SEGUNDO_PAR:       { prefijo: '[SEGUNDO PAR]',       prioridad: 5 },
    RENOVACION_MANUAL: { prefijo: '[RENOVACION MANUAL]', prioridad: null },
};

/**
 * Tags y etiquetas que cortan cualquier flujo de retención.
 *
 * 'post-venta', 'postventa', 'ya es cliente' y 'cerrado' describen EXACTAMENTE a
 * la base instalada, que es a quien le escriben estos flujos: heredando
 * TAGS_SIN_BOT tal cual, la retención no le escribiría nunca a nadie. El resto
 * de la lista (proveedor, spam, no bot, personal, familiar, no interesado…) sí
 * corta, y se hereda para que un tag de exclusión nuevo valga acá sin tener que
 * acordarse de este archivo.
 */
const TAGS_QUE_NO_CORTAN_RETENCION = ['post-venta', 'postventa', 'ya es cliente', 'cerrado'];
const TAGS_EXCLUSION_RETENCION = TAGS_SIN_BOT.filter(t => !TAGS_QUE_NO_CORTAN_RETENCION.includes(t));

/** ¿Alguno de los tags/etiquetas del cliente o del chat corta la retención? */
function tieneTagDeCorte(nombres) {
    return (nombres || []).some(n =>
        TAGS_EXCLUSION_RETENCION.some(t => String(n || '').toLowerCase().includes(t))
    );
}

/**
 * De qué flujo es una tarea, leyendo su prefijo.
 * Un prefijo desconocido se trata como prioridad 0 (más urgente que todos): si
 * mañana aparece un flujo nuevo que todavía no está en esta tabla, la regla se
 * equivoca para el lado de NO escribirle al cliente.
 */
function clasificarTarea(description) {
    const desc = description || '';
    for (const [clave, flujo] of Object.entries(FLUJOS_RETENCION)) {
        if (desc.startsWith(flujo.prefijo)) return { clave, ...flujo };
    }
    return { clave: 'DESCONOCIDO', prefijo: '(flujo de retención sin registrar)', prioridad: 0 };
}

/**
 * Abre los turnos de un barrido: trae de una sola consulta los toques de
 * retención de todos los clientes candidatos y devuelve un objeto para
 * preguntar cliente por cliente, sin volver a pegarle a la base.
 *
 * @param {string[]} clientIds - Candidatos del barrido.
 * @param {string} flujoClave - Clave en FLUJOS_RETENCION del flujo que pregunta.
 * @param {Object} [opts]
 * @param {Date}   [opts.now]
 */
async function abrirTurnos(clientIds, flujoClave, { now = new Date() } = {}) {
    const flujo = FLUJOS_RETENCION[flujoClave];
    if (!flujo) throw new Error(`Flujo de retención desconocido: ${flujoClave}`);
    if (flujo.prioridad === null) throw new Error(`${flujoClave} no manda mensajes: no pide turno`);

    const ids = [...new Set((clientIds || []).filter(Boolean))];
    const limite = new Date(now.getTime() - RETENCION_EXCLUSION_DIAS * DIA_MS);

    // Las de la ventana, MÁS las que siguen abiertas aunque sean más viejas: una
    // tarea PENDING de hace veinte días no se envió todavía, así que el turno del
    // cliente sigue tomado por ella.
    //
    // Pero con un techo: sin él, UNA tarea que se trabó —un prefijo que nadie
    // levanta, un ejecutor que murió a mitad de un SENDING— deja al cliente sin
    // retención para siempre y en silencio. Pasados 60 días esa tarea no se va a
    // enviar nunca; que siga abierta es un bug de otra cosa, no un turno tomado.
    const abandono = new Date(now.getTime() - PENDIENTE_MAX_DIAS * DIA_MS);
    const tareas = ids.length
        ? await prisma.clientTask.findMany({
            where: {
                clientId: { in: ids },
                createdBy: CREADO_POR_RETENCION,
                OR: [
                    { createdAt: { gte: limite } },
                    { status: { in: ['PENDING', 'SENDING'] }, createdAt: { gte: abandono } },
                ],
            },
            select: { id: true, clientId: true, description: true, status: true, createdAt: true },
        })
        : [];

    const porCliente = new Map();
    for (const t of tareas) {
        if (!porCliente.has(t.clientId)) porCliente.set(t.clientId, []);
        porCliente.get(t.clientId).push({ ...t, flujo: clasificarTarea(t.description) });
    }

    // Turnos tomados durante ESTA corrida: dos pedidos del mismo cliente en el
    // mismo barrido tienen que dar un solo mensaje, y la tarea recién creada
    // todavía no está en el Map de arriba.
    const reservados = new Set();

    /**
     * ¿Está libre el turno de este cliente?
     * @returns {{ ok: boolean, motivo?: string, desplazables: Array }}
     */
    function disponible(clientId) {
        if (reservados.has(clientId)) {
            return { ok: false, motivo: 'ya tomó su turno en esta corrida', desplazables: [] };
        }

        const desplazables = [];
        for (const t of (porCliente.get(clientId) || [])) {
            // Nota para el mostrador, no un mensaje: no ocupa el turno.
            if (t.flujo.prioridad === null) continue;

            const mismoFlujo = t.flujo.clave === flujoClave;

            // Dedup del propio flujo: creada la tarea, este flujo no vuelve a
            // crearla mientras esté en la ventana, haya salido o no. Una tarea
            // cancelada (contacto frío, compuerta) no se reintenta al día
            // siguiente: si no correspondía hoy, tampoco corresponde mañana.
            if (mismoFlujo) {
                return { ok: false, motivo: `ya tiene un ${t.flujo.prefijo} (${t.status})`, desplazables: [] };
            }

            // Ya salió o está saliendo: el cliente recibió su mensaje de la
            // quincena. Ninguna prioridad deshace un WhatsApp ya enviado.
            if (t.status === 'DONE' || t.status === 'SENDING') {
                return { ok: false, motivo: `toque reciente de ${t.flujo.prefijo} (${t.status})`, desplazables: [] };
            }

            if (t.status === 'PENDING') {
                if (t.flujo.prioridad <= flujo.prioridad) {
                    return { ok: false, motivo: `${t.flujo.prefijo} pendiente tiene prioridad`, desplazables: [] };
                }
                desplazables.push(t);
                continue;
            }

            // CANCELLED / FAILED de OTRO flujo: nunca llegó al cliente, así que
            // no le gastó el turno. Que la posventa se haya cancelado por un tag
            // no puede dejar sin su renovación a un cliente que la necesita.
        }

        return { ok: true, desplazables };
    }

    /**
     * Toma el turno: corre para adelante las tareas menos urgentes que estaban
     * pendientes y deja al cliente reservado por lo que queda de la corrida.
     * Devuelve false si el turno ya no estaba libre.
     */
    async function tomar(clientId) {
        const estado = disponible(clientId);
        if (!estado.ok) return false;

        for (const t of estado.desplazables) {
            // Guarda por status: si entre la lectura y ahora el ejecutor la
            // reclamó (SENDING), no se la tocamos — ese mensaje ya está en vuelo.
            const nuevaFecha = new Date(now.getTime() + (RETENCION_EXCLUSION_DIAS + 1) * DIA_MS);
            const movida = await prisma.clientTask.updateMany({
                where: { id: t.id, status: 'PENDING' },
                data: { dueDate: nuevaFecha },
            }).catch(() => ({ count: 0 }));

            if (movida.count > 0) {
                t.status = 'DESPLAZADA'; // que no la vuelva a contar esta misma corrida
                console.log(`  ↪️ [Retención] ${t.flujo.prefijo} corrida ${RETENCION_EXCLUSION_DIAS + 1} días: le cede el turno a ${flujo.prefijo}`);
            }
        }

        reservados.add(clientId);
        return true;
    }

    return { disponible, tomar };
}

module.exports = {
    CREADO_POR_RETENCION,
    RETENCION_EXCLUSION_DIAS,
    FLUJOS_RETENCION,
    TAGS_EXCLUSION_RETENCION,
    tieneTagDeCorte,
    clasificarTarea,
    abrirTurnos,
};
