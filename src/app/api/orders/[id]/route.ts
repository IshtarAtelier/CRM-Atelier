import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { ContactService } from '@/services/contact.service';
import { prisma } from '@/lib/db';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const reason = searchParams.get('reason') || 'Sin motivo especificado';
        // Read role from secure middleware header
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';

        // Only ADMIN can delete orders
        if (role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Solo el administrador puede eliminar operaciones. Solicitá la eliminación desde el panel de ventas.' },
                { status: 403 }
            );
        }

        const order = await ContactService.deleteOrder(id, reason);
        return NextResponse.json(order);
    } catch (error) {
        console.error('Error deleting order:', error);
        return NextResponse.json({ error: 'Error al eliminar el pedido' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { labStatus, labNotes, orderType, labOrderNumber, frameSource, userFrameBrand, userFrameModel, userFrameNotes, labColor, labTreatment, labDiameter, labPdOd, labPdOi } = body;

        const data: any = {};
        if (labStatus) {
            data.labStatus = labStatus;
            if (labStatus === 'SENT') {
                data.labSentAt = new Date();
            }
        }
        if (labNotes !== undefined) data.labNotes = labNotes;
        if (labOrderNumber !== undefined) data.labOrderNumber = labOrderNumber;

        // Frame data updates
        if (frameSource !== undefined) data.frameSource = frameSource;
        if (userFrameBrand !== undefined) data.userFrameBrand = userFrameBrand;
        if (userFrameModel !== undefined) data.userFrameModel = userFrameModel;
        if (userFrameNotes !== undefined) data.userFrameNotes = userFrameNotes;

        // SmartLab lab fields
        if (labColor !== undefined) data.labColor = labColor;
        if (labTreatment !== undefined) data.labTreatment = labTreatment;
        if (labDiameter !== undefined) data.labDiameter = labDiameter;
        if (labPdOd !== undefined) data.labPdOd = labPdOd;
        if (labPdOi !== undefined) data.labPdOi = labPdOi;

        if (orderType) {
            // Prevent reverting a SALE back to QUOTE
            if (orderType === 'QUOTE') {
                const current = await prisma.order.findUnique({ where: { id } });
                if (current?.orderType === 'SALE') {
                    return NextResponse.json(
                        { error: 'No se puede revertir una venta a presupuesto' },
                        { status: 400 }
                    );
                }
            }
            // Validation: when converting QUOTE → SALE
            if (orderType === 'SALE') {
                const existingOrder = await prisma.order.findUnique({
                    where: { id },
                    include: {
                        items: { include: { product: true } },
                        payments: true,
                        client: true,
                    },
                });

                if (!existingOrder) {
                    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
                }

                // Check: client must have name and phone at minimum
                const client = existingOrder.client;
                if (!client?.name || !client?.phone || !client?.dni || !client?.address) {
                    return NextResponse.json({
                        error: 'La ficha del contacto debe estar completa (nombre, teléfono, DNI y dirección obligatorios)'
                    }, { status: 400 });
                }

                // Check: 40% minimum payment
                const minRequired = (existingOrder.total || 0) * 0.4;
                const totalPaid = existingOrder.paid || 0;
                if (totalPaid < minRequired) {
                    return NextResponse.json({
                        error: `Se requiere un pago mínimo del 40% ($${Math.ceil(minRequired).toLocaleString()}) para convertir en venta. Pagado: $${totalPaid.toLocaleString()}`
                    }, { status: 400 });
                }

                // Check: if order has crystals, frame info must be set
                const hasCrystals = existingOrder.items?.some((item: any) =>
                    item.product?.type === 'Cristal' || item.product?.category === 'LENS'
                );

                if (hasCrystals && !existingOrder.prescriptionId) {
                    return NextResponse.json({
                        error: 'Si el pedido incluye cristales, debe tener una receta seleccionada'
                    }, { status: 400 });
                }

                const effectiveFrameSource = frameSource || existingOrder.frameSource;
                if (hasCrystals && !effectiveFrameSource) {
                    return NextResponse.json({
                        error: 'Si el pedido incluye cristales, debe seleccionar un armazón (de la óptica o del usuario)'
                    }, { status: 400 });
                }
                if (hasCrystals && effectiveFrameSource === 'USUARIO') {
                    const effBrand = userFrameBrand || existingOrder.userFrameBrand;
                    const effModel = userFrameModel || existingOrder.userFrameModel;
                    if (!effBrand && !effModel) {
                        return NextResponse.json({
                            error: 'Debe completar al menos la marca o modelo del armazón del usuario'
                        }, { status: 400 });
                    }
                }

                // Check: stock availability for non-crystal products
                const stockItems = (existingOrder.items || []).filter((item: any) => {
                    const cat = item.product?.category;
                    const type = item.product?.type;
                    const isCrystal = cat === 'LENS' || (type || '').includes('Cristal');
                    return !isCrystal;
                });
                const insufficientStock: string[] = [];
                for (const item of stockItems) {
                    const product = item.product;
                    if (product && product.stock < item.quantity) {
                        const name = `${product.brand || ''} ${product.model || product.name || ''}`.trim();
                        insufficientStock.push(`${name}: stock ${product.stock}, necesitás ${item.quantity}`);
                    }
                }
                if (insufficientStock.length > 0) {
                    return NextResponse.json({
                        error: `Stock insuficiente:\n${insufficientStock.join('\n')}`
                    }, { status: 400 });
                }
            }

            data.orderType = orderType;
            // When converting to SALE, automatically send to lab
            if (orderType === 'SALE' && !labStatus) {
                data.labStatus = 'SENT';
                data.labSentAt = new Date();
            }

            // Stock decrement: when converting to SALE, atomically decrement stock
            if (orderType === 'SALE') {
                const orderForStock = await prisma.order.findUnique({
                    where: { id },
                    include: { items: { include: { product: true } } },
                });
                const stockItems = (orderForStock?.items || []).filter((item: any) => {
                    const cat = item.product?.category;
                    const type = item.product?.type;
                    return !(cat === 'LENS' || (type || '').includes('Cristal'));
                });

                const stockUpdates = stockItems.map((item: any) =>
                    prisma.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.quantity } },
                    })
                );

                const [updatedOrder] = await prisma.$transaction([
                    prisma.order.update({
                        where: { id },
                        data,
                        include: {
                            items: { include: { product: true } },
                            payments: true,
                        },
                    }),
                    ...stockUpdates,
                ]);

                return NextResponse.json(updatedOrder);
            }
        }

        const order = await prisma.order.update({
            where: { id },
            data,
            include: {
                items: { include: { product: true } },
                payments: true,
            },
        });
        return NextResponse.json(order);
    } catch (error: any) {
        console.error('Error updating order:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
