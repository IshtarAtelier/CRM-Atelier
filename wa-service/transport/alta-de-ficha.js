/**
 * Alta automática de la ficha del CRM cuando entra un WhatsApp (API oficial).
 *
 * Con WhatsApp Web esto lo hacía el "extractor pasivo" (passive-extractor.js),
 * que además leía la charla con IA. Ese camino NO existe en la API oficial
 * (`cloud.js` no lo carga), y el agujero que dejó no se ve en ningún log: el
 * mensaje entra al buzón, se guarda el chat, y ahí muere. Sin ficha el lead no
 * aparece en el embudo (/admin/leads sale de `Client`), nadie le puede seguir
 * la venta, y se pierde de qué anuncio vino — que es la mitad de la atribución.
 *
 * Esta es la versión sin IA y sin nada que salga hacia el cliente: nombre del
 * perfil de WhatsApp + teléfono, y se da de alta el prospecto. No lee la
 * conversación, no manda mensajes, no etiqueta por intención. Lo que la IA
 * hacía de más (leer el interés, la obra social, la receta) lo sigue haciendo
 * una persona desde el buzón.
 *
 * ── Quién NO es un lead ─────────────────────────────────────────────────────
 * Un proveedor, un laboratorio, otra óptica del canal mayorista o alguien del
 * propio equipo escriben al mismo número que los clientes. Si se les crea
 * ficha, entran al embudo, aparecen en Oportunidades de Cierre y alguien
 * termina persiguiendo a su propio laboratorio para que "termine la compra".
 * A esos chats se les pone la etiqueta NO_CLIENTE (y SIN_SEGUIMIENTO, que es
 * la que ya respetan los seguimientos) y no se les crea ficha nunca.
 *
 * La lista no es una adivinanza: sale de datos que ya están en la base
 * (`OpticaLead` = ópticas del canal mayorista, `User.whatsappPhone` = el
 * equipo) más los números propios del negocio. Para todo lo demás está la
 * etiqueta manual: alcanza con ponerle "Proveedor" o "No Cliente" a la ficha
 * y queda afuera del embudo y de los seguimientos (src/lib/no-cliente.ts).
 */

const { prisma } = require('../db');
const { esNombreValido } = require('../shared/nombre-de-persona');
const { convertIntoLead } = require('../tools');

/** Etiqueta de chat que marca "acá no hay una venta que perseguir". */
const ETIQUETA_NO_CLIENTE = 'NO_CLIENTE';
/** La etiqueta que ya cortaba los seguimientos en el motor viejo. Se pone junto. */
const ETIQUETA_SIN_SEGUIMIENTO = 'SIN_SEGUIMIENTO';

/**
 * Números propios del negocio: la línea de la tienda y la del canal mayorista.
 * Se escriben entre ellas (pruebas, avisos internos) y no son leads de nadie.
 */
const NUMEROS_PROPIOS = [
    '5493518685644', // tienda / atención al público
    '5493541215971', // mayorista y administración
    process.env.ADMIN_WHATSAPP_PHONE,
].filter(Boolean);

/** Los últimos 8 dígitos son lo único que no cambia entre formatos (0, 15, +54). */
function cola(telefono) {
    const d = String(telefono || '').replace(/\D/g, '');
    return d.length >= 8 ? d.slice(-8) : null;
}

/**
 * Si este teléfono es de alguien que no va a comprar, devuelve el motivo en
 * criollo (va al log y a la etiqueta). Si puede ser un cliente, devuelve null.
 */
async function motivoNoCliente(waId) {
    const tail = cola(waId);
    if (!tail) return null;

    if (NUMEROS_PROPIOS.some(n => cola(n) === tail)) return 'número propio del negocio';

    // Otra óptica: es un prospecto del canal MAYORISTA, que tiene su propio
    // circuito (OpticaLead). En el embudo minorista no pinta nada.
    const opticas = await prisma.$queryRaw`
        SELECT name FROM "OpticaLead"
        WHERE REGEXP_REPLACE(COALESCE("phoneWa", ''), '\\D', '', 'g') LIKE ${'%' + tail}
           OR REGEXP_REPLACE(COALESCE("phone", ''), '\\D', '', 'g') LIKE ${'%' + tail}
        LIMIT 1
    `.catch(() => []);
    if (opticas.length) return `óptica del canal mayorista (${opticas[0].name})`;

    // Alguien del equipo escribiendo desde su celular.
    const equipo = await prisma.$queryRaw`
        SELECT name FROM "User"
        WHERE REGEXP_REPLACE(COALESCE("whatsappPhone", ''), '\\D', '', 'g') LIKE ${'%' + tail}
        LIMIT 1
    `.catch(() => []);
    if (equipo.length) return `del equipo (${equipo[0].name})`;

    return null;
}

/** Suma etiquetas al chat sin repetir. Devuelve el chat actualizado. */
async function etiquetar(chat, etiquetas) {
    const actuales = chat.chatLabels || [];
    const nuevas = etiquetas.filter(e => !actuales.includes(e));
    if (!nuevas.length) return chat;
    return prisma.whatsAppChat.update({
        where: { id: chat.id },
        data: { chatLabels: [...actuales, ...nuevas] },
    });
}

/**
 * Da de alta la ficha del CRM si corresponde. Nunca lanza: un entrante se
 * guarda igual aunque esto falle.
 *
 * @param {object} chat  fila de WhatsAppChat ya persistida
 * @param {string} waId  teléfono E.164 sin '+'
 * @param {string|null} profileName nombre del perfil de WhatsApp que manda Meta
 * @returns {Promise<object>} el chat (actualizado si se creó la ficha)
 */
async function asegurarFichaDeLead(chat, waId, profileName) {
    try {
        if (!chat || chat.clientId) return chat;
        if ((chat.chatLabels || []).includes(ETIQUETA_NO_CLIENTE)) return chat;

        const motivo = await motivoNoCliente(waId);
        if (motivo) {
            console.log(`  🚫 [Ficha] ${waId} no es un cliente: ${motivo}. No se crea ficha.`);
            return etiquetar(chat, [ETIQUETA_NO_CLIENTE, ETIQUETA_SIN_SEGUIMIENTO]);
        }

        const nombre = esNombreValido(profileName) ? profileName.trim()
            : (esNombreValido(chat.profileName) ? chat.profileName.trim() : null);
        if (!nombre) {
            // Sin un nombre real no se crea: una ficha "Hola" o "+54 9 351..."
            // ensucia el CRM y después nadie la limpia. La crea una persona
            // desde el buzón cuando sepa con quién habla.
            console.log(`  👤 [Ficha] ${waId} sin nombre de perfil utilizable: queda para carga manual.`);
            return chat;
        }

        // contactSource null a propósito: convertIntoLead lo resuelve leyendo el
        // texto del primer mensaje (plantillas [meta...], "vi su anuncio", etc.).
        const alta = await convertIntoLead({
            phone: waId,
            name: nombre,
            contactSource: null,
            interest: null,
            chatId: chat.id,
        });

        if (!alta || !alta.success || !alta.contact) {
            console.warn(`  ⚠️ [Ficha] No se pudo crear la ficha de ${nombre} (${waId}): ${alta && alta.error}`);
            return chat;
        }

        const clientId = alta.contact.id;
        console.log(`  ✅ [Ficha] Alta automática: ${nombre} (${waId}) → ${clientId}`);

        // La etiqueta del anuncio ya se guardó en el chat unos renglones antes;
        // la ficha nace después, así que hay que pasársela acá o la atribución
        // se queda a mitad de camino.
        if (chat.adTag) {
            await prisma.client.updateMany({
                where: { id: clientId, adTag: null },
                data: { adTag: chat.adTag },
            }).catch(() => {});
        }

        if (global.io) {
            global.io.emit('lead_created', {
                id: clientId,
                name: nombre,
                phone: waId,
                interest: 'No especificado',
                source: alta.contact.contactSource || 'WhatsApp',
            });
        }

        // Devolver el chat recargado (ya con clientId) para que el emit del
        // buzón y lo que siga trabajen sobre el estado real. Si por lo que sea
        // no vuelve, se sigue con el que teníamos: nunca null.
        return (await prisma.whatsAppChat.findUnique({ where: { id: chat.id } })) || chat;
    } catch (e) {
        console.error('[Ficha] Error en el alta automática (el mensaje se guardó igual):', e.message);
        return chat;
    }
}

module.exports = { asegurarFichaDeLead, motivoNoCliente, ETIQUETA_NO_CLIENTE, ETIQUETA_SIN_SEGUIMIENTO };
