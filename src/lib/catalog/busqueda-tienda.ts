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
    [/\b(anteojos|lentes|gafas) de sol\b/g, 'sol'],
    [/\bclip ?on(es)?\b|\bclipon(es)?\b|\bclipones\b/g, 'clip'],
    [/\b(mujer(es)?|damas?|femenin[oa]s?)\b/g, 'femme'],
    [/\b(hombres?|caballeros?|masculin[oa]s?|varon(es)?)\b/g, 'homme'],
    [/\b(recetad[oa]s?|graduad[oa]s?|aumento)\b/g, 'receta'],
    [/\bpolarizad[oa]s?\b/g, 'polarizado'],
];

/** Palabras que no distinguen un anteojo de otro en esta tienda. */
const PALABRAS_VACIAS = new Set([
    'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'para', 'con', 'y', 'en',
    'anteojo', 'anteojos', 'lente', 'lentes', 'armazon', 'armazones', 'marco', 'marcos', 'modelo', 'modelos',
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
    if (unisex || g.includes('femenino') || g.includes('mujer') || g.includes('femme')) partes.push('femme');
    if (unisex || g.includes('masculino') || g.includes('hombre') || g.includes('homme')) partes.push('homme');
    if (unisex) partes.push('unisex');
    return partes.join(' ');
}

/** Todo el texto donde se busca, normalizado. */
export function textoDelProducto(p: ProductoBuscable): string {
    const colores = (p.coloresFamilia || []).map(id => familiaColorPorId(id)?.etiqueta ?? id);
    return textoBuscable([
        p.name, p.model, p.modelCode, p.brand, p.category, p.color, ...colores,
        p.shape, p.material, generoBuscable(p.gender), p.polarizado ? 'polarizado' : '',
    ].filter(Boolean).join(' '));
}

/** "negros" encuentra "negro"; "redondos", "redondo". */
function aparece(texto: string, palabra: string): boolean {
    if (texto.includes(palabra)) return true;
    if (palabra.length > 4 && palabra.endsWith('es') && texto.includes(palabra.slice(0, -2))) return true;
    if (palabra.length > 3 && palabra.endsWith('s') && texto.includes(palabra.slice(0, -1))) return true;
    return false;
}

/** ¿El producto responde a la consulta? Una consulta vacía (o solo palabras vacías) no filtra. */
export function coincideBusquedaTienda(p: ProductoBuscable, consulta?: string | null): boolean {
    const palabras = palabrasDeBusqueda(consulta);
    if (palabras.length === 0) return true;
    const texto = textoDelProducto(p);
    return palabras.every(palabra => aparece(texto, palabra));
}
