import { precioConSigno } from '@/lib/format-precio';

/**
 * Los rangos del filtro "Precio" de /tienda.
 *
 * Se comparan contra el precio POR TRANSFERENCIA, que es el número grande de
 * cada tarjeta (pedido de Ishtar, 31/8). Antes se comparaban contra el precio
 * que se cobra con tarjeta, y el resultado no coincidía con lo que la persona
 * ve: "Hasta $150.000" dejaba 5 modelos cuando 134 tarjetas mostraban menos, y
 * "Más de $250.000" daba siempre 0 (auditoría del 25/9/2026, re-chequeo 28/9).
 *
 * Cortes elegidos con la distribución real del 28/9/2026 (160 modelos, precio
 * por transferencia): hasta $140.000 → 86, de $140.000 a $160.000 → 56, más
 * de $160.000 → 18. Si cambian los precios o el % de transferencia, revisar
 * que ningún rango quede vacío.
 *
 * El segundo rango arranca en 140001 y el tercero en 160001: la API compara
 * los dos límites con <=, y un modelo justo en el corte no puede caer en dos
 * botones a la vez.
 */
export interface RangoPrecioTienda {
    id: string;
    etiqueta: string;
    min: string;
    max: string;
}

export const RANGOS_PRECIO_TIENDA: readonly RangoPrecioTienda[] = [
    { id: '', etiqueta: 'Todos', min: '', max: '' },
    { id: 'hasta-140', etiqueta: 'Hasta $140.000', min: '', max: '140000' },
    { id: '140-160', etiqueta: '$140.000 a $160.000', min: '140001', max: '160000' },
    { id: 'desde-160', etiqueta: 'Más de $160.000', min: '160001', max: '' },
];

/**
 * Los rangos de /tienda sirven para el catálogo entero, pero no para cada
 * categoría sola (auditoría de catálogo del 15/10/2026): en /lentes-de-sol
 * "Hasta $140.000" devolvía 0 modelos porque el solar más barato sale
 * $140.250 por transferencia, y en /clip-on los 10 modelos cuestan lo mismo,
 * así que cualquier rango es "todos o ninguno". Un botón que no devuelve nada
 * no es un filtro: es una puerta cerrada.
 *
 * Cortes con la distribución real del 15/10/2026 (precio por transferencia):
 *   Receta  119.000 ×5 · 123.250 ×37 · 136.000 ×44 · 153.000 ×8 · 182.750 ×1
 *           → hasta $130.000: 42 · $130.000 a $150.000: 44 · más de $150.000: 9
 *   Sol     140.250 ×1 · 148.750 ×37 · 182.750 ×7 · 191.250 ×10
 *           → hasta $150.000: 38 · más de $150.000: 17
 *   Clip-On 148.750 ×10 → sin filtro de precio (una sola lista vacía).
 * Si cambian los precios o el % de transferencia, revisar que ningún rango
 * quede vacío (la query está en el informe de esa auditoría).
 */
const RANGOS_POR_CATEGORIA: Record<string, readonly RangoPrecioTienda[]> = {
    Receta: [
        { id: '', etiqueta: 'Todos', min: '', max: '' },
        { id: 'hasta-130', etiqueta: 'Hasta $130.000', min: '', max: '130000' },
        { id: '130-150', etiqueta: '$130.000 a $150.000', min: '130001', max: '150000' },
        { id: 'desde-150', etiqueta: 'Más de $150.000', min: '150001', max: '' },
    ],
    Sol: [
        { id: '', etiqueta: 'Todos', min: '', max: '' },
        { id: 'hasta-150', etiqueta: 'Hasta $150.000', min: '', max: '150000' },
        { id: 'desde-150', etiqueta: 'Más de $150.000', min: '150001', max: '' },
    ],
    'Clip-On': [],
};

/**
 * Los botones de precio que corresponden a lo que la persona está mirando.
 * Sin categoría (o "Todo") son los del catálogo entero; una lista vacía
 * significa "no mostrar la sección Precio".
 */
export function rangosPrecioPara(categoria?: string | null): readonly RangoPrecioTienda[] {
    const clave = (categoria || '').trim();
    if (!clave || clave === 'Todo') return RANGOS_PRECIO_TIENDA;
    const encontrada = Object.keys(RANGOS_POR_CATEGORIA).find(k => k.toLowerCase() === clave.toLowerCase());
    return encontrada ? RANGOS_POR_CATEGORIA[encontrada] : RANGOS_PRECIO_TIENDA;
}

/**
 * Cómo se lee el rango activo en el chip de filtros. Si es uno de los botones,
 * su misma etiqueta (antes el chip decía "Más de $250.001"); si vino de un
 * link viejo con otros números, se escribe con esos números.
 */
export function etiquetaRangoPrecio(min: string, max: string): string {
    const conocido = [RANGOS_PRECIO_TIENDA, ...Object.values(RANGOS_POR_CATEGORIA)].flat()
        .find(r => r.id && r.min === (min || '') && r.max === (max || ''));
    if (conocido) return conocido.etiqueta;
    if (min && max) return `${precioConSigno(Number(min))} a ${precioConSigno(Number(max))}`;
    if (max) return `Hasta ${precioConSigno(Number(max))}`;
    return `Desde ${precioConSigno(Number(min))}`;
}
