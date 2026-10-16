/**
 * Qué incluye cada compra y cuándo llega: UN solo lugar.
 *
 * Plan de la tienda del 15/10/2026 (1.5 y 4.3). La auditoría de fichas
 * encontró que sol y clip-on no decían si eran polarizados, si venía estuche
 * ni cuándo llegaba, y que el plazo de entrega era distinto en la ficha
 * (2 / 5), en el checkout (2 / 5) y en los términos (2 / 5 a 7). Sin eso la
 * gente pregunta por WhatsApp en vez de comprar.
 *
 * Datos confirmados por Ishtar el 15/10/2026: TODOS los productos llevan
 * estuche; los anteojos de sol y los clip-on son TODOS polarizados.
 * Las garantías salen de lib/garantia.ts (adaptación) y de la ley 24.240
 * (art. 11, garantía legal de 6 meses para bienes nuevos).
 *
 * Lo leen la ficha (bloque "Qué incluye" y línea de plazo), el checkout y
 * los términos y condiciones. No escribir plazos ni "qué incluye" en otro lado.
 */
import { GARANTIA_PLAZO_DIAS } from '@/lib/garantia';

/** Plazos de despacho prometidos al cliente, en días hábiles. */
export const PLAZOS_DESPACHO = {
    /** Armazón solo, anteojos de sol o clip-on: sale del local. */
    sinCristales: '2 días hábiles',
    /** Con cristales a medida: calibrado y laboratorio. */
    conCristales: '5 a 7 días hábiles',
} as const;

export const GARANTIA_LEGAL = 'Garantía legal de 6 meses (ley 24.240)';
export const GARANTIA_ADAPTACION_RENGLON = `Garantía de adaptación de ${GARANTIA_PLAZO_DIAS} días en cristales`;

export type CategoriaWeb = 'Receta' | 'Sol' | 'Clip-On' | 'Cristal' | string;

/** Los renglones del bloque "Qué incluye" de la ficha, según la categoría. */
export function queIncluye(categoria: CategoriaWeb): string[] {
    const cat = (categoria || '').toLowerCase();
    if (cat.startsWith('sol')) {
        return [
            'Lentes polarizados con protección UV',
            'Estuche rígido y paño de microfibra',
            GARANTIA_LEGAL,
            `Se despacha en ${PLAZOS_DESPACHO.sinCristales}`,
        ];
    }
    if (cat.startsWith('clip')) {
        return [
            'Armazón de receta + clip de sol polarizado con protección UV',
            'Estuche rígido y paño de microfibra',
            'Cristales calibrados a tu receta, si los elegís',
            GARANTIA_ADAPTACION_RENGLON,
            `Se despacha en ${PLAZOS_DESPACHO.sinCristales} solo armazón · ${PLAZOS_DESPACHO.conCristales} con cristales`,
        ];
    }
    if (cat.startsWith('cristal')) {
        return [
            'Cristales calibrados a tu receta',
            GARANTIA_ADAPTACION_RENGLON,
            `Calibrado y laboratorio en ${PLAZOS_DESPACHO.conCristales}`,
        ];
    }
    return [
        'Armazón con estuche rígido y paño de microfibra',
        'Cristales calibrados a tu receta, si los elegís',
        GARANTIA_ADAPTACION_RENGLON,
        'Ajuste y control del calce sin cargo en el local',
        `Se despacha en ${PLAZOS_DESPACHO.sinCristales} solo armazón · ${PLAZOS_DESPACHO.conCristales} con cristales`,
    ];
}
