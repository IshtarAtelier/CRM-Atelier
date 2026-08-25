// PUT /api/orders/[id]/items/[itemId]/color — guarda el color de UNA línea.
//
// El color del cristal (el tono del fotocromático, o el color y el grado del
// teñido) se elegía solo mientras se armaba el presupuesto. Una vez guardado,
// corregirlo obligaba a abrir el presupuesto entero para editar y volver a
// guardar todo — con el riesgo de pisar cualquier otra cosa en el camino.
//
// Mismo criterio que el endpoint de armazones: se guarda UNA línea, no toca
// nada más, y una venta ya enviada a fábrica lo rechaza.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { indicesDelMismoTenido } from '@/lib/tenido-sync';

const texto = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
    try {
        const { id, itemId } = await params;

        const order = await prisma.order.findUnique({
            where: { id },
            select: { id: true, isLocked: true, orderType: true, clientId: true },
        });
        if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

        // Una venta enviada a fábrica no se toca por ningún camino: el cristal
        // ya se está fabricando con ese color.
        if (order.isLocked && order.orderType === 'SALE') {
            return NextResponse.json({
                error: 'Venta enviada a fábrica: el color del cristal no se puede modificar. Para corregirlo, un admin debe reabrir el pedido (el cambio queda registrado).',
            }, { status: 409 });
        }

        // La línea tiene que ser de ESTE pedido: sin esta comprobación, un id de
        // item de otro pedido se escribiría igual.
        const item = await prisma.orderItem.findFirst({
            where: { id: itemId, orderId: id },
            select: { id: true, productNameSnapshot: true },
        });
        if (!item) return NextResponse.json({ error: 'La línea no pertenece a este pedido' }, { status: 404 });

        const body = await request.json();
        const datos = {
            crystalColor: texto(body.crystalColor),
            crystalColorType: texto(body.crystalColorType),
            crystalColorNote: texto(body.crystalColorNote),
            framePosition: body.framePosition == null || body.framePosition === ''
                ? null
                : parseInt(String(body.framePosition), 10),
        };

        const guardado = await prisma.orderItem.update({
            where: { id: itemId },
            data: datos,
            select: {
                id: true, crystalColor: true, crystalColorType: true,
                crystalColorNote: true, framePosition: true,
            },
        });

        // El teñido es UNO por anteojo: si esta línea es un teñido viejo
        // partido en OD/OI, el cambio se copia a su línea compañera — sin esto
        // quedaba un ojo Sepia y el otro G15, y la fábrica no sabe cuál vale.
        // Qué líneas son el mismo teñido lo decide gruposDeTenido (promo-utils).
        const lineas = await prisma.orderItem.findMany({
            where: { orderId: id },
            orderBy: { id: 'asc' },
            select: {
                id: true, eye: true, framePosition: true,
                productNameSnapshot: true, productCategorySnapshot: true, productTypeSnapshot: true,
                product: { select: { id: true, name: true, category: true, type: true } },
            },
        });
        const idxEditada = lineas.findIndex(l => l.id === itemId);
        const companeras = idxEditada === -1 ? [] : indicesDelMismoTenido(lineas, idxEditada)
            .filter(i => i !== idxEditada)
            .map(i => lineas[i].id);
        if (companeras.length > 0) {
            await prisma.orderItem.updateMany({ where: { id: { in: companeras } }, data: datos });
        }

        const actor = getActor(request, 'CRM');
        logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'ORDER',
            entityId: id,
            details: {
                evento: 'color_de_cristal',
                producto: item.productNameSnapshot,
                color: datos.crystalColor,
                grado: datos.crystalColorNote,
                armazon: datos.framePosition,
            },
        }).catch(console.error);

        return NextResponse.json({ success: true, item: guardado });
    } catch (error: any) {
        console.error('[Guardar color de cristal] Error:', error.message);
        return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 });
    }
}
