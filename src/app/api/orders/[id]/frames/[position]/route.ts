// PUT /api/orders/[id]/frames/[position] — guarda UN armazón del pedido.
//
// Cada armazón se guarda solo: el vendedor mide uno, lo guarda, y recién
// después agarra el siguiente. Si el guardado fuera uno solo al final, cerrar
// la pestaña en el medio perdía la mitad del trabajo.
//
// Escribe la fila de `OrderFrame` y, para las posiciones 1 y 2, ESPEJA a las
// columnas viejas del pedido (frameA…, frameA2…). Ese espejo no es adorno: hay
// pantallas y procesos que todavía leen esas columnas —SmartLab, el PDF, los
// paneles de laboratorio— y romperlos sería peor que la deuda de mantenerlo.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

/** Columnas viejas equivalentes, para las dos primeras posiciones. */
const ESPEJO: Record<number, Record<string, string>> = {
    1: { shape: 'labFrameShape', a: 'frameA', b: 'frameB', dbl: 'frameDbl', edc: 'frameEdc', details: 'labFrameDetails', imageUrl: 'frameImageUrl', heightOD: 'labHeightOD', heightOI: 'labHeightOI' },
    2: { shape: 'labFrameShape2', a: 'frameA2', b: 'frameB2', dbl: 'frameDbl2', edc: 'frameEdc2', details: 'labFrameDetails2', imageUrl: 'frameImageUrl2', heightOD: 'labHeightOD2', heightOI: 'labHeightOI2' },
};

const texto = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
const numero = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(String(v));
    return isNaN(n) ? null : n;
};

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; position: string }> }) {
    try {
        const { id, position } = await params;
        const pos = parseInt(position, 10);
        if (!Number.isInteger(pos) || pos < 1 || pos > 20) {
            return NextResponse.json({ error: 'Posición de armazón inválida' }, { status: 400 });
        }

        const order = await prisma.order.findUnique({
            where: { id },
            select: { id: true, isLocked: true, orderType: true, clientId: true },
        });
        if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

        const actor = getActor(request, 'CRM');
        const body = await request.json();

        const datos = {
            shape: texto(body.shape), a: texto(body.a), b: texto(body.b),
            dbl: texto(body.dbl), edc: texto(body.edc), details: texto(body.details),
            imageUrl: texto(body.imageUrl),
            heightOD: numero(body.heightOD), heightOI: numero(body.heightOI),
        };

        // Venta ya enviada a fábrica: lo único que se puede seguir agregando es
        // la FOTO. Documenta lo que se vendió; no cambia una sola medida de lo
        // que la fábrica está fabricando. Todo lo demás exige reabrir el pedido.
        if (order.isLocked && order.orderType === 'SALE') {
            const actual = await prisma.orderFrame.findUnique({
                where: { orderId_position: { orderId: id, position: pos } },
            });
            const cambiaAlgoMas = (['shape', 'a', 'b', 'dbl', 'edc', 'details', 'heightOD', 'heightOI'] as const)
                .some(k => (actual ? (actual as any)[k] ?? null : null) !== (datos as any)[k]);
            if (cambiaAlgoMas) {
                return NextResponse.json({
                    error: 'Venta enviada a fábrica: las medidas del armazón no se pueden modificar. Para corregirlas, un admin debe reabrir el pedido (el cambio queda registrado).',
                }, { status: 409 });
            }
        }

        const guardado = await prisma.orderFrame.upsert({
            where: { orderId_position: { orderId: id, position: pos } },
            create: { orderId: id, position: pos, ...datos },
            update: datos,
        });

        // Espejo a las columnas viejas (solo 1 y 2): lo que todavía las lee
        // tiene que seguir viendo lo mismo.
        const mapa = ESPEJO[pos];
        if (mapa) {
            const legacy: Record<string, unknown> = {};
            Object.entries(mapa).forEach(([k, col]) => { legacy[col] = (datos as any)[k]; });
            await prisma.order.update({ where: { id }, data: legacy });
        }

        logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'ORDER',
            entityId: id,
            details: { evento: 'armazon_guardado', posicion: pos, conFoto: !!datos.imageUrl },
        }).catch(console.error);

        return NextResponse.json({ success: true, frame: guardado });
    } catch (error: any) {
        console.error('[Guardar armazón] Error:', error.message);
        return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 });
    }
}
