/**
 * LA EQUIVALENCIA PRODUCTO DEL CRM → ARTÍCULO DEL PORTAL SMARTLAB (Grupo Óptico).
 *
 * Por qué existe: el favorito del vendedor elegía el artículo "por palabras
 * sueltas" (free, blue, org…) y en el portal, para el MISMO material, hay un
 * artículo común y otro "C/AR ESSENTIAL", más variantes por color e índice
 * (403 artículos, relevados el 3/10/2026: docs/smartlab-portal.md). Así se
 * cargaban productos distintos de los vendidos.
 *
 * Acá la equivalencia se DECLARA, por familia y por material, con reglas fijas:
 *  · el producto del CRM es "Familia · Material [· Essential] [2x1]";
 *  · la familia dice tipo de lente, marca del portal y qué palabras tiene que
 *    tener (y no tener) la etiqueta del artículo;
 *  · el material dice el id de material y el color del portal;
 *  · "Essential" exige "ESSENTIAL" en la etiqueta, y su ausencia lo prohíbe.
 * El robot pide al portal la lista de artículos de esa combinación y se queda
 * con el ÚNICO que cumple. Cero o más de uno = no carga y dice cuáles vio:
 * nunca elige "el primero".
 *
 * Stock es otra cosa: el artículo es el cristal puntual de esa graduación
 * ("8-050+025 ORG BLUE C/AR 1.56 STOCK ESF-050 CIL+025"), que el portal busca
 * con un código propio por material (MATERIALES_STOCK).
 *
 * Reglas del portal que no son del CRM (vistas el 3/10/2026):
 *  · solo ORG BLANCO 1.49 acepta teñido: el 2º par de sol de un 2x1 se carga
 *    como la misma familia en Orgánico Blanco 1.49 sin Essential + el teñido
 *    (así lo cargó el equipo en 22 de 22 casos);
 *  · los ids de material de stock NO son los de laboratorio (36 y 37 son otra
 *    cosa en cada lista).
 *
 * PURO: lo prueba `npm run check:lab-modulos`.
 */

export type TipoLentePortal = 1 | 3 | 4 | 5 | 6;

export interface Familia {
    /** Prefijo del nombre del producto en el CRM (antes del primer "·"). */
    crm: RegExp;
    lensTypeId: TipoLentePortal;
    brandId: number;
    /** La etiqueta del artículo TIENE que cumplir esto. */
    debe: RegExp;
    /** …y NO puede cumplir esto (familias vecinas en la misma lista). */
    noDebe?: RegExp;
    nombre: string;
}

const MARCA_DIGITAL = 145; // "Smart Lens Digital"
const MARCA_LAB = 135; // "Smart Lens"

/** Familias de laboratorio. El orden importa: la primera que matchea gana. */
export const FAMILIAS: Familia[] = [
    { nombre: 'Multifocal Smart FREE', crm: /^multifocal smart free\b/i, lensTypeId: 5, brandId: MARCA_DIGITAL, debe: /\bSMART FREE\b/ },
    { nombre: 'Multifocal Smart ONE', crm: /^multifocal smart one\b/i, lensTypeId: 5, brandId: MARCA_DIGITAL, debe: /\bSMART ONE\b/ },
    { nombre: 'Multifocal Smart NEW', crm: /^multifocal smart new\b/i, lensTypeId: 5, brandId: MARCA_DIGITAL, debe: /\bSMART NEW\b/ },
    { nombre: 'Multifocal Smart PRO', crm: /^multifocal smart pro\b/i, lensTypeId: 5, brandId: MARCA_DIGITAL, debe: /\bSMART PRO\b/ },
    { nombre: 'Multifocal Smart EXCLUSIVE', crm: /^multifocal smart exclusive\b/i, lensTypeId: 5, brandId: MARCA_DIGITAL, debe: /\bSMART EXCLUSIVE\b/ },
    { nombre: 'Multifocal Smart DRIVE', crm: /^multifocal smart drive\b/i, lensTypeId: 5, brandId: MARCA_DIGITAL, debe: /\bSMART DRIVE\b/ },
    { nombre: 'Multifocal Smart AI LENS', crm: /^multifocal smart ai ?lens\b/i, lensTypeId: 5, brandId: MARCA_DIGITAL, debe: /\bSMART AILENS\b/ },
    { nombre: 'Ocupacional Office', crm: /^ocupacional office\b/i, lensTypeId: 6, brandId: MARCA_DIGITAL, debe: /\bSMART OFFICE\b/ },
    { nombre: 'Ocupacional Ultra Relax', crm: /^ocupacional ultra relax\b/i, lensTypeId: 1, brandId: MARCA_DIGITAL, debe: /\bRELAX\b/ },
    { nombre: 'Control miopía MyoFix', crm: /^control miop[ií]a myofix\b/i, lensTypeId: 1, brandId: MARCA_DIGITAL, debe: /\bMYOFIX\b/ },
    { nombre: 'Control miopía MyoLens', crm: /^control miop[ií]a myolens\b/i, lensTypeId: 1, brandId: MARCA_DIGITAL, debe: /\bMYOLENS\b/ },
    { nombre: 'Control miopía Majestic DIGITAL', crm: /^control miop[ií]a majestic digital\b/i, lensTypeId: 1, brandId: MARCA_DIGITAL, debe: /\bMAJESTIC DIGITAL\b/ },
    { nombre: 'Control miopía Majestic', crm: /^control miop[ií]a majestic\b/i, lensTypeId: 1, brandId: MARCA_LAB, debe: /\bMAJESTIC\b/, noDebe: /\bDIGITAL\b/ },
    { nombre: 'Monofocal DIGITAL (free-form)', crm: /^monofocal digital\b/i, lensTypeId: 1, brandId: MARCA_DIGITAL, debe: /\bULTRA\b/, noDebe: /\bRELAX\b|\bMYO|\bMAJESTIC\b/ },
    { nombre: 'Monofocal TALLADO (CNC)', crm: /^monofocal tallado\b/i, lensTypeId: 1, brandId: MARCA_LAB, debe: /./, noDebe: /\bMAJESTIC\b|\bLENTICULAR\b|\bDIAM 75\b/ },
    { nombre: 'Bifocal Kriptock Invisible', crm: /^bifocal kriptock invisible\b/i, lensTypeId: 3, brandId: MARCA_DIGITAL, debe: /\bKRIPTOCK INVISIBLE\b/ },
    { nombre: 'Bifocal Kriptock', crm: /^bifocal kriptock\b/i, lensTypeId: 3, brandId: MARCA_LAB, debe: /\bKRIPTOCK\b/, noDebe: /\bINVISIBLE\b/ },
    { nombre: 'Bifocal Flat Top', crm: /^bifocal flat top\b/i, lensTypeId: 4, brandId: MARCA_LAB, debe: /\bF\.T\b/ },
];

/** Color del portal (material/color list). */
export const COLOR = { BLANCO: 1, GRIS: 2, SEPIA: 3, AMARILLO: 4, AZUL: 5, ROJO: 6, ROSA: 7, VERDE: 9, PLATEADO: 10, PURPURA: 17, DORADO: 18 } as const;

/**
 * El color que el vendedor eligió en el ítem (crystalColor) → color del
 * portal, para los materiales que vienen en varios colores (fotocromático
 * Smart Color, foto espejado, polarizado, espejado). El nombre del producto
 * dice qué colores ofrece; el ítem dice cuál se vendió.
 */
const COLOR_DEL_ITEM: [RegExp, number][] = [
    [/\b(gris|grey|gray)\b/i, COLOR.GRIS],
    [/\b(sepia|brown|marr[oó]n|caf[eé])\b/i, COLOR.SEPIA],
    [/\b(verde|green|g-?15)\b/i, COLOR.VERDE],
    [/\b(azul|blue)\b/i, COLOR.AZUL],
    [/\b(rosa|pink)\b/i, COLOR.ROSA],
    [/\b(p[uú]rpura|purple|violeta)\b/i, COLOR.PURPURA],
    [/\b(rojo|red)\b/i, COLOR.ROJO],
    [/\b(plata|plateado|silver)\b/i, COLOR.PLATEADO],
    [/\b(dorado|golden|gold|oro)\b/i, COLOR.DORADO],
    [/\b(amarillo|driver|drive)\b/i, COLOR.AMARILLO],
];

export function colorDelItem(texto: string | null | undefined): number | null {
    const t = String(texto || '');
    for (const [re, c] of COLOR_DEL_ITEM) if (re.test(t)) return c;
    return null;
}

export interface MaterialLab {
    crm: RegExp;
    materialId: number;
    /** Etiqueta exacta en la lista de materiales de laboratorio del portal (se verifica en cada carga). */
    etiqueta: string;
    /** Color fijo; null = lo decide el ítem (colores en `colores`). */
    colorId: number | null;
    colores?: number[];
    /**
     * Lo que la ETIQUETA del artículo tiene que decir (o no) de este material.
     * Hace falta porque el portal lista algunos artículos bajo dos materiales:
     * "MONOF MYOFIX ORG BLUE DIGITAL 1.67" aparece con el 1.67 blanco y con el blue.
     */
    articulo?: RegExp;
    articuloNo?: RegExp;
    /** El portal lo trae siempre con antirreflejo y sin la palabra ESSENTIAL (Anti Age): Essential no distingue. */
    arIncluido?: boolean;
}

/**
 * Material del CRM → material de LABORATORIO del portal. El orden importa:
 * lo más específico primero (foto blue antes que foto, alto índice antes que blanco).
 */
export const MATERIALES_LAB: MaterialLab[] = [
    { crm: /fotocrom[aá]tico.*espejado|foto espejado/i, materialId: 24, etiqueta: 'ORG FOTO ESPEJADO 1.56', colorId: null, colores: [COLOR.AZUL, COLOR.DORADO, COLOR.VERDE, COLOR.PURPURA, COLOR.ROJO, COLOR.PLATEADO] },
    { crm: /fotocrom[aá]tico smart color/i, materialId: 16, etiqueta: 'ORG FOTO 1.56', colorId: null, colores: [COLOR.AZUL, COLOR.PURPURA, COLOR.ROSA, COLOR.SEPIA, COLOR.VERDE] },
    { crm: /policarbonato fotocrom[aá]tico/i, materialId: 21, etiqueta: 'POLI FOTO 1.59', colorId: COLOR.GRIS },
    { crm: /fotocrom[aá]tico.*\bblue\b.*1\.56/i, materialId: 33, etiqueta: 'ORG FOTO BLUE 1.56', colorId: COLOR.GRIS },
    { crm: /fotocrom[aá]tico.*(alto [ií]ndice 1\.60|1\.60)/i, materialId: 36, etiqueta: 'ORG FOTO ALTO INDICE 1.6', colorId: COLOR.GRIS },
    { crm: /fotocrom[aá]tico.*1\.67/i, materialId: 17, etiqueta: 'ORG FOTO 1.67', colorId: COLOR.GRIS },
    { crm: /fotocrom[aá]tico.*1\.56/i, materialId: 16, etiqueta: 'ORG FOTO 1.56', colorId: COLOR.GRIS },
    { crm: /polarizado/i, materialId: 22, etiqueta: 'ORG POLARIZADO 1.49', colorId: null, colores: [COLOR.GRIS, COLOR.SEPIA, COLOR.VERDE, COLOR.AMARILLO] },
    { crm: /espejado/i, materialId: 29, etiqueta: 'ORG ESPEJADO 1.49', colorId: null, colores: [COLOR.AZUL, COLOR.PLATEADO] },
    { crm: /anti age/i, materialId: 37, etiqueta: 'ORG BLUE ANTI AGE 1.60', colorId: COLOR.BLANCO, arIncluido: true },
    { crm: /super blue.*1\.60/i, materialId: 28, etiqueta: 'ORG SUPER BLUE 1.60', colorId: COLOR.BLANCO },
    { crm: /blue light.*1\.67/i, materialId: 31, etiqueta: 'ORG BLUE ALTO INDICE 1.67', colorId: COLOR.BLANCO, articulo: /\bBLUE\b/ },
    { crm: /policarbonato blue/i, materialId: 27, etiqueta: 'POLI BLUE 1.59', colorId: COLOR.BLANCO },
    { crm: /policarbonato/i, materialId: 6, etiqueta: 'POLI BLANCO 1.59', colorId: COLOR.BLANCO },
    { crm: /blue light( cut)? 1\.56/i, materialId: 20, etiqueta: 'ORG BLUE LIGHT 1.56', colorId: COLOR.BLANCO },
    { crm: /(alto [ií]ndice|stylis blanco)\s*1\.74/i, materialId: 15, etiqueta: 'ORG ALTO INDICE 1.74', colorId: COLOR.BLANCO },
    { crm: /(alto [ií]ndice|stylis blanco)\s*1\.67/i, materialId: 5, etiqueta: 'ORG ALTO INDICE 1.67', colorId: COLOR.BLANCO, articuloNo: /\bBLUE\b/ },
    { crm: /stylis blue light 1\.67/i, materialId: 31, etiqueta: 'ORG BLUE ALTO INDICE 1.67', colorId: COLOR.BLANCO, articulo: /\bBLUE\b/ },
    { crm: /blanco alto [ií]ndice 1\.60/i, materialId: 35, etiqueta: 'ORG ALTO INDICE 1.60', colorId: COLOR.BLANCO },
    { crm: /mineral blanco/i, materialId: 1, etiqueta: 'MINERAL CROWN 1.53', colorId: COLOR.BLANCO },
    { crm: /org[aá]nico blanco( hasta di[aá]m\. 70)? 1\.49|org[aá]nico blanco 1\.5\b/i, materialId: 3, etiqueta: 'ORG BLANCO 1.49', colorId: COLOR.BLANCO },
];

/** El material del 2º par de sol (y de todo cristal que se tiñe): el único que el portal tiñe. */
export const MATERIAL_TENIBLE: MaterialLab = MATERIALES_LAB.find(m => m.materialId === 3)!;

export interface MaterialStock {
    crm: RegExp;
    /** Id en la lista de materiales de STOCK (lo que va en `materialId` del pedido). */
    materialId: number;
    etiqueta: string;
    /** Código con el que el portal busca los cristales de esa línea en article/list. */
    codigoArticulos: number;
    /** Lo que tiene que decir la etiqueta del cristal de stock. */
    debe: RegExp;
}

/** Stock: relevado el 3/10/2026 consultando article/list con una graduación común. */
export const MATERIALES_STOCK: MaterialStock[] = [
    { crm: /super blue.*1\.60/i, materialId: 14, etiqueta: 'Org S.Blue c/Ar 1.60', codigoArticulos: 34, debe: /^ORG SUPER BLUE ASF C\/AR\.? 1\.60\b/ },
    { crm: /fotocrom[aá]tico.*1\.56/i, materialId: 26, etiqueta: 'Org Foto C/ar 1.56', codigoArticulos: 35, debe: /^ORG FOTO GRIS C\/AR 1\.56\b/ },
    { crm: /blue c\/ar 1\.56/i, materialId: 8, etiqueta: 'Org Blue c/Ar 1.56', codigoArticulos: 33, debe: /^ORG BLUE C\/AR 1\.56\b/ },
    { crm: /blanco c\/ar 1\.56/i, materialId: 19, etiqueta: 'Org c/Ar 1.56', codigoArticulos: 32, debe: /^ORG C\/AR BLANCO 1\.56\b/ },
    { crm: /policarbonato( blanco)? 1\.59 \(sin antirreflejo\)/i, materialId: 6, etiqueta: 'Poli Blanco 1.59', codigoArticulos: 40, debe: /^POLI BLANCO 1\.59\b/ },
    { crm: /policarbonato c\/ar/i, materialId: 7, etiqueta: 'Poli Blanco C/ar', codigoArticulos: 41, debe: /^POLI C\/AR BLANCO 1\.59\b/ },
    { crm: /org[aá]nico blanco 1\.49/i, materialId: 3, etiqueta: 'Org Blanco 1.49', codigoArticulos: 31, debe: /^ORG BLANCO 1\.49\b/ },
    { crm: /mineral blanco/i, materialId: 1, etiqueta: 'Mineral Blanco', codigoArticulos: 57, debe: /^MINERAL BLANCO\b/ },
];

export interface EspecificacionLab {
    clase: 'LAB';
    familia: Familia;
    material: MaterialLab;
    colorId: number;
    essential: boolean;
    /** true si se cambió al material teñible (2º par de sol, o un teñido). */
    pasoATenible: boolean;
}

export interface EspecificacionStock {
    clase: 'STOCK';
    material: MaterialStock;
    rangoExtendido: boolean;
}

export type Especificacion = EspecificacionLab | EspecificacionStock;

export type Resolucion = { ok: true; especificacion: Especificacion } | { ok: false; motivo: string };

// "Familia · Material [· Essential]"; unos pocos productos viejos usan " - ".
const partes = (nombre: string): string[] => (nombre.includes('·') ? nombre.split('·') : nombre.split(/\s+-\s+/)).map(p => p.trim());
const familiaDe = (nombre: string): string => partes(nombre)[0] || '';
const materialDe = (nombre: string): string => partes(nombre)[1] || '';

/**
 * Qué hay que pedirle al portal para un producto del CRM. Puro.
 * `colorItem`: el color elegido en el ítem (crystalColor) para los materiales
 * que vienen en varios. `conTenido`: el par lleva teñido (sol): el portal
 * solo tiñe Orgánico Blanco 1.49.
 */
export function especificacionDe(nombreProducto: string | null | undefined, opts: { colorItem?: string | null; conTenido?: boolean } = {}): Resolucion {
    const nombre = String(nombreProducto || '').replace(/\s+/g, ' ').trim();
    if (!nombre) return { ok: false, motivo: 'el cristal no tiene nombre de producto' };
    const fam = familiaDe(nombre);
    const mat = materialDe(nombre);

    if (/^stock\b/i.test(fam)) {
        if (opts.conTenido) return { ok: false, motivo: `"${nombre}" es de stock y el portal no tiñe cristales de stock: hay que venderlo de laboratorio en Orgánico Blanco 1.49` };
        const ms = MATERIALES_STOCK.find(m => m.crm.test(mat));
        if (!ms) return { ok: false, motivo: `"${nombre}": no hay equivalencia de stock declarada para "${mat}" (src/services/lab-modules/grupo-optico/catalogo.ts)` };
        return { ok: true, especificacion: { clase: 'STOCK', material: ms, rangoExtendido: /rango extendido/i.test(nombre) } };
    }

    const familia = FAMILIAS.find(f => f.crm.test(fam));
    if (!familia) return { ok: false, motivo: `"${nombre}": la familia "${fam}" no tiene equivalencia en SmartLab declarada (catalogo.ts)` };

    const essential = /·\s*essential\b/i.test(nombre);
    let material = MATERIALES_LAB.find(m => m.crm.test(mat));
    if (!material) return { ok: false, motivo: `"${nombre}": el material "${mat}" no tiene equivalencia en SmartLab declarada (catalogo.ts)` };

    let pasoATenible = false;
    if (opts.conTenido && material.materialId !== MATERIAL_TENIBLE.materialId) {
        // Regla del portal: solo ORG BLANCO 1.49 acepta teñido. Así se cargó
        // siempre el 2º par de sol del 2x1 (22 de 22 casos, 3/10/2026).
        material = MATERIAL_TENIBLE;
        pasoATenible = true;
    }

    let colorId = material.colorId;
    if (colorId === null) {
        const c = colorDelItem(opts.colorItem);
        if (c === null || !material.colores?.includes(c)) {
            return { ok: false, motivo: `"${nombre}" viene en varios colores y el ítem no dice cuál (${opts.colorItem ? `dice "${opts.colorItem}"` : 'sin color cargado'})` };
        }
        colorId = c;
    }
    // Un teñido va sobre cristal blanco: el color lo pone el teñido.
    if (pasoATenible) colorId = COLOR.BLANCO;
    return { ok: true, especificacion: { clase: 'LAB', familia, material, colorId, essential: essential && !pasoATenible, pasoATenible } };
}

export interface ArticuloPortal { value: string; label: string }

/**
 * El ÚNICO artículo de la lista del portal que corresponde. La lista ya viene
 * filtrada por tipo, material, color y marca; acá se aplica la familia y el
 * Essential (y para stock, la línea). Puro.
 */
export function elegirArticulo(lista: ArticuloPortal[], esp: Especificacion): { ok: true; articulo: ArticuloPortal } | { ok: false; motivo: string } {
    const norm = (s: string) => s.toUpperCase().replace(/\s+/g, ' ').trim();
    let candidatos: ArticuloPortal[];
    if (esp.clase === 'STOCK') {
        candidatos = lista.filter(a => esp.material.debe.test(norm(a.label)) && (esp.rangoExtendido ? /R\. ?EXT/.test(norm(a.label)) : /\bSTOCK\b/.test(norm(a.label))));
        if (candidatos.length === 0 && !esp.rangoExtendido) {
            // Fuera del rango de stock: el portal lo ofrece como rango extendido.
            const ext = lista.filter(a => esp.material.debe.test(norm(a.label)) && /R\. ?EXT/.test(norm(a.label)));
            if (ext.length === 1) return { ok: false, motivo: `esa graduación no está en stock: el portal solo la tiene en rango extendido (${ext[0].label}); hay que venderla como rango extendido` };
        }
    } else {
        candidatos = lista.filter(a => {
            const l = norm(a.label);
            if (!esp.familia.debe.test(l)) return false;
            if (esp.familia.noDebe?.test(l)) return false;
            if (esp.material.articulo && !esp.material.articulo.test(l)) return false;
            if (esp.material.articuloNo?.test(l)) return false;
            return esp.material.arIncluido || /ESSENTIAL/.test(l) === esp.essential;
        });
    }
    if (candidatos.length === 1) return { ok: true, articulo: candidatos[0] };
    const vistos = lista.map(a => a.label).join(' · ') || 'ninguno';
    return candidatos.length === 0
        ? { ok: false, motivo: `el portal no ofrece un artículo que corresponda (ofrece: ${vistos})` }
        : { ok: false, motivo: `el portal ofrece ${candidatos.length} artículos que corresponden y no se elige al azar: ${candidatos.map(c => c.label).join(' · ')}` };
}

/** Teñido: tipo (por el estilo del producto) y color (los ids del desplegable del portal, mismo orden que TONOS_TENIDO). */
export const TENIDO_TIPO: Record<'COMPACTO' | 'DEGRADE' | 'MUESTRA', string> = {
    COMPACTO: 'Color Compacto',
    DEGRADE: 'Color Degradee',
    MUESTRA: 'Color Segun Muestra',
};
export const TENIDO_COLOR: Record<string, number> = { Gris: 1, Verde: 2, Sepia: 3, G15: 4, 'Nigth Drive': 5, Azul: 6, Rosa: 7, Rojo: 8 };
export const TENIDO_INTENSIDADES = ['0.5', '1', '2', '3', '4'];

/** Tipo de armazón del portal: el desplegable dice PLÁSTICO / METALICO y manda ZILO / METALICO. */
export const TIPO_ARMAZON: Record<'PLASTICO' | 'METALICO', string> = { PLASTICO: 'ZILO', METALICO: 'METALICO' };
/** Tipo de aro (typeRim): el id es fijo; el artículo cambia entre stock y laboratorio y se lee del portal. */
export const TIPO_ARO: Record<'ENTERO' | 'RANURADO' | 'PERFORADO', { id: number; etiqueta: string }> = {
    ENTERO: { id: 1, etiqueta: 'Calibrado Aro Entero' },
    RANURADO: { id: 2, etiqueta: 'Calibrado Ranurado' },
    PERFORADO: { id: 3, etiqueta: 'Calibrado Perforado' },
};
