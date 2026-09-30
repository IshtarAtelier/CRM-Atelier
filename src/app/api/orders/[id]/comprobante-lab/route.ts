import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { parseLabNumbers } from '@/lib/lab-order-numbers';
import { labNameFor } from '@/lib/lab-orders';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';
import { LAB_LABELS, labKeyDeNombre } from '@/services/lab-recon/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/[id]/comprobante-lab
 *
 * Carga A MANO el comprobante (factura o remito) que el laboratorio emitió por
 * el pedido de esta venta, para CUALQUIER laboratorio. No es un campo suelto de
 * la venta: se registra en el cruce de costos (`LabCostEntry`), que es donde
 * viven los comprobantes de Optovisión y Grupo Óptico que llegan solos. Así la
 * venta muestra su factura y, en el mismo acto, el cruce dice si lo facturado
 * cerró con el costo cargado o hay diferencia para reclamar.
 *
 * Por qué existe (30/9/2026): la Cámara de Ópticas no tiene portal ni correo
 * parseable, y sus tres facturas de agosto/septiembre —$114.841 por un bifocal
 * cargado a $23.100— no las veía nadie.
 *
 * Body: { comprobante: "FC A 00002-00152120", importe: 114841.10,
 *         fecha?: "2026-08-26", tipo?: "factura" | "remito",
 *         labOrderNumber?: "163327" (si la venta tiene varios pedidos) }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const actor = getActor(request);
        const body = await request.json().catch(() => ({}));

        const comprobante = String(body.comprobante || '').trim();
        const importe = Number(body.importe);
        const tipo: 'factura' | 'remito' = body.tipo === 'remito' ? 'remito' : 'factura';
        const fecha = body.fecha ? new Date(body.fecha) : null;
        if (!comprobante) return NextResponse.json({ error: 'Falta el número de comprobante.' }, { status: 400 });
        if (!Number.isFinite(importe) || importe <= 0) return NextResponse.json({ error: 'El importe tiene que ser mayor a cero.' }, { status: 400 });
        if (fecha && Number.isNaN(fecha.getTime())) return NextResponse.json({ error: 'La fecha no es válida.' }, { status: 400 });

        const order = await prisma.order.findUnique({
            where: { id },
            select: {
                id: true, labOrderNumber: true, isDeleted: true,
                items: { select: { laboratorySnapshot: true, productCategorySnapshot: true, product: { select: { laboratory: true, category: true } } } },
            },
        });
        if (!order || order.isDeleted) return NextResponse.json({ error: 'Venta no encontrada.' }, { status: 404 });

        const numeros = parseLabNumbers(order.labOrderNumber);
        if (numeros.length === 0) {
            return NextResponse.json({ error: 'La venta no tiene N° de operación del laboratorio: cargalo primero, es la llave para cruzar la factura.' }, { status: 400 });
        }
        const pedido = body.labOrderNumber ? String(body.labOrderNumber).trim() : numeros[0];
        if (!numeros.includes(pedido)) {
            return NextResponse.json({ error: `El pedido ${pedido} no es de esta venta (tiene ${numeros.join(', ')}).` }, { status: 400 });
        }

        const lab = labKeyDeNombre(labNameFor(order.items));
        if (!lab) {
            return NextResponse.json({ error: 'No se reconoce el laboratorio de los cristales de esta venta.' }, { status: 400 });
        }

        const entry = await LabCostReconciliationService.upsertEntry({
            lab,
            labOrderNumber: pedido,
            // Se guarda como total: es lo que dice el comprobante en mano. Para
            // Optovisión y la Cámara (Factura A) es el comparable; para Grupo
            // Óptico neto y total coinciden.
            billedTotal: importe,
            billedNet: lab === 'GRUPO_OPTICO' ? importe : null,
            source: 'MANUAL',
            sourceFile: null,
            invoiceDate: fecha,
            notes: `${tipo === 'remito' ? 'Remito' : 'Factura'} ${comprobante} cargado a mano por ${actor.name}`,
            invoiceRefs: [{ comprobante, importe, url: null, tipo }],
        });
        if (!entry) {
            return NextResponse.json({ error: 'No se pudo registrar el comprobante.' }, { status: 500 });
        }

        await logAudit({
            userId: actor.id, userName: actor.name,
            action: 'UPDATE', entityType: 'LAB_COST_ENTRY', entityId: entry.id,
            details: { orderId: id, lab, labOrderNumber: pedido, comprobante, importe, tipo, status: entry.status, difference: entry.difference },
        });

        return NextResponse.json({
            ok: true,
            entry: {
                id: entry.id, lab: entry.lab, labLabel: LAB_LABELS[entry.lab] || entry.lab,
                labOrderNumber: entry.labOrderNumber, status: entry.status, difference: entry.difference,
                billedTotal: entry.billedTotal, billedNet: entry.billedNet, invoiceRefs: entry.invoiceRefs,
            },
        });
    } catch (error: any) {
        console.error('[comprobante-lab] Error:', error);
        return NextResponse.json({ error: error.message || 'Error al guardar el comprobante' }, { status: 500 });
    }
}
