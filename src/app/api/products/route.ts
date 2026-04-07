import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { ProductService } from '@/services/product.service';

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
        return NextResponse.json(product);
    } catch (error: any) {
        console.error('Error creating product:', error);
        return NextResponse.json({
            error: 'Error al crear producto',
            details: error.message
        }, { status: 500 });
    }
}
