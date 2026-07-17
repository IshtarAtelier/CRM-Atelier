import { NextResponse } from 'next/server';
import { ProductService } from '@/services/product.service';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Acceso denegado. Se requiere rol ADMIN.' }, { status: 403 });
        }

        const { items } = await request.json();

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'Formato inválido: se esperaba una lista de items.' }, { status: 400 });
        }

        const result = await ProductService.bulkCreate(items);

        // Trazabilidad: quién hizo la carga masiva y cuántos productos entraron
        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'PRODUCT',
            entityId: 'BULK',
            details: { count: result.count },
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (error: any) {
        if (error?.name === 'InvalidCostError') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        console.error('Error in bulk creation:', error);
        return NextResponse.json({
            error: 'Error en la carga masiva',
            details: error.message
        }, { status: 500 });
    }
}
