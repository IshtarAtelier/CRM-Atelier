/**
 * Segunda oportunidad para la extracción pasiva que se perdió.
 *
 * EL PROBLEMA QUE RESUELVE
 * `handleMessage` programa la extracción con un `setTimeout` de 20 s guardado
 * en un Map en memoria (`index.js`, `passiveDebounceTimers`). Si el proceso
 * reinicia antes de que dispare —y este servicio corre sobre Puppeteer, que
 * reinicia seguido— el temporizador se evapora: no hay error, no hay reintento,
 * no queda rastro. El chat se queda sin ficha para siempre.
 *
 * Medido en producción (agosto 2026): ~40% de los chats que cumplían la regla
 * del extractor (nombre válido + teléfono válido) nunca recibieron ficha. Unas
 * 180 por mes, sostenido junio y julio. Sin ficha no hay a quién buscarle
 * órdenes, así que esas ventas son invisibles para medir retorno publicitario.
 *
 * POR QUÉ UN BARRIDO Y NO ARREGLAR EL TEMPORIZADOR
 * Persistir los timers obligaría a tocar el camino caliente de cada mensaje
 * entrante, que es donde vive el turno del bot. Un barrido aparte es aditivo:
 * si falla, falla solo. El costo es latencia (una ficha puede tardar hasta un
 * ciclo en crearse) y eso no le molesta a nadie.
 *
 * CÓMO NO SE DESCONTROLA
 * - Solo mira chats cuyo `profileName` y `realPhone` YA pasan la regla, con una
 *   verificación barata y sin gastar una llamada al modelo. Los que no la pasan
 *   (sin nombre usable) no se reintentan nunca: se descartarían igual.
 * - Ignora los chats con actividad en los últimos 5 minutos, para no pisarse
 *   con el debounce en vivo.
 * - Tanda acotada por ciclo. Apenas la ficha se crea el chat deja de aparecer
 *   en la consulta, así que la cola se vacía sola.
 */
const { prisma } = require('../db');
const { isPhrase } = require('../tools');

/** Cuántos chats se reprocesan por ciclo. Acotado para no inundar el modelo. */
const TANDA = 15;
/** No tocar chats con actividad reciente: el debounce en vivo todavía tiene su turno. */
const MINUTOS_DE_GRACIA = 5;
/**
 * Hasta dónde mirar hacia atrás. Pedido del dueño (4/8/2026): solo el fin de
 * semana + hoy — 3 días. Con 7 días, la primera corrida tras un arreglo creó
 * ~95 fichas de golpe y el contador de "nuevos contactos hoy" quedó
 * irreconocible. Lo anterior a la ventana lo levanta, si hace falta, el script
 * de mantenimiento a mano. Ajustable por env sin tocar código.
 */
const DIAS = Number(process.env.EXTRACCION_PENDIENTE_DIAS) || 3;

/**
 * Espejo de `telefonoValido` de passive-extractor.js, para el caso con
 * `realPhone`. Va acá para que un teléfono basura (dos dígitos, por ejemplo) no
 * quede reintentándose cada diez minutos para siempre: el extractor lo
 * rechazaría igual y el chat volvería a aparecer en la consulta.
 */
function telefonoUsable(realPhone) {
    const d = String(realPhone || '').replace(/\D/g, '');
    return d.length >= 8 && d.length <= 15;
}

/** Espejo de `esNombreValido` de passive-extractor.js. Si cambia allá, cambia acá. */
function esNombreValido(nombre) {
    if (!nombre || typeof nombre !== 'string') return false;
    const limpio = nombre.trim();
    if (limpio.length < 2) return false;
    if ((limpio.match(/\d/g) || []).length >= 5) return false;
    const generico = limpio.toLowerCase();
    if (['contacto nuevo wa', 'contacto nuevo', 'cliente', 'desconocido', '-', 'sin nombre'].includes(generico)) return false;
    try {
        if (isPhrase(limpio)) return false;
    } catch {
        /* ante la duda, dejamos que el extractor decida */
    }
    return true;
}

/**
 * @param {(chatId: string, waId: string, profileName: string) => Promise<any>} processPassiveExtraction
 */
async function recuperarExtraccionesPendientes(processPassiveExtraction) {
    const ahora = Date.now();
    const candidatos = await prisma.whatsAppChat.findMany({
        where: {
            clientId: null,
            realPhone: { not: null },
            profileName: { not: null },
            createdAt: { gte: new Date(ahora - DIAS * 864e5) },
            lastMessageAt: { lt: new Date(ahora - MINUTOS_DE_GRACIA * 60 * 1000) },
        },
        select: { id: true, waId: true, profileName: true, realPhone: true },
        orderBy: { lastMessageAt: 'desc' },
        take: TANDA * 4, // se filtra abajo, así que se pide de más
    });

    const pendientes = candidatos
        .filter((c) => esNombreValido(c.profileName) && telefonoUsable(c.realPhone))
        .slice(0, TANDA);
    if (!pendientes.length) return;

    console.log(`  🔁 [Extracción pendiente] ${pendientes.length} chat(s) sin ficha que sí cumplen la regla. Reintentando...`);

    for (const chat of pendientes) {
        try {
            await processPassiveExtraction(chat.id, chat.waId, chat.profileName);
        } catch (e) {
            // Nunca propaga: es una red de seguridad, no puede tumbar el ciclo.
            console.error(`  ❌ [Extracción pendiente] ${chat.profileName}: ${e.message}`);
        }
    }
}

module.exports = { recuperarExtraccionesPendientes };
