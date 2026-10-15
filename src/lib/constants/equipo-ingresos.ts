/**
 * Fecha de ingreso de cada persona del equipo y lo que se tomó de vacaciones
 * ANTES de que existiera el calendario (Ishtar, 15/10/2026). De acá sale la
 * solapa "Vacaciones" de /admin/equipo/calendario (src/lib/vacaciones.ts).
 *
 * Por id de usuario, no por nombre: los nombres se editan.
 * `tomadasAntes`: días ya gozados por período, con el período identificado por
 * su fecha de inicio (el aniversario del ingreso).
 */
export interface IngresoEquipo { ingreso: string; tomadasAntes?: Record<string, number> }

export const INGRESOS_EQUIPO: Record<string, IngresoEquipo> = {
    // Matías Turchi. Se tomó los 14 días del primer año antes del sistema.
    cmmukkygj003vgc7t33nkx0vi: { ingreso: '2024-11-26', tomadasAntes: { '2024-11-26': 14 } },
    // Milena Magallanes.
    cmr2nb9f30002yethwy8sjeo3: { ingreso: '2026-08-01' },
};

/** Días de vacaciones por año de antigüedad (Ishtar, 15/10/2026). */
export const DIAS_VACACIONES_POR_ANIO = 14;
