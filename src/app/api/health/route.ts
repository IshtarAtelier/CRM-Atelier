import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Health check para monitoreo externo (cron-job.org):
//   200 → app viva, DB arriba y catálogo con productos publicables.
//   503 → DB caída (db:down) o catálogo en cero (status:degraded), para que la
//         alerta salte ANTES de que alguien vea la tienda sin productos.
// Nota: aunque el catálogo dé 0, la home sigue mostrando productos por el
// fallback de src/lib/home-products.ts — esto es la alarma, no el airbag.
export async function GET() {
  try {
    const products = await Promise.race([
      prisma.webProduct.count({
        where: { isActive: true, product: { publishToWeb: true, category: { not: 'Cristal' } } },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout (5s)')), 5000)
      ),
    ]);

    if (products === 0) {
      console.error('[Health] DB arriba pero catálogo publicable en CERO.');
      return NextResponse.json(
        { status: 'degraded', db: 'up', products: 0 },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: 'ok', db: 'up', products });
  } catch (error: any) {
    console.error('[Health] DB check failed:', error?.message);
    return NextResponse.json(
      { status: 'error', db: 'down' },
      { status: 503 }
    );
  }
}
