import { NextResponse } from 'next/server';
import { ProductService } from '@/services/product.service';

export async function POST(request: Request) {
    try {
        const { items } = await request.json();

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'Formato inválido: se esperaba una lista de items.' }, { status: 400 });
        }

        const result = await ProductService.bulkCreate(items);
        return NextResponse.json({ success: true, count: result.count });
    } catch (error: any) {
        console.error('Error in bulk creation:', error);
        return NextResponse.json({
            error: 'Error en la carga masiva',
            details: error.message
        }, { status: 500 });
    }
}
