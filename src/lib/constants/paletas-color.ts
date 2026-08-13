// ────────────────────────────────────────────────────────────────────────────
// Qué colores puede elegir el cliente, según el CRISTAL.
//
// No hay una paleta única: un Transitions Gen S viene en 8 colores, un
// Xtractive en gris, y el teñido a pedido tiene los tonos que ofrece SmartLab.
// Ofrecerle al vendedor colores que ese cristal no tiene es garantía de un
// pedido rebotado — y ocultarle los que sí existen es una venta que no se hace.
//
// Cada paleta se declara ACÁ y viaja con el deploy. Agregar una es tres líneas;
// no hace falta tocar la base ni cargar producto por producto, porque el propio
// NOMBRE del producto dice qué lleva ("fotocromáticos 8", "(Gris)", "(Colores)").
//
// Fuente: Lista de Precios Optovision — 03 de agosto de 2026.
// ────────────────────────────────────────────────────────────────────────────

export interface Tono {
    name: string;
    hexColor: string;
}

/** Catálogo maestro de tonos: un solo lugar donde vive cada color y su muestra. */
const T = {
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

/** Transitions Gen S completo: los 8 colores. */
export const GEN_S_8: Paleta = {
    id: 'GEN_S_8',
    label: 'Transitions Gen S — 8 colores',
    tonos: [T.GRIS, T.CAFE, T.VERDE, T.ZAFIRO, T.RUBI, T.AMBAR, T.AMATISTA, T.GRAFITO],
};

/** Gen S en los materiales que solo salen en dos colores (Airwear, Stylis). */
export const GEN_S_2: Paleta = {
    id: 'GEN_S_2',
    label: 'Transitions Gen S — 2 colores',
    tonos: [T.GRIS, T.CAFE],
    porConfirmar: true,
};

/** Un solo color: los que el nombre declara como "(Gris)". */
export const SOLO_GRIS: Paleta = {
    id: 'SOLO_GRIS',
    label: 'Un solo color',
    tonos: [T.GRIS],
};

export const PALETAS = { GEN_S_8, GEN_S_2, SOLO_GRIS };

const normalizar = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * La paleta que corresponde a un cristal fotocromático.
 *
 * Se lee del NOMBRE del producto, que ya declara lo que lleva. Devuelve null
 * cuando el cristal no es fotocromático o cuando su paleta todavía no está
 * cargada: en ese caso la pantalla lo dice, en vez de ofrecer colores
 * inventados que el laboratorio no va a poder hacer.
 */
export function paletaDeFotocromatico(product: any): Paleta | null {
    const n = normalizar(product?.name);
    const esFotocromatico = n.includes('transitions') || n.includes('fotocromatic')
        || n.includes('acclimates') || n.includes('xtractive');
    if (!esFotocromatico) return null;

    // Lo que el nombre declara MANDA, sea cual sea la tecnología.
    if (n.includes('(gris)') || n.includes('fotocromatico gris') || n.includes('fotocromatica gris')) return SOLO_GRIS;
    if (n.includes('fotocromaticos 2')) return GEN_S_2;
    if (n.includes('8 colores') || n.includes('fotocromaticos 8') || n.includes('(colores)')) return GEN_S_8;

    // Sin declaración en el nombre, manda el MATERIAL — es lo que muestra la
    // lista de precios: las filas de ORMA traen los 8 colores, y las de Airwear
    // y Stylis solo dos. El material está en el nombre del producto.
    if (n.includes('xtractive')) return { ...SOLO_GRIS, label: 'Transitions XTRActive', porConfirmar: true };
    if (n.includes('acclimates')) return { ...GEN_S_2, label: 'Acclimates', porConfirmar: true };
    if (n.includes('gen s')) {
        if (n.includes('airwear') || n.includes('stylis')) return GEN_S_2;
        if (n.includes('orma')) return GEN_S_8;
        return { ...GEN_S_8, porConfirmar: true };
    }

    return null;
}
