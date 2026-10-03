import { cristalVitolenPorNombre } from '@/services/lab-modules/vitolen/catalogo';
import { DESCUENTO_SEGUNDO_PAR_HOYA } from '@/lib/constants/descuentos';
import { isCrystal, safePrice } from '@/lib/promo-utils';

/**
 * PROMO DEL SEGUNDO PAR DE HOYA / PENTAX, la regla completa en un solo lugar.
 * La fija `npm run check:promo-hoya`. PricingService y el cotizador delegan acá.
 *
 * Bases de Vitolen (30/9/2026, docs/vitolen-pedidos-y-promos.md):
 *  1. La enciende un PRIMER PAR de progresivo Hoya iD LifeStyle 4, Array 2,
 *     Summit o Argos, o Pentax Allfocus (todos con antirreflejo en nuestro
 *     catálogo). Mi Primer Hoya NO participa; Nulux, Sync, Visión Simple y
 *     Tact tampoco encienden nada.
 *  2. El SEGUNDO PAR es del mismo diseño (igual o menor valor: puede ser un
 *     material más barato) o un ocupacional Tact. Nunca más caro que el 1º.
 *  3. El 2º par lleva DESCUENTO_SEGUNDO_PAR_HOYA % para el cliente. Los
 *     renglones quedan a precio de lista: el descuento va aparte, como el
 *     armazón bonificado del 2x1, y se guarda en `appliedPromoDiscount`.
 *  4. Un solo segundo par por venta (la promo es un 2º par por cada 1º; una
 *     venta normal trae dos). Si hay varios pares, el 1º es el más caro y el
 *     2º el más caro de los que entran.
 *  5. Qué par es cada uno lo dice el armazón asignado (`framePosition`); sin
 *     asignar, los pares se arman en el orden del carrito (OD + OI del mismo
 *     cristal).
 *
 * No toca al 2x1 de Varilux (otra promo, otro módulo): un carrito con las dos
 * es un error del vendedor, no algo que se resuelva acá.
 */

export const LINEAS_PRIMER_PAR_HOYA = ['lifestyle-4', 'array-2', 'summit', 'argos', 'allfocus-pro', 'allfocus-flex'] as const;
export const LINEAS_SOLO_SEGUNDO_PAR_HOYA = ['tact'] as const;

export interface LineaDeCarrito {
    product?: any;
    productNameSnapshot?: string | null;
    quantity?: number;
    price?: number;
    customPrice?: number;
    eye?: string | null;
    framePosition?: number | null;
    uid?: string | number;
}

export interface ParHoya {
    linea: string;
    nombre: string;
    indices: number[];
    uids: (string | number)[];
    precio: number;
    framePosition: number | null;
    completo: boolean;
}

export interface DescuentoSegundoParHoya {
    discount: number;
    /** Para la pantalla: "2º par Hoya (HOYA ARRAY 2 - 1.50 CLEAR BLUE FILTER) -80%". */
    itemName: string | null;
    indices: number[];
    uids: (string | number)[];
    primerPar: ParHoya | null;
    segundoPar: ParHoya | null;
}

/** La línea del catálogo de Vitolen de un cristal del carrito, o null si no es uno. Puro. */
export function lineaHoyaDe(item: LineaDeCarrito): string | null {
    const p = item.product;
    const nombre = p?.name || item.productNameSnapshot || '';
    if (!nombre) return null;
    if (p && !isCrystal(p)) return null;
    return cristalVitolenPorNombre(nombre)?.linea ?? null;
}

const precioDe = (it: LineaDeCarrito) => safePrice(it.customPrice ?? it.price) * (it.quantity || 1);

/**
 * Los pares de cristales de Vitolen del carrito. Un par = OD + OI del mismo
 * cristal en el mismo armazón; sin armazón asignado, se arman en orden. Un
 * renglón sin ojo cuenta como par entero. Puro.
 */
export function paresHoya(items: LineaDeCarrito[]): ParHoya[] {
    const pares: (ParHoya & { ojos: Set<string> })[] = [];
    const abiertos = new Map<string, ParHoya & { ojos: Set<string> }>();
    items.forEach((it, i) => {
        const linea = lineaHoyaDe(it);
        if (!linea) return;
        const nombre = it.product?.name || it.productNameSnapshot || '';
        const ojo = it.eye === 'OD' || it.eye === 'OI' ? it.eye : null;
        const pos = it.framePosition ?? null;
        const clave = `${nombre}|${pos ?? 'auto'}`;
        let par = abiertos.get(clave);
        // Un ojo repetido (dos OD del mismo cristal) abre otro par.
        if (!par || !ojo || par.ojos.has(ojo) || par.completo) {
            par = { linea, nombre, indices: [], uids: [], precio: 0, framePosition: pos, completo: false, ojos: new Set() };
            abiertos.set(clave, par);
            pares.push(par);
        }
        par.indices.push(i);
        if (it.uid !== undefined) par.uids.push(it.uid);
        par.precio += precioDe(it);
        if (ojo) par.ojos.add(ojo);
        par.completo = !ojo || (par.ojos.has('OD') && par.ojos.has('OI'));
    });
    return pares.map(({ ojos: _ojos, ...p }) => p);
}

export function descuentoSegundoParHoya(items: LineaDeCarrito[]): DescuentoSegundoParHoya {
    const nada: DescuentoSegundoParHoya = { discount: 0, itemName: null, indices: [], uids: [], primerPar: null, segundoPar: null };
    if (!Array.isArray(items) || items.length === 0) return nada;
    const pares = paresHoya(items).filter(p => p.completo && p.precio > 0);
    const primeros = pares
        .filter(p => (LINEAS_PRIMER_PAR_HOYA as readonly string[]).includes(p.linea))
        .sort((a, b) => b.precio - a.precio);
    for (const primero of primeros) {
        const segundo = pares
            .filter(q => q !== primero
                && (q.linea === primero.linea || (LINEAS_SOLO_SEGUNDO_PAR_HOYA as readonly string[]).includes(q.linea))
                && q.precio <= primero.precio
                && (q.framePosition == null || primero.framePosition == null || q.framePosition !== primero.framePosition))
            .sort((a, b) => b.precio - a.precio)[0];
        if (!segundo) continue;
        const discount = Math.round(segundo.precio * DESCUENTO_SEGUNDO_PAR_HOYA / 100);
        return {
            discount,
            itemName: `2º par Hoya (${segundo.nombre}) -${DESCUENTO_SEGUNDO_PAR_HOYA}%`,
            indices: segundo.indices,
            uids: segundo.uids,
            primerPar: primero,
            segundoPar: segundo,
        };
    }
    return nada;
}
