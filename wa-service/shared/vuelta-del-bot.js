'use strict';

/**
 * La VUELTA del bot a un chat que tomó una persona: leer, decidir y
 * reactivar, en un solo lugar y sin dependencias del proceso (se le inyecta
 * prisma y la exclusión). Antes vivía dentro de `bot-cloud.js` y solo se
 * podía "probar" con regex sobre el código; ahora `npm run check:vuelta-bot`
 * lo corre de verdad contra una base falsa.
 *
 * Orden (auditoría del 15/10/2026):
 *   1. ¿Lo apagó una PERSONA? (`botOffReason = TOMADO_POR_PERSONA`). Si no, o
 *      no se sabe, no vuelve — sin tocar nada.
 *   2. ¿Hay una consulta esperando, posterior a nuestro último saliente?
 *   3. ¿El chat o la ficha tienen una exclusión ("Ya es cliente", "Cancelar
 *      Bot"…)? Se mira ANTES de cualquier escritura: antes `evaluarVuelta`
 *      prendía el bot y recién después se miraba la exclusión, y el chat
 *      quedaba con `botEnabled=true` aunque no se le contestara.
 *   4. Recién ahí, la reactivación: `updateMany` condicionado a que siga
 *      apagado POR LA MISMA RAZÓN (dos instancias no la ganan las dos).
 */

const { duenioDelChat, decidirVuelta, ANTIGUEDAD_MAXIMA_PARA_VOLVER_H } = require('./duenio-del-chat');
const { entranteDeFila } = require('./clasificar-entrante');
const { ETIQUETA_BOT_APAGADO } = require('./traspaso-humano');
const { MOTIVO_APAGADO, actualizarChat, datosDePrendido, esColumnaAusente, marcarAusentes, columnasDisponibles } = require('./motivo-apagado');

const SELECT_CHAT = { id: true, waId: true, realPhone: true, profileName: true, botEnabled: true, chatLabels: true, clientId: true };

/**
 * @param {object} deps
 * @param {object} deps.prisma
 * @param {(chat, msg) => Promise<boolean>} deps.tieneExclusion
 * @param {(d: Date) => boolean} deps.enHorario
 * @param {() => Date} [deps.reloj]
 * @param {(chatId: string) => void} [deps.broadcastChatUpdate]
 * @param {{ log: Function }} [deps.consola]
 */
function crearVueltaDelBot({ prisma, tieneExclusion, enHorario, reloj = () => new Date(), broadcastChatUpdate = () => {}, consola = console }) {
    /**
     * El chat con su motivo. Si la base no tiene la columna, sin motivo (→ no
     * vuelve solo). `where` es el de un findUnique.
     */
    async function leerChat(where) {
        if (columnasDisponibles()) {
            try {
                return await prisma.whatsAppChat.findUnique({ where, select: { ...SELECT_CHAT, botOffReason: true } });
            } catch (e) {
                if (!esColumnaAusente(e)) throw e;
                marcarAusentes(e);
            }
        }
        const c = await prisma.whatsAppChat.findUnique({ where, select: SELECT_CHAT });
        return c ? { ...c, botOffReason: null } : c;
    }

    /**
     * Los chats que el barrido mira: apagados porque los tomó una persona, con
     * algo entrante en las últimas 24 h. Sin la columna, ninguno.
     */
    async function chatsParaBarrer(take) {
        if (!columnasDisponibles()) return [];
        const desde = new Date(reloj().getTime() - ANTIGUEDAD_MAXIMA_PARA_VOLVER_H * 60 * 60 * 1000);
        try {
            return await prisma.whatsAppChat.findMany({
                where: { botEnabled: false, botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA, lastInboundAt: { gte: desde } },
                select: { ...SELECT_CHAT, botOffReason: true },
                orderBy: { lastInboundAt: 'asc' },
                take,
            });
        } catch (e) {
            if (!esColumnaAusente(e)) throw e;
            marcarAusentes(e);
            return [];
        }
    }

    /**
     * @param {object} chat  con botOffReason (ver leerChat)
     * @param {object} [msgEntrante]  el entrante del webhook, si lo hay (un
     *   mensaje de anuncio pisa la exclusión). Si no, se arma con la fila que espera.
     * @returns {Promise<{ vuelve: boolean, esperando: object|null, decision: object }>}
     */
    async function evaluarVuelta(chat, msgEntrante = null) {
        const quien = chat.profileName || chat.waId;
        const duenio = await duenioDelChat(prisma, chat);
        const esperando = duenio.esperando || null;
        const ahora = reloj();

        // Sin dueño humano o sin nada esperando: se decide sin tocar la base.
        let excluido = false;
        const previa = decidirVuelta({ ...duenio, ahora, enHorario });
        if (previa.accion === 'volver') {
            const msg = msgEntrante || (esperando ? { ...entranteDeFila(esperando), profileName: chat.profileName, from: chat.realPhone } : null);
            excluido = await tieneExclusion(chat, msg);
        }
        const d = excluido ? decidirVuelta({ ...duenio, excluido, ahora, enHorario }) : previa;

        if (d.accion === 'volver') {
            // Se va también la etiqueta: el buzón mostraría BOT APAGADO con el
            // bot encendido.
            const sinEtiqueta = (chat.chatLabels || []).filter(l => l !== ETIQUETA_BOT_APAGADO);
            const r = await actualizarChat(prisma,
                { id: chat.id, botEnabled: false, botOffReason: MOTIVO_APAGADO.TOMADO_POR_PERSONA },
                { ...datosDePrendido(), chatLabels: sinEtiqueta },
            ).catch(e => { consola.error('  ⚠️ [Vuelta] No se pudo reactivar el bot:', e && e.message); return { count: 0 }; });
            if (!r || r.count !== 1) return { vuelve: false, esperando, decision: d }; // lo ganó otro camino u otra instancia
            chat.botEnabled = true;
            chat.botOffReason = null;
            chat.chatLabels = sinEtiqueta;
            consola.log(`  🔄 [BotCloud] El bot vuelve en ${quien}: ${d.motivo} (último del equipo: ${duenio.quien || '—'}).`);
            broadcastChatUpdate(chat.id);
            return { vuelve: true, esperando, decision: d };
        }
        if (d.accion === 'esperar') {
            consola.log(`  ⏳ [BotCloud] ${quien} lo atiende ${duenio.quien || 'una persona'}: ${d.motivo}. Lo retoma el barrido en ~${Math.ceil(d.esperarMs / 60000)} min.`);
        } else {
            consola.log(`  🙋 [BotCloud] ${quien}: el bot no vuelve (${d.motivo}).`);
        }
        return { vuelve: false, esperando, decision: d };
    }

    return { leerChat, chatsParaBarrer, evaluarVuelta };
}

module.exports = { crearVueltaDelBot, SELECT_CHAT };
