import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const products = await prisma.webProduct.findMany({
      where: {
        OR: [
          { slug: 'clipon-tr12173' },
          { slug: 'clip-on-tr12173' },
          { slug: 'clipon-g5919' },
          { slug: 'clip-on-g5919-c1' },
          { slug: 'clipon-a12183' },
          { slug: 'clip-on-a12183-c2' },
          { slug: 'clipon-mlt25026' },
          { slug: 'clip-on-mlt25026-c1' }
        ]
      },
      include: { 
        product: {
          include: {
            _count: {
              select: { orderItems: true }
            }
          }
        }
      }
    });
    
    return NextResponse.json({ success: true, count: products.length, products });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || error });
  }
}
