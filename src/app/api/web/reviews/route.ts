import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enforceRateLimit } from '@/lib/api-guard';
import { productReviewSchema, validateBody } from '@/lib/validation';
import { captureError } from '@/lib/logger';
import { agregadoDeResenas } from '@/lib/reviews/agregado-producto';

/**
 * Reseñas de producto. Público bajo /api/web.
 * GET  ?productId=X → reseñas aprobadas + agregado (promedio y total).
 * POST → crea una reseña SIN aprobar (moderación anti-spam), rate-limited.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const productId = new URL(req.url).searchParams.get('productId');
    if (!productId) return NextResponse.json({ error: 'productId requerido' }, { status: 400 });

    // El promedio se calcula en `agregado-producto.ts`, no acá: el mismo número
    // lo declara el `aggregateRating` de la ficha para Google. Dos cuentas
    // separadas pueden redondear distinto, y un JSON-LD que dice 4,6 sobre una
    // página que muestra 4,7 es exactamente lo que se revisa en una sanción.
    const [reviews, agregado] = await Promise.all([
      prisma.productReview.findMany({
        where: { productId, approved: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, authorName: true, rating: true, comment: true, createdAt: true },
      }),
      agregadoDeResenas(productId),
    ]);

    return NextResponse.json({
      reviews,
      average: agregado?.promedio ?? 0,
      count: agregado?.cantidad ?? 0,
    });
  } catch (error) {
    captureError(error, { scope: 'web.reviews.GET' });
    return NextResponse.json({ reviews: [], average: 0, count: 0 });
  }
}

export async function POST(req: Request) {
  try {
    const limited = enforceRateLimit(req, 'web-reviews', { limit: 4, windowMs: 60_000 });
    if (limited) return limited;

    const raw = await req.json().catch(() => null);
    const result = validateBody(productReviewSchema, raw);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

    await prisma.productReview.create({
      data: {
        productId: result.data.productId,
        authorName: result.data.authorName,
        rating: result.data.rating,
        comment: result.data.comment,
        approved: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: '¡Gracias! Tu reseña quedó pendiente de aprobación.',
    });
  } catch (error) {
    captureError(error, { scope: 'web.reviews.POST' });
    return NextResponse.json({ error: 'No se pudo enviar la reseña.' }, { status: 500 });
  }
}
