import { prisma } from '../../../lib/db';
import { claveDeModulo } from '../contrato';

/**
 * UNA SOLA PASADA A LA VEZ CONTRA CADA PORTAL.
 *
 * Generaliza el turno de grupo-optico.provider.ts (clave por laboratorio).
 * Por qué existe: el 24/9/2026 dos pasadas completas contra el portal de Grupo
 * Óptico a la misma hora pidieron el PDF de todos los comprobantes a la vez, el
 * portal devolvió PDFs a medias y se escribieron importes disparatados.
 *
 * El turno se reclama con un `updateMany` condicional (atómico en Postgres y
 * válido entre las dos instancias de Railway) y vence solo: si una pasada muere
 * a la mitad, otra lo toma pasado el vencimiento. El valor es "<vence>|<pasada>".
 *
 * Quién espera: la pasada COMPLETA (la diaria) espera si el turno lo tiene un
 * pase RÁPIDO, porque si se salteara ese día no habría pasada completa. Si lo
 * tiene otra completa, no espera: esa ya hace el trabajo.
 */
/** 'robot' es la carga asistida (una persona está esperando): espera a cualquiera. */
export type Pasada = 'completa' | 'rapida' | 'robot';

export interface TurnoGuardado { vence: string; pasada: Pasada }

/** Lee "<vence>|<pasada>". Puro: lo prueba `npm run check:lab-modulos`. */
export function leerTurno(valor: string | null | undefined): TurnoGuardado | null {
    const [vence, pasada] = String(valor || '').split('|');
    if (!vence || Number.isNaN(Date.parse(vence))) return null;
    return { vence, pasada: pasada === 'rapida' ? 'rapida' : pasada === 'robot' ? 'robot' : 'completa' };
}

/** ¿Está tomado a esta hora? Puro. */
export function turnoVigente(valor: string | null | undefined, ahora: Date): Pasada | null {
    const t = leerTurno(valor);
    if (!t || t.vence <= ahora.toISOString()) return null;
    return t.pasada;
}

/**
 * ¿La pasada que pide debe esperar a que se libere el turno? Puro.
 * Una completa espera a una rápida; el robot de la carga asistida (hay una
 * persona esperando en la ficha) espera a cualquiera; todo lo demás se saltea.
 */
export function debeEsperar(quienLoTiene: Pasada | null, quienPide: Pasada): boolean {
    if (!quienLoTiene) return false;
    if (quienPide === 'robot') return true;
    return quienLoTiene === 'rapida' && quienPide === 'completa';
}

export async function tomarTurno(lab: string, pasada: Pasada, duracionMin = 45): Promise<string | null> {
    const clave = claveDeModulo(lab, 'turno');
    const ahora = new Date();
    const hasta = `${new Date(ahora.getTime() + duracionMin * 60000).toISOString()}|${pasada}`;
    await prisma.systemSetting.createMany({
        data: [{ key: clave, value: new Date(0).toISOString() }],
        skipDuplicates: true,
    });
    const tomado = await prisma.systemSetting.updateMany({
        where: { key: clave, value: { lt: ahora.toISOString() } },
        data: { value: hasta },
    });
    return tomado.count === 1 ? hasta : null;
}

export async function quienTieneElTurno(lab: string): Promise<Pasada | null> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: claveDeModulo(lab, 'turno') } });
    return turnoVigente(fila?.value, new Date());
}

export async function esperarTurno(lab: string, pasada: Pasada, maxMs: number, cadaMs = 20_000): Promise<string | null> {
    const limite = Date.now() + maxMs;
    for (;;) {
        const turno = await tomarTurno(lab, pasada);
        if (turno || Date.now() + cadaMs > limite) return turno;
        if (!debeEsperar(await quienTieneElTurno(lab), pasada)) return null;
        await new Promise(r => setTimeout(r, cadaMs));
    }
}

export async function soltarTurno(lab: string, hasta: string): Promise<void> {
    await prisma.systemSetting.updateMany({
        where: { key: claveDeModulo(lab, 'turno'), value: hasta },
        data: { value: new Date(0).toISOString() },
    }).catch(err => console.error(`[lab-modulos] No se pudo soltar el turno de ${lab} (vence solo):`, err));
}

/**
 * Corre `tarea` con el turno del portal tomado, y lo suelta al final pase lo
 * que pase. Sin base para el turno se corre igual: mejor datos que silencio.
 */
export async function conTurno<T>(
    lab: string,
    pasada: Pasada,
    tarea: () => Promise<T>,
    opts: { esperar?: boolean; esperaMaxMs?: number } = {},
): Promise<T | { skipped: true; reason: string }> {
    let turno: string | null;
    try {
        turno = opts.esperar
            ? await esperarTurno(lab, pasada, opts.esperaMaxMs ?? 8 * 60_000)
            : await tomarTurno(lab, pasada);
    } catch (err) {
        console.error(`[lab-modulos] No se pudo tomar el turno de ${lab} (se corre igual):`, err);
        turno = 'sin-turno';
    }
    if (!turno) return { skipped: true, reason: `otra pasada contra el portal de ${lab} está en curso` };
    try {
        return await tarea();
    } finally {
        if (turno !== 'sin-turno') await soltarTurno(lab, turno);
    }
}
