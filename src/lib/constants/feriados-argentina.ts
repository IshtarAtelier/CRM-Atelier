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
/** `local`: cómo abre el local ese día, tal como lo dijo Ishtar ("Abre 9 a 17", "Cerrado"). */
export interface Feriado { fecha: string; nombre: string; tipo?: TipoFeriado; local?: string }

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
    { fecha: '2026-10-12', nombre: 'Diversidad Cultural', local: 'Abre 9 a 17' },
    { fecha: '2026-11-09', nombre: 'Visita del Papa', local: 'Abre 9 a 17' },
    { fecha: '2026-11-23', nombre: 'Soberanía Nacional (trasladado del 20/11)', local: 'Abre 9 a 17' },
    { fecha: '2026-12-07', nombre: 'Puente turístico', tipo: 'NO_LABORABLE' },
    { fecha: '2026-12-08', nombre: 'Inmaculada Concepción', local: 'Abre 9 a 17' },
    { fecha: '2026-12-24', nombre: 'Nochebuena', tipo: 'HORARIO_ESPECIAL', local: 'Cierra a las 18' },
    { fecha: '2026-12-25', nombre: 'Navidad', local: 'Cerrado (el sábado abre normal)' },
    { fecha: '2026-12-31', nombre: 'Fin de año', tipo: 'HORARIO_ESPECIAL', local: 'Cierra a las 18' },
    // 2027 (por regla; revisar con el decreto)
    { fecha: '2027-01-01', nombre: 'Año Nuevo', local: 'Cerrado' },
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
