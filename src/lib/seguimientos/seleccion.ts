import { evaluar, type Candidato, type EstadoDelChat, type Contexto } from './politica';

/**
 * A QUIÉN LE TOCA en este tick. Función pura sobre datos ya leídos: se prueba
 * sin base y sin red.
 *
 * Los candidatos vienen ya ordenados por urgencia (es `paraHoy` del tablero,
 * que pasa por `ordenarPorUrgencia`): el más atrasado primero. Acá solo se
 * filtra por las compuertas y se corta en el cupo.
 */

export interface Seleccion {
    elegidos: Candidato[];
    vetados: { candidato: Candidato; motivo: string }[];
    /** Los que pasaron las compuertas pero no entraron en el cupo de hoy. */
    enEspera: Candidato[];
}

export function seleccionar(input: {
    candidatos: Candidato[];
    chats: Map<string, EstadoDelChat>;
    ctx: Contexto;
    /** Cuántos pueden salir ahora: min(cupo que queda del día, lote del tick). */
    cupo: number;
}): Seleccion {
    const elegidos: Candidato[] = [];
    const vetados: Seleccion['vetados'] = [];
    const enEspera: Candidato[] = [];

    for (const c of input.candidatos) {
        const chat = c.waChatId ? input.chats.get(c.waChatId) ?? null : null;
        const motivo = evaluar(c, chat, input.ctx);
        if (motivo) { vetados.push({ candidato: c, motivo }); continue; }
        if (elegidos.length < Math.max(0, input.cupo)) elegidos.push(c);
        else enEspera.push(c);
    }

    return { elegidos, vetados, enEspera };
}
