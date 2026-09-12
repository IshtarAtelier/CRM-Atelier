import { prisma } from '@/lib/db';

/**
 * El RASTRO del motor: qué corrió y qué mandó. Dos tablas (schema.prisma):
 *
 *  - `SeguimientoEnvio`: una fila por envío automático, reclamada ANTES de
 *    mandar, con clave única (chat + plantilla + día). Si el tick corre dos
 *    veces o lo corren dos instancias, el segundo intento choca con la fila y
 *    no manda: esa es la idempotencia, y no depende de etiquetas ni relojes.
 *  - `SeguimientoCorrida`: una fila por tick con lo que evaluó, mandó, vetó
 *    (y por qué) y falló. Es lo que lee la vista de salud y la alerta diaria.
 *
 * Los "días" acá son días de Córdoba (`diaArt`): el tope diario y la clave
 * única cortan a la medianoche argentina, no a la de Londres.
 */

const HORA_MS = 3_600_000;

/** "YYYY-MM-DD" del día de Córdoba para un instante dado. Argentina no tiene horario de verano: UTC−3 fijo. */
export function diaArt(now: Date | number = Date.now()): string {
    return new Date(new Date(now).getTime() - 3 * HORA_MS).toISOString().slice(0, 10);
}

/** Hora (0-23) de Córdoba. */
export function horaArt(now: Date | number = Date.now()): number {
    return new Date(new Date(now).getTime() - 3 * HORA_MS).getUTCHours();
}

/** Instante UTC en que empezó el día de Córdoba que contiene `now`. */
export function inicioDelDiaArt(now: Date | number = Date.now()): Date {
    return new Date(`${diaArt(now)}T03:00:00.000Z`);
}

export type ResultadoEnvioRegistrado = 'RECLAMADO' | 'ENVIADO' | 'FALLIDO' | 'SALTEADO';

/**
 * Reclama el envío de hoy para este chat + plantilla. Devuelve el id de la
 * fila si lo ganó, o null si ya existía (ya se mandó o se está mandando).
 */
export async function reclamarEnvio(input: { chatId: string; clientId: string | null; plantilla: string; dia: string }): Promise<string | null> {
    try {
        const fila = await prisma.seguimientoEnvio.create({
            data: { chatId: input.chatId, clientId: input.clientId, plantilla: input.plantilla, diaArt: input.dia, resultado: 'RECLAMADO' },
            select: { id: true },
        });
        return fila.id;
    } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
        // Ya hay fila hoy. Si fue un FALLIDO, se vuelve a reclamar (atómico:
        // solo gana quien la pase de FALLIDO a RECLAMADO): un envío que rebotó
        // a las 10 se reintenta a las 11, no mañana. Si está ENVIADO o
        // RECLAMADO por otro, null: no se manda dos veces.
        const retomada = await prisma.seguimientoEnvio.updateMany({
            where: { chatId: input.chatId, plantilla: input.plantilla, diaArt: input.dia, resultado: 'FALLIDO' },
            data: { resultado: 'RECLAMADO', detalle: 'reintento tras una falla anterior hoy' },
        });
        if (retomada.count !== 1) return null;
        const fila = await prisma.seguimientoEnvio.findUnique({
            where: { chatId_plantilla_diaArt: { chatId: input.chatId, plantilla: input.plantilla, diaArt: input.dia } },
            select: { id: true },
        });
        return fila?.id ?? null;
    }
}

export async function cerrarEnvio(id: string, resultado: ResultadoEnvioRegistrado, detalle?: string): Promise<void> {
    await prisma.seguimientoEnvio.update({ where: { id }, data: { resultado, detalle: detalle?.slice(0, 500) } }).catch(err => {
        console.error('[Motor seguimientos] No se pudo cerrar el registro del envío:', err?.message);
    });
}

export interface DatosDeCorrida {
    dia: string;
    hora: number;
    modo: 'real' | 'seco';
    candidatos: number;
    elegidos: number;
    enviados: number;
    fallidos: number;
    enEspera: number;
    cupoDiario: number;
    usadoHoy: number;
    vetados: { motivo: string; cantidad: number; nombres: string[] }[];
    detalle?: unknown;
    error?: string | null;
    duracionMs: number;
}

/** Nunca lanza: un registro que falla no puede tumbar la corrida que registra. */
export async function registrarCorrida(d: DatosDeCorrida): Promise<void> {
    try {
        await prisma.seguimientoCorrida.create({
            data: {
                diaArt: d.dia, horaArt: d.hora, modo: d.modo,
                candidatos: d.candidatos, elegidos: d.elegidos, enviados: d.enviados, fallidos: d.fallidos, enEspera: d.enEspera,
                cupoDiario: d.cupoDiario, usadoHoy: d.usadoHoy,
                vetados: d.vetados as object[],
                detalle: (d.detalle ?? undefined) as object | undefined,
                error: d.error ?? null,
                duracionMs: d.duracionMs,
            },
        });
    } catch (err: any) {
        console.error('[Motor seguimientos] No se pudo registrar la corrida:', err?.message);
    }
}

/** Agrupa los vetos por motivo, con los nombres (recortados) para poder mirar quién quedó afuera y por qué. */
export function agruparVetos(vetados: { nombre: string; motivo: string }[], maxNombres = 60): DatosDeCorrida['vetados'] {
    const porMotivo = new Map<string, string[]>();
    for (const v of vetados) {
        const lista = porMotivo.get(v.motivo) ?? [];
        lista.push(v.nombre);
        porMotivo.set(v.motivo, lista);
    }
    return [...porMotivo.entries()]
        .map(([motivo, nombres]) => ({ motivo, cantidad: nombres.length, nombres: nombres.slice(0, maxNombres) }))
        .sort((a, b) => b.cantidad - a.cantidad);
}
