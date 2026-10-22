/**
 * Quién escribió un saliente de WhatsApp: una PERSONA del equipo, el bot, el
 * sistema o una campaña.
 *
 * Espejo de `wa-service/shared/remitentes.js` (el wa-service se despliega
 * aparte y no puede importar de `src/`). `npm run check:remitentes` falla si
 * las dos copias dicen cosas distintas — sin base ni red, también en CI.
 *
 * Por qué existe (auditoría del 10/10/2026): había cuatro listas a mano de
 * "remitentes automáticos" (`cierres.ts`, `campania-reflotar`, `embudo.service`
 * y la del bot) y ninguna coincidía. Las campañas ("Campaña Novedades Sep26",
 * 122 mensajes en 60 días) no estaban en ninguna: para el tablero contaban
 * como "una persona le escribió" y para el bot como una vendedora que tomó el
 * chat. Ahora: una lista, y las campañas por prefijo.
 *
 * Se decidió no agregar una columna `senderKind` todavía: ver el comentario
 * del espejo para el porqué (dos despliegues, ~30 escritores, filas viejas).
 */

export const TIPO_REMITENTE = {
    HUMANO: 'HUMAN',
    BOT: 'BOT',
    SISTEMA: 'SYSTEM',
    CAMPANIA: 'CAMPAIGN',
} as const;

export type TipoRemitente = (typeof TIPO_REMITENTE)[keyof typeof TIPO_REMITENTE];

/** Firmas del bot y de los respondedores automáticos. */
export const REMITENTES_BOT = ['Bot', 'Auto-respondedor', 'Meta (Auto-Reply)'] as const;

/** Firmas de los avisos del sistema (confirmaciones, recibos, avisos internos). */
export const REMITENTES_SISTEMA = ['Sistema', 'Sistema Atelier', 'CRM Automático'] as const;

/** Toda campaña firma "Campaña <nombre>". */
export const PREFIJO_CAMPANIA = 'Campaña ';

/** Los nombres exactos que NO son una persona (las campañas van por prefijo). */
export const NOMBRES_NO_HUMANOS: readonly string[] = [...REMITENTES_BOT, ...REMITENTES_SISTEMA];

export function tipoDeRemitente(senderName: string | null | undefined): TipoRemitente | null {
    if (!senderName) return null;
    const n = String(senderName).trim();
    if ((REMITENTES_BOT as readonly string[]).includes(n)) return TIPO_REMITENTE.BOT;
    if ((REMITENTES_SISTEMA as readonly string[]).includes(n)) return TIPO_REMITENTE.SISTEMA;
    if (n.startsWith(PREFIJO_CAMPANIA)) return TIPO_REMITENTE.CAMPANIA;
    return TIPO_REMITENTE.HUMANO;
}

export function esRemitenteHumano(senderName: string | null | undefined): boolean {
    return tipoDeRemitente(senderName) === TIPO_REMITENTE.HUMANO;
}

/**
 * Filtro de Prisma (sobre `WhatsAppMessage.senderName`) para "lo escribió una
 * PERSONA". Usarlo en vez de un `notIn` a mano.
 */
export function whereSalienteHumano() {
    return {
        senderName: { notIn: [...NOMBRES_NO_HUMANOS], not: { startsWith: PREFIJO_CAMPANIA } },
    };
}
