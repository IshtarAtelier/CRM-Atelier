import { NextResponse } from 'next/server';
import { getGoogleReviews } from '@/lib/googleReviews';

export async function GET() {
  try {
    const data = await getGoogleReviews();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error general en GET /api/reviews:', error);
    return NextResponse.json({ error: 'Error al obtener reseñas' }, { status: 500 });
  }
}
