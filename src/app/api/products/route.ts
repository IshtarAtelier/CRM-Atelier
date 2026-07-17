import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { ProductService } from '@/services/product.service';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const products = await ProductService.getAll();
        return NextResponse.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        // Only ADMIN can create products
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo el administrador puede cargar productos' }, { status: 403 });
        }

        const body = await request.json();
        const product = await ProductService.create(body);

        // Trazabilidad: quién cargó el producto
        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'PRODUCT',
            entityId: product.id,
            details: { name: product.name, brand: product.brand, price: product.price, cost: product.cost },
        });

        return NextResponse.json(product);
    } catch (error: any) {
        if (error?.name === 'InvalidCostError') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        console.error('Error creating product:', error);
        return NextResponse.json({
            error: 'Error al crear producto',
            details: error.message
        }, { status: 500 });
    }
}
