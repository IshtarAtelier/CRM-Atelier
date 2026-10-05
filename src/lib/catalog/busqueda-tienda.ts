/**
 * La búsqueda de la tienda, en UN solo lugar: la de /tienda (parámetro
 * `search` de /api/store/products) y la lupa del encabezado usan esta función.
 *
 * Por qué existe (auditoría del 25/9/2026, re-chequeo del 28/9): la búsqueda
 * comparaba el texto tal cual contra nombre, código, categoría y marca.
 * - "clip on" daba 0 y "clip-on" daba 10: el guion contaba.
 * - "negro" daba 2 aunque el filtro de color encontraba ~29: el color no se
 *   miraba, solo el nombre.
 * - "mujer", "redondo", "titanio", "polarizado" daban 0 o casi nada.
 * - La lupa del encabezado era otro motor que además distinguía tildes
 *   ("orion" 0, "Orión" 1).
 *
 * Cómo busca: normaliza el texto (sin tildes, mayúsculas, guiones ni puntos),
 * traduce sinónimos a como está cargado el catálogo, descarta palabras que no
 * distinguen nada ("anteojos", "de") y exige que CADA palabra que queda
 * aparezca en algún dato del producto. Así "anteojos de sol negros" encuentra
 * los de sol negros, no todo lo que dice "sol" o todo lo que es negro.
 *
 * "Aparecer" es por PALABRA, no por pedazo de texto (revisión del 5/10): una
 * palabra de la consulta encuentra una del producto si es su comienzo
 * ("calip" → Calipso, "homb" → hombre) o si es la misma palabra en plural o
 * en femenino ("negras" → negro). Con pedazos de texto "polaris" traía los
 * polarizados, "iris" traía Sirio y "pegaso c3" traía el código BC3063.
 */
import { normalizarTexto } from '@/lib/text-normalize';
import { familiaColorPorId } from '@/lib/catalog/color-normalizado';

/** Sin tildes ni mayúsculas, y con guiones, guiones bajos, puntos y barras como espacio. */
export function textoBuscable(valor?: string | null): string {
    return normalizarTexto(valor).replace(/[-_./]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Cómo lo escribe la gente → cómo está cargado. Se aplican sobre la consulta
 * ya normalizada y en este orden (las frases largas antes que sus palabras).
 */
const SINONIMOS: ReadonlyArray<[RegExp, string]> = [
    [/\b(anteojos|anteojo|lentes|gafas) de sol\b/g, 'sol'],
    // "clip on de sol": el clip-on ES el anteojo de sol de quien usa receta;
    // el "de sol" no tiene que dejarlo afuera.
    [/\b(clip ?on(es)?|clipon(es)?|clipones|clip)( (de|para) sol| solar(es)?)?\b/g, 'clip'],
    [/\b(mujer(es)?|damas?|femenin[oa]s?)\b/g, 'mujer'],
    [/\b(hombres?|caballeros?|masculin[oa]s?|varon(es)?)\b/g, 'hombre'],
    // "sin aumento" no distingue nada (todo armazón se vende también sin
    // receta). Va ANTES que "aumento", que sí quiere decir receta.
    [/\bsin aumento\b/g, ''],
    [/\b(recetad[oa]s?|graduad[oa]s?|con aumento|aumento)\b/g, 'receta'],
    [/\bpolarizad[oa]s?\b/g, 'polarizado'],
];

/** Palabras que no distinguen un anteojo de otro en esta tienda. */
const PALABRAS_VACIAS = new Set([
    'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'para', 'con', 'y', 'en',
    'anteojo', 'anteojos', 'lente', 'lentes', 'armazon', 'armazones', 'marco', 'marcos', 'modelo', 'modelos',
    'gafa', 'gafas', 'optico', 'opticos', 'optica',
]);

/** Las palabras de la consulta que tienen que aparecer, ya traducidas. Vacío = no filtra. */
export function palabrasDeBusqueda(consulta?: string | null): string[] {
    let q = textoBuscable(consulta);
    for (const [patron, reemplazo] of SINONIMOS) q = q.replace(patron, reemplazo);
    return q.split(' ').filter(p => p && !PALABRAS_VACIAS.has(p));
}

/** Lo mínimo de un producto que mira la búsqueda (así lo devuelve /api/store/products). */
export interface ProductoBuscable {
    name?: string | null;
    model?: string | null;
    modelCode?: string | null;
    brand?: string | null;
    category?: string | null;
    color?: string | null;
    coloresFamilia?: string[] | null;
    shape?: string | null;
    material?: string | null;
    gender?: string | null;
    polarizado?: boolean | null;
}

/** Palabras de género con las que el producto se puede encontrar. Unisex aparece para las dos. */
function generoBuscable(gender?: string | null): string {
    const g = normalizarTexto(gender);
    if (!g) return '';
    const unisex = g.includes('unisex') || g.includes('sin_genero') || g.includes('no_gender');
    const partes: string[] = [];
    if (unisex || g.includes('femenino') || g.includes('mujer') || g.includes('femme')) partes.push('mujer');
    if (unisex || g.includes('masculino') || g.includes('hombre') || g.includes('homme')) partes.push('hombre');
    if (unisex) partes.push('unisex');
    return partes.join(' ');
}

/** El nombre del producto: donde se busca aunque se hayan tipeado una o dos letras. */
function textoDelNombre(p: ProductoBuscable): string {
    return textoBuscable([p.name, p.model, p.modelCode, p.brand].filter(Boolean).join(' '));
}

/** Lo que DESCRIBE al producto (categoría, color, forma, material, género). */
function textoDeAtributos(p: ProductoBuscable): string {
    const colores = (p.coloresFamilia || []).map(id => familiaColorPorId(id)?.etiqueta ?? id);
    return textoBuscable([
        p.category, p.color, ...colores, p.shape, p.material, generoBuscable(p.gender),
        p.polarizado ? 'polarizado' : '',
    ].filter(Boolean).join(' '));
}

/** Todo el texto donde se busca, normalizado. */
export function textoDelProducto(p: ProductoBuscable): string {
    return [textoDelNombre(p), textoDeAtributos(p)].filter(Boolean).join(' ');
}

/**
 * La palabra sin plural y en masculino: "negras" → "negro", "redondos" →
 * "redondo", "venus" → "venu". Se aplica igual a la consulta y al producto,
 * y solo se compara palabra entera contra palabra entera.
 */
function raiz(palabra: string): string {
    let r = palabra;
    if (r.length > 4 && r.endsWith('es')) r = r.slice(0, -2);
    else if (r.length > 3 && r.endsWith('s')) r = r.slice(0, -1);
    if (r.length > 3 && r.endsWith('a')) r = r.slice(0, -1) + 'o';
    return r;
}

/**
 * ¿La palabra de la consulta está en estas palabras del producto?
 * - Como comienzo de una palabra ("calip" → calipso). Si termina en número,
 *   lo que sigue no puede ser otro número: "c2" no es "c21", "9004" sí es
 *   "9004m".
 * - Como la misma palabra en plural o femenino ("negras" → negro), entera.
 */
function apareceEn(palabrasProducto: string[], palabra: string): boolean {
    const terminaEnNumero = /\d$/.test(palabra);
    const raizConsulta = raiz(palabra);
    return palabrasProducto.some(w => {
        if (w.startsWith(palabra) && !(terminaEnNumero && /\d/.test(w.charAt(palabra.length)))) return true;
        return !/\d/.test(palabra) && raiz(w) === raizConsulta;
    });
}

/** ¿El producto responde a la consulta? Una consulta vacía (o solo palabras vacías) no filtra. */
export function coincideBusquedaTienda(p: ProductoBuscable, consulta?: string | null): boolean {
    const palabras = palabrasDeBusqueda(consulta);
    if (palabras.length === 0) return true;
    const nombre = textoDelNombre(p).split(' ').filter(Boolean);
    const todo = [...nombre, ...textoDeAtributos(p).split(' ').filter(Boolean)];
    // Con una o dos letras se busca solo en el nombre: si no, "ho" traía todo
    // lo que es de hombre y "ne" todo lo negro, y la lupa —que busca mientras
    // se tipea— se llenaba de resultados que nadie pidió.
    return palabras.every(palabra => apareceEn(palabra.length < 3 ? nombre : todo, palabra));
}
