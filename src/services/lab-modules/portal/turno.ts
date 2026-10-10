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
        const dueno = await quienTieneElTurno(lab);
        // Sin dueño = se soltó entre que falló tomarlo y acá: se vuelve a intentar
        // enseguida, no es "ocupado" (auditoría 4, M6).
        if (dueno && !debeEsperar(dueno, pasada)) return null;
        await new Promise(r => setTimeout(r, dueno ? cadaMs : 1_000));
    }
}

/**
 * Renueva el turno mientras la tarea sigue viva: solo si la fila todavía dice
 * ESTE turno (si venció y otro lo tomó, no se le roba). Devuelve el turno nuevo
 * o null. Sin esto, un robot más lento que los 45 min (login de hasta 15 min
 * por intento en un portal pésimo) perdía el turno con el navegador abierto y
 * otro entraba a crear al mismo tiempo (auditoría de robustez 3, A1).
 */
export async function renovarTurno(lab: string, hasta: string, duracionMin = 45): Promise<string | null> {
    const pasada = leerTurno(hasta)?.pasada;
    if (!pasada) return null;
    const nuevo = `${new Date(Date.now() + duracionMin * 60000).toISOString()}|${pasada}`;
    const r = await prisma.systemSetting.updateMany({ where: { key: claveDeModulo(lab, 'turno'), value: hasta }, data: { value: nuevo } });
    return r.count === 1 ? nuevo : null;
}
/** Cada cuánto se renueva el turno mientras la tarea corre (mucho antes de los 45 min). */
export const RENOVAR_TURNO_CADA_MS = 10 * 60_000;

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
    opts: { esperar?: boolean; esperaMaxMs?: number; obligatorio?: boolean } = {},
): Promise<T | { skipped: true; reason: string }> {
    let turno: string | null;
    try {
        turno = opts.esperar
            ? await esperarTurno(lab, pasada, opts.esperaMaxMs ?? 8 * 60_000)
            : await tomarTurno(lab, pasada);
    } catch (err) {
        // Lo que crea cosas en un portal (la carga de un pedido) NO corre sin
        // turno: dos cargas a la vez son dos pedidos. Leer, sí: mejor datos que silencio.
        if (opts.obligatorio) throw new Error(`No se pudo tomar el turno del portal de ${lab} (¿base caída?): no se carga nada sin turno. Reintentá en un rato.`);
        console.error(`[lab-modulos] No se pudo tomar el turno de ${lab} (se corre igual):`, err);
        turno = 'sin-turno';
    }
    if (!turno) return { skipped: true, reason: `otra pasada contra el portal de ${lab} está en curso` };
    // Mientras la tarea corre, el turno se renueva solo: una tarea viva nunca lo pierde.
    const renovacion = turno === 'sin-turno' ? null : setInterval(() => {
        renovarTurno(lab, turno!).then(nuevo => { if (nuevo) turno = nuevo; })
            .catch(err => console.error(`[lab-modulos] No se pudo renovar el turno de ${lab}:`, err));
    }, RENOVAR_TURNO_CADA_MS);
    try {
        return await tarea();
    } finally {
        if (renovacion) clearInterval(renovacion);
        if (turno !== 'sin-turno') await soltarTurno(lab, turno);
    }
}
