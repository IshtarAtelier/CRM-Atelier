import type { InvoiceRef } from '../../lab-recon/types';
import { fechaArgentina } from './pedidos';
import { importeArgentino } from './cuenta-corriente';

/**
 * LECTURA DE LAS FACTURAS DE UN PEDIDO DE VITOLEN, la parte pura. Lo prueba
 * `npm run check:lab-modulos` con el texto de un PDF real.
 *
 * Cómo factura Vitolen (verificado el 3/10/2026 sobre el pedido 6981382L):
 *  - `facturacion_automatica.pdf?codigo=<nº de trabajo sin la L>00` trae TODAS
 *    las facturas del pedido, una por página (los cristales en una, el
 *    calibrado en otra, de otra sucursal). Cada página imprime el código del
 *    pedido (9 dígitos) y "REMITO/CASO Nº" (el caso interno, truncado).
 *  - Factura A con IVA discriminado: Gravado, IVA 21 % y TOTAL. Atelier es
 *    monotributo y no recupera el IVA: el costo real es el TOTAL.
 *  - Líneas: código | descripción | cant. | 21,0% | unitario | total. Los
 *    descuentos ("Descuento L241 - 25% …") son líneas negativas; "Recargo
 *    Operativo", positiva. El costo del pedido es la suma de los TOTALES de
 *    sus facturas vigentes (una anulada entera por nota de crédito no cuenta:
 *    eso lo dice la cuenta corriente, cuenta-corriente.ts).
 */

export interface LineaFactura {
    codigo: string;
    descripcion: string;
    cantidad: number;
    unitario: number;
    total: number;
}

export interface FacturaVitolen {
    tipo: 'FA' | 'NCA' | 'OTRO';
    numero: string;            // "0067-01243373"
    fecha: Date | null;
    codigoPedido: string | null; // "698138200"
    pedido: string | null;       // "6981382L"
    caso: string | null;         // "Burban Nahuel -" (truncado por el portal)
    lineas: LineaFactura[];
    gravado: number | null;
    iva: number | null;
    total: number | null;
    /**
     * ¿La suma de las líneas leídas da el gravado? Una descripción partida en
     * dos renglones (la graduación larga de un progresivo) deja la línea sin
     * leer; los importes del comprobante igual salen de los TOTALES.
     */
    lineasCompletas: boolean;
}

/** "698138200" → "6981382L": el código es el nº de trabajo sin la L y con "00" al final. Puro. */
export function pedidoDeCodigo(codigo: string | null | undefined): string | null {
    const m = String(codigo || '').trim().match(/^(\d{5,})00$/);
    return m ? `${m[1]}L` : null;
}

/** Al revés, para armar la URL del PDF a partir del nº de trabajo. Puro. */
export function codigoDePedido(numeroDeTrabajo: string): string | null {
    const m = String(numeroDeTrabajo || '').trim().match(/^(\d{5,})L?$/i);
    return m ? `${m[1]}00` : null;
}

/** Una página del PDF → una factura. Null si la página no es un comprobante. Puro. */
export function parsearFacturaVitolen(textoPagina: string): FacturaVitolen | null {
    const t = textoPagina.replace(/\r/g, '');
    const numero = t.match(/N[ºo°]\s*(\d{4}-\d{8})/)?.[1] ?? null;
    if (!numero) return null;
    const tipo: FacturaVitolen['tipo'] = /Nota de Cr[eé]dito/i.test(t) ? 'NCA' : /Factura/i.test(t) ? 'FA' : 'OTRO';
    const fecha = fechaArgentina(t.match(/Fecha de Emisi[oó]n:\s*(\d{2}\/\d{2}\/\d{4})/)?.[1] ?? null);
    const codigoPedido = t.match(/^(\d{9})\s*$/m)?.[1] ?? null;
    const caso = t.match(/REMITO\/CASO N[ºo°]\s*(.*?)\s*$/m)?.[1]?.trim() || null;
    const lineas: LineaFactura[] = [];
    for (const m of t.matchAll(/^(\d{5,9})\s+(.+?)\s+(\d+)\s+21,0%\s+(-?\$[\d.]+,\d{2})\s+(-?\$[\d.]+,\d{2})\s*$/gm)) {
        lineas.push({
            codigo: m[1],
            descripcion: m[2].replace(/\(\d\)\s*$/, '').replace(/\s+/g, ' ').trim(),
            cantidad: Number(m[3]),
            unitario: importeArgentino(m[4]) ?? 0,
            total: importeArgentino(m[5]) ?? 0,
        });
    }
    const monto = (etiqueta: RegExp) => importeArgentino(t.match(etiqueta)?.[1] ?? null);
    const gravado = monto(/Gravado\s*21[.,]0%\s*(-?\$[\d.]+,\d{2})/);
    const sumaLineas = lineas.reduce((s, l) => s + l.total, 0);
    return {
        tipo, numero, fecha, codigoPedido, pedido: pedidoDeCodigo(codigoPedido), caso, lineas,
        gravado,
        iva: monto(/IVA\s*21[.,]0%\s*(-?\$[\d.]+,\d{2})/),
        total: monto(/^TOTAL\s+(-?\$[\d.]+,\d{2})/m),
        lineasCompletas: gravado !== null && Math.abs(sumaLineas - gravado) < 1,
    };
}

/** Todas las páginas del PDF del pedido → facturas, descartando lo que no es comprobante. Puro. */
export function parsearFacturasDelPedido(paginas: string[]): FacturaVitolen[] {
    return paginas.map(parsearFacturaVitolen).filter((f): f is FacturaVitolen => !!f);
}

export interface CostoFacturado {
    pedido: string;
    billedNet: number | null;
    billedTotal: number | null;
    invoiceDate: Date | null;
    invoiceRefs: InvoiceRef[];
    /** Facturas del PDF que no eran de este pedido o estaban anuladas: no suman. */
    descartadas: string[];
}

/**
 * Lo que el pedido cuesta según sus facturas: suma de las FA vigentes del
 * MISMO pedido (una página de otro pedido en el PDF no suma; una anulada
 * entera por nota de crédito tampoco). Puro.
 */
export function costoFacturadoDelPedido(
    pedido: string,
    facturas: FacturaVitolen[],
    anuladas: Set<string>,
    urlPdf: string | null,
): CostoFacturado {
    const descartadas: string[] = [];
    const vigentes = facturas.filter(f => {
        if (f.tipo !== 'FA') { descartadas.push(`${f.tipo} ${f.numero}`); return false; }
        if (f.pedido && f.pedido !== pedido) { descartadas.push(`FA ${f.numero} es del pedido ${f.pedido}`); return false; }
        if (anuladas.has(`FA ${f.numero}`)) { descartadas.push(`FA ${f.numero} anulada por nota de crédito`); return false; }
        return true;
    });
    const suma = (xs: (number | null)[]) => xs.every(x => x === null) ? null : xs.reduce<number>((s, x) => s + (x ?? 0), 0);
    return {
        pedido,
        billedNet: suma(vigentes.map(f => f.gravado)),
        billedTotal: suma(vigentes.map(f => f.total)),
        invoiceDate: vigentes.map(f => f.fecha).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
        invoiceRefs: vigentes.map(f => ({ comprobante: f.numero, importe: f.total, url: urlPdf, tipo: 'factura' as const })),
        descartadas,
    };
}
