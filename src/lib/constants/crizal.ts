// ────────────────────────────────────────────────────────────────────────────
// Los antirreflejos (Crizal) que procesa Optovisión/Essilor.
//
// UN SOLO catálogo alimenta el selector de la venta, la validación del server,
// las descripciones que ve el vendedor y el cruce con las facturas. Igual que
// los tonos de teñido (tenido.ts): agregar o sacar uno se hace ACÁ y viaja con
// el deploy.
//
// POR QUÉ EXISTE (decisión de la administradora, 26/8/2026): el costo de todo
// cristal con Crizal se calcula con el MÁS CARO (así el margen nunca queda
// corto), y el que realmente lleva el par es un DATO DE LA VENTA, de elección
// obligatoria — igual que el tono de un teñido. Antes vivía en el nombre del
// producto ("+ CRIZAL" sin decir cuál) y 44 de 82 cristales quedaron
// imposibles de costear.
//
// El orden de la lista es el orden del selector: de más completo a más simple.
// ────────────────────────────────────────────────────────────────────────────

export interface OpcionCrizal {
    /** Clave estable que se guarda en la venta (Order.labCrizal). */
    code: string;
    /** Como lo conoce el vendedor y como figura en la lista del laboratorio. */
    nombre: string;
    /** Qué es, en una frase — para elegir sabiendo y explicárselo al cliente. */
    detalle: string;
    /** Con esto puesto, el par NO lleva Crizal (variantes sin antirreflejo). */
    sinCrizal?: boolean;
}

export const CRIZALES: OpcionCrizal[] = [
    {
        code: 'CRIZAL_PREVENCIA',
        nombre: 'Crizal Prevencia',
        detalle: 'El más completo: antirreflejo + filtro de luz azul-violeta. Es el que se toma como base del precio.',
    },
    {
        code: 'CRIZAL_SAPPHIRE',
        nombre: 'Crizal Sapphire',
        detalle: 'El antirreflejo más transparente (multiángulo): menos reflejos de frente y de costado.',
    },
    {
        code: 'CRIZAL_FORTE_UV',
        nombre: 'Crizal Forte UV',
        detalle: 'El estándar: antirreflejo resistente al rayado con protección UV. El de fábrica en Varilux.',
    },
    {
        code: 'TRIO_EASY_CLEAN',
        nombre: 'Trío Easy Clean',
        detalle: 'Antirreflejo básico, fácil de limpiar. La opción económica.',
        sinCrizal: true,
    },
    {
        code: 'SIN_AR',
        nombre: 'Sin antirreflejo',
        detalle: 'La lente sola, sin tratamiento. Solo si el cliente lo pidió así.',
        sinCrizal: true,
    },
];

export const codigosCrizal = CRIZALES.map(c => c.code);

export function esCrizalValido(code: unknown): boolean {
    return typeof code === 'string' && codigosCrizal.includes(code);
}

/** Lo mínimo que hay que saber de un ítem para decidir si exige Crizal.
 *  Cada llamador lo arma desde lo que tenga: el snapshot congelado de la venta
 *  o el producto vivo — la regla es UNA sola acá. */
export interface ItemParaCrizal {
    categoria?: string | null;
    laboratorio?: string | null;
    nombre?: string | null;
}

/**
 * ¿Esta venta exige que se informe el Crizal? Sí cuando lleva algún cristal de
 * Optovisión con antirreflejo en juego. Los "SIN AR" / "Sin Crizal" explícitos
 * en el nombre no lo exigen: no llevan tratamiento.
 */
export function ventaExigeCrizal(items: ItemParaCrizal[]): boolean {
    return items.some(i =>
        /cristal/i.test(i.categoria || '')
        && /optovision/i.test(i.laboratorio || '')
        && !/sin\s*ar\b|sin\s*crizal/i.test(i.nombre || ''));
}
