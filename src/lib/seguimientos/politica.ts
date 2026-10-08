import type { TemplateName } from '@/lib/whatsapp/templates';
import { MOTOR_SEGUIMIENTOS_DESDE, PLANTILLAS_AUTOMATICAS, SILENCIO_MINIMO_HORAS } from '@/lib/constants/seguimientos';
import { esNombreDePersona } from '@/lib/nombre-de-persona';
import type { Clasificacion } from '@/lib/embudo/respuesta';

/**
 * LAS COMPUERTAS del motor de seguimientos.
 *
 * Cada regla es una función pura: recibe el candidato y el estado de su chat,
 * y devuelve el MOTIVO del veto o null. La política es la lista `COMPUERTAS`;
 * el motor no sabe qué hay adentro. Agregar o sacar una regla es tocar la
 * lista, nunca el motor.
 *
 * Ante la duda, vetar. Un seguimiento que no sale hoy se recupera mañana (el
 * lead sigue en "para hoy" y el motor lo vuelve a evaluar en el próximo tick);
 * uno de más no se recupera, y le pega a la calidad del número.
 *
 * Qué decide el playbook y qué decide esto: el playbook dice QUÉ toca (la
 * plantilla, por etapa y plazo). Acá se decide si el sistema PUEDE mandarlo
 * HOY. Lo que se veta no va a una persona (8/10/2026: "en embudo no debe
 * haber nada para humano"): o se destraba solo con el tiempo (48 h, pausa),
 * o lo cierra el motor (`cierre.ts`), o lo apagó alguien a mano a propósito.
 */

export interface Candidato {
    leadId: string;
    nombre: string;
    createdAt: Date;
    waChatId: string | null;
    plantilla: TemplateName | undefined;
}

export interface EstadoDelChat {
    lastInboundAt: Date | null;
    lastFollowUpAt: Date | null;
    followUpPausedUntil: Date | null;
    /** Último mensaje SALIENTE del chat, de quien sea (persona, sistema o el motor). */
    lastOutboundAt: Date | null;
    /** Etiquetas del chat (`SIN_SEGUIMIENTO` = lo apagaron desde el buzón). */
    chatLabels?: string[];
    /** Etiquetas de la ficha ("Sin Seguimiento", "no interesado" = lo apagaron desde la ficha). */
    tagNames?: string[];
    /**
     * Qué dijo el cliente después del último seguimiento (`lib/embudo/respuesta.ts`),
     * o null si no contestó. `cierre` y `posponer` los ejecuta el motor antes
     * de seleccionar; acá solo se veta este tick con el motivo a la vista.
     */
    respuesta?: Clasificacion | null;
}

/** Etiquetas de ficha que apagan el seguimiento automático de esa persona. */
export const TAGS_QUE_APAGAN_EL_SEGUIMIENTO = ['sin seguimiento', 'no interesado'] as const;
export const LABEL_SIN_SEGUIMIENTO = 'SIN_SEGUIMIENTO';

/** true si alguien apagó el seguimiento de esta persona, desde el chat o desde la ficha. */
export function seguimientoApagado(chat: Pick<EstadoDelChat, 'chatLabels' | 'tagNames'> | null | undefined): string | null {
    if (!chat) return null;
    if ((chat.chatLabels || []).includes(LABEL_SIN_SEGUIMIENTO)) return 'seguimiento apagado desde el chat (Sin seguimiento)';
    const tag = (chat.tagNames || []).find(t => TAGS_QUE_APAGAN_EL_SEGUIMIENTO.some(x => t.toLowerCase().includes(x)));
    return tag ? `seguimiento apagado desde la ficha (etiqueta "${tag}")` : null;
}

export interface Contexto {
    now: number;
}

export type Compuerta = (c: Candidato, chat: EstadoDelChat | null, ctx: Contexto) => string | null;

const HORA_MS = 3_600_000;

/** Nombre de pila para la plantilla; sin él el mensaje diría "Hola Hola,". */
export function nombreDePila(nombre: string | null | undefined): string | null {
    const pila = (nombre || '').trim().split(/\s+/)[0] || '';
    // Un número, un "cliente" genérico, una sola letra o puros emojis no son un nombre.
    if (/\d/.test(pila) || !esNombreDePersona(pila)) return null;
    // "El Flaco" es un apodo válido de ficha, pero "Hola El, buen día!" no se puede mandar.
    if (/^(el|la|los|las|de|del|un|una|mi|don|doña|sr|sra)$/i.test(pila)) return null;
    return pila.charAt(0).toUpperCase() + pila.slice(1).toLowerCase();
}

export const COMPUERTAS: Compuerta[] = [
    // Sin plantilla no hay nada que mandar ('cerrar' lo ejecuta el motor por otro camino; 'cotizar' solo informa).
    (c) => (c.plantilla ? null : 'no hay plantilla que mandar'),

    (c) => (PLANTILLAS_AUTOMATICAS.includes(c.plantilla!) ? null : `la plantilla ${c.plantilla} no está habilitada para envío automático`),

    // Los viejos se atienden a mano (decisión del 7/9/2026).
    (c) => (!MOTOR_SEGUIMIENTOS_DESDE || c.createdAt.getTime() >= MOTOR_SEGUIMIENTOS_DESDE.getTime() ? null : 'lead anterior al arranque del motor: se le escribe a mano'),

    (c) => (c.waChatId ? null : 'sin chat de WhatsApp donde mandarle'),

    (c) => (nombreDePila(c.nombre) ? null : 'sin nombre de pila para la plantilla'),

    (_c, chat) => (chat ? null : 'el chat no existe en la base'),

    // Lo apagaron a mano: desde el buzón ("Sin seguimiento" en la cabecera del
    // chat) o desde la ficha (etiqueta). Es EL interruptor por persona: el
    // motor es 100 % automático salvo para quien lo tenga apagado
    // (decisión de Ishtar, 11/9/2026).
    (_c, chat) => seguimientoApagado(chat),

    // "Hablamos a fin de mes" y los SKIP de la compuerta de conversación.
    (_c, chat, ctx) => (chat!.followUpPausedUntil && chat!.followUpPausedUntil.getTime() > ctx.now
        ? `seguimientos pausados hasta ${chat!.followUpPausedUntil.toISOString().slice(0, 10)}`
        : null),

    // Ya se le mandó un seguimiento hace poco. Es la red contra el doble envío
    // que no depende de las etiquetas: si el registro de un envío falla, la
    // etiqueta del escalón no se escribe y el tablero sigue diciendo "toca" —
    // sin esta compuerta, el tick siguiente se lo volvía a mandar.
    (_c, chat, ctx) => (chat!.lastFollowUpAt && ctx.now - chat!.lastFollowUpAt.getTime() < SILENCIO_MINIMO_HORAS * HORA_MS
        ? `ya se le mandó un seguimiento hace menos de ${SILENCIO_MINIMO_HORAS} h`
        : null),

    // Alguien le escribió hace poco (una persona desde el celular o el buzón, o
    // el propio motor). El clasificador del tablero deja que el escalón
    // siguiente venza aunque una persona haya escrito ayer — para el tablero
    // está bien, lo decide un humano; para un envío AUTOMÁTICO sería una
    // plantilla encima de una charla que acaba de tener un vendedor.
    (_c, chat, ctx) => (chat!.lastOutboundAt && ctx.now - chat!.lastOutboundAt.getTime() < SILENCIO_MINIMO_HORAS * HORA_MS
        ? `le escribieron hace menos de ${SILENCIO_MINIMO_HORAS} h`
        : null),

    // La charla está viva: la atiende el bot o una persona.
    (_c, chat, ctx) => (chat!.lastInboundAt && ctx.now - chat!.lastInboundAt.getTime() < SILENCIO_MINIMO_HORAS * HORA_MS
        ? `el cliente escribió hace menos de ${SILENCIO_MINIMO_HORAS} h: la charla está viva`
        : null),

    // Contestó después del último toque. Hasta el 8/10/2026 esto frenaba al
    // motor para siempre ("sigue una persona") y nadie seguía: 142 de 501
    // oportunidades de septiembre quedaron ahí, casi todas por un 👍 o un
    // "gracias". Ahora la respuesta se LEE (`lib/embudo/respuesta.ts`): si dijo
    // que no, se cierra como perdido; si pidió más adelante, se pausa; si fue
    // una reacción, un "ok" o una pregunta (que ya contestó el bot), la
    // cadencia sigue cuando pasan las 48 h de silencio de arriba.
    (_c, chat) => (chat!.respuesta === 'cierre' ? 'el cliente dijo que no: se cierra como perdido'
        : chat!.respuesta === 'posponer' ? 'el cliente pidió más adelante: se pausa'
            : null),
];

/** El primer veto que aplica, o null si el sistema puede mandarlo solo. */
export function evaluar(c: Candidato, chat: EstadoDelChat | null, ctx: Contexto): string | null {
    for (const compuerta of COMPUERTAS) {
        const veto = compuerta(c, chat, ctx);
        if (veto) return veto;
    }
    return null;
}
