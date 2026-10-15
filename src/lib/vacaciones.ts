/**
 * Períodos de vacaciones de una persona: uno por año desde su ingreso
 * (aniversario a aniversario), con DIAS_VACACIONES_POR_ANIO cada uno. Los días
 * tomados son las novedades VACACIONES, en días corridos, imputadas al período
 * en que caen; más lo gozado antes del sistema (`tomadasAntes`).
 * Una sola fuente para la solapa Vacaciones del calendario del equipo.
 */
import { DIAS_VACACIONES_POR_ANIO, type IngresoEquipo } from '@/lib/constants/equipo-ingresos';

export interface VacacionRango { desde: string; hasta: string; status: string }
export interface PeriodoVacaciones {
    desde: string; hasta: string; dias: number;
    tomados: number; pendientes: number; restantes: number; actual: boolean; futuro: boolean;
}

/** Suma años/días a una clave AAAA-MM-DD (UTC, sin zona). */
export function sumar(k: string, { anios = 0, dias = 0 }: { anios?: number; dias?: number }): string {
    const [a, m, d] = k.split('-').map(Number);
    return new Date(Date.UTC(a + anios, m - 1, d + dias)).toISOString().slice(0, 10);
}
const DIA_MS = 86400000;
const t = (k: string) => Date.parse(`${k}T00:00:00Z`);
/** Días corridos de [a,b] que caen dentro de [c,d], ambos inclusive. */
export function diasEnComun(a: string, b: string, c: string, d: string): number {
    const ini = Math.max(t(a), t(c)), fin = Math.min(t(b), t(d));
    return fin < ini ? 0 : Math.round((fin - ini) / DIA_MS) + 1;
}
export const diasCorridos = (desde: string, hasta: string) => diasEnComun(desde, hasta, desde, hasta);

/** Antigüedad legible: "1 año y 10 meses", "2 meses". */
export function antiguedad(ingreso: string, hoy: string): string {
    const [a1, m1, d1] = ingreso.split('-').map(Number), [a2, m2, d2] = hoy.split('-').map(Number);
    let meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
    if (meses < 0) return 'todavía no ingresó';
    const anios = Math.floor(meses / 12); meses %= 12;
    const partes = [anios && `${anios} año${anios === 1 ? '' : 's'}`, meses && `${meses} mes${meses === 1 ? '' : 'es'}`].filter(Boolean);
    return partes.length ? partes.join(' y ') : 'menos de un mes';
}

/** Desde el ingreso hasta el período que contiene `hoy` y el siguiente (para programar adelante). */
export function periodosVacaciones(dato: IngresoEquipo, vacaciones: VacacionRango[], hoy: string): PeriodoVacaciones[] {
    const out: PeriodoVacaciones[] = [];
    for (let n = 0; n < 60; n++) {
        const desde = sumar(dato.ingreso, { anios: n });
        const hasta = sumar(dato.ingreso, { anios: n + 1, dias: -1 });
        if (desde > sumar(hoy, { anios: 1 })) break;
        const enPeriodo = (s: string) => vacaciones.filter(v => v.status === s).reduce((acc, v) => acc + diasEnComun(v.desde, v.hasta, desde, hasta), 0);
        const tomados = enPeriodo('APROBADO') + (dato.tomadasAntes?.[desde] ?? 0);
        const pendientes = enPeriodo('PENDIENTE');
        out.push({
            desde, hasta, dias: DIAS_VACACIONES_POR_ANIO, tomados, pendientes,
            restantes: DIAS_VACACIONES_POR_ANIO - tomados - pendientes,
            actual: desde <= hoy && hoy <= hasta, futuro: desde > hoy,
        });
    }
    return out;
}
