/**
 * LA IDENTIDAD DE LOS LABORATORIOS, en un solo lugar (10/10/2026).
 *
 * Hasta acá "¿este ítem es de Grupo Óptico?" se decidía con cinco regex
 * distintas (el cruce, la carga, la ficha, dos pantallas), y dos de ellas
 * divergían dentro de la misma carga: un cristal sin laboratorio contaba como
 * GO para armar el plan pero no para listar el par. "¿De qué lab es este nº?"
 * tenía tres definiciones. Y el código corto de una venta (#XXXX) se armaba a
 * mano en 100 lugares mientras el robot lo busca en el portal.
 *
 * Todo lo que necesite reconocer un laboratorio por su nombre, un nº de pedido
 * por su forma o el código corto de una venta, lee de acá. Puro, sin base.
 */
export type LabKey = 'OPTOVISION' | 'GRUPO_OPTICO' | 'LA_CAMARA' | 'VITOLEN';

/** El nombre del laboratorio tal como aparece en `laboratorySnapshot` / `Product.laboratory`. */
export const LAB_ITEM_PATTERNS: Record<LabKey, RegExp> = {
    OPTOVISION: /optovision/i,
    // "GRUPO OPTICO", "Grupo Óptico", "grupo-optico", "GRUPO_OPTICO".
    GRUPO_OPTICO: /grupo[\s_-]?[oó]ptico/i,
    // Fideicomiso Cámara de Ópticas de Córdoba (LabCOC): los bifocales Flat Top.
    // Sin portal ni correo parseable: sus comprobantes se cargan a mano desde
    // la venta (30/9/2026: tres facturas con el bifocal Blue Cut a $114.841
    // contra $23.100 cargados en el sistema, y nadie lo veía).
    LA_CAMARA: /c[aá]mara/i,
    // Vitolen (Hoya + Pentax), desde el 30/9/2026: su portal lo lee el módulo
    // de src/services/lab-modules/vitolen.
    VITOLEN: /vitolen/i,
};

export const LAB_KEYS = Object.keys(LAB_ITEM_PATTERNS) as LabKey[];

/** El patrón de un laboratorio nombrado como string (claves de LabCostEntry.lab); undefined si no es uno conocido. */
export const patronDeLab = (lab: string | null | undefined): RegExp | undefined => LAB_ITEM_PATTERNS[String(lab || '').toUpperCase() as LabKey];

/** El laboratorio que nombra un texto ("Grupo Óptico", "VITOLEN"); null si ninguno. */
export function labDeNombre(nombre: string | null | undefined): LabKey | null {
    const t = String(nombre || '');
    if (!t) return null;
    return LAB_KEYS.find(k => LAB_ITEM_PATTERNS[k].test(t)) ?? null;
}

export interface ItemConLaboratorio {
    laboratorySnapshot?: string | null;
    product?: { laboratory?: string | null } | null;
}

/** El laboratorio de un ítem de venta: lo que se guardó al vender, o el del producto. null si no dice. */
export function labDeItem(item: ItemConLaboratorio | null | undefined): LabKey | null {
    return labDeNombre(item?.laboratorySnapshot ?? item?.product?.laboratory ?? null);
}

/**
 * ¿El ítem es de este laboratorio? `sinLaboratorio` dice qué hacer con un
 * ítem que no nombra ninguno (ventas viejas): por defecto NO es de nadie —
 * la carga de Grupo Óptico lo asume suyo a propósito, porque se la llama
 * dentro de su propio módulo y sus ventas viejas no tenían laboratorio.
 */
export function esDeLab(item: ItemConLaboratorio | null | undefined, lab: LabKey, opciones: { sinLaboratorio?: LabKey | null } = {}): boolean {
    const l = labDeItem(item);
    if (l) return l === lab;
    return (opciones.sinLaboratorio ?? null) === lab;
}

/** ¿El ítem es un cristal (no un armazón ni un tratamiento)? La categoría guardada al vender, o la del producto. */
export function esCristal(item: { productCategorySnapshot?: string | null; product?: { category?: string | null } | null } | null | undefined): boolean {
    return /cristal|lens/i.test(String(item?.productCategorySnapshot ?? item?.product?.category ?? ''));
}

/** ¿El ítem es un cristal de ESTE laboratorio? (la pregunta que la carga, el cruce y la ficha hacían cada uno a su manera). */
export function esCristalDeLab(item: (ItemConLaboratorio & { productCategorySnapshot?: string | null; product?: { category?: string | null; laboratory?: string | null } | null }) | null | undefined, lab: LabKey, opciones: { sinLaboratorio?: LabKey | null } = {}): boolean {
    return esCristal(item) && esDeLab(item, lab, opciones);
}

/**
 * El par (armazón 1 o 2) que dice un código interno escrito en un portal:
 * "1°par", "2° par", "2do par", "1er par", "primer/segundo par". Es lo que el
 * robot escribe en los dos portales y lo que el seguimiento lee para saber de
 * qué armazón es un pedido. null si no lo dice. Puro.
 */
export function parDelCodigoInterno(texto: string | null | undefined): 1 | 2 | null {
    const t = String(texto || '').toLowerCase();
    const dos = /(?:^|\D)2\s*(?:[°ºo]|do)?\s*par\b|segundo\s+par/.test(t);
    const uno = /(?:^|\D)1\s*(?:[°ºo]|er|ro)?\s*par\b|primer\s+par/.test(t);
    if (dos) return 2;
    if (uno) return 1;
    return null;
}

/**
 * La forma del nº de pedido de cada laboratorio, para no atribuirle a uno un
 * nº del otro cuando una venta tiene pedidos de dos (venta mixta):
 *  · Grupo Óptico (SmartLab): 8 dígitos que empiezan con 8 (hoy 80xxxxxx; mañana 81…).
 *  · Vitolen: 7 dígitos; en el portal se muestra con una L ("6981382L").
 *  · Optovisión: 6 dígitos.
 * La Cámara no tiene nº propio (comprobantes a mano).
 */
const FORMA_DE_NUMERO: { lab: LabKey; forma: RegExp }[] = [
    { lab: 'GRUPO_OPTICO', forma: /^8\d{7}$/ },
    { lab: 'VITOLEN', forma: /^\d{7}L?$/i },
    { lab: 'OPTOVISION', forma: /^\d{6}$/ },
];

/** El laboratorio al que pertenece un nº de pedido por su forma; null si no es de ninguno. Puro. */
export function labDeNumero(numero: string | null | undefined): LabKey | null {
    const n = String(numero || '').trim();
    return FORMA_DE_NUMERO.find(f => f.forma.test(n))?.lab ?? null;
}

export function esNumeroDeLab(numero: string | null | undefined, lab: LabKey): boolean {
    return labDeNumero(numero) === lab;
}

/** Solo los dígitos de un nº (Vitolen "6981382L" ↔ "6981382" en la venta). Puro. */
export const soloDigitos = (n: string) => String(n || '').replace(/\D/g, '');

/**
 * El código corto de una venta: "#" + las últimas 4 letras del id, en mayúscula.
 * Es lo que el robot y el favorito escriben en el "Código interno" del portal
 * de Grupo Óptico y lo que el seguimiento busca para vincular un pedido con su
 * venta: tiene que armarse SIEMPRE igual.
 */
export function codigoCortoDeVenta(orderId: string): string {
    return `#${String(orderId || '').slice(-4).toUpperCase()}`;
}

export const esCodigoCorto = (texto: string | null | undefined): boolean => /^#[A-Z0-9]{4}$/i.test(String(texto || '').trim());
