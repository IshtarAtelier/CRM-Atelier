import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

/**
 * CIERRE ECONÓMICO DE UN CASO DE POST VENTA: imputar el costo como descuento en
 * la caja de quien cometió el error.
 *
 * El circuito, tal como lo definió el administrador (2/8/2026):
 *   1. El vendedor carga una ESTIMACIÓN del costo al abrir el caso.
 *   2. Cuando el laboratorio facturó TODAS las operaciones del caso (las dos, si
 *      son dos), la conciliación pisa la estimación con el valor real
 *      (costSource = 'LAB') y le manda UN email al administrador con todo el
 *      detalle. Ver completePostSaleCost en services/lab-recon.
 *   3. El administrador revisa ese email y dispara el cobro. Un solo paso: al
 *      imputar queda registrada la corroboración, porque el acto de imputar ES
 *      la corroboración.
 *
 * Por qué el paso 2 espera a TODAS las operaciones: el monto que carga el
 * vendedor puede no coincidir con lo que factura el lab, y con una sola de las
 * dos facturas el costo todavía no es el final. La plata no se mueve hasta que
 * el número está cerrado y un humano lo miró.
 *
 * El disparo vive acá adentro (sesión autenticada, rol ADMIN) y no en un link
 * del email: es un movimiento de plata, y un link que cobra solo con abrirlo se
 * dispara con un reenvío o una previsualización del cliente de correo. El email
 * lleva todo el detalle y el acceso directo al caso.
 */

/** ¿A qué caja va el descuento? */
function cajaDelCaso(pvCase: { fault: string | null; faultUserId: string | null }) {
    // La atribución solo distingue Laboratorio/Óptica/Cliente/Médico. Solo
    // cuando el error fue de la ÓPTICA hay una persona a la que descontarle, y
    // esa persona se elige en el caso (faultUserId). Todo lo demás lo absorbe
    // Atelier → caja del administrador.
    if (pvCase.fault === 'Óptica' && pvCase.faultUserId) {
        return { vendorId: pvCase.faultUserId, loCubreAtelier: false };
    }
    return { vendorId: null, loCubreAtelier: true };
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const actor = getActor(request);
        if (actor.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Solo el administrador puede corroborar e imputar el costo de un caso' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const body = await request.json().catch(() => ({}));

        const pvCase = await prisma.postSaleCase.findUnique({
            where: { id },
            select: {
                id: true, cost: true, costSource: true, cashEntryId: true,
                fault: true, faultUserId: true, caseType: true,
                orderLabel: true, newOrderNumber: true,
                client: { select: { name: true } },
            },
        });
        if (!pvCase) {
            return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
        }

        if (pvCase.cashEntryId) {
            return NextResponse.json(
                { error: 'El costo de este caso ya fue imputado a caja.' },
                { status: 409 }
            );
        }
        // El portón del circuito: mientras el costo sea la estimación del
        // vendedor no hay nada que cobrar. costSource pasa a 'LAB' recién cuando
        // el laboratorio facturó TODAS las operaciones del caso.
        if (pvCase.costSource !== 'LAB') {
            return NextResponse.json({
                error: 'Todavía no está el costo real del laboratorio: falta la factura de alguna de las operaciones del caso.',
            }, { status: 409 });
        }
        if (!(pvCase.cost > 0)) {
            return NextResponse.json(
                { error: 'El caso no tiene costo que imputar (sin cargo).' },
                { status: 409 }
            );
        }

        const { vendorId, loCubreAtelier } = cajaDelCaso(pvCase);
        // Si lo cubre Atelier el descuento va a la caja del administrador que
        // está imputando (caja Ishtar). Se puede redirigir a otra caja pasando
        // vendorId explícito, para los casos que la atribución no cubre bien.
        const destinoId = String(body.vendorId || '') || vendorId || actor.id;
        if (!destinoId) {
            return NextResponse.json({ error: 'No se pudo resolver la caja de destino' }, { status: 400 });
        }
        const vendor = await prisma.user.findUnique({
            where: { id: destinoId },
            select: { id: true, name: true, role: true },
        });
        if (!vendor || vendor.role === 'OPTICA') {
            return NextResponse.json({ error: 'La caja de destino no es válida' }, { status: 404 });
        }

        // Nombre del caso, para que el movimiento se entienda desde la caja sin
        // tener que volver al caso.
        const nombreCaso = [
            'Post venta',
            pvCase.client?.name,
            pvCase.caseType,
            pvCase.newOrderNumber ? `OP ${pvCase.newOrderNumber}` : pvCase.orderLabel,
        ].filter(Boolean).join(' · ');

        // El movimiento y el candado del caso van juntos: si algo falla en el
        // medio, no queda ni un descuento sin caso ni un caso marcado sin
        // descuento. El @unique de cashEntryId cubre además el doble click.
        const { entry } = await prisma.$transaction(async tx => {
            const entry = await tx.vendorCashEntry.create({
                data: {
                    vendorId: vendor.id,
                    type: 'DEBITO',
                    amount: pvCase.cost,
                    reason: nombreCaso,
                    category: 'POST_VENTA',
                    createdById: actor.id,
                    createdByName: actor.name,
                },
            });
            await tx.postSaleCase.update({
                where: { id, cashEntryId: null },
                data: {
                    cashEntryId: entry.id,
                    // Imputar ES corroborar: el administrador miró el número y lo
                    // dio por bueno en el mismo acto.
                    costConfirmedAt: new Date(),
                    costConfirmedBy: actor.name,
                },
            });
            await tx.postSaleNote.create({
                data: {
                    caseId: id,
                    content: `${actor.name} corroboró el costo e imputó $${Math.round(pvCase.cost).toLocaleString('es-AR')} como descuento en la caja de ${vendor.name}${loCubreAtelier ? ' (lo cubre Atelier)' : ''}.`,
                    createdBy: 'Sistema',
                },
            });
            return { entry };
        });

        await logAudit({
            userId: actor.id, userName: actor.name, action: 'CREATE',
            entityType: 'VENDOR_CASH', entityId: entry.id,
            details: {
                evento: 'imputacion_postventa', caseId: id, vendorId: vendor.id,
                vendorName: vendor.name, monto: pvCase.cost, loCubreAtelier,
            },
        });
        return NextResponse.json({ ok: true, entry, vendorName: vendor.name, loCubreAtelier });
    } catch (error: any) {
        console.error('Error en el cierre económico del caso de post venta:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
