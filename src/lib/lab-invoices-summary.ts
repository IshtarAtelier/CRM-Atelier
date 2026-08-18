// ────────────────────────────────────────────────────────────────────────────
// Las facturas del laboratorio de una venta, listas para mostrar.
//
// El dato ya existía: la conciliación (`LabCostEntry`) viene guardando el número
// de comprobante de los dos labs desde hace meses —343 de Grupo Óptico y 57 de
// Optovision al 18/8/2026— y lo cruza contra el pedido de la venta Y contra los
// números de operación de los casos de post-venta. Lo que faltaba era mostrarlo:
// vivía solo en los mails de conciliación, así que ante un "¿con qué factura vino
// este pedido?" había que ir a buscarlo al mail.
//
// Un solo helper porque el mismo dato va en dos pantallas (la venta y el caso de
// post-venta) y tienen que decir lo mismo — mismo criterio, mismo formato.
//
// UNA VENTA PUEDE TENER VARIAS FACTURAS, y por dos motivos distintos:
//   · el 2x1 y los pedidos partidos entran al lab como dos operaciones;
//   · cada caso de post-venta genera su propio número de operación, que se
//     factura aparte (`PostSaleCase.newOrderNumber`, que a su vez admite varios
//     números si el caso rehizo los dos pares).
// ────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/db';

/** Nombre lindo del laboratorio, para mostrar. */
export function nombreDelLab(lab: string): string {
    if (lab === 'GRUPO_OPTICO') return 'Grupo Óptico';
    if (lab === 'OPTOVISION') return 'Optovision';
    return lab;
}

/**
 * El número de comprobante, sin el prefijo con que lo guarda cada proveedor.
 *
 * Grupo Óptico lo escribe `Fact 0004-00345504` y Optovision guarda el nombre del
 * PDF adjunto, `FA_3008-00073752.pdf`. Los dos traen el número real adentro, con
 * el formato de AFIP `NNNN-NNNNNNNN`. Si no matchea se devuelve lo que haya
 * limpio, antes que mostrar un campo vacío.
 */
export function numerosDeFactura(sourceFile: string | null | undefined): string[] {
    if (!sourceFile) return [];
    // Todas, no la primera: un pedido puede venir en varios comprobantes y el
    // scraper los guarda separados por coma ("Fact 0004-001, 0004-002").
    const encontrados = String(sourceFile).match(/\d{3,5}-\d{4,10}/g);
    if (encontrados?.length) return [...new Set(encontrados)];
    const limpio = String(sourceFile).replace(/\.pdf$/i, '').replace(/^(Fact|FA)[_\s]*/i, '').trim();
    return limpio ? [limpio] : [];
}

/** El primero, para los lugares que muestran uno solo. */
export function numeroDeFactura(sourceFile: string | null | undefined): string | null {
    return numerosDeFactura(sourceFile)[0] ?? null;
}

export interface FacturaDeLab {
    /** Número de comprobante ya limpio: "0004-00345504". */
    numero: string | null;
    /** GRUPO_OPTICO | OPTOVISION | … */
    lab: string;
    labNombre: string;
    /** Número de operación/pedido del laboratorio con el que vino. */
    pedidoLab: string;
    fecha: Date | null;
    importe: number | null;
    /** UNMATCHED | OK | OVERCOST | UNDERCOST | PENDING */
    estado: string;
    /** true si esta factura corresponde a un caso de post-venta y no a la venta original. */
    dePostVenta: boolean;
    /** Id del caso de post-venta, cuando corresponde. */
    postSaleCaseId?: string;
}

/** Los números de operación de laboratorio que hay que buscar, por venta. */
interface ClavesDeVenta {
    orderId: string;
    /** El de la venta original. */
    propio: string | null;
    /** Los de los casos de post-venta: número → id del caso. */
    postVenta: Map<string, string>;
}

/** Extrae los números de operación de un campo de texto libre. */
function numerosDe(txt: string | null | undefined): string[] {
    return String(txt || '').match(/\d{4,}/g) || [];
}

/**
 * Busca las facturas de un conjunto de ventas, en UNA sola consulta.
 *
 * Pensado para la lista de ventas, que muestra decenas: hacer una consulta por
 * venta la volvería lenta sin necesidad.
 *
 * @param ordenes las ventas con su número de operación y sus casos de post-venta
 * @returns un mapa orderId → facturas encontradas
 */
export async function facturasDeLasVentas(
    ordenes: Array<{
        id: string;
        labOrderNumber?: string | null;
        postSaleCases?: Array<{ id: string; newOrderNumber?: string | null }> | null;
    }>,
): Promise<Map<string, FacturaDeLab[]>> {
    const resultado = new Map<string, FacturaDeLab[]>();
    if (!ordenes?.length) return resultado;

    const claves: ClavesDeVenta[] = ordenes.map(o => {
        const postVenta = new Map<string, string>();
        for (const c of o.postSaleCases || []) {
            for (const n of numerosDe(c.newOrderNumber)) postVenta.set(n, c.id);
        }
        return {
            orderId: o.id,
            propio: (numerosDe(o.labOrderNumber)[0] || o.labOrderNumber || null),
            postVenta,
        };
    });

    const todosLosNumeros = [...new Set(
        claves.flatMap(c => [...(c.propio ? numerosDe(c.propio) : []), ...c.postVenta.keys()]),
    )];
    if (!todosLosNumeros.length) return resultado;

    const entradas = await prisma.labCostEntry.findMany({
        where: {
            OR: [
                { labOrderNumber: { in: todosLosNumeros } },
                { orderId: { in: ordenes.map(o => o.id) } },
            ],
        },
        select: {
            lab: true, labOrderNumber: true, orderId: true,
            sourceFile: true, invoiceDate: true, billedTotal: true, status: true,
        },
    });

    for (const c of claves) {
        const propios = c.propio ? numerosDe(c.propio) : [];
        const facturas: FacturaDeLab[] = [];

        for (const e of entradas) {
            const esPostVenta = c.postVenta.has(e.labOrderNumber);
            const esPropio = propios.includes(e.labOrderNumber);
            // La entrada también cuenta si la conciliación la colgó de esta venta
            // aunque el número no matchee (pasa cuando el lab factura con un
            // número de un rango).
            const colgadaDeEstaVenta = e.orderId === c.orderId;
            if (!esPostVenta && !esPropio && !colgadaDeEstaVenta) continue;

            // Un pedido puede venir en VARIOS comprobantes: se lista cada uno.
            // Sin ninguno no hay nada que mostrar — es un pedido que el
            // laboratorio todavía no facturó.
            const numeros = numerosDeFactura(e.sourceFile);
            if (!numeros.length) continue;

            for (const numero of numeros) {
                // Sin duplicados: el mismo comprobante puede venir por dos caminos.
                if (facturas.some(f => f.numero === numero && f.pedidoLab === e.labOrderNumber)) continue;

                facturas.push({
                    numero,
                    lab: e.lab,
                    labNombre: nombreDelLab(e.lab),
                    pedidoLab: e.labOrderNumber,
                    fecha: e.invoiceDate,
                    // El importe es del PEDIDO, no de cada comprobante: cuando
                    // son varios no se puede repartir sin inventar. Se muestra
                    // solo en el primero para no sumarlo de más al leerlo.
                    importe: numero === numeros[0] ? e.billedTotal : null,
                    estado: e.status,
                    dePostVenta: esPostVenta && !esPropio,
                    ...(esPostVenta && !esPropio ? { postSaleCaseId: c.postVenta.get(e.labOrderNumber) } : {}),
                });
            }
        }

        // Las de la venta primero, después las de post-venta, y dentro de cada
        // grupo por fecha: es el orden en que ocurrieron.
        facturas.sort((a, b) =>
            Number(a.dePostVenta) - Number(b.dePostVenta) ||
            (a.fecha?.getTime() || 0) - (b.fecha?.getTime() || 0));

        if (facturas.length) resultado.set(c.orderId, facturas);
    }

    return resultado;
}
