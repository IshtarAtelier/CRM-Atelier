import type { CristalVitolen } from './catalogo';
import { DISENOS_PORTAL, type DisenoPortal, type OpcionMaterial } from './portal-materiales';

/**
 * QUÉ OPCIÓN DEL PORTAL ES CADA CRISTAL DEL CRM. Puro: `npm run check:lab-modulos`.
 *
 * El portal nombra los materiales a su manera ("Array 2 1.60 Hilux MR-8 Clear"
 * para nuestro "HOYA ARRAY 2 - 1.60 CLEAR") y los agrupa por diseño (logo). Se
 * elige POR TEXTO, con reglas explícitas por familia de material e índice, y se
 * exige UNA sola opción: dos candidatas o ninguna es un faltante que ve la
 * persona, nunca "la primera que aparezca". Un cambio de ids en el portal se
 * detecta al llenar (llenar.ts compara el texto de la opción con el esperado).
 */

/** Línea del catálogo → data-id del logo en el formulario (clase Progresivo). */
const DISENO_POR_LINEA: Record<string, string> = {
    'lifestyle-4': '56',
    'array-2': '23',
    'summit': '25',
    'argos': '26',
    'mph-array-2': '84',
    'mph-summit': '84',
};

export type ColorPortal = 'Grey' | 'Brown' | 'Green';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** El color del cristal de la venta ("Gris", "marrón", "G15"…) al nombre del portal. Puro. */
export function colorDe(crystalColor: string | null | undefined): ColorPortal | null {
    const c = norm(crystalColor || '');
    if (!c) return null;
    if (/gris|grey|gray/.test(c)) return 'Grey';
    if (/marr|brown|cafe|sepia/.test(c)) return 'Brown';
    if (/verde|green|g-?15/.test(c)) return 'Green';
    return null;
}

export function disenoDelPortal(cristal: Pick<CristalVitolen, 'linea'>, disenos: DisenoPortal[] = DISENOS_PORTAL): DisenoPortal | null {
    const dataId = DISENO_POR_LINEA[cristal.linea];
    return dataId ? disenos.find(d => d.dataId === dataId) ?? null : null;
}

export interface EleccionDeMaterial {
    opcion: OpcionMaterial | null;
    motivo?: string;
    candidatos: OpcionMaterial[];
}

export function materialDelPortal(
    cristal: Pick<CristalVitolen, 'linea' | 'diseno' | 'material' | 'indice'>,
    opts: { variante?: string | null; color?: string | null } = {},
    disenos: DisenoPortal[] = DISENOS_PORTAL,
): EleccionDeMaterial {
    const diseno = disenoDelPortal(cristal, disenos);
    if (!diseno) {
        return { opcion: null, motivo: `el diseño "${cristal.diseno}" (${cristal.linea}) todavía no está relevado en el formulario del portal: cargarlo a mano`, candidatos: [] };
    }
    // El texto de la opción, sin la coletilla de Mi Primer Hoya ("Add hasta 1.75").
    const t = (o: OpcionMaterial) => norm(o.texto).replace(/ add hasta [\d.]+$/, '');
    let cand = diseno.materiales;

    switch (cristal.linea) {
        case 'array-2': cand = cand.filter(o => /^array 2 /.test(t(o))); break;           // Array Wrap no está en la lista
        case 'mph-array-2': cand = cand.filter(o => /- array /.test(t(o))); break;
        case 'mph-summit': cand = cand.filter(o => /- summit /.test(t(o))); break;
        case 'lifestyle-4': {
            const v = norm(opts.variante || '');
            if (!v) return { opcion: null, motivo: 'Lifestyle 4 necesita la variante (Urban / Indoor / Outdoor) para elegir el material en el portal', candidatos: cand };
            cand = cand.filter(o => t(o).startsWith(`idls4 ${v} `));
            break;
        }
    }

    cand = cand.filter(o => o.texto.includes(cristal.indice));

    const m = norm(cristal.material.replace(cristal.indice, ''));
    const esBlueFilter = /clear blue filter/.test(m);
    const esUv420 = /uv-?420|filter 420/.test(m);
    const esSensity = /sensity/.test(m);
    const esPolar = /polari/.test(m);
    const esClear = !esBlueFilter && !esUv420 && !esSensity && !esPolar && /clear/.test(m);
    if (esBlueFilter) cand = cand.filter(o => /clear blue filter/.test(t(o)));
    else if (esUv420) cand = cand.filter(o => /filter 420/.test(t(o)));
    else if (esSensity) cand = cand.filter(o => /sensity 2/.test(t(o)));
    else if (esPolar) cand = cand.filter(o => /polari[sz]ed|polarizado/.test(t(o)));
    else if (esClear) cand = cand.filter(o => /\bclear$/.test(t(o)));
    else return { opcion: null, motivo: `no hay regla para el material "${cristal.material}" en el portal`, candidatos: cand };

    if (esSensity || esPolar) {
        // Nada se inventa: si el portal ofrece más de un color, el fotocromático
        // o polarizado necesita el color elegido en la venta; no se pide en gris
        // por defecto. Con una sola opción no hay nada que elegir, pero un color
        // pedido que no existe igual se dice.
        const color = colorDe(opts.color);
        const colores = [...new Set(cand.map(c => c.texto.match(/\b(Grey|Brown|Green)\b/i)?.[1]).filter(Boolean))];
        if (!color && (cand.length > 1 || opts.color)) {
            return { opcion: null, motivo: `${cristal.material} necesita el color del cristal en la venta (${opts.color ? `"${opts.color}" no es uno del portal; ` : ''}hay: ${colores.join(' / ') || 'ninguno'})`, candidatos: cand };
        }
        if (color) {
            const conColor = cand.filter(o => new RegExp(`\\b${color}\\b`, 'i').test(o.texto));
            if (conColor.length === 0) {
                return { opcion: null, motivo: `${diseno.nombre} ${cristal.material} no viene en ${color} en el portal (hay: ${cand.map(c => c.texto).join(' | ') || 'nada'})`, candidatos: cand };
            }
            cand = conColor;
        }
    }

    if (cand.length === 1) return { opcion: cand[0], candidatos: cand };
    if (cand.length === 0) {
        return { opcion: null, motivo: `no se encuentra "${cristal.material}" entre los materiales de ${diseno.nombre} en el portal`, candidatos: [] };
    }
    return { opcion: null, motivo: `varias opciones del portal para "${cristal.material}" en ${diseno.nombre}: ${cand.map(c => c.texto).join(' | ')}`, candidatos: cand };
}
