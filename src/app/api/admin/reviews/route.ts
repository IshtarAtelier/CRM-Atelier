import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActorValidated } from '@/lib/session-revalidation';
import { captureError } from '@/lib/logger';

/**
 * Moderación de reseñas (admin/staff). Protegido por el middleware + revalidación.
 * GET    → pendientes (approved=false) + últimas aprobadas.
 * PATCH  { id, approved } → aprobar/desaprobar.
 * DELETE ?id=X → borrar (spam).
 */
export const dynamic = 'force-dynamic';

async function guard(request: Request) {
  const actor = await getActorValidated(request);
  if (!actor.valid || !actor.role || !['ADMIN', 'STAFF'].includes(actor.role)) return null;
  return actor;
}

export async function GET(request: Request) {
  if (!(await guard(request))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const [pending, approved] = await Promise.all([
      prisma.productReview.findMany({ where: { approved: false }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.productReview.findMany({ where: { approved: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return NextResponse.json({ pending, approved });
  } catch (error) {
    captureError(error, { scope: 'admin.reviews.GET' });
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await guard(request))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id, approved } = await request.json();
    if (!id || typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'id y approved requeridos' }, { status: 400 });
    }
    const review = await prisma.productReview.update({ where: { id }, data: { approved } });
    return NextResponse.json({ success: true, review });
  } catch (error) {
    captureError(error, { scope: 'admin.reviews.PATCH' });
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await guard(request))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    await prisma.productReview.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    captureError(error, { scope: 'admin.reviews.DELETE' });
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
