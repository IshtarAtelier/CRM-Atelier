/**
 * El "día" según el reloj de la óptica, no según el del servidor.
 *
 * Railway corre en UTC. Usar su medianoche hace que todo lo trabajado después
 * de las 21 hs argentinas le cuente al día siguiente: el resumen del lunes
 * incluiría las tres últimas horas del domingo, y un briefing "una vez por día"
 * volvería a aparecer a las 21 hs de la misma jornada.
 *
 * Vive acá y no adentro de cada ruta porque ya lo necesitan dos lugares (el
 * cron del resumen diario y el briefing del panel) y son cálculos que, copiados,
 * divergen: alcanza con que uno olvide el offset para que los dos reportes
 * hablen de días distintos con el mismo nombre.
 */

/** Argentina es UTC-3 todo el año: no tiene horario de verano desde 2009. */
const OFFSET_MS = 3 * 60 * 60 * 1000;

export interface DiaArgentino {
    /** Comienzo del día, ya convertido a UTC real (para comparar con la base). */
    desde: Date;
    /** Comienzo del día siguiente, en UTC real. Se usa con `lt`, nunca con `lte`. */
    hasta: Date;
    /** "domingo 30-08" — para hablarle a una persona. */
    etiqueta: string;
    /** "29/08/2026" — el formato visible de la casa (ver CLAUDE.md). */
    fecha: string;
    /** "2026-08-29" — para guardar y comparar, nunca para mostrar. */
    iso: string;
}

/**
 * El día que empezó `haceDias` días atrás en hora argentina.
 * `0` es hoy, `1` es ayer.
 */
export function diaArgentino(haceDias = 0): DiaArgentino {
    // OJO: el `+ OFFSET_MS` de abajo asume que el proceso corre en UTC, que es
    // el caso en Railway. En una máquina de desarrollo con otro huso, `desde` y
    // `hasta` salen corridos por la diferencia — los textos (etiqueta/fecha/iso)
    // siguen bien. Es el comportamiento que ya tenía el cron del resumen
    // diario; se conserva tal cual para no moverle el corte a producción.
    const ahoraAr = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));

    const inicioAr = new Date(ahoraAr);
    inicioAr.setHours(0, 0, 0, 0);
    inicioAr.setDate(inicioAr.getDate() - haceDias);

    const finAr = new Date(inicioAr);
    finAr.setDate(finAr.getDate() + 1);

    const dd = String(inicioAr.getDate()).padStart(2, '0');
    const mm = String(inicioAr.getMonth() + 1).padStart(2, '0');
    const aaaa = inicioAr.getFullYear();

    return {
        desde: new Date(inicioAr.getTime() + OFFSET_MS),
        hasta: new Date(finAr.getTime() + OFFSET_MS),
        etiqueta: inicioAr.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' }),
        fecha: `${dd}/${mm}/${aaaa}`,
        // A mano y no con toISOString(): esa función pasa por UTC y devolvería
        // el día anterior para todo lo que ocurre antes de las 21 hs.
        iso: `${aaaa}-${mm}-${dd}`,
    };
}

/** "2026-08-31" — la clave con la que se marca "esto ya lo hizo hoy". */
export function hoyArgentino(): string {
    return diaArgentino(0).iso;
}
