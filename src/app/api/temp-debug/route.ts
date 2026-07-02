import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const products = await prisma.webProduct.findMany({
      include: { product: true }
    });
    
    const results = products.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      isActive: p.isActive,
      category: p.category,
      publishToWeb: p.product?.publishToWeb,
      model: p.product?.model,
      brand: p.product?.brand
    }));
    
    return NextResponse.json({ success: true, count: results.length, products: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || error });
  }
}
