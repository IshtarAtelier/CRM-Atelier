/**
 * LA RESPUESTA DEL CLIENTE A LA CONFIRMACIÓN DE SU PEDIDO.
 *
 * El repaso de compra (`sale-confirmation.ts`) le pide al cliente que revise
 * cada dato y responda OK; si en 24 h no contesta, lo damos por confirmado y
 * la fabricación sigue bajo su responsabilidad (Ishtar, 8/10/2026). Lo que
 * contestó queda en la venta (`Order.clientConfirmation`) y Milena lo ve en
 * Ventas antes de tocar "Procesar": "respondió OK", "todavía no respondió",
 * "24 h sin respuesta" o "respondió con una observación" (esa hay que leerla).
 *
 * Puro: lo mismo que `wa-service/shared/confirmacion-cliente.js` (el bot no
 * puede importar .ts). Si se toca una lista, se toca la otra; lo fija
 * `npm run check:confirmacion`.
 */

export type ConfirmacionCliente = 'OK' | 'TACITA' | 'OBSERVACION';

/** Cuánto se espera la respuesta antes de darla por tácita. Es lo que dice el mensaje. */
export const HORAS_PARA_CONFIRMACION_TACITA = 24;

/** Después de esto, una respuesta ya no es "a la confirmación": es otra charla. */
export const DIAS_PARA_RESPONDER = 7;

/** Lo que cuenta como "sí": el OK que pide el mensaje y sus variantes. Comparado sin tildes ni signos. */
const OK: RegExp[] = [
    /^(ok|oka|okey|okay|okk+)$/,
    /^(si|sii+|sip|see?|dale|listo|perfecto|genial|barbaro|buenisimo|joya|de acuerdo|confirmo|confirmado|correcto|exacto|va|vamos)$/,
    /^(si|ok|dale|listo|perfecto)[,.]? ?(gracias|muchas gracias|genial|perfecto|dale|joya|barbaro|buenisimo|todo bien|esta (todo )?bien|esta perfecto|confirmo)?$/,
    /^(todo|esta todo|esta) (bien|ok|perfecto|correcto)[.!]*$/,
    /^(si|ok|dale)[,.]? ?(esta|es) (todo )?(bien|correcto|perfecto|asi)[.!]*$/,
    /^(muchas )?gracias[.!]*$/,
    /^(es|son) (el|los|la|las) (mio|mios|mia|mias|que elegi|que pedi)[.!]*$/,
    /^[👍👌✅🙌💪❤️🫶🏻🏼🏽🏾🏿\s]+$/,
];

function normalizar(texto: string): string {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¡!¿?.,;:"'*_~()\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 'OK' si dijo que sí sin agregar nada; 'OBSERVACION' si dijo cualquier otra cosa (una persona lo lee). */
export function leerRespuestaDeConfirmacion(m: { content: string | null; type?: string | null }): ConfirmacionCliente {
    const crudo = (m.content || '').trim();
    if (/^\[reacci[oó]n\]\s*[👍👌✅🙌💪❤️🫶]/iu.test(crudo)) return 'OK';
    if ((m.type || 'TEXT').toUpperCase() !== 'TEXT' || !crudo) return 'OBSERVACION';
    if (/^[👍👌✅🙌💪❤️🫶\s]+$/u.test(crudo)) return 'OK';
    const t = normalizar(crudo);
    return OK.some(r => r.test(t)) ? 'OK' : 'OBSERVACION';
}

export interface EstadoConfirmacion {
    estado: ConfirmacionCliente | 'ESPERANDO' | 'SIN_CONFIRMACION';
    /** Para la tarjeta de Ventas, en criollo. */
    texto: string;
    /** Para colorear: verde (OK), ámbar (esperando), gris (tácita), rojo (observación). */
    tono: 'verde' | 'ambar' | 'gris' | 'rojo';
}

/** Lo que Milena ve antes de procesar. `labSentAt` = cuándo se mandó la confirmación. */
export function estadoConfirmacionCliente(o: { clientConfirmation?: string | null; clientConfirmedAt?: Date | string | null; clientConfirmationText?: string | null; labSentAt?: Date | string | null }, now = Date.now()): EstadoConfirmacion {
    const hace = (d: Date | string | null | undefined) => {
        if (!d) return '';
        const ms = now - new Date(d).getTime();
        const h = Math.floor(ms / 3_600_000);
        if (h < 1) return 'hace minutos';
        if (h < 48) return `hace ${h} h`;
        return `hace ${Math.floor(h / 24)} días`;
    };
    if (o.clientConfirmation === 'OK') return { estado: 'OK', tono: 'verde', texto: `El cliente respondió OK ${hace(o.clientConfirmedAt)}${o.clientConfirmationText ? `: «${o.clientConfirmationText.slice(0, 60)}»` : ''}` };
    if (o.clientConfirmation === 'TACITA') return { estado: 'TACITA', tono: 'gris', texto: `${HORAS_PARA_CONFIRMACION_TACITA} h sin respuesta: confirmado tácito (bajo su responsabilidad)` };
    if (o.clientConfirmation === 'OBSERVACION') return { estado: 'OBSERVACION', tono: 'rojo', texto: `Respondió con una observación ${hace(o.clientConfirmedAt)}: «${(o.clientConfirmationText || '').slice(0, 120)}» — leerla antes de procesar` };
    if (!o.labSentAt) return { estado: 'SIN_CONFIRMACION', tono: 'gris', texto: 'Todavía no se le mandó la confirmación' };
    return { estado: 'ESPERANDO', tono: 'ambar', texto: `Esperando el OK del cliente (confirmación enviada ${hace(o.labSentAt)})` };
}
