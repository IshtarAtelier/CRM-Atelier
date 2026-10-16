/**
 * Quién escribió un saliente: una PERSONA del equipo, el bot, el sistema o una
 * campaña. Fuente única de verdad para el wa-service.
 *
 * POR QUÉ importa: al armar el historial para el modelo, TODO saliente se
 * mandaba como `role: 'ai'` — o sea, como palabras del propio bot. Cuando una
 * vendedora atiende el chat a mano, el bot lee lo que ella escribió como si lo
 * hubiera dicho él: da por hecho que ya cotizó, que ya prometió una fecha o que
 * ya pidió la receta, y sigue desde ahí.
 *
 * Y al revés (auditoría del 10/10/2026): la lista de "no humanos" era
 * Bot / Sistema / Auto-respondedor, pero en producción escriben también
 * "Sistema Atelier" (1.121 mensajes en 60 días: confirmaciones de venta,
 * recibos, avisos), "Campaña Novedades Sep26", "Campaña MP 12 Cuotas",
 * "Meta (Auto-Reply)" y "CRM Automático". Para el bot eran PERSONAS:
 * `humanoSeAdelanto` lo apagaba cuando salía una confirmación de venta, la
 * ventana de "volver solo" se corría con cada campaña, y en el historial el
 * modelo leía "[Lo escribió Campaña Novedades Sep26, del equipo]".
 *
 * Se decidió NO agregar una columna `senderKind` en esta pasada: la escriben
 * ~30 lugares en dos despliegues distintos (CRM y wa-service), y si el
 * wa-service sale antes que la migración, cada `create` con el campo nuevo
 * falla y se pierde el mensaje. Las filas viejas igual necesitarían este
 * clasificador por nombre. Queda una sola definición acá, su espejo en
 * `src/lib/whatsapp/remitentes.ts`, y `npm run check:remitentes` que falla si
 * divergen (sin base ni red, también en CI).
 *
 * 'Teléfono' (eco del celular del local), 'Celular' (eco en el transporte
 * legacy), 'Humano (Sincronizado)' y 'CRM' (envío del panel sin firma) SÍ son
 * personas: no están en ninguna lista.
 */

/** Firma del auto-respondedor (mensaje fijo fuera de horario). */
const SENDER_NAME_AUTORESPONDEDOR = 'Auto-respondedor';

/** Tipos de remitente. Mismos valores que en `src/lib/whatsapp/remitentes.ts`. */
const TIPO_REMITENTE = Object.freeze({
    HUMANO: 'HUMAN',
    BOT: 'BOT',
    SISTEMA: 'SYSTEM',
    CAMPANIA: 'CAMPAIGN',
});

/** Firmas del bot y de los respondedores automáticos (los que "hablan" solos). */
const REMITENTES_BOT = Object.freeze(['Bot', SENDER_NAME_AUTORESPONDEDOR, 'Meta (Auto-Reply)']);

/** Firmas de los avisos del sistema (confirmaciones, recibos, avisos internos). */
const REMITENTES_SISTEMA = Object.freeze(['Sistema', 'Sistema Atelier', 'CRM Automático']);

/**
 * Toda campaña firma "Campaña <nombre>" ("Campaña Novedades Sep26",
 * "Campaña MP 12 Cuotas", …). Por prefijo, para que una campaña nueva no haya
 * que acordarse de anotarla.
 */
const PREFIJO_CAMPANIA = 'Campaña ';

/**
 * @param {string|null|undefined} senderName
 * @returns {'HUMAN'|'BOT'|'SYSTEM'|'CAMPAIGN'|null} null = sin firma (no se asume nada)
 */
function tipoDeRemitente(senderName) {
    if (!senderName) return null;
    const n = String(senderName).trim();
    if (REMITENTES_BOT.includes(n)) return TIPO_REMITENTE.BOT;
    if (REMITENTES_SISTEMA.includes(n)) return TIPO_REMITENTE.SISTEMA;
    if (n.startsWith(PREFIJO_CAMPANIA)) return TIPO_REMITENTE.CAMPANIA;
    return TIPO_REMITENTE.HUMANO;
}

/** `true` si el saliente lo escribió una persona del equipo. */
function esRemitenteHumano(senderName) {
    return tipoDeRemitente(senderName) === TIPO_REMITENTE.HUMANO;
}

/** Los nombres exactos que NO son una persona (sin las campañas, que van por prefijo). */
const NOMBRES_NO_HUMANOS = Object.freeze([...REMITENTES_BOT, ...REMITENTES_SISTEMA]);

/** Compatibilidad: algunos módulos lo usaban como Set. */
const REMITENTES_NO_HUMANOS = new Set(NOMBRES_NO_HUMANOS);

/**
 * Filtro de Prisma para "lo escribió una PERSONA" (sobre `senderName`).
 * Antes cada consulta repetía `senderName: { notIn: [...] }` a mano y las
 * campañas, que van por prefijo, se colaban. Usar SIEMPRE este.
 *
 *   prisma.whatsAppMessage.findFirst({ where: { chatId, direction: 'OUTBOUND', ...whereSalienteHumano() } })
 */
function whereSalienteHumano() {
    return { senderName: { notIn: [...NOMBRES_NO_HUMANOS], not: { startsWith: PREFIJO_CAMPANIA } } };
}

module.exports = {
    SENDER_NAME_AUTORESPONDEDOR,
    TIPO_REMITENTE,
    REMITENTES_BOT,
    REMITENTES_SISTEMA,
    PREFIJO_CAMPANIA,
    REMITENTES_NO_HUMANOS,
    NOMBRES_NO_HUMANOS,
    tipoDeRemitente,
    esRemitenteHumano,
    whereSalienteHumano,
};
