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
 * Cómo se lee el rango activo en el chip de filtros. Si es uno de los botones,
 * su misma etiqueta (antes el chip decía "Más de $250.001"); si vino de un
 * link viejo con otros números, se escribe con esos números.
 */
export function etiquetaRangoPrecio(min: string, max: string): string {
    const conocido = RANGOS_PRECIO_TIENDA.find(r => r.id && r.min === (min || '') && r.max === (max || ''));
    if (conocido) return conocido.etiqueta;
    if (min && max) return `${precioConSigno(Number(min))} a ${precioConSigno(Number(max))}`;
    if (max) return `Hasta ${precioConSigno(Number(max))}`;
    return `Desde ${precioConSigno(Number(min))}`;
}
