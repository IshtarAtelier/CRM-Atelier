import type { TemplateName } from '@/lib/whatsapp/templates';
import { MOTOR_SEGUIMIENTOS_DESDE, PLANTILLAS_AUTOMATICAS, SILENCIO_MINIMO_HORAS } from '@/lib/constants/seguimientos';

/**
 * LAS COMPUERTAS del motor de seguimientos.
 *
 * Cada regla es una función pura: recibe el candidato y el estado de su chat,
 * y devuelve el MOTIVO del veto o null. La política es la lista `COMPUERTAS`;
 * el motor no sabe qué hay adentro. Agregar o sacar una regla es tocar la
 * lista, nunca el motor.
 *
 * Ante la duda, vetar. Un seguimiento que no sale hoy se recupera mañana (el
 * lead sigue en "para hoy" del tablero, para que lo mande una persona); uno
 * de más no se recupera, y le pega a la calidad del número.
 *
 * Qué decide el playbook y qué decide esto: el playbook dice QUÉ toca (la
 * plantilla, por etapa y plazo). Acá se decide si el sistema PUEDE mandarlo
 * solo. Son preguntas distintas a propósito: el tablero le muestra el mismo
 * "hoy toca X" a una persona, que sí puede decidir mandarlo aunque el motor
 * lo haya vetado.
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
}

export interface Contexto {
    now: number;
}

export type Compuerta = (c: Candidato, chat: EstadoDelChat | null, ctx: Contexto) => string | null;

const HORA_MS = 3_600_000;

/** Nombre de pila para la plantilla; sin él el mensaje diría "Hola Hola,". */
export function nombreDePila(nombre: string | null | undefined): string | null {
    const pila = (nombre || '').trim().split(/\s+/)[0] || '';
    // Un número, un "cliente" genérico o una sola letra no son un nombre.
    if (pila.length < 2 || /\d/.test(pila) || /^(cliente|contacto|sin|s\/n)$/i.test(pila)) return null;
    return pila.charAt(0).toUpperCase() + pila.slice(1).toLowerCase();
}

export const COMPUERTAS: Compuerta[] = [
    // El playbook propone también 'cotizar' y 'decidir': eso es trabajo de una persona.
    (c) => (c.plantilla ? null : 'no hay plantilla que mandar (el paso es de una persona)'),

    (c) => (PLANTILLAS_AUTOMATICAS.includes(c.plantilla!) ? null : `la plantilla ${c.plantilla} no está habilitada para envío automático`),

    // Los viejos se atienden a mano (decisión del 7/9/2026).
    (c) => (c.createdAt.getTime() >= MOTOR_SEGUIMIENTOS_DESDE.getTime() ? null : 'lead anterior al arranque del motor: se le escribe a mano'),

    (c) => (c.waChatId ? null : 'sin chat de WhatsApp donde mandarle'),

    (c) => (nombreDePila(c.nombre) ? null : 'sin nombre de pila para la plantilla'),

    (_c, chat) => (chat ? null : 'el chat no existe en la base'),

    // "Hablamos a fin de mes" y los SKIP de la compuerta de conversación.
    (_c, chat, ctx) => (chat!.followUpPausedUntil && chat!.followUpPausedUntil.getTime() > ctx.now
        ? `seguimientos pausados hasta ${chat!.followUpPausedUntil.toISOString().slice(0, 10)}`
        : null),

    // La charla está viva: la atiende el bot o una persona.
    (_c, chat, ctx) => (chat!.lastInboundAt && ctx.now - chat!.lastInboundAt.getTime() < SILENCIO_MINIMO_HORAS * HORA_MS
        ? `el cliente escribió hace menos de ${SILENCIO_MINIMO_HORAS} h: la charla está viva`
        : null),

    // Contestó después del último toque: le toca a una persona, no a otra plantilla.
    (_c, chat) => (chat!.lastFollowUpAt && chat!.lastInboundAt && chat!.lastInboundAt.getTime() > chat!.lastFollowUpAt.getTime()
        ? 'el cliente respondió al último seguimiento: sigue una persona'
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
