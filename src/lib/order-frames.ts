// ────────────────────────────────────────────────────────────────────────────
// Cuántos armazones lleva un pedido, y cuáles son.
//
// LA REGLA: un armazón por PAR DE CRISTALES. Cuatro pares de cristales son
// cuatro anteojos, cada uno con sus medidas, su altura pupilar y su foto.
//
// Antes la cantidad se deducía de la promo ("¿el nombre dice 2x1?"), que es una
// señal comercial, no física: un pedido de dos pares sin promo mostraba UN solo
// armazón y el segundo se fabricaba a ciegas. Y como los datos vivían en
// columnas fijas del pedido, más de dos no entraban.
//
// Módulo PURO (sin prisma): lo usan la pantalla, el PDF, la confirmación al
// cliente y la validación del servidor, todos sobre el mismo criterio.
// ────────────────────────────────────────────────────────────────────────────

import { isCrystal } from './promo-utils';

export interface FrameItemLike {
    eye?: string | null;
    quantity?: number | null;
    product?: { name?: string | null; category?: string | null; type?: string | null } | null;
    productNameSnapshot?: string | null;
    productCategorySnapshot?: string | null;
    productTypeSnapshot?: string | null;
}

/** Un armazón, venga de la tabla nueva o de las columnas viejas del pedido. */
export interface OrderFrameData {
    position: number;
    shape: string | null;
    a: string | null;
    b: string | null;
    dbl: string | null;
    edc: string | null;
    details: string | null;
    imageUrl: string | null;
    heightOD: number | null;
    heightOI: number | null;
}

/** El producto de un item, mirando también los snapshots (pedidos viejos). */
function productoDe(it: FrameItemLike) {
    return it.product || {
        name: it.productNameSnapshot,
        category: it.productCategorySnapshot,
        type: it.productTypeSnapshot,
    };
}

/**
 * Cuántos PARES de cristales tiene el pedido = cuántos armazones lleva.
 *
 * Los cristales se cargan por ojo (`eye`), así que un par es un OD con su OI.
 * Si vinieran sin ojo (pedidos viejos o carga suelta), se cuenta por cantidad
 * y se redondea para arriba: es preferible pedir una medida de más que fabricar
 * un anteojo sin medidas.
 */
export function contarParesDeCristales(items: FrameItemLike[] | null | undefined): number {
    return contarPares(items).pares;
}

/** Igual que `contarParesDeCristales`, pero además dice si el conteo es CONFIABLE
 *  (los cristales traen el ojo cargado) o si hubo que estimarlo. */
function contarPares(items: FrameItemLike[] | null | undefined): { pares: number; confiable: boolean } {
    const cristales = (items || []).filter(it => isCrystal(productoDe(it)));
    if (cristales.length === 0) return { pares: 0, confiable: false };

    const cuenta = (lado: string[]) => cristales
        .filter(it => lado.includes((it.eye || '').toUpperCase()))
        .reduce((n, it) => n + (it.quantity || 1), 0);

    const od = cuenta(['OD', 'RIGHT']);
    const oi = cuenta(['OI', 'LEFT']);

    // Con el ojo cargado el conteo es exacto: tantos OD como anteojos.
    if (od > 0 || oi > 0) {
        const sinOjo = cristales
            .filter(it => !it.eye)
            .reduce((n, it) => n + (it.quantity || 1), 0);
        return { pares: Math.max(od, oi) + Math.ceil(sinOjo / 2), confiable: true };
    }

    // Sin ojo hay que estimar por cantidad: no es confiable.
    const total = cristales.reduce((n, it) => n + (it.quantity || 1), 0);
    return { pares: Math.ceil(total / 2), confiable: false };
}

/**
 * Cuántos armazones hay que cargar.
 *
 * Manda la cantidad de PARES DE CRISTALES. La promo 2x1 se usa solo como PISO:
 * si un pedido viejo trae los cristales sin ojo o con snapshots incompletos, el
 * conteo puede quedar corto, y en un 2x1 sabemos que son al menos dos anteojos.
 * Nunca menos de 1: siempre hay algo que fabricar.
 */
export function cantidadDeArmazones(order: {
    items?: FrameItemLike[] | null;
    appliedPromoName?: string | null;
}): number {
    const { pares, confiable } = contarPares(order?.items);

    // Si los cristales traen el ojo cargado, el conteo es exacto y MANDA. La
    // promo no lo pisa: un solo par de cristales que se llaman "…2x1" es UN
    // anteojo, y pedir un segundo armazón que no existe traba la venta con un
    // faltante imposible de completar.
    if (confiable) return Math.max(1, pares);

    // Sin ojo cargado (pedidos viejos) el conteo es una estimación: ahí sí la
    // promo 2x1 sirve de piso, porque sabemos que son al menos dos anteojos.
    const esPromo2x1 = (order?.appliedPromoName || '').toLowerCase().includes('2x1')
        || (order?.items || []).some(it => {
            const n = (productoDe(it)?.name || '').toLowerCase();
            return n.includes('2x1') || n.includes('2 x 1');
        });
    return Math.max(1, pares, esPromo2x1 ? 2 : 0);
}

const texto = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));
const numero = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
};

/**
 * Los armazones del pedido, normalizados y ordenados por posición.
 *
 * Prioriza la tabla `OrderFrame`; para las posiciones 1 y 2 cae a las columnas
 * viejas del pedido cuando la fila todavía no existe (pedidos anteriores a la
 * migración que no entraron en el backfill).
 */
export function framesDeLaOrden(order: any): OrderFrameData[] {
    const cantidad = cantidadDeArmazones(order);
    const filas: any[] = Array.isArray(order?.frames) ? order.frames : [];

    const legacy = (pos: number): OrderFrameData | null => {
        const s = pos === 1 ? order?.labFrameShape : order?.labFrameShape2;
        const a = pos === 1 ? order?.frameA : order?.frameA2;
        const b = pos === 1 ? order?.frameB : order?.frameB2;
        const dbl = pos === 1 ? order?.frameDbl : order?.frameDbl2;
        const edc = pos === 1 ? order?.frameEdc : order?.frameEdc2;
        const det = pos === 1 ? order?.labFrameDetails : order?.labFrameDetails2;
        const img = pos === 1 ? order?.frameImageUrl : order?.frameImageUrl2;
        const hOD = pos === 1 ? order?.labHeightOD : order?.labHeightOD2;
        const hOI = pos === 1 ? order?.labHeightOI : order?.labHeightOI2;
        return {
            position: pos,
            shape: texto(s), a: texto(a), b: texto(b), dbl: texto(dbl), edc: texto(edc),
            details: texto(det), imageUrl: texto(img),
            heightOD: numero(hOD), heightOI: numero(hOI),
        };
    };

    const salida: OrderFrameData[] = [];
    for (let pos = 1; pos <= cantidad; pos++) {
        const fila = filas.find(f => f.position === pos);
        if (fila) {
            salida.push({
                position: pos,
                shape: texto(fila.shape), a: texto(fila.a), b: texto(fila.b),
                dbl: texto(fila.dbl), edc: texto(fila.edc), details: texto(fila.details),
                imageUrl: texto(fila.imageUrl),
                heightOD: numero(fila.heightOD), heightOI: numero(fila.heightOI),
            });
        } else if (pos <= 2) {
            salida.push(legacy(pos) as OrderFrameData);
        } else {
            salida.push({
                position: pos, shape: null, a: null, b: null, dbl: null, edc: null,
                details: null, imageUrl: null, heightOD: null, heightOI: null,
            });
        }
    }
    return salida;
}

/** "Armazón" si es uno solo; "1º Armazón", "2º Armazón"… si son varios. */
export function etiquetaArmazon(position: number, total: number): string {
    return total <= 1 ? 'Armazón' : `${position}º Armazón`;
}
