import { BUSINESS_INFO } from '@/lib/business-info';

/**
 * ¿El local está abierto ahora? Única fuente: `BUSINESS_INFO.openingHoursSpecification`
 * (el mismo dato que el cartel de la web y el schema.org) — nunca un horario
 * escrito de nuevo acá. Argentina no tiene horario de verano: ART es UTC−3 fijo.
 *
 * Lo usa `vigilar-horario-bot.ts` para saber cuándo es "fuera de horario".
 */
const DIAS_SEMANA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const HORA_MS = 3_600_000;

function minutosDesdeMedianoche(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
}

/**
 * A qué hora cierra el local HOY (20 de lunes a viernes, 17 el sábado), o
 * `null` si hoy no abre (domingo). Es el reloj del vigilante del bot: se
 * revisa una vez por día, al cierre, en vez de estar mirando todo el tiempo.
 */
export function horaDeCierreDeHoy(now: Date = new Date()): number | null {
    const art = new Date(now.getTime() - 3 * HORA_MS);
    const hoy = DIAS_SEMANA[art.getUTCDay()];
    const franja = BUSINESS_INFO.openingHoursSpecification.find(f => (f.dayOfWeek as readonly string[]).includes(hoy));
    if (!franja) return null;
    return Math.floor(minutosDesdeMedianoche(franja.closes) / 60);
}

export function dentroDelHorarioComercial(now: Date = new Date()): boolean {
    const art = new Date(now.getTime() - 3 * HORA_MS);
    const hoy = DIAS_SEMANA[art.getUTCDay()];
    const minutosAhora = art.getUTCHours() * 60 + art.getUTCMinutes();

    return BUSINESS_INFO.openingHoursSpecification.some(franja => {
        if (!(franja.dayOfWeek as readonly string[]).includes(hoy)) return false;
        const abre = minutosDesdeMedianoche(franja.opens);
        const cierra = minutosDesdeMedianoche(franja.closes);
        return minutosAhora >= abre && minutosAhora < cierra;
    });
}
