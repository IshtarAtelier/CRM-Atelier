import { PRODUCTOS_OVES, type ClaseDePedidoOves, type ProductoOves } from '../../../lib/laboratorios/oves-catalogo';

/**
 * LA EQUIVALENCIA PRODUCTO DEL CRM → PRODUCTO DE OVES (portal de Optovisión).
 *
 * En OVES un producto es diseño + material + variante (liso / Blue UV /
 * Transitions GenS <color> / Xperio <color> / Acclimates), elegido en un
 * autocompletar de 685 opciones (lib/laboratorios/oves-catalogo.ts, relevado
 * el 19/10/2026). El tratamiento (Crizal, Numax, sin tratamiento) NO es parte
 * del producto: es un servicio aparte del formulario.
 *
 * Acá la equivalencia se DECLARA, nunca se adivina:
 *  · el nombre del CRM dice la FAMILIA (Varilux Comfort, Eyezen Start, Kodak
 *    SV Digital, Monofocal de laboratorio…), el MATERIAL (Orma, Airwear 1.59,
 *    Stylis 1.67…) y la VARIANTE (Blue UV, Transitions Gen S, Xperio…);
 *  · cada combinación tiene UN código de variante del portal (`cod`): 21/20/C0
 *    liso, WR/WS/WT Blue UV, YE/YF… Transitions por material y color, DS/DE/DW
 *    Xperio, 95 Acclimates; los de laboratorio tradicional y stock, uno por
 *    producto;
 *  · con (clase, línea, material, cod) tiene que quedar EXACTAMENTE un producto
 *    del catálogo. Cero o más de uno = no se carga y se dice qué se vio.
 *
 * Lo que el CRM vende y OVES no tiene (Stellest, Antiage, BLC 1.56 de
 * laboratorio, los "Rango Extendido" que el portal no lista…) se declara en
 * `aMano`: la ficha lo anuncia y el pedido se carga a mano, como los 8
 * cristales de Grupo Óptico (Ishtar, 15/10/2026).
 *
 * PURO: lo fija `npm run check:carga-optovision`.
 */

export type TipoDeLente = 'MONOFOCAL' | 'MULTIFOCAL' | 'OCUPACIONAL' | 'BIFOCAL';
export type Material = 'ORMA' | 'AIRWEAR' | 'STYLIS' | 'ORGANICO' | 'POLICARBONATO';
export type Variante = 'LISO' | 'BLUE_UV' | 'TRANSITIONS' | 'XTRACTIVE' | 'XPERIO' | 'ACCLIMATES';
/** Qué tratamiento implica el nombre del CRM: "+ CRIZAL" (cuál, lo elige quien prepara), "+ AR NUMAX", "— SIN ANTIRREFLEJO", o viene puesto de fábrica (stock con Crizal/Multicot/Numax). */
export type Tratamiento = 'CRIZAL' | 'NUMAX' | 'SIN' | 'INCLUIDO';

/** Color de un Transitions / Xperio como lo escribe OVES en el nombre del producto. */
export type ColorOves = 'Gris' | 'Café' | 'Amatista' | 'Ambar' | 'Esmerald' | 'Gris-verde' | 'Ruby' | 'Zafiro';

/** El tono que eligió el vendedor en la venta (`crystalColor`, TONOS de paletas-color.ts) → color de OVES. Puro. */
export function colorOvesDe(crystalColor: string | null | undefined): ColorOves | null {
    const c = normalizar(crystalColor);
    if (!c) return null;
    if (/^gris$|^gray|^grey/.test(c)) return 'Gris';
    if (/cafe|marron|brown/.test(c)) return 'Café';
    if (/amatista|amethyst|morado/.test(c)) return 'Amatista';
    if (/ambar|amber/.test(c)) return 'Ambar';
    // "Verde / Esmeralda" del CRM es el Emerald de Transitions; "Verde grafito" es el Graphite Green ("Gris-verde" en OVES).
    if (/grafito|graphite|gris ?verde|gris-verde/.test(c)) return 'Gris-verde';
    if (/esmerald|verde|emerald/.test(c)) return 'Esmerald';
    if (/rubi|ruby|rojo|rosado/.test(c)) return 'Ruby';
    if (/zafiro|sapphire|azul/.test(c)) return 'Zafiro';
    return null;
}

/** Códigos de variante de los diseños de tallado digital (RXTD), por material y color. */
const COD_RXTD: Record<Variante, Partial<Record<Material, string | Partial<Record<ColorOves, string>>>>> = {
    LISO: { ORMA: '21', AIRWEAR: '20', STYLIS: 'C0' },
    BLUE_UV: { ORMA: 'WR', AIRWEAR: 'WS', STYLIS: 'WT' },
    ACCLIMATES: { ORMA: '95' },
    XTRACTIVE: { ORMA: { Gris: 'BY' } },
    TRANSITIONS: {
        ORMA: { Gris: 'YE', 'Café': 'YF', Amatista: 'YI', Ambar: 'YJ', Esmerald: 'YK', 'Gris-verde': 'YG', Ruby: 'YL', Zafiro: 'YH' },
        AIRWEAR: { Gris: 'YC', 'Café': 'YD' },
        STYLIS: { Gris: 'Y9', 'Café': 'YA' },
    },
    XPERIO: { ORMA: { Gris: 'DS', 'Café': 'DE', 'Gris-verde': 'DW' }, AIRWEAR: { Gris: 'BW', 'Café': 'DT' } },
};

/** Varilux XR (línea S/T): códigos propios, Design y Pro aparte. */
const COD_XR: Record<'DESIGN' | 'PRO', Record<Material, Partial<Record<'LISO' | 'TRANSITIONS' | 'XPERIO', string | Partial<Record<ColorOves, string>>>>>> = {
    DESIGN: {
        AIRWEAR: { LISO: 'Q0', TRANSITIONS: { 'Café': 'QP', Gris: 'QK' }, XPERIO: { 'Café': 'QU', Gris: 'QT' } },
        ORMA: { LISO: 'QM', TRANSITIONS: { 'Café': 'QR', Gris: 'QL', 'Gris-verde': 'QS' }, XPERIO: { 'Café': 'QQ', Gris: 'QO' } },
        STYLIS: { LISO: 'QN', TRANSITIONS: { Gris: 'QJ' } },
        ORGANICO: {}, POLICARBONATO: {},
    },
    PRO: {
        AIRWEAR: { LISO: 'SK', TRANSITIONS: { 'Café': 'SX', Gris: 'SM' }, XPERIO: { 'Café': 'SZ', Gris: 'SY' } },
        ORMA: { LISO: 'SQ', TRANSITIONS: { 'Café': 'SU', Gris: 'SN', 'Gris-verde': 'SV' }, XPERIO: { 'Café': 'SW', Gris: 'ST' } },
        STYLIS: { LISO: 'SS', TRANSITIONS: { Gris: 'SL' } },
        ORGANICO: {}, POLICARBONATO: {},
    },
};

/** Monofocales / bifocales de laboratorio tradicional (RXTT) y stock (RXSA), un código por producto. */
const COD_TRADICIONAL: Record<string, string> = {
    // Blue UV Filter System (monofocal de laboratorio con Blue UV)
    'BLUEUV:ORMA': 'WR', 'BLUEUV:AIRWEAR': 'WS', 'BLUEUV:STYLIS': 'WT',
    // Monofocal de laboratorio liso: OVES solo lista Stylis 1.67 (C0); Orma y Airwear lisos no existen (ver aMano).
    'MONOLAB:STYLIS': 'C0',
    // Transitions Gen S tallado (monofocal de laboratorio), por material y color
    'TRANS:ORMA:Gris': 'YE', 'TRANS:ORMA:Café': 'YF', 'TRANS:ORMA:Amatista': 'YI', 'TRANS:ORMA:Ambar': 'YJ', 'TRANS:ORMA:Esmerald': 'YK', 'TRANS:ORMA:Gris-verde': 'YG', 'TRANS:ORMA:Ruby': 'YL', 'TRANS:ORMA:Zafiro': 'YH',
    'TRANS:AIRWEAR:Gris': 'YC', 'TRANS:AIRWEAR:Café': 'YD', 'TRANS:STYLIS:Gris': 'Y9', 'TRANS:STYLIS:Café': 'YA',
    'XTRACTIVE:ORMA:Gris': 'BY',
    // Xperio (polarizado) monofocal de laboratorio
    'XPERIO:ORMA:Gris': 'DS', 'XPERIO:ORMA:Café': 'DE', 'XPERIO:ORMA:Gris-verde': 'DW', 'XPERIO:AIRWEAR:Gris': 'BW', 'XPERIO:AIRWEAR:Café': 'DT',
    // Interview (ocupacional tradicional)
    'INTERVIEW:ORMA': '15', 'INTERVIEW:AIRWEAR': 'DA',
};

/** Productos de marca Optovisión ("Familia · Material …"): nombre del CRM (normalizado, sin el sufijo de tratamiento) → clase y código. */
const OPTOVISION_PROPIOS: { crm: RegExp; clase: ClaseDePedidoOves; cod: string; tipo: TipoDeLente }[] = [
    { crm: /^monofocal de laboratorio · cr 39 blanco 1\.50/, clase: 'RXTT', cod: '16', tipo: 'MONOFOCAL' },
    { crm: /^monofocal de laboratorio · alto indice 1\.74/, clase: 'RXTT', cod: '85', tipo: 'MONOFOCAL' },
    { crm: /^monofocal de laboratorio · cr 39 polarizado/, clase: 'RXTT', cod: 'M5', tipo: 'MONOFOCAL' },
    { crm: /^monofocal de laboratorio · fotosensible blue light cut/, clase: 'RXTT', cod: '37', tipo: 'MONOFOCAL' },
    { crm: /^monofocal de laboratorio · fotosensible 1\.56/, clase: 'RXTT', cod: 'FM', tipo: 'MONOFOCAL' },
    { crm: /^monofocal de laboratorio · policast esferico/, clase: 'RXTT', cod: '17', tipo: 'MONOFOCAL' },
    { crm: /^monofocal de laboratorio · policast blue light cut/, clase: 'RXTT', cod: 'L9', tipo: 'MONOFOCAL' },
    { crm: /^monofocal de laboratorio · policast fotocromatico/, clase: 'RXTT', cod: '96', tipo: 'MONOFOCAL' },
    { crm: /^bifocal flat top · blanco/, clase: 'RXTT', cod: '22', tipo: 'BIFOCAL' },
    { crm: /^bifocal flat top · blue light cut/, clase: 'RXTT', cod: 'LO', tipo: 'BIFOCAL' },
    { crm: /^bifocal flat top · fotosensible/, clase: 'RXTT', cod: 'FS', tipo: 'BIFOCAL' },
    { crm: /^bifocal flat top · policarbonato blanco/, clase: 'RXTT', cod: 'L4', tipo: 'BIFOCAL' },
    { crm: /^bifocal flat top · policarbonato life rx/, clase: 'RXTT', cod: 'L5', tipo: 'BIFOCAL' },
    { crm: /^bifocal flat top · transitions signature gen8/, clase: 'RXTT', cod: 'TJ', tipo: 'BIFOCAL' },
    { crm: /^bifocal kriptock · blanco/, clase: 'RXTT', cod: 'LC', tipo: 'BIFOCAL' },
    { crm: /^pro-line · cr 39 blanco blc/, clase: 'RXTT', cod: '12', tipo: 'MULTIFOCAL' },
    { crm: /^pro-line · cr 39 blanco/, clase: 'RXTT', cod: 'LF', tipo: 'MULTIFOCAL' },
    { crm: /^stock optovision · blc hmc 1\.56 · rango extendido/, clase: 'RXSA', cod: '84', tipo: 'MONOFOCAL' },
    { crm: /^stock optovision · multicot max 1\.50 · rango extendido/, clase: 'RXSA', cod: '58', tipo: 'MONOFOCAL' },
    { crm: /^stock optovision · multicot max 1\.50$/, clase: 'RXSA', cod: 'LM', tipo: 'MONOFOCAL' },
    { crm: /^stock optovision · numax 1\.50$/, clase: 'RXSA', cod: 'NM', tipo: 'MONOFOCAL' },
    { crm: /^stock optovision · cr 39 1\.50$/, clase: 'RXSA', cod: 'OR', tipo: 'MONOFOCAL' },
    { crm: /^stock optovision · cr 39 fotocromatico con multicot 1\.50$/, clase: 'RXSA', cod: 'FT', tipo: 'MONOFOCAL' },
    { crm: /^stock optovision · cr 39 iron/, clase: 'RXSA', cod: 'IR', tipo: 'MONOFOCAL' },
    { crm: /^stock optovision · hd super hmc asferico blc uv420 1\.61$/, clase: 'RXSA', cod: '4A', tipo: 'MONOFOCAL' },
    { crm: /^stock optovision · policarbonato blanco con multicot/, clase: 'RXSA', cod: 'P2', tipo: 'MONOFOCAL' },
    { crm: /^stock optovision · policarbonato blanco 1\.59$/, clase: 'RXSA', cod: 'P1', tipo: 'MONOFOCAL' },
    { crm: /^stock optovision · policarbonato blue cut con numax/, clase: 'RXSA', cod: '28', tipo: 'MONOFOCAL' },
    { crm: /^stock optovision · policarbonato fotocromatico con numax/, clase: 'RXSA', cod: '44', tipo: 'MONOFOCAL' },
    { crm: /^monofocal de stock - orma$/, clase: 'RXSA', cod: '24', tipo: 'MONOFOCAL' },
    { crm: /^lente de stock - orma blue uv crizal sapphire hr/, clase: 'RXSA', cod: 'TD', tipo: 'MONOFOCAL' },
    { crm: /^transitions gen s - orma \(stock\)/, clase: 'RXSA', cod: 'YS', tipo: 'MONOFOCAL' },
];

/**
 * Lo que el CRM vende y OVES no ofrece (relevado contra las 685 filas del
 * portal, 19/10/2026): se carga a mano. Cada entrada dice POR QUÉ, para que la
 * ficha lo anuncie y nadie busque un botón que no está.
 */
const A_MANO: { crm: RegExp; motivo: string }[] = [
    { crm: /stellest/, motivo: 'Stellest no está en el catálogo de OVES (Optovisión lo toma por otro canal)' },
    { crm: /antiage/, motivo: 'los Antiage 1.60 no figuran en el catálogo de OVES' },
    { crm: /^monofocal de laboratorio · cr 39 blue light cut/, motivo: 'OVES no tiene un Cr 39 Blue Light Cut de laboratorio (solo el BLC HMC 1.56 de stock)' },
    { crm: /^monofocal de laboratorio · fotosensible espejado/, motivo: 'OVES no lista el Fotosensible Espejado de laboratorio' },
    { crm: /^monofocal de laboratorio · policast polarizado/, motivo: 'OVES no lista el POLICAST Polarizado Espejado' },
    { crm: /^stock optovision · (blc hmc 1\.56$|numax 1\.50 · rango|cr 39 1\.50 · rango|cr 39 fotocromatico con multicot 1\.50 · rango|hd super hmc asferico blc uv420 1\.61 · rango|blc hmc fotosensible)/, motivo: 'esa variante de stock (con o sin rango extendido) no figura con ese nombre en OVES' },
    { crm: /^hd mr7/, motivo: 'el HD MR7 no figura en el catálogo de OVES' },
    { crm: /^monofocal de laboratorio - (orma|airwear)/, motivo: 'OVES no tiene "Monofocal de laboratorio" Orma ni Airwear sin Blue UV (solo CR 39 Blanco o la versión Blue UV): confirmar con Optovisión cuál corresponde' },
    { crm: /^blue uv filter system - orma — sin antirreflejo/, motivo: 'un Orma Blue UV sin antirreflejo se pide a Optovisión como CR 39 Blanco o con tratamiento: confirmar antes de cargar' },
];

/** Diseños de tallado digital: familia del CRM → línea del portal. `eleccion` dice qué tiene que elegir quien prepara. */
interface FamiliaRXTD { crm: RegExp; linea: string | ((eleccion: Eleccion) => string | null); nombre: string; tipo: TipoDeLente; eleccion?: { clave: string; etiqueta: string; opciones: { value: string; label: string }[] } }
export interface Eleccion { potenciaBoost?: string | null; corredorPrecise?: string | null }

export const FAMILIAS_RXTD: FamiliaRXTD[] = [
    { nombre: 'Varilux Comfort Max', crm: /^varilux comfort max\b/, linea: 'VXCM', tipo: 'MULTIFOCAL' },
    { nombre: 'Varilux Comfort', crm: /^varilux comfort\b/, linea: 'VXCO', tipo: 'MULTIFOCAL' },
    { nombre: 'Varilux Physio 3.0', crm: /^varilux physio 3\.0\b/, linea: 'VP30', tipo: 'MULTIFOCAL' },
    { nombre: 'Varilux Physio', crm: /^varilux physio\b/, linea: 'VXPH', tipo: 'MULTIFOCAL' },
    { nombre: 'Varilux Liberty 3.0', crm: /^varilux liberty 3\.0\b/, linea: 'VL30', tipo: 'MULTIFOCAL' },
    { nombre: 'Varilux Liberty', crm: /^varilux liberty\b/, linea: 'VXLI', tipo: 'MULTIFOCAL' },
    { nombre: 'Eyezen Start', crm: /^eyezen start\b/, linea: 'EYST', tipo: 'MONOFOCAL' },
    { nombre: 'Eyezen Kids', crm: /^eyezen kids\b/, linea: 'EYKS', tipo: 'MONOFOCAL' },
    {
        nombre: 'Eyezen Boost', crm: /^eyezen boost\b/, tipo: 'MONOFOCAL',
        linea: e => ({ '0.4': 'EYB4', '0.6': 'EYB6', '0.85': 'EYB8' } as Record<string, string>)[String(e.potenciaBoost ?? '')] ?? null,
        eleccion: { clave: 'potenciaBoost', etiqueta: 'Potencia del Eyezen Boost', opciones: [{ value: '0.4', label: '0.4' }, { value: '0.6', label: '0.6' }, { value: '0.85', label: '0.85' }] },
    },
    { nombre: 'Espace Plus Digital', crm: /^espace plus digital\b/, linea: 'ESPL', tipo: 'OCUPACIONAL' },
    { nombre: 'Myopilux Lite', crm: /^myopilux kids lite\b/, linea: 'MYLI', tipo: 'MONOFOCAL' },
    { nombre: 'Myopilux Plus', crm: /^myopilux kids plus\b/, linea: 'MYPL', tipo: 'MONOFOCAL' },
    { nombre: 'Kodak SV Digital', crm: /^kodak sv digital\b/, linea: 'KOSI', tipo: 'MONOFOCAL' },
    {
        nombre: 'Kodak Precise Next', crm: /^kodak precise\b/, tipo: 'MULTIFOCAL',
        linea: e => ({ LARGE: 'KPNL', SHORT: 'KPNS' } as Record<string, string>)[String(e.corredorPrecise ?? '').toUpperCase()] ?? null,
        eleccion: { clave: 'corredorPrecise', etiqueta: 'Corredor del Kodak Precise Next', opciones: [{ value: 'LARGE', label: 'Large (estándar)' }, { value: 'SHORT', label: 'Short (armazón bajo)' }] },
    },
    { nombre: 'Kodak Unique Dro', crm: /^kodak unique dro\b/, linea: 'KOUN', tipo: 'MULTIFOCAL' },
    { nombre: 'Kodak Softwear', crm: /^kodak softwear\b/, linea: 'KOSO', tipo: 'OCUPACIONAL' },
    { nombre: 'Sygnus ONE', crm: /^sygnus monofocal one\b/, linea: 'SYSV', tipo: 'MONOFOCAL' },
    { nombre: 'Sygnus Driver', crm: /^sygnus driver\b/, linea: 'SYDR', tipo: 'MONOFOCAL' },
    { nombre: 'Sygnus Bifocal', crm: /^sygnus bifocal\b/, linea: 'SYBI', tipo: 'BIFOCAL' },
    { nombre: 'Sygnus New Edition', crm: /^essilor new editions?\b/, linea: 'SYGN', tipo: 'MULTIFOCAL' },
    { nombre: 'Pro-Line Digital TDI', crm: /^pro-line digital tdi\b/, linea: 'PROL', tipo: 'MULTIFOCAL' },
];

export interface EspecificacionOves {
    clase: ClaseDePedidoOves;
    producto: ProductoOves;
    familia: string;
    tipo: TipoDeLente;
    material: Material | null;
    variante: Variante;
    color: ColorOves | null;
    tratamiento: Tratamiento;
    /** "2x1" en el nombre: la promo doble de Optovisión (Doble Disfrute Varilux / 2x1 Kodak / 2x1 Sygnus…). */
    esPromo2x1: boolean;
    /** "Mi primer Varilux / Kodak": promo con cupón, un solo par. */
    esMiPrimer: boolean;
    /** Lo que conviene que la persona sepa de la equivalencia (p. ej. "liso → Blue UV, el único que OVES ofrece"). */
    avisos: string[];
}

export type ResolucionOves =
    | { ok: true; especificacion: EspecificacionOves }
    | { ok: false; motivo: string; aMano: boolean; eleccion?: FamiliaRXTD['eleccion'] };

/** Sin acentos, minúsculas, espacios simples. Puro. */
export function normalizar(s: string | null | undefined): string {
    return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** El material que nombra un texto (del CRM o del catálogo). Puro. */
export function materialDe(texto: string | null | undefined): Material | null {
    const t = normalizar(texto).replace(/[^a-z0-9. ]/g, '');
    if (/\bai?r?wear\b/.test(t) || /\bairwear/.test(t)) return 'AIRWEAR';
    if (/\bstylis\b/.test(t)) return 'STYLIS';
    if (/\borma\b/.test(t)) return 'ORMA';
    if (/policarbon/.test(t)) return 'POLICARBONATO';
    if (/organic/.test(t)) return 'ORGANICO';
    return null;
}

/** Cómo el nombre del CRM nombra el tratamiento. Puro. */
export function tratamientoDe(nombreNormalizado: string): Tratamiento {
    if (/\+ ar numax/.test(nombreNormalizado)) return 'NUMAX';
    if (/sin antirreflejo/.test(nombreNormalizado)) return 'SIN';
    if (/\+ crizal/.test(nombreNormalizado)) return 'CRIZAL';
    return 'INCLUIDO';
}

/** La variante del material que dice el nombre del CRM. Puro. */
export function varianteDe(nombreNormalizado: string): Variante {
    if (/xtractive/.test(nombreNormalizado)) return 'XTRACTIVE';
    if (/transitions/.test(nombreNormalizado)) return 'TRANSITIONS';
    if (/xperio/.test(nombreNormalizado)) return 'XPERIO';
    if (/acclimates/.test(nombreNormalizado)) return 'ACCLIMATES';
    if (/blue uv/.test(nombreNormalizado)) return 'BLUE_UV';
    return 'LISO';
}

/** El color que viene escrito en el nombre del CRM ("Xperio Gris", "Transitions XTRActive Gris"); null si no lo dice. Puro. */
function colorEnElNombre(nombreNormalizado: string): ColorOves | null {
    const m = nombreNormalizado.match(/(?:xperio|xtractive|gen s|gen8)\s+(gris|cafe|verde|zafiro|ambar|amatista|rub[ií]|grafito)\b/);
    return m ? colorOvesDe(m[1]) : null;
}

/** El código de una celda de la tabla: fijo, o por color; con UN solo color posible (Xtractive Gris) no hace falta elegirlo. Puro. */
function codDeCelda(celda: string | Partial<Record<ColorOves, string>> | undefined, color: ColorOves | null): { cod: string | null; pideColor: string[] } {
    if (!celda) return { cod: null, pideColor: [] };
    if (typeof celda === 'string') return { cod: celda, pideColor: [] };
    const colores = Object.keys(celda) as ColorOves[];
    if (colores.length === 1) return { cod: celda[colores[0]] ?? null, pideColor: [] };
    if (color && celda[color]) return { cod: celda[color]!, pideColor: [] };
    return { cod: null, pideColor: colores };
}

function lineaDe(f: FamiliaRXTD, eleccion: Eleccion): string | null {
    return typeof f.linea === 'string' ? f.linea : f.linea(eleccion);
}

/** Un solo producto del catálogo para la clave; si no, por qué. Puro. */
export function elegirProductoOves(clave: { clase: ClaseDePedidoOves; linea: string; cod: string; material?: Material | null }): { ok: true; producto: ProductoOves } | { ok: false; motivo: string } {
    const candidatos = PRODUCTOS_OVES.filter(p => p.clase === clave.clase && p.linea === clave.linea && p.cod === clave.cod && (!clave.material || materialDe(p.material) === clave.material));
    if (candidatos.length === 1) return { ok: true, producto: candidatos[0] };
    if (candidatos.length === 0) {
        const vecinos = PRODUCTOS_OVES.filter(p => p.clase === clave.clase && p.linea === clave.linea && (!clave.material || materialDe(p.material) === clave.material)).map(p => p.label);
        return { ok: false, motivo: `OVES no tiene ${clave.clase} ${clave.linea} ${clave.material ?? ''} con variante ${clave.cod}${vecinos.length ? ` (ofrece: ${vecinos.slice(0, 8).join(' / ')}${vecinos.length > 8 ? '…' : ''})` : ''}`.replace(/\s+/g, ' ') };
    }
    return { ok: false, motivo: `OVES tiene ${candidatos.length} productos para ${clave.linea} ${clave.material ?? ''} ${clave.cod} (${candidatos.map(c => c.label).join(' / ')}): no se elige "el primero"` };
}

/**
 * Qué producto de OVES corresponde al producto del CRM. `color` es el tono del
 * ítem de la venta (Transitions / Xperio); `eleccion`, lo que puso quien
 * prepara cuando la familia lo exige (potencia del Boost, corredor del Precise).
 */
export function especificacionDe(nombreCRM: string | null | undefined, opts: { color?: string | null; eleccion?: Eleccion } = {}): ResolucionOves {
    const n = normalizar(nombreCRM);
    if (!n) return { ok: false, motivo: 'el ítem no tiene nombre de producto', aMano: false };
    const aMano = A_MANO.find(a => a.crm.test(n));
    if (aMano) return { ok: false, motivo: aMano.motivo, aMano: true };

    const esMiPrimer = /^mi primer /.test(n);
    const esPromo2x1 = /\b2\s*x\s*1\b/.test(n);
    const tratamiento = tratamientoDe(n);
    const sinSufijo = n.replace(/\s*(\+ crizal|\+ ar numax|— sin antirreflejo|- sin antirreflejo)\b.*$/, '').replace(/\s*2\s*x\s*1\s*$/, '').trim();
    const base = sinSufijo.replace(/^mi primer /, '');

    // 1. Productos de marca Optovisión y de stock/tradicional con código fijo.
    const propio = OPTOVISION_PROPIOS.find(p => p.crm.test(base));
    if (propio) {
        const r = elegirProductoOves({ clase: propio.clase, linea: 'S/T', cod: propio.cod });
        if (!r.ok) return { ok: false, motivo: r.motivo, aMano: true };
        return { ok: true, especificacion: { clase: propio.clase, producto: r.producto, familia: r.producto.marca || r.producto.label, tipo: propio.tipo, material: materialDe(r.producto.material), variante: varianteDe(base), color: null, tratamiento, esPromo2x1, esMiPrimer, avisos: [] } };
    }

    // 2. Monofocales de laboratorio tradicional (Blue UV Filter System, Transitions Gen S tallado, Xperio, Interview) y Varilux XR: línea S/T.
    const material = materialDe(base);
    const variante = varianteDe(base);
    const color = colorEnElNombre(base) ?? colorOvesDe(opts.color);
    const xr = base.match(/^varilux xr (design|pro)\b/);
    if (xr) {
        if (!material) return { ok: false, motivo: `no se reconoce el material en "${nombreCRM}"`, aMano: false };
        const tabla = COD_XR[xr[1].toUpperCase() as 'DESIGN' | 'PRO'][material];
        const v = variante === 'TRANSITIONS' ? 'TRANSITIONS' : variante === 'XPERIO' ? 'XPERIO' : 'LISO';
        const { cod, pideColor } = codDeCelda(tabla[v], color);
        if (!cod) return { ok: false, motivo: v === 'LISO' ? `Varilux XR ${xr[1]} no viene en ${material} liso en OVES` : pideColor.length ? `falta el color del ${v === 'XPERIO' ? 'Xperio' : 'Transitions'} (elegilo en la venta: ${pideColor.join(', ')})` : `Varilux XR ${xr[1]} ${material} ${v} no viene en ${color} en OVES`, aMano: !pideColor.length };
        const r = elegirProductoOves({ clase: 'RXTD', linea: 'S/T', cod, material });
        if (!r.ok) return { ok: false, motivo: r.motivo, aMano: true };
        return { ok: true, especificacion: { clase: 'RXTD', producto: r.producto, familia: `Varilux XR ${xr[1][0].toUpperCase()}${xr[1].slice(1)}`, tipo: 'MULTIFOCAL', material, variante, color, tratamiento, esPromo2x1, esMiPrimer, avisos: [] } };
    }
    const tradicional = /^blue uv filter system\b/.test(base) ? 'BLUEUV' : /^monofocal de laboratorio - /.test(base) ? 'MONOLAB' : /^transitions gen s - /.test(base) ? 'TRANS' : /^xperio - /.test(base) ? 'XPERIO' : /^interview\b/.test(base) ? 'INTERVIEW' : null;
    if (tradicional) {
        if (!material) return { ok: false, motivo: `no se reconoce el material en "${nombreCRM}"`, aMano: false };
        const conColor = tradicional === 'TRANS' || tradicional === 'XPERIO';
        const clave = conColor ? (variante === 'XTRACTIVE' ? `XTRACTIVE:${material}:Gris` : `${tradicional}:${material}:${color ?? ''}`) : `${tradicional}:${material}`;
        if (conColor && !color) return { ok: false, motivo: `falta el color del ${tradicional === 'XPERIO' ? 'Xperio' : 'Transitions'} (elegilo en la venta: Gris, Café…)`, aMano: false };
        const cod = COD_TRADICIONAL[clave];
        if (!cod) return { ok: false, motivo: `OVES no lista "${nombreCRM}" (${clave}) en laboratorio tradicional`, aMano: true };
        const r = elegirProductoOves({ clase: 'RXTT', linea: 'S/T', cod });
        if (!r.ok) return { ok: false, motivo: r.motivo, aMano: true };
        return { ok: true, especificacion: { clase: 'RXTT', producto: r.producto, familia: r.producto.marca, tipo: tradicional === 'INTERVIEW' ? 'OCUPACIONAL' : 'MONOFOCAL', material, variante, color, tratamiento, esPromo2x1, esMiPrimer, avisos: [] } };
    }

    // 3. Diseños de tallado digital.
    const familia = FAMILIAS_RXTD.find(f => f.crm.test(base));
    if (!familia) return { ok: false, motivo: `no se reconoce la familia de "${nombreCRM}" en el catálogo de OVES (revisar catalogo.ts)`, aMano: true };
    if (!material) return { ok: false, motivo: `no se reconoce el material en "${nombreCRM}"`, aMano: false };
    const linea = lineaDe(familia, opts.eleccion ?? {});
    if (!linea) return { ok: false, motivo: `${familia.nombre}: hay que elegir ${familia.eleccion?.etiqueta.toLowerCase()}`, aMano: false, eleccion: familia.eleccion };
    const { cod, pideColor } = codDeCelda(COD_RXTD[variante][material], color);
    if (!cod && pideColor.length) return { ok: false, motivo: `falta el color del ${variante === 'XPERIO' ? 'Xperio' : 'Transitions'} (elegilo en la venta: ${pideColor.join(', ')})`, aMano: false };
    if (!cod) return { ok: false, motivo: `${familia.nombre} ${material} no viene ${variante === 'LISO' ? 'liso' : variante.toLowerCase()}${color ? ` ${color}` : ''} en OVES`, aMano: true };
    let r = elegirProductoOves({ clase: 'RXTD', linea, cod, material });
    const avisos: string[] = [];
    if (!r.ok && variante === 'LISO') {
        // El CRM vende "Varilux Comfort - Orma + Crizal" (liso) y OVES, para ese
        // diseño y material, solo lista el Blue UV (Essilor dejó de ofrecer el
        // liso en Varilux / Eyezen, 19/10/2026). No es elegir "el primero": es
        // el ÚNICO producto de ese diseño en ese material, y así lo carga el
        // equipo a mano ("Eyezen Start Orma Blue UV" para el Eyezen 2x1). Se
        // avisa en la revisión. REGLA A CONFIRMAR con Ishtar.
        const blue = COD_RXTD.BLUE_UV[material];
        const rb = typeof blue === 'string' ? elegirProductoOves({ clase: 'RXTD', linea, cod: blue, material }) : null;
        if (rb?.ok) { r = rb; avisos.push(`OVES no tiene ${familia.nombre} ${r.producto.material} liso: se carga "${r.producto.label}", el único que ofrece para ese diseño y material`); }
    }
    if (!r.ok) return { ok: false, motivo: r.motivo, aMano: true };
    return { ok: true, especificacion: { clase: 'RXTD', producto: r.producto, familia: familia.nombre, tipo: familia.tipo, material, variante: avisos.length ? 'BLUE_UV' : variante, color, tratamiento, esPromo2x1, esMiPrimer, avisos } };
}

/** La elección que la familia del producto le pide a quien prepara (potencia, corredor), si la hay. Puro. */
export function eleccionQuePide(nombreCRM: string | null | undefined): FamiliaRXTD['eleccion'] | null {
    const n = normalizar(nombreCRM).replace(/^mi primer /, '');
    return FAMILIAS_RXTD.find(f => f.crm.test(n))?.eleccion ?? null;
}

/** La familia (diseño) del producto del CRM, para nombrar la promo y comparar pares. Puro. */
export function familiaDelNombre(nombreCRM: string | null | undefined): string {
    const n = normalizar(nombreCRM).replace(/^mi primer /, '');
    const f = FAMILIAS_RXTD.find(f => f.crm.test(n));
    if (f) return f.nombre;
    const xr = n.match(/^varilux xr (design|pro)\b/);
    if (xr) return `Varilux XR ${xr[1][0].toUpperCase()}${xr[1].slice(1)}`;
    return n.split(/\s[-·]\s/)[0].trim();
}

/** Las descripciones de servicio de OVES que corresponden a un tratamiento del CRM (lib/constants/crizal.ts `code`). Puro. */
export const SERVICIO_TRATAMIENTO: Record<string, string> = {
    CRIZAL_FORTE_UV: 'Crizal Forte UV',
    CRIZAL_PREVENCIA: 'Crizal Prevencia',
    CRIZAL_SAPPHIRE: 'Crizal Sapphire',
    SIN_AR: 'sin tratamiento',
    NUMAX: 'Numax',
};

/** Calibrados del formulario (descripción exacta de la opción). */
export const SERVICIO_CALIBRADO: Record<string, string> = {
    COMUN: 'Calibrado Comun',
    PERFORADO: 'Calibrado perforado',
    RANURADO: 'Calibrado ranurado',
    SIN: 'sin calibrado',
};

/** Coloración del formulario según el estilo del teñido del CRM (constants/tenido.ts). */
export const SERVICIO_COLORACION: Record<string, string> = {
    COMPACTO: 'color pleno',
    DEGRADE: 'color degrade',
    MUESTRA: 'color muestra',
    SIN: 'sin color',
};

export const SERVICIO_OTROS_NINGUNO = 'sin otros servicios';

/** Tipo de armazón del formulario (`tipoarm`): valor → etiqueta, y cómo lo nombra la venta. */
export const TIPO_ARMAZON_OVES: { value: string; label: string; crm: RegExp }[] = [
    { value: '1', label: 'Zilo / Acetato', crm: /zilo|acetato|pl[aá]stic|inyectad|tr-?90|ultem/i },
    { value: '2', label: 'Metal', crm: /met[aá]l/i },
    { value: '3', label: 'Montura al aire', crm: /al aire|perfor|rimless|tres piezas|3 piezas/i },
    { value: '4', label: 'Hilo Nylon', crm: /nylon|ranur|semi/i },
    { value: '5', label: 'Hilo de Acero', crm: /acero/i },
];

/** Las formas del dibujo del armazón que ofrece el formulario (radio `armazonLente`). */
export const FORMAS_OVES = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15] as const;
