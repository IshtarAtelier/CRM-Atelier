import { NextResponse } from 'next/server';
import { getActorValidated } from '@/lib/session-revalidation';
import { AttributionService, esRangoAtribucion, type RangoAtribucion } from '@/services/attribution.service';

/**
 * Atribución del período: qué devolvió cada anuncio de Meta (gasto real contra
 * chats y ventas cobradas) y de qué canal viene la gente. Solo lectura.
 *
 * El gasto se consulta a Meta desde el server: el token de Ads nunca viaja al
 * navegador. Es el mismo cálculo que manda el reporte diario por email.
 */
export const dynamic = 'force-dynamic';

const RANGO_POR_DEFECTO: RangoAtribucion = 30;

export async function GET(request: Request) {
  try {
    const actor = await getActorValidated(request);
    if (!actor.valid || !actor.role || !['ADMIN', 'STAFF'].includes(actor.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const pedido = Number(searchParams.get('dias'));
    const dias = esRangoAtribucion(pedido) ? pedido : RANGO_POR_DEFECTO;

    const data = await AttributionService.getAtribucion(dias);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[admin/analytics/atribucion] error:', error);
    return NextResponse.json({ error: 'No se pudo calcular la atribución' }, { status: 500 });
  }
}
