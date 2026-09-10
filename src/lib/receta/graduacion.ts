/**
 * Cuándo una graduación es ALTA, y qué cristales la resuelven.
 *
 * Regla de negocio (Ishtar, 9/9/2026): "si es de graduación alta, las opciones
 * tienen que verlas en los tallados digital y tallado CNC".
 *
 * El porqué: un cristal de stock viene con una curva y un espesor fijos. A
 * partir de cierta graduación queda grueso, pesado y con aberraciones en los
 * bordes; el tallado (digital / CNC, "free-form") se calcula para esa receta
 * en particular y en índices altos (1.60 / 1.67 / 1.74). Ofrecerle a alguien
 * de -8 un cristal de stock 1.49 es venderle algo que no va a poder usar.
 *
 * Por qué esto vive en código y no en "marcar productos a mano": de los 481
 * productos del catálogo hay 6 marcados como recomendados para el bot, y
 * NINGUNO es un tallado. Con el filtro de recomendados, el bot no podía
 * ofrecer un tallado ni queriendo — y para monofocales solo tenía UN producto
 * (el más básico) contra CUATRO multifocales caros. Esa desproporción es la
 * razón mecánica de que todo terminara en un presupuesto de multifocal.
 */

/**
 * Desde acá se considera alta (en dioptrías, valor absoluto de la esfera).
 * A partir de ±4,00 el índice del cristal ya cambia el espesor de forma
 * visible; es el corte que usa la óptica para dejar de ofrecer stock.
 */
export const GRADUACION_ALTA = 4;

/** Categorías de CRISTAL, donde la graduación manda. Un armazón no se filtra por esto. */
export const CATEGORIAS_DE_CRISTAL = ['MONOFOCAL', 'MULTIFOCAL', 'BIFOCAL', 'OCUPACIONAL'];

/** La esfera más alta de la receta, en valor absoluto. 0 si no hay datos. */
export function graduacionMaxima(receta: {
    sphereOD?: number | string | null;
    sphereOI?: number | string | null;
} | null | undefined): number {
    if (!receta) return 0;
    const n = (v: unknown) => {
        if (v === null || v === undefined || v === '') return 0;
        const x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
        return Number.isFinite(x) ? Math.abs(x) : 0;
    };
    return Math.max(n(receta.sphereOD), n(receta.sphereOI));
}

export function esGraduacionAlta(graduacion: number | null | undefined): boolean {
    return typeof graduacion === 'number' && Number.isFinite(graduacion) && Math.abs(graduacion) >= GRADUACION_ALTA;
}

/**
 * Filtro de nombre para quedarse solo con los tallados. Los del catálogo se
 * llaman "Monofocal TALLADO (CNC) · …" y "KODAK SV DIGITAL - …" / "ESPACE PLUS
 * DIGITAL - …", así que se reconocen por esas tres palabras.
 */
export const PALABRAS_DE_TALLADO = ['tallado', 'CNC', 'DIGITAL'];
