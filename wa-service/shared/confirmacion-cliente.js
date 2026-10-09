/**
 * La respuesta del cliente a la confirmación de su pedido, registrada en la
 * venta en el momento en que llega.
 *
 * Espejo de `src/lib/confirmacion-cliente.ts` (el bot no puede importar .ts):
 * mismas listas, misma lectura. Lo fija `npm run check:confirmacion`.
 *
 * Qué hace: si el cliente tiene una venta reciente (mandada a fábrica hace
 * menos de 7 días) que todavía no tiene respuesta, lo que escribe se toma como
 * su respuesta al repaso: "OK" (o un sí, un 👍) → `clientConfirmation = 'OK'`;
 * cualquier otra cosa → 'OBSERVACION', con el texto, y aviso al equipo en la
 * mensajería interna para que alguien lo lea ANTES de procesar.
 *
 * Nunca lanza: un registro roto no puede frenar el guardado del mensaje.
 */
const { escribirEnCanal } = require('./aviso-respuesta');

const DIAS_PARA_RESPONDER = 7;
const CANAL_CONFIRMACIONES = '📦 Confirmaciones de pedidos';

const OK = [
    /^(ok|oka|okey|okay|okk+)$/,
    /^(si|sii+|sip|see?|dale|listo|perfecto|genial|barbaro|buenisimo|joya|de acuerdo|confirmo|confirmado|correcto|exacto|va|vamos)$/,
    /^(si|ok|dale|listo|perfecto)[,.]? ?(gracias|muchas gracias|genial|perfecto|dale|joya|barbaro|buenisimo|todo bien|esta (todo )?bien|esta perfecto|confirmo)?$/,
    /^(todo|esta todo|esta) (bien|ok|perfecto|correcto)[.!]*$/,
    /^(si|ok|dale)[,.]? ?(esta|es) (todo )?(bien|correcto|perfecto|asi)[.!]*$/,
    /^(muchas )?gracias[.!]*$/,
    /^(es|son) (el|los|la|las) (mio|mios|mia|mias|que elegi|que pedi)[.!]*$/,
    /^[👍👌✅🙌💪❤️🫶🏻🏼🏽🏾🏿\s]+$/,
];

function normalizar(texto) {
    return String(texto).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¡!¿?.,;:"'*_~()\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 'OK' | 'OBSERVACION' */
function leerRespuestaDeConfirmacion(m) {
    const crudo = String(m.content || '').trim();
    if (/^\[reacci[oó]n\]\s*[👍👌✅🙌💪❤️🫶]/iu.test(crudo)) return 'OK';
    if (String(m.type || 'TEXT').toUpperCase() !== 'TEXT' || !crudo) return 'OBSERVACION';
    if (/^[👍👌✅🙌💪❤️🫶\s]+$/u.test(crudo)) return 'OK';
    const t = normalizar(crudo);
    return OK.some(r => r.test(t)) ? 'OK' : 'OBSERVACION';
}

/**
 * Registra la respuesta en la venta que la esperaba. Devuelve la lectura o null si no había nada esperando.
 * @param {{ clientId: string, nombre: string, texto: string, tipo: string }} r
 */
async function registrarRespuestaAConfirmacion(prisma, r) {
    try {
        const desde = new Date(Date.now() - DIAS_PARA_RESPONDER * 86400000);
        const venta = await prisma.order.findFirst({
            where: { clientId: r.clientId, orderType: 'SALE', isDeleted: false, labSentAt: { gte: desde }, clientConfirmation: null },
            orderBy: { labSentAt: 'desc' },
            select: { id: true, labSentAt: true, labStatus: true },
        });
        if (!venta) return null;
        const lectura = leerRespuestaDeConfirmacion({ content: r.texto, type: r.tipo });
        const texto = String(r.tipo || 'TEXT').toUpperCase() === 'TEXT' ? String(r.texto || '').replace(/\s+/g, ' ').trim().slice(0, 300) : `[${String(r.tipo || 'mensaje').toLowerCase()}]`;
        const nro = String(venta.id).slice(-4).toUpperCase();
        await prisma.order.update({ where: { id: venta.id }, data: { clientConfirmation: lectura, clientConfirmedAt: new Date(), clientConfirmationText: texto }, select: { id: true } });
        await prisma.interaction.create({
            data: {
                clientId: r.clientId, type: 'NOTE', userName: 'Sistema',
                content: lectura === 'OK'
                    ? `✅ El cliente confirmó su pedido #${nro} por WhatsApp: «${texto}». Puede procesarse.`
                    : `✋ El cliente respondió a la confirmación del pedido #${nro} con una observación: «${texto}». Leerla antes de procesar.`,
            },
        });
        if (lectura === 'OBSERVACION') {
            const yaProcesado = venta.labStatus && venta.labStatus !== 'NONE' && venta.labStatus !== 'SENT';
            await escribirEnCanal(prisma, {
                subject: CANAL_CONFIRMACIONES,
                cuerpo: `✋ ${r.nombre} respondió a la confirmación de su pedido #${nro} con algo que hay que leer: «${texto}»\n${yaProcesado ? '⚠️ El pedido YA está procesado: ver si hay que frenar al laboratorio.' : 'No procesarlo hasta resolverlo con el cliente.'}\nFicha: /admin/contactos?id=${r.clientId}`,
                urgent: !!yaProcesado,
            });
        }
        return lectura;
    } catch (e) {
        console.error('[Confirmación cliente] No se pudo registrar la respuesta:', e.message);
        return null;
    }
}

module.exports = { leerRespuestaDeConfirmacion, registrarRespuestaAConfirmacion, CANAL_CONFIRMACIONES, DIAS_PARA_RESPONDER };
