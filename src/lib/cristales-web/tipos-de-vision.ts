import type { LensType } from './claves';

/**
 * Cómo se le presenta cada TIPO de visión al cliente en el paso 1 de
 * "Armá tus lentes", y para quién es.
 *
 * Por qué existe: medido en producción (30 días hasta el 15/10/2026), el paso
 * donde más gente se va es el 1: 78 de 218 sesiones. Las cards decían qué hace
 * el cristal ("ver a una sola distancia") pero no PARA QUIÉN es, y un padre
 * no sabe si su hijo es "monofocal".
 *
 * ⚠️ TEXTOS PENDIENTES DE VALIDACIÓN: Ishtar tiene que leer y aprobar estas
 * frases antes del deploy (plan tienda 15/10/2026, tarea 2.2). Son lenguaje
 * de mostrador, no técnico: si una frase no es como lo dice ella, se cambia
 * acá y en ningún otro lado.
 *
 * Solo tipos que la tienda vende (GRUPOS_CRISTAL): no hay ocupacional ni
 * descanso como opción web, así que no se inventan.
 */
export interface TipoDeVision {
    titulo: string;
    /** Frase corta: para quién es. */
    paraQuien: string;
}

export const TIPOS_DE_VISION: Record<LensType, TipoDeVision> = {
    MONOFOCAL: {
        titulo: 'Monofocal',
        paraQuien: 'Ves mal de lejos o de cerca: una sola graduación. Es el más común.',
    },
    MULTIFOCAL: {
        titulo: 'Multifocal',
        paraQuien: 'Lejos y cerca en el mismo lente, sin línea. En general a partir de los 40.',
    },
    BIFOCAL: {
        titulo: 'Bifocal',
        paraQuien: 'Lejos arriba y cerca abajo, con la línea visible. Para quien ya los usa.',
    },
    NONE: {
        titulo: 'Solo armazón',
        paraQuien: 'Te llevás el armazón sin cristales con aumento.',
    },
};

/**
 * Qué paso se le muestra al cliente ("1 de 3"), a partir del estado interno
 * del configurador.
 *
 * El estado interno salta: en el flujo transparente va 1 → 2 → 4 (el 3 no
 * existe, quedó de cuando había un paso de receta con archivo), y "Solo
 * armazón" va directo al 4. El contador decía "Paso 2 de 4" y después
 * "Paso 4 de 4", y con solo armazón "Paso 4 de 4" habiendo tocado una sola
 * cosa (informe del 15/10/2026, hallazgo 2).
 *
 * Pasos reales:
 *  - transparente: tipo → calidad → receta (3); solo armazón: 1 de 1.
 *  - sol: color → estilo → visión → receta (4); sin aumento: 3 de 3.
 */
export function pasoVisible(args: { step: number; flujo: 'SUN' | 'CLEAR'; lensType: LensType | null }): { actual: number; total: number } {
    const { step, flujo, lensType } = args;
    if (flujo === 'SUN') {
        const total = lensType === 'NONE' ? 3 : 4;
        return { actual: Math.min(Math.max(step, 1), total), total };
    }
    if (lensType === 'NONE') return { actual: 1, total: 1 };
    const total = 3;
    const actual = step >= 4 ? 3 : Math.min(Math.max(step, 1), 2);
    return { actual, total };
}
