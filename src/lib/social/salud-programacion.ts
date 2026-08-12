import { readFile } from 'node:fs/promises';
import path from 'node:path';
// Con extensión a propósito: `npm run check:social` importa este helper desde un
// script de Node, que en ESM no resuelve la extensión sola (ver tsconfig).
import { evaluarFrescura, DIAS_FRESCURA } from './frescura.ts';

/**
 * ¿Lo que está programado en redes va a poder salir?
 *
 * POR QUÉ EXISTE. La guarda de frescura y los dedup miran el DÍA DE HOY: cuando
 * llega la fecha, deciden si esa pieza sale. Eso protege (nunca se publica un
 * precio viejo) pero no avisa. El 12/8 no salió ninguna story y lo que lo hizo
 * caro fue el silencio: los runs quedaban en verde, el mail diario contaba las
 * publicaciones de la semana —que seguían llegando por el feed— y nada miraba
 * hacia adelante. Mirar para atrás no alcanza: un hueco futuro no mueve ningún
 * número hasta que ya pasó.
 *
 * QUÉ CUENTA COMO PROBLEMA. Las piezas con precio se regeneran solas todos los
 * viernes (`.github/workflows/social-regeneracion.yml`), así que una pieza
 * programada para octubre con precios de hoy NO es un problema: para octubre
 * ya se regeneró ocho veces. Marcarla en rojo dejaría este chequeo en rojo
 * permanente, y una alarma que siempre suena no se puede distinguir de una rota
 * — el mismo criterio que el mail de cadencia.
 *
 * Entonces se miran dos cosas, y solo dos:
 *
 *   1. EL HORIZONTE CORTO: de acá a que venzan los precios de hoy, ¿lo
 *      programado puede salir? Esto es accionable hoy.
 *   2. EL LATIDO DE LA REGENERACIÓN: `generadoEl` es la prueba de que el
 *      workflow del viernes corrió. Si la última generación tiene más de una
 *      semana, la regeneración está caída aunque nadie lo haya notado — y eso
 *      sí condena todo lo que viene. Es la falla que de verdad hay que cazar:
 *      el workflow se creó el 6/8 y a la fecha no había corrido nunca.
 *
 * Vive en un helper porque lo leen el mail diario y `npm run check:social`, y
 * tienen que decir exactamente lo mismo.
 */

/** Días de programación por delante bajo los cuales conviene cargar más fechas. */
export const DIAS_COBERTURA_MINIMA = 21;

/**
 * Antigüedad máxima tolerable de la última regeneración de precios.
 *
 * La regeneración corre los viernes y la frescura dura {@link DIAS_FRESCURA}
 * días: hay margen para que falle UN viernes sin que se caiga nada. Pasado esto,
 * el próximo viernes ya no llega a tiempo y hay que intervenir.
 */
export const DIAS_REGENERACION_VENCIDA = 8;

export interface EntradaProgramada {
    fecha: string;
    pieza?: string;
    reel?: string;
}

export interface PiezaEnRiesgo {
    /** La fecha en que está programada (para stories, el día que dejan de salir). */
    fecha: string;
    id: string;
    /** Qué la frena, en castellano. */
    motivo: string;
    /** Último día en que todavía se puede publicar. */
    venceEl: string | null;
}

export interface SaludProgramacion {
    /** Hoy en hora argentina, `yyyy-mm-dd`. */
    hoy: string;
    /** Última fecha con algo programado, y cuánto falta para quedarse sin nada. */
    ultimaFecha: string | null;
    diasDeCobertura: number;
    entradasFuturas: number;
    /** Hasta qué día alcanza este chequeo: más allá, lo cubre la regeneración. */
    horizonte: string;
    /**
     * Programado dentro del horizonte que NO va a poder salir. Vacío = todo bien.
     */
    enRiesgo: PiezaEnRiesgo[];
    /** Fecha de la última regeneración de precios (el `generadoEl` más nuevo). */
    ultimaRegeneracion: string | null;
    diasDesdeRegeneracion: number | null;
    /** true cuando el workflow de los viernes dejó de correr. */
    regeneracionCaida: boolean;
    /** El primer día en que empiezan los huecos si nadie regenera. */
    regenerarAntesDel: string | null;
    /** Cuántas piezas con precio dependen de esa regeneración. */
    piezasConPrecio: number;
    ok: boolean;
}

function hoyART(): string {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function sumarDias(fecha: string, dias: number): string {
    const d = new Date(`${fecha}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

/**
 * El próximo viernes, que es cuando corre la regeneración de precios. Si hoy es
 * viernes devuelve hoy: la corrida es a las 06:00 ART, antes de cualquier
 * publicación del día.
 */
function proximoViernes(fecha: string): string {
    const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();   // 5 = viernes
    return sumarDias(fecha, (5 - dia + 7) % 7);
}

export function diasEntre(desde: string, hasta: string): number {
    return Math.round(
        (new Date(`${hasta}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / 86_400_000,
    );
}

async function leerJson(...tramos: string[]): Promise<any | null> {
    try {
        return JSON.parse(await readFile(path.join(process.cwd(), ...tramos), 'utf-8'));
    } catch {
        return null;
    }
}

/**
 * Hasta qué día una pieza con precio sigue siendo publicable.
 * `null` cuando no lleva precios (no vence nunca) o cuando ya está vencida por
 * no poder probar de cuándo son —ese caso lo describe {@link evaluarFrescura}—.
 */
function venceEl(pieza: { fuente?: string; generadoEl?: string; generadoDesde?: string } | null): string | null {
    if (!pieza || pieza.fuente !== 'base') return null;
    if (!pieza.generadoEl) return null;
    if (pieza.generadoDesde && pieza.generadoDesde !== 'produccion') return null;
    return sumarDias(pieza.generadoEl, DIAS_FRESCURA);
}

export async function evaluarSaludProgramacion(): Promise<SaludProgramacion> {
    const hoy = hoyART();
    const feed = await leerJson('social', 'feed-programacion.json');
    const stories = await leerJson('social', 'stories-diarias.json');

    const programacion: EntradaProgramada[] = feed?.programacion || [];
    const futuras = programacion.filter(e => e.fecha >= hoy);
    const fechas = programacion.map(e => e.fecha).sort();
    const ultimaFecha = fechas.length ? fechas[fechas.length - 1] : null;

    /** Cada pieza se lee una sola vez aunque esté programada seis veces. */
    const cache = new Map<string, any>();
    const pieza = async (id: string) => {
        if (!cache.has(id)) cache.set(id, await leerJson('social', 'contenido', `${id}.json`));
        return cache.get(id);
    };

    const generaciones: string[] = [];
    let piezasConPrecio = 0;

    const registrar = (json: any) => {
        if (json?.fuente === 'base') {
            piezasConPrecio++;
            if (json.generadoEl) generaciones.push(json.generadoEl);
        }
    };

    // El latido primero: el horizonte del chequeo depende de si la regeneración
    // sigue viva.
    for (const e of programacion) {
        if (e.pieza) registrar(await pieza(e.pieza));
    }
    for (const [, lista] of Object.entries<any>(stories?.carriles || {})) {
        for (const s of lista as Array<{ id: string }>) registrar(await pieza(s.id));
    }
    generaciones.sort();
    const ultimaRegeneracion = generaciones.length ? generaciones[generaciones.length - 1] : null;
    const diasDesdeRegeneracion = ultimaRegeneracion ? diasEntre(ultimaRegeneracion, hoy) : null;
    const regeneracionCaida =
        piezasConPrecio > 0 &&
        (diasDesdeRegeneracion === null || diasDesdeRegeneracion > DIAS_REGENERACION_VENCIDA);

    // HASTA DÓNDE MIRAR. Con la regeneración sana, solo tiene sentido mirar hasta
    // el próximo viernes: ese día los precios se renuevan y todo lo de más
    // adelante cambia de dato. Avisar por algo que el sistema se repara solo el
    // viernes es ruido, y el ruido termina en que nadie lea la alarma.
    // Si la regeneración se cayó no hay reparación que esperar, y entonces sí
    // importa todo lo que alcanzan a cubrir los precios actuales.
    const horizonte = regeneracionCaida ? sumarDias(hoy, DIAS_FRESCURA) : proximoViernes(hoy);

    const enRiesgo: PiezaEnRiesgo[] = [];

    for (const e of futuras) {
        if (!e.pieza) continue;
        const json = await pieza(e.pieza);
        if (e.fecha > horizonte) continue;   // lo cubre la regeneración semanal
        const veredicto = evaluarFrescura(json || {});
        if (!veredicto.fresca) {
            enRiesgo.push({ fecha: e.fecha, id: e.pieza, motivo: veredicto.motivo, venceEl: venceEl(json) });
            continue;
        }
        const vence = venceEl(json);
        if (vence && vence < e.fecha) {
            enRiesgo.push({
                fecha: e.fecha,
                id: e.pieza,
                motivo: `Los precios vencen el ${vence}, ${diasEntre(vence, e.fecha)} días antes de salir.`,
                venceEl: vence,
            });
        }
    }

    // Las stories no tienen fecha propia: rotan todos los días, así que basta con
    // saber cuáles no pueden salir HOY.
    for (const [, lista] of Object.entries<any>(stories?.carriles || {})) {
        for (const s of lista as Array<{ id: string }>) {
            const json = await pieza(s.id);
            const veredicto = evaluarFrescura(json || {});
            if (!veredicto.fresca) {
                enRiesgo.push({ fecha: hoy, id: s.id, motivo: veredicto.motivo, venceEl: venceEl(json) });
            }
        }
    }

    // La primera caída de todas: el día en que empiezan los huecos si nadie regenera.
    const regenerarAntesDel = generaciones.length ? sumarDias(generaciones[0], DIAS_FRESCURA) : null;
    const diasDeCobertura = ultimaFecha ? Math.max(0, diasEntre(hoy, ultimaFecha)) : 0;

    return {
        hoy,
        ultimaFecha,
        diasDeCobertura,
        entradasFuturas: futuras.length,
        horizonte,
        enRiesgo,
        ultimaRegeneracion,
        diasDesdeRegeneracion,
        regeneracionCaida,
        regenerarAntesDel,
        piezasConPrecio,
        ok: enRiesgo.length === 0 && !regeneracionCaida && diasDeCobertura >= DIAS_COBERTURA_MINIMA,
    };
}
