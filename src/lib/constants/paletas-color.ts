// ────────────────────────────────────────────────────────────────────────────
// Qué colores puede elegir el cliente, según el CRISTAL.
//
// No hay una paleta única: un Transitions Gen S en ORMA viene en 8 colores, en
// Airwear o Stylis en 2, un Xtractive solo en gris y un Xperio en 3. Ofrecerle
// al vendedor colores que ese cristal no tiene es un pedido rebotado; esconder
// los que sí tiene es una venta que no se hace.
//
// QUIÉN MANDA: el MATERIAL (ORMA / Airwear / Stylis) y la tecnología, no lo que
// diga el nombre del producto. Los nombres del catálogo mienten: los tres
// "XR DESIGN … TRANSITIONS GEN S" dicen "(fotocromáticos 8)" y en Airwear y
// Stylis son 2 — y el XR DESIGN en ORMA son 3, no 8. Confirmado con la Lista de
// Precios Optovision del 3/8/2026.
//
// Agregar o corregir una paleta se hace ACÁ y viaja con el deploy: no hay que
// tocar la base ni cargar producto por producto.
// ────────────────────────────────────────────────────────────────────────────

export interface Tono {
    name: string;
    hexColor: string;
}

/** Catálogo maestro de tonos: un solo lugar donde vive cada color y su muestra. */
export const TONOS = {
    GRIS: { name: 'Gris', hexColor: '#555555' },
    CAFE: { name: 'Café / Marrón', hexColor: '#6b4c3a' },
    VERDE: { name: 'Verde / Esmeralda', hexColor: '#2f6b4f' },
    ZAFIRO: { name: 'Zafiro (Azul)', hexColor: '#2a4b8d' },
    RUBI: { name: 'Rubí (Rojo/Rosado)', hexColor: '#a52a4a' },
    AMBAR: { name: 'Ámbar', hexColor: '#c9862a' },
    AMATISTA: { name: 'Amatista (Morado)', hexColor: '#7b4b9c' },
    GRAFITO: { name: 'Verde grafito', hexColor: '#3f4f45' },
} as const;

export interface Paleta {
    id: string;
    /** Lo que se le muestra al vendedor arriba de los colores. */
    label: string;
    tonos: Tono[];
    /**
     * true = la lista todavía NO está confirmada contra la lista de precios.
     * Se muestra igual (mejor eso que no poder cargar nada), pero avisando.
     */
    porConfirmar?: boolean;
}

/** Transitions Gen S en ORMA: los 8 colores. */
export const GEN_S_8: Paleta = {
    id: 'GEN_S_8',
    label: 'Gen S — 8 colores',
    tonos: [TONOS.GRIS, TONOS.CAFE, TONOS.VERDE, TONOS.ZAFIRO, TONOS.RUBI, TONOS.AMBAR, TONOS.AMATISTA, TONOS.GRAFITO],
};

/** Gris y café: Airwear, Stylis y Acclimates. */
export const GRIS_CAFE: Paleta = {
    id: 'GRIS_CAFE',
    label: '2 colores',
    tonos: [TONOS.GRIS, TONOS.CAFE],
};

/** Xperio en ORMA y el Gen S del XR Design en ORMA. */
export const GRIS_CAFE_VERDE: Paleta = {
    id: 'GRIS_CAFE_VERDE',
    label: '3 colores',
    tonos: [TONOS.GRIS, TONOS.CAFE, TONOS.VERDE],
};

/** Un solo color: Xtractive y los SKU que el nombre declara "(Gris)". */
export const SOLO_GRIS: Paleta = {
    id: 'SOLO_GRIS',
    label: 'Solo gris',
    tonos: [TONOS.GRIS],
};

export const PALETAS = { GEN_S_8, GRIS_CAFE, GRIS_CAFE_VERDE, SOLO_GRIS };

const normalizar = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * La paleta que corresponde a un cristal.
 *
 * Devuelve null cuando el cristal no lleva color a elegir. El orden de las
 * reglas importa: primero las excepciones concretas, después el material.
 */
export function paletaDeFotocromatico(product: any): Paleta | null {
    const n = normalizar(product?.name);

    const esGenS = n.includes('gen s');
    const esXtractive = n.includes('xtractive');
    const esAcclimates = n.includes('acclimates');
    const esXperio = n.includes('xperio');
    const esFotocromatico = n.includes('transitions') || n.includes('fotocromatic');

    if (!esGenS && !esXtractive && !esAcclimates && !esXperio && !esFotocromatico) return null;

    const esOrma = n.includes('orma');
    const esAirwear = n.includes('airwear');
    const esStylis = n.includes('stylis');

    // 1. SKU que ya viene atado a un solo color: el nombre lo declara y es el
    //    producto entero, no una interpretación de cuántos colores hay.
    if (n.includes('(gris)') || n.includes('fotocromatico gris') || n.includes('fotocromatica gris')) return SOLO_GRIS;
    if (n.includes('cafe / gris') || n.includes('cafe/gris')) return GRIS_CAFE;

    // 2. Tecnologías con paleta propia, sin importar el material.
    if (esXtractive) return SOLO_GRIS;
    if (esAcclimates) return GRIS_CAFE;

    // 3. Xperio (polarizado): en ORMA son 3; en el resto de los materiales, 2.
    if (esXperio) return esOrma ? GRIS_CAFE_VERDE : GRIS_CAFE;

    // 4. Transitions Gen S — manda el MATERIAL.
    if (esGenS) {
        // El XR Design en ORMA es la excepción: 3 colores, no 8, por más que el
        // nombre del producto diga "(fotocromáticos 8)".
        if (n.includes('xr design') || n.includes('x design')) {
            return esOrma ? GRIS_CAFE_VERDE : GRIS_CAFE;
        }
        if (esAirwear || esStylis) return GRIS_CAFE;
        if (esOrma) return GEN_S_8;
        return { ...GEN_S_8, porConfirmar: true };
    }

    // 5. Fotocromático sin tecnología reconocible (los genéricos de otros labs).
    return { ...SOLO_GRIS, label: 'Fotocromático', porConfirmar: true };
}
