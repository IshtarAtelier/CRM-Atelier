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
const tono = (name: string, hexColor: string): Tono => ({ name, hexColor });
/** Los tonos que el catálogo de Grupo Óptico reconoce en el ítem (COLOR_DEL_ITEM), con el nombre en que el vendedor los ve. */
const TONOS_GO: { patron: RegExp; tono: Tono }[] = [
    { patron: /\b(gris|grey|gray)\b/, tono: tono('Gris', '#555555') },
    { patron: /\b(sepia|brown|marron|cafe)\b/, tono: tono('Sepia', '#6b4c3a') },
    { patron: /\b(verde|green|g-?15)\b/, tono: tono('Verde', '#2f6b4f') },
    { patron: /\b(azul|blue)\b/, tono: tono('Azul', '#2a4b8d') },
    { patron: /\b(rosa|pink)\b/, tono: tono('Rosa', '#c76b8a') },
    { patron: /\b(purpura|purple|violeta)\b/, tono: tono('Púrpura', '#7b4b9c') },
    { patron: /\b(rojo|red)\b/, tono: tono('Rojo', '#a52a2a') },
    { patron: /\b(plata|plateado|silver)\b/, tono: tono('Plateado', '#9aa0a6') },
    { patron: /\b(dorado|golden|gold|oro)\b/, tono: tono('Dorado', '#c9a227') },
    { patron: /\b(amarillo|driver|drive)\b/, tono: tono('Amarillo', '#d4b106') },
];
/** `fijos`: la paleta no toma los colores del nombre del producto (ofrece solo los que el portal arma). */
const PALETAS_GRUPO_OPTICO: Record<string, Paleta & { fijos?: boolean }> = {
    SMART_COLOR: { id: 'go-smart-color', label: 'Fotocromático Smart Color (Grupo Óptico)', tonos: [tono('Azul', '#2a4b8d'), tono('Púrpura', '#7b4b9c'), tono('Rosa', '#c76b8a'), tono('Sepia', '#6b4c3a'), tono('Verde', '#2f6b4f')] },
    FOTO_ESPEJADO: { id: 'go-foto-espejado', label: 'Fotocromático espejado (Grupo Óptico)', tonos: [tono('Azul', '#2a4b8d'), tono('Dorado', '#c9a227'), tono('Verde', '#2f6b4f'), tono('Púrpura', '#7b4b9c'), tono('Rojo', '#a52a2a'), tono('Plateado', '#9aa0a6')] },
    POLARIZADO: { id: 'go-polarizado', label: 'Polarizado (Grupo Óptico)', tonos: [tono('Gris', '#555555'), tono('Sepia', '#6b4c3a'), tono('Verde', '#2f6b4f'), tono('Amarillo', '#d4b106')] },
    // El portal de SmartLab solo ofrece el espejado 1.49 en AZUL y PLATEADO. La
    // lista de precios lo escribe "Gris / Plata" en multifocales y "Azul / Plata"
    // en monofocales: es el mismo cristal, y "Gris" no existe en el portal
    // (auditoría de equivalencias, 15/10/2026). Por eso esta paleta NO toma los
    // colores del nombre del producto: ofrece los dos que el laboratorio arma.
    ESPEJADO: { id: 'go-espejado', label: 'Espejado (Grupo Óptico)', tonos: [tono('Azul', '#2a4b8d'), tono('Plateado', '#9aa0a6')], fijos: true },
};
/**
 * La paleta de un cristal de Grupo Óptico, por su nombre normalizado; null si
 * no es uno de varios colores. Los colores salen del NOMBRE del producto
 * ("Polarizado Gris / Brown", "Smart Color (Brown/Green/Blue/Pink/Purple)",
 * "Espejado Azul / Plata"), que es lo que el catálogo nuestro declara; si el
 * nombre no lista ninguno, la paleta fija del material. El portal valida al
 * cargar (catalogo.ts, MATERIALES_LAB.colores) y dice qué ofrece si no cuadra.
 */
export function paletaDeGrupoOptico(nombreNormalizado: string): Paleta | null {
    const n = nombreNormalizado;
    if (n.includes('xperio') || n.includes('transitions')) return null; // esos son de Optovisión
    const base = n.includes('smart color') ? PALETAS_GRUPO_OPTICO.SMART_COLOR
        : /fotocromatic\w*\s+espejado|foto espejado/.test(n) ? PALETAS_GRUPO_OPTICO.FOTO_ESPEJADO
            : n.includes('polarizado') ? PALETAS_GRUPO_OPTICO.POLARIZADO
                : n.includes('espejado') ? PALETAS_GRUPO_OPTICO.ESPEJADO
                    : null;
    if (!base) return null;
    const { fijos, ...paleta } = base;
    if (fijos) return paleta;
    // Los colores que el nombre lista después de la tecnología ("espejado azul / plata", "(brown/green/…)", "— gris / sepia").
    const cola = n.replace(/^.*?(smart color|espejado|polarizado)/, '').replace(/\b1\.\d\d\b.*$/, '');
    const delNombre = TONOS_GO.filter(t => t.patron.test(cola)).map(t => t.tono);
    return delNombre.length ? { ...base, tonos: delNombre } : base;
}

export function paletaDeFotocromatico(product: any): Paleta | null {
    const n = normalizar(product?.name);

    const esGenS = n.includes('gen s');
    const esXtractive = n.includes('xtractive');
    const esAcclimates = n.includes('acclimates');
    const esXperio = n.includes('xperio');
    const esFotocromatico = n.includes('transitions') || n.includes('fotocromatic');

    // 0. Cristales de Grupo Óptico que el portal ofrece en varios colores: el
    //    vendedor tiene que elegir uno en la venta, si no el robot no puede
    //    cargarlo (lab-modules/grupo-optico/catalogo.ts, MATERIALES_LAB).
    //    Los nombres son los que el catálogo reconoce (COLOR_DEL_ITEM).
    const lab = normalizar(product?.laboratory);
    const paletaGO = !lab || /grupo/.test(lab) ? paletaDeGrupoOptico(n) : null;
    if (paletaGO) return paletaGO;

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
