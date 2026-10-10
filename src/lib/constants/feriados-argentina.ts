/**
 * Feriados nacionales de Argentina que muestra el calendario del equipo
 * (/admin/equipo/calendario). Es una lista escrita a mano, no una API: cambia
 * una vez por año y conviene que no dependa de la red.
 *
 * 2026 está según el calendario oficial (incluye los tres puentes turísticos,
 * que son NO LABORABLES: el empleador decide si se trabaja). 2027 está armado con la regla de los
 * trasladables (martes/miércoles → lunes anterior; jueves/viernes → lunes
 * siguiente; sábado/domingo se quedan) — REVISAR cuando salga el decreto, que
 * suele agregar días no laborables "puente".
 *
 * El Día del Empleado de Comercio (26/9, ley 26.541) no es feriado nacional
 * pero para los vendedores vale como tal: va con tipo EMPLEADOS_COMERCIO.
 * Cuando cae fin de semana el gremio suele pasarlo al lunes; acá queda en la
 * fecha de ley y si se corre, se edita.
 *
 * Para agregar un feriado puntual o un puente sin tocar código: cargarlo en la
 * pantalla como novedad tipo "Otro".
 */

/**
 * HORARIO_ESPECIAL: no es feriado, se trabaja normal pero con otro horario
 * (24 y 31/12 cierran a las 18). Igual que NO_LABORABLE, va con todo el
 * equipo y no suma horas.
 */
export type TipoFeriado = 'FERIADO' | 'NO_LABORABLE' | 'EMPLEADOS_COMERCIO' | 'HORARIO_ESPECIAL';
/**
 * Cómo abre el local ese día, cuando ya está decidido (Ishtar, 10/10/2026).
 * De acá salen la columna del calendario del equipo Y las stories que avisan
 * el feriado (src/lib/social/stories-feriados.ts): cargar la apertura de un
 * feriado nuevo es lo único que hace falta para que se programe su story.
 */
export type AperturaLocal =
    | { abre: string; cierra: string }      // "09:00" / "17:00"
    | { cerrado: true; nota?: string };      // nota: "el sábado abrimos como siempre"
/** Todo feriado que el local abre, abre de 9 a 17 (Ishtar, 10/10/2026). */
export const HORARIO_FERIADO = { abre: '09:00', cierra: '17:00' } as const;

export interface Feriado { fecha: string; nombre: string; tipo?: TipoFeriado; apertura?: AperturaLocal }

/** "09:00" → "9"; "18:30" → "18:30". */
const hora = (h: string) => h.endsWith(':00') ? String(Number(h.slice(0, 2))) : h.replace(/^0/, '');

/** La apertura en una frase corta: "Abre 9 a 17", "Cerrado". */
export function textoApertura(a: AperturaLocal | undefined): string | null {
    if (!a) return null;
    if ('cerrado' in a) return a.nota ? `Cerrado (${a.nota})` : 'Cerrado';
    return `Abre ${hora(a.abre)} a ${hora(a.cierra)}`;
}
export { hora as horaCorta };

/** Los días que se trabajan con normalidad, todo el equipo, sin sumar horas a favor. */
export const TIPOS_DIA_NORMAL: TipoFeriado[] = ['NO_LABORABLE', 'HORARIO_ESPECIAL'];

/**
 * Desde cuándo se lleva la cobertura de feriados: desde que empezó Milena
 * (alta 1/7/2026, primera venta 2/7). Pedido de Ishtar del 8/10/2026.
 */
export const DESDE_COBERTURA_FERIADOS = '2026-07-01';

export const FERIADOS_ARGENTINA: Feriado[] = ([
    // 2026
    { fecha: '2026-01-01', nombre: 'Año Nuevo' },
    { fecha: '2026-02-16', nombre: 'Carnaval' },
    { fecha: '2026-02-17', nombre: 'Carnaval' },
    { fecha: '2026-03-23', nombre: 'Puente turístico', tipo: 'NO_LABORABLE' },
    { fecha: '2026-03-24', nombre: 'Día de la Memoria' },
    { fecha: '2026-04-02', nombre: 'Malvinas (y Jueves Santo)' },
    { fecha: '2026-04-03', nombre: 'Viernes Santo' },
    { fecha: '2026-05-01', nombre: 'Día del Trabajador' },
    { fecha: '2026-05-25', nombre: 'Revolución de Mayo' },
    { fecha: '2026-06-15', nombre: 'Güemes (trasladado del 17/6)' },
    { fecha: '2026-06-20', nombre: 'Belgrano' },
    { fecha: '2026-07-09', nombre: 'Independencia' },
    { fecha: '2026-07-10', nombre: 'Puente turístico', tipo: 'NO_LABORABLE' },
    { fecha: '2026-08-17', nombre: 'San Martín' },
    { fecha: '2026-09-26', nombre: 'Día del Empleado de Comercio', tipo: 'EMPLEADOS_COMERCIO' },
    { fecha: '2026-10-12', nombre: 'Diversidad Cultural', apertura: HORARIO_FERIADO },
    { fecha: '2026-11-09', nombre: 'Visita del Papa', apertura: HORARIO_FERIADO },
    { fecha: '2026-11-23', nombre: 'Soberanía Nacional (trasladado del 20/11)', apertura: HORARIO_FERIADO },
    { fecha: '2026-12-07', nombre: 'Puente turístico', tipo: 'NO_LABORABLE' },
    { fecha: '2026-12-08', nombre: 'Inmaculada Concepción', apertura: HORARIO_FERIADO },
    { fecha: '2026-12-24', nombre: 'Nochebuena', tipo: 'HORARIO_ESPECIAL', apertura: { abre: '09:00', cierra: '18:00' } },
    { fecha: '2026-12-25', nombre: 'Navidad', apertura: { cerrado: true, nota: 'el sábado abrimos como siempre' } },
    { fecha: '2026-12-31', nombre: 'Fin de año', tipo: 'HORARIO_ESPECIAL', apertura: { abre: '09:00', cierra: '18:00' } },
    // 2027 (por regla; revisar con el decreto)
    { fecha: '2027-01-01', nombre: 'Año Nuevo', apertura: { cerrado: true, nota: 'el sábado abrimos como siempre' } },
    { fecha: '2027-02-08', nombre: 'Carnaval' },
    { fecha: '2027-02-09', nombre: 'Carnaval' },
    { fecha: '2027-03-24', nombre: 'Día de la Memoria' },
    { fecha: '2027-03-26', nombre: 'Viernes Santo' },
    { fecha: '2027-04-02', nombre: 'Malvinas' },
    { fecha: '2027-05-01', nombre: 'Día del Trabajador' },
    { fecha: '2027-05-25', nombre: 'Revolución de Mayo' },
    { fecha: '2027-06-21', nombre: 'Güemes (trasladado del 17/6)' },
    { fecha: '2027-06-20', nombre: 'Belgrano' },
    { fecha: '2027-07-09', nombre: 'Independencia' },
    { fecha: '2027-08-16', nombre: 'San Martín (trasladado del 17/8)' },
    { fecha: '2027-09-26', nombre: 'Día del Empleado de Comercio', tipo: 'EMPLEADOS_COMERCIO' },
    { fecha: '2027-10-11', nombre: 'Diversidad Cultural (trasladado del 12/10)' },
    { fecha: '2027-11-20', nombre: 'Soberanía Nacional' },
    { fecha: '2027-12-08', nombre: 'Inmaculada Concepción' },
    { fecha: '2027-12-25', nombre: 'Navidad' },
] as Feriado[]).sort((a, b) => a.fecha.localeCompare(b.fecha));
