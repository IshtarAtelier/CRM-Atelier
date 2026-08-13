/**
 * LA POLÍTICA: el único módulo que responde "¿se le puede mandar un seguimiento
 * a este cliente ahora?".
 *
 * Por qué existe. La respuesta vivía en 5 lugares distintos, cada uno con sus
 * propios umbrales copiados a mano: cooldown de 48hs en un lado y 72 en otro,
 * "actividad reciente" de 24hs acá y de 2hs allá, tres ventanas horarias
 * incompatibles. El resultado no era un bug puntual sino algo peor: nadie podía
 * decir con certeza por qué a un cliente le llegó (o no) un mensaje, y arreglar
 * un caso en un archivo dejaba los otros cuatro igual de rotos.
 *
 * Acá las reglas son UNA sola implementación y las diferencias legítimas entre
 * flujos son PARÁMETROS, no copias. Si mañana el negocio cambia el cooldown, se
 * cambia en un lugar y vale para todos.
 *
 * `eligibility.js` (los tiers de presupuesto) sigue existiendo y delega acá los
 * checks comunes; lo suyo — qué escalón corresponde — es propio y se queda ahí.
 *
 * Contrato: `evaluarElegibilidad(ctx) → { ok, motivo, codigo }`.
 * El `codigo` es para contar y graficar (nunca más un "no funciona" mudo); el
 * `motivo` es para que lo lea una persona.
 */

const { prisma } = require('../db');
const { TAGS_SIN_BOT } = require('../utils');
const { COOLDOWN_HOURS, ACTIVITY_WINDOW_HOURS } = require('./config');

/**
 * Estados de `Client.status` que significan "ya compró".
 *
 * Es LA señal operativa de conversión: verificado contra producción, una venta
 * cerrada muchas veces solo se ve acá (los tags y las órdenes no siempre
 * acompañan). Un cliente convertido sale de TODO lo automático — la regla la
 * dictó el negocio el 12/8/2026.
 */
const ESTADOS_CONVERTIDO = ['CLIENT', 'active'];

/** Códigos de rechazo. Cerrado a propósito: se cuentan por ciclo. */
const MOTIVOS = {
    OK: 'OK',
    APAGADO_GLOBAL: 'APAGADO_GLOBAL',
    SIN_SEGUIMIENTO: 'SIN_SEGUIMIENTO',
    TAG_EXCLUSION: 'TAG_EXCLUSION',
    PAUSADO: 'PAUSADO',
    COOLDOWN: 'COOLDOWN',
    ACTIVIDAD_RECIENTE: 'ACTIVIDAD_RECIENTE',
    CONTACTO_FRIO: 'CONTACTO_FRIO',
    CONVERTIDO: 'CONVERTIDO',
    COMPRA_POSTERIOR: 'COMPRA_POSTERIOR',
    PAGO_POSTERIOR: 'PAGO_POSTERIOR',
};

const no = (codigo, motivo) => ({ ok: false, codigo, motivo });
const si = (motivo = '') => ({ ok: true, codigo: MOTIVOS.OK, motivo });

/** Cache corto del interruptor global: se consulta una vez por cliente evaluado. */
let cacheGlobal = { valor: null, hasta: 0 };

/** ¿Está prendido el interruptor "Seguimientos" del panel? */
async function seguimientosHabilitados(now = new Date()) {
    if (cacheGlobal.valor !== null && now.getTime() < cacheGlobal.hasta) return cacheGlobal.valor;
    try {
        const fila = await prisma.systemSetting.findUnique({ where: { key: 'followups_enabled' } });
        // Sin la fila, el sistema arranca PRENDIDO: es como venía funcionando y
        // apagarlo por defecto sería un corte silencioso en el primer deploy.
        const valor = fila ? fila.value !== 'false' : true;
        cacheGlobal = { valor, hasta: now.getTime() + 30_000 };
        return valor;
    } catch (e) {
        console.error('[Politica] No se pudo leer followups_enabled:', e.message);
        // Fail-closed: si no se puede saber si está prendido, no se manda nada.
        return false;
    }
}

/** Invalida el cache — lo llama el panel al tocar el interruptor. */
function olvidarInterruptor() {
    cacheGlobal = { valor: null, hasta: 0 };
}

/**
 * ¿Se le puede mandar un seguimiento a este cliente, ahora?
 *
 * @param {Object}  ctx
 * @param {Object}  ctx.client   cliente con `id`, `name`, `status`, `tags[]`
 * @param {Object}  ctx.chat     chat con `id`, `chatLabels[]`, `followUpPausedUntil`,
 *                               `lastFollowUpAt`, `lastMessageAt`
 * @param {Date}    [ctx.now]
 * @param {Date}    [ctx.desde]  fecha de referencia (el presupuesto, la entrega):
 *                               si hay una compra o un pago POSTERIOR, no se sigue.
 * @param {boolean} [ctx.isManual]  disparado a mano por un vendedor: saltea
 *                               cooldown, actividad y contacto frío — quien lo
 *                               pide está mirando la conversación.
 * @param {number}  [ctx.cooldownHoras]   default: config (48)
 * @param {boolean} [ctx.mirarCooldown]   default: true. El re-chequeo del
 *                               último segundo (sender) lo apaga: ese envío ya
 *                               fue aprobado, mirarle el cooldown lo mataría.
 * @param {number}  [ctx.actividadHoras]  default: config (24). El sender usa 2:
 *                               es el re-chequeo del último segundo, no el filtro.
 * @param {boolean} [ctx.exigirEntrante]  cortar contactos fríos (default: true)
 * @param {boolean} [ctx.mirarConvertido] cortar a quien ya compró (default: true).
 *                               La posventa lo apaga: le escribe justamente a
 *                               quien acaba de comprar.
 * @param {string[]} [ctx.tagsExclusion]  default TAGS_SIN_BOT. La posventa pasa
 *                               una lista recortada (para ella "post-venta" y
 *                               "ya es cliente" no son motivo de corte).
 * @param {boolean} [ctx.mirarInterruptorGlobal] default: true
 */
async function evaluarElegibilidad(ctx) {
    const {
        client,
        chat,
        now = new Date(),
        desde = null,
        isManual = false,
        cooldownHoras = COOLDOWN_HOURS,
        mirarCooldown = true,
        actividadHoras = ACTIVITY_WINDOW_HOURS,
        exigirEntrante = true,
        mirarConvertido = true,
        tagsExclusion = TAGS_SIN_BOT,
        mirarInterruptorGlobal = true,
    } = ctx || {};

    if (!client || !chat) return no(MOTIVOS.TAG_EXCLUSION, 'Falta el cliente o el chat');

    const nombre = client.name || chat.profileName || client.id;

    // ── Baratos primero (sin tocar la base) ──────────────────────────────────

    if (mirarInterruptorGlobal && !(await seguimientosHabilitados(now))) {
        return no(MOTIVOS.APAGADO_GLOBAL, 'El interruptor de Seguimientos está apagado');
    }

    const labels = chat.chatLabels || [];

    // El trigger manual respeta SIN_SEGUIMIENTO igual: es una decisión tomada
    // sobre esa conversación, no un accidente.
    if (labels.includes('SIN_SEGUIMIENTO')) {
        return no(MOTIVOS.SIN_SEGUIMIENTO, `${nombre} tiene SIN_SEGUIMIENTO en el chat`);
    }

    const coincide = (texto) => tagsExclusion.some(t => (texto || '').toLowerCase().includes(t));

    if ((client.tags || []).some(tag => coincide(tag.name))) {
        return no(MOTIVOS.TAG_EXCLUSION, `${nombre} tiene una etiqueta que excluye del bot`);
    }
    // OJO: [SISTEMA - BOT APAGADO] NO va en esta lista. Ese label solo dice que
    // el agente dejó de contestar en la charla, que es lo normal apenas la toma
    // una persona — y frenar el seguimiento por eso fue la causa de que durante
    // 20 días no saliera ni uno (308 de 308 presupuestos lo tenían).
    if (labels.some(l => coincide(l))) {
        return no(MOTIVOS.TAG_EXCLUSION, `El chat de ${nombre} tiene una etiqueta que excluye del bot`);
    }

    // Pausa pedida por el propio cliente ("hablamos a fin de mes"). Vale también
    // para el trigger manual: taggear a alguien no debería adelantarle la fecha
    // que él mismo puso.
    if (chat.followUpPausedUntil && new Date(chat.followUpPausedUntil) > now) {
        const hasta = new Date(chat.followUpPausedUntil).toLocaleDateString('es-AR');
        return no(MOTIVOS.PAUSADO, `Seguimientos de ${nombre} pausados hasta ${hasta}`);
    }

    if (!isManual && mirarCooldown && chat.lastFollowUpAt) {
        const horas = (now.getTime() - new Date(chat.lastFollowUpAt).getTime()) / 3600000;
        if (horas < cooldownHoras) {
            return no(MOTIVOS.COOLDOWN, `${nombre} recibió un seguimiento hace ${horas.toFixed(1)}hs (cooldown ${cooldownHoras}hs)`);
        }
    }

    if (!isManual && chat.lastMessageAt) {
        const horas = (now.getTime() - new Date(chat.lastMessageAt).getTime()) / 3600000;
        if (horas < actividadHoras) {
            return no(MOTIVOS.ACTIVIDAD_RECIENTE, `El chat de ${nombre} tuvo actividad hace ${horas.toFixed(1)}hs`);
        }
    }

    // ── Ahora sí, la base ────────────────────────────────────────────────────

    if (mirarConvertido && ESTADOS_CONVERTIDO.includes(client.status)) {
        return no(MOTIVOS.CONVERTIDO, `${nombre} ya compró: queda fuera de lo automático`);
    }

    if (desde) {
        const compra = await prisma.order.findFirst({
            where: {
                clientId: client.id,
                orderType: { in: ['SALE', 'ORDER'] },
                createdAt: { gt: desde },
                isDeleted: false,
            },
            select: { id: true },
        });
        if (compra) return no(MOTIVOS.COMPRA_POSTERIOR, `${nombre} ya compró después de esa fecha`);

        const pago = await prisma.payment.findFirst({
            where: { order: { clientId: client.id }, date: { gt: desde } },
            select: { id: true },
        });
        if (pago) return no(MOTIVOS.PAGO_POSTERIOR, `${nombre} registró un pago después de esa fecha`);
    }

    if (!isManual && exigirEntrante) {
        const entrantes = await prisma.whatsAppMessage.count({
            where: { chatId: chat.id, direction: 'INBOUND' },
        });
        if (entrantes === 0) {
            return no(MOTIVOS.CONTACTO_FRIO, `${nombre} es un contacto frío (nunca escribió)`);
        }
    }

    return si(`${nombre} puede recibir seguimiento`);
}

module.exports = {
    evaluarElegibilidad,
    seguimientosHabilitados,
    olvidarInterruptor,
    MOTIVOS,
    ESTADOS_CONVERTIDO,
};
