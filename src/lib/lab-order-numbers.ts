import { prisma } from '@/lib/db';

/**
 * EL Nº DE OPERACIÓN ES ÚNICO. Es la llave que ata un pedido del laboratorio a
 * una venta: la factura del lab llega con ese número y por ahí se cruza el costo.
 * Si el mismo número está en dos ventas, no hay forma de saber a cuál pertenece
 * la factura — y el costo termina colgado de la venta equivocada.
 *
 * El campo `labOrderNumber` guarda TEXTO LIBRE y suele traer varios números
 * ("588062 - 588065", "3578631 - Ficha"), porque una venta 2x1 tiene un pedido
 * por par. Por eso la comparación NO puede ser por string completo —así se
 * escapó el caso real de 588049, cargado en "588057 - 588049" y en
 * "587998 - 588049"—: hay que comparar número por número.
 */

/** Los números de operación reales del campo (4+ dígitos), sin repetir. */
export function parseLabNumbers(value: string | null | undefined): string[] {
    return [...new Set((value || '').match(/\d{4,}/g) || [])];
}

export interface LabNumberConflict {
    numero: string;
    tipo: 'VENTA' | 'POSTVENTA';
    orderId: string | null;
    orderShort: string;
    clientId: string | null;
    cliente: string;
    labOrderNumber: string | null;
    labSentAt: Date | null;
    vendedor: string | null;
}

/**
 * Devuelve, para cada número, dónde más está usado. Vacío = se puede guardar.
 * `excludeOrderId` es el pedido que se está editando (que obviamente puede
 * conservar su propio número).
 */
export async function findLabNumberConflicts(params: {
    value: string | null | undefined;
    excludeOrderId?: string | null;
}): Promise<LabNumberConflict[]> {
    const numeros = parseLabNumbers(params.value);
    if (numeros.length === 0) return [];

    const conflictos: LabNumberConflict[] = [];

    const ventas = await prisma.order.findMany({
        where: {
            isDeleted: false,
            ...(params.excludeOrderId ? { id: { not: params.excludeOrderId } } : {}),
            OR: numeros.map(n => ({ labOrderNumber: { contains: n } })),
        },
        select: {
            id: true, labOrderNumber: true, labSentAt: true, clientId: true,
            client: { select: { name: true } },
            user: { select: { name: true } },
        },
        take: 20,
    });
    for (const v of ventas) {
        // `contains` matchea por substring ("8049" dentro de "588049"): confirmar
        // que el número esté como número entero del otro pedido.
        const suyos = parseLabNumbers(v.labOrderNumber);
        for (const n of numeros) {
            if (!suyos.includes(n)) continue;
            conflictos.push({
                numero: n, tipo: 'VENTA', orderId: v.id, orderShort: v.id.slice(-4).toUpperCase(),
                clientId: v.clientId, cliente: v.client?.name?.trim() || 'Cliente',
                labOrderNumber: v.labOrderNumber, labSentAt: v.labSentAt, vendedor: v.user?.name || null,
            });
        }
    }

    // Un reproceso de postventa también toma un nº de operación propio: repetirlo
    // rompe el cruce igual que en una venta.
    const casos = await prisma.postSaleCase.findMany({
        where: {
            ...(params.excludeOrderId ? { orderId: { not: params.excludeOrderId } } : {}),
            OR: numeros.map(n => ({ newOrderNumber: { contains: n } })),
        },
        select: {
            id: true, newOrderNumber: true, orderId: true, clientId: true, createdAt: true,
            client: { select: { name: true } },
        },
        take: 20,
    });
    for (const c of casos) {
        const suyos = parseLabNumbers(c.newOrderNumber);
        for (const n of numeros) {
            if (!suyos.includes(n)) continue;
            conflictos.push({
                numero: n, tipo: 'POSTVENTA', orderId: c.orderId, orderShort: (c.orderId || c.id).slice(-4).toUpperCase(),
                clientId: c.clientId, cliente: c.client?.name?.trim() || 'Cliente',
                labOrderNumber: c.newOrderNumber, labSentAt: c.createdAt, vendedor: null,
            });
        }
    }

    return conflictos;
}

/** Mensaje único, igual en el aviso en vivo y en el rechazo del servidor. */
export function duplicateMessage(conflictos: LabNumberConflict[]): string {
    if (conflictos.length === 0) return '';
    const porNumero = new Map<string, LabNumberConflict[]>();
    for (const c of conflictos) {
        if (!porNumero.has(c.numero)) porNumero.set(c.numero, []);
        porNumero.get(c.numero)!.push(c);
    }
    const partes = [...porNumero.entries()].map(([numero, cs]) => {
        const donde = cs.map(c => `${c.tipo === 'POSTVENTA' ? 'la postventa' : 'la venta'} de ${c.cliente} (#${c.orderShort})`).join(' y ');
        return `El N° ${numero} ya está en ${donde}`;
    });
    return `${partes.join('. ')}. Un número de operación no se puede repetir: la factura del laboratorio se cruza por ese número.`;
}
