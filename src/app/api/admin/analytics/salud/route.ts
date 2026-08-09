import { NextResponse } from 'next/server';
import { getActorValidated } from '@/lib/session-revalidation';
import { GrowthService } from '@/services/growth.service';

/**
 * Salud de la cadena de medición (Pixel, CAPI, GA, conversiones de Google Ads,
 * analítica propia) con checklist accionable. Solo lectura; consulta la Graph
 * API de Meta desde el server (el token jamás viaja al navegador).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getActorValidated(request);
    if (!actor.valid || !actor.role || !['ADMIN', 'STAFF'].includes(actor.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const salud = await GrowthService.getSaludMedicion();
    return NextResponse.json(salud);
  } catch (error) {
    console.error('[admin/analytics/salud] error:', error);
    return NextResponse.json({ error: 'No se pudo evaluar la medición' }, { status: 500 });
  }
}
