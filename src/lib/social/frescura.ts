import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Guarda de frescura de las piezas con precio.
 *
 * La regla R6 del sistema de placas dice que publicar un precio viejo tiene que
 * ser IMPOSIBLE, no "algo a tener cuidado". Para los carruseles eso ya estaba
 * resuelto en el cron del feed; para las STORIES no: las 13
 * `story-producto-*.json` traen precio real (`fuente: "base"`, con el valor y
 * las cuotas escritos adentro) y ni siquiera llevaban fecha de generación, así
 * que podían salir indefinidamente con un precio de hace meses.
 *
 * Vive en un solo lugar porque lo usan los dos crons: si la regla cambia (o el
 * plazo), cambia una vez. Es el mismo criterio que el resto del proyecto para
 * datos que se muestran en más de un lado.
 */

/** Días desde la generación tras los cuales una pieza con precio no se publica. */
export const DIAS_FRESCURA = 10;

export interface VeredictoFrescura {
  fresca: boolean;
  /** `null` cuando la pieza no declara `generadoEl` (se trata como vencida). */
  dias: number | null;
  motivo: string;
}

/**
 * Decide si una pieza puede publicarse.
 *
 * Solo mira las piezas marcadas `fuente: "base"` — las escritas a mano no
 * llevan precios (R6 no las deja) y no vencen. Una pieza de base SIN
 * `generadoEl` se considera vencida a propósito: no se puede probar que el
 * precio sea de hoy, y ante la duda no se publica.
 */
export function evaluarFrescura(pieza: {
  id?: string;
  fuente?: string;
  generadoEl?: string;
  generadoDesde?: string;
}): VeredictoFrescura {
  if (pieza?.fuente !== 'base') {
    return { fresca: true, dias: null, motivo: 'La pieza no trae precios de la base.' };
  }
  // Generada contra docker, no contra producción. El catálogo local está
  // desincronizado —es la misma razón por la que los snapshots no se commitean
  // desde acá— así que su precio puede ser de hace semanas aunque el JSON diga
  // que se generó hoy. La fecha prueba CUÁNDO se generó, no CONTRA QUÉ: sin este
  // corte, `generadoEl: hoy` alcanzaba para publicar un precio viejo, que es
  // exactamente lo que R6 existe para impedir.
  if (pieza.generadoDesde && pieza.generadoDesde !== 'produccion') {
    return {
      fresca: false,
      dias: null,
      motivo: `Los precios salieron de la base "${pieza.generadoDesde}", no de producción. Regenerar con --produccion.`,
    };
  }
  if (!pieza.generadoEl) {
    return {
      fresca: false,
      dias: null,
      motivo: 'No declara cuándo se generó, así que no se puede probar que el precio sea el de hoy.',
    };
  }
  // Mediodía UTC para que el corte no dependa de la hora del día ni del huso.
  // El `max(0)` es para el mensaje: una pieza generada hoy, mirada de madrugada
  // en Argentina, da -1 día contra ese mediodía y quedaba "hace -1 día(s)".
  const dias = Math.max(
    0,
    Math.floor((Date.now() - new Date(`${pieza.generadoEl}T12:00:00Z`).getTime()) / 86_400_000),
  );
  return dias > DIAS_FRESCURA
    ? { fresca: false, dias, motivo: `Los precios se generaron hace ${dias} días.` }
    : { fresca: true, dias, motivo: `Precios de hace ${dias} día(s).` };
}

/** Lee el JSON de una pieza de `social/contenido`. Devuelve null si no existe. */
export async function leerPieza(id: string): Promise<Record<string, any> | null> {
  try {
    const crudo = await readFile(path.join(process.cwd(), 'social', 'contenido', `${id}.json`), 'utf-8');
    return JSON.parse(crudo);
  } catch {
    return null;
  }
}
