import { NextResponse } from 'next/server';
import { ProductService } from '@/services/product.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || '';
        const category = searchParams.get('category'); // LENS, FRAME, SUNGLASS, ACCESSORY
        const type = searchParams.get('type'); // MONOFOCAL, MULTIFOCAL, etc.

        // Simplest: just get all and filter or add a specific search method in service
        const allProducts = await ProductService.getAll();
        
        let filtered = allProducts;
        
        if (query) {
            const lowQuery = query.toLowerCase();
            filtered = filtered.filter(p => 
                (p.name?.toLowerCase().includes(lowQuery)) || 
                (p.brand?.toLowerCase().includes(lowQuery)) || 
                (p.model?.toLowerCase().includes(lowQuery))
            );
        }

        if (category) {
            filtered = filtered.filter(p => p.category === category);
        }

        if (type) {
            filtered = filtered.filter(p => p.type === type);
        }

        return NextResponse.json(filtered.slice(0, 20)); // Limit for LLM efficiency
    } catch (error: any) {
        console.error('[Bot Bridge Products] Error:', error);
        return NextResponse.json({ error: 'Error al consultar catálogo' }, { status: 500 });
    }
}
