/**
 * Stories que avisan cómo abre el local en cada feriado (Ishtar, 10/10/2026:
 * "siempre programá para que la audiencia desde unos días antes sepa cómo se
 * trabaja o no el feriado").
 *
 * La fuente es la `apertura` de cada día en FERIADOS_ARGENTINA: un feriado
 * sin apertura cargada no tiene story, porque todavía no se sabe qué decir.
 *
 * Dos mitades, una sola regla:
 * - `piezaDeFeriado()` arma el JSON de la placa. Lo usa
 *   `scripts/social/generar-stories-feriados.ts`, que la renderiza a
 *   public/social/feriado-<fecha>/01.jpg (Instagram necesita la imagen ya
 *   publicada en el sitio: el cron NO renderiza).
 * - `feriadosParaAvisarHoy()` dice qué piezas le tocan a la tanda de la
 *   mañana del cron social-story-diaria: desde DIAS_DE_ANTICIPACION días antes
 *   hasta el mismo día, una por día.
 */
import { FERIADOS_ARGENTINA, horaCorta, type Feriado } from '@/lib/constants/feriados-argentina';

/** Cuántos días antes empieza a salir la story (y sale todos los días hasta el feriado inclusive). */
export const DIAS_DE_ANTICIPACION = 3;

export const DIRECCION_STORY = 'José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba';

export const idPiezaFeriado = (fecha: string) => `feriado-${fecha}`;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** "2026-11-09" → "lunes 9/11". */
export function diaYFecha(fecha: string): string {
    const [a, m, d] = fecha.split('-').map(Number);
    const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
    return `${DIAS[dow]} ${d}/${m}`;
}

/** El nombre sin aclaraciones de traslado: "Soberanía Nacional (trasladado del 20/11)" → "Soberanía Nacional". */
const nombreLimpio = (n: string) => n.replace(/\s*\(.*?\)\s*/g, '').trim();
/** "Feriado de la Diversidad Cultural", "Feriado de Navidad" (texto aprobado por Ishtar el 10/10/2026). */
function feriadoDe(nombre: string): string {
    const n = nombreLimpio(nombre);
    return /^(Diversidad|Inmaculada|Visita|Soberanía|Revolución|Independencia|Memoria)/.test(n) ? `Feriado de la ${n}` : `Feriado de ${n}`;
}

/** El JSON de la placa (formato de social/contenido), o null si el día no tiene apertura cargada. */
export function piezaDeFeriado(f: Feriado) {
    const a = f.apertura;
    if (!a) return null;
    const cuando = diaYFecha(f.fecha);
    const queEs = f.tipo === 'HORARIO_ESPECIAL' ? nombreLimpio(f.nombre) : feriadoDe(f.nombre);
    let title: string, body: string, caption: string;
    if ('cerrado' in a) {
        title = `El ${cuando} *cerramos*`;
        body = `${queEs}${a.nota ? `\n${a.nota[0].toUpperCase()}${a.nota.slice(1)}` : ''}\n\nTe esperamos en ${DIRECCION_STORY}`;
        caption = `El ${cuando} el local está cerrado.${a.nota ? ` ${a.nota[0].toUpperCase()}${a.nota.slice(1)}.` : ''}`;
    } else {
        const rango = `de ${horaCorta(a.abre)} a ${horaCorta(a.cierra)}`;
        title = f.tipo === 'HORARIO_ESPECIAL' ? `El ${cuando} *cerramos a las ${horaCorta(a.cierra)}*` : `El ${cuando} *abrimos*`;
        body = `${queEs}\nD${rango.slice(1)} hs\n\n${DIRECCION_STORY}`;
        caption = f.tipo === 'HORARIO_ESPECIAL'
            ? `El ${cuando} abrimos ${rango}. ${DIRECCION_STORY}.`
            : `El ${cuando}, feriado, abrimos ${rango}. ${DIRECCION_STORY}.`;
    }
    return {
        id: idPiezaFeriado(f.fecha),
        format: '9:16',
        theme: 'dark',
        pilar: 'accion',
        fuente: 'business-info',
        caption,
        slides: [{ type: 'cta', role: 'portada', image: 'blog/vidriera-atelier.jpg', title, body }],
    };
}

/** Suma días a una clave AAAA-MM-DD. */
function sumarDias(k: string, n: number): string {
    const [a, m, d] = k.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Los feriados con apertura cargada cuya story tiene que salir el día `hoy` (AAAA-MM-DD, hora argentina). */
export function feriadosParaAvisarHoy(hoy: string, lista: Feriado[] = FERIADOS_ARGENTINA): Feriado[] {
    return lista.filter(f => f.apertura && f.fecha >= hoy && sumarDias(f.fecha, -DIAS_DE_ANTICIPACION) <= hoy);
}
