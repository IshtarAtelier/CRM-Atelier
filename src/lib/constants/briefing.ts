/**
 * Los números del briefing diario del equipo de venta.
 *
 * Son reglas de la dueña, no parámetros técnicos: viven acá con nombre para que
 * el día que cambien se cambien en un solo lugar y no haya que buscarlos entre
 * el texto del modal y la validación del endpoint.
 */

/** Presupuestos por día. Es un piso, no una meta. */
export const BRIEFING_MINIMO_PRESUPUESTOS = 15;

/** Tareas por día: un rango, porque cerrar 40 tareas en un día es no hacerlas. */
export const BRIEFING_TAREAS_MIN = 5;
export const BRIEFING_TAREAS_MAX = 10;

/**
 * Largo mínimo de lo que el vendedor escribe al final.
 *
 * Lo validan el modal (para avisar en el momento) y el endpoint (porque el
 * modal es del cliente y no se le cree). Por eso el número es uno solo.
 */
export const BRIEFING_MINIMO_TEXTO = 10;

export interface ObjetivosBriefing {
    presupuestos: number;
    tareasMin: number;
    /**
     * Tope del rango de tareas. Es OPCIONAL: sin él la ficha dice "mínimo N por
     * día" y no un rango inventado. El rango nació como freno a cerrar 40
     * tareas de una para inflar el número; cuando la dueña fija un piso alto y
     * no un techo, poner un techo de más sería ponerle un límite que no pidió.
     */
    tareasMax?: number;
}

const OBJETIVOS_POR_DEFECTO: ObjetivosBriefing = {
    presupuestos: BRIEFING_MINIMO_PRESUPUESTOS,
    tareasMin: BRIEFING_TAREAS_MIN,
    tareasMax: BRIEFING_TAREAS_MAX,
};

const normalizar = (t: string) =>
    (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Objetivos propios de cada persona. El piso NO es el mismo para todos: Milena
 * además procesa los pedidos y hace la caja, así que vende menos horas del día
 * (decisión de Ishtar, 16/9/2026). Sin esto, su ficha le marcaba "te faltaron"
 * todos los días por un mínimo que no era el suyo.
 *
 * La audiencia se decide por NOMBRE, igual que en las novedades guiadas: los
 * ids de usuario difieren entre bases y un id copiado mal deja el objetivo
 * puesto en la persona equivocada, sin error a la vista.
 */
const OBJETIVOS: { coincide: (n: string) => boolean; objetivos: ObjetivosBriefing }[] = [
    {
        coincide: n => n.includes('milena'),
        objetivos: { ...OBJETIVOS_POR_DEFECTO, presupuestos: 10 },
    },
    {
        coincide: n => n.includes('matias'),
        objetivos: { presupuestos: 20, tareasMin: 20, tareasMax: undefined },
    },
];

/** Los objetivos del día de esta persona; los de por defecto si no tiene propios. */
export function objetivosDe(nombre: string): ObjetivosBriefing {
    const n = normalizar(nombre);
    return OBJETIVOS.find(o => o.coincide(n))?.objetivos ?? OBJETIVOS_POR_DEFECTO;
}
