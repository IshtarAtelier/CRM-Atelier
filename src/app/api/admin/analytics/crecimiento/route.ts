import { NextResponse } from 'next/server';
import { getActorValidated } from '@/lib/session-revalidation';
import { GrowthService } from '@/services/growth.service';
import { AdsBudgetService } from '@/services/ads-budget.service';

/**
 * Serie mensual de crecimiento: cobrado real (Payment), tráfico y embudo web
 * (analítica propia) y clientes nuevos. Solo lectura.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getActorValidated(request);
    if (!actor.valid || !actor.role || !['ADMIN', 'STAFF'].includes(actor.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const meses = Math.min(24, Math.max(3, Number(searchParams.get('meses')) || 12));
    // El techo de inversión va junto al crecimiento a propósito: los dos
    // números se leen juntos ("crecí tanto, gastando tanto").
    const [serie, techo] = await Promise.all([
      GrowthService.getCrecimiento(meses),
      AdsBudgetService.getEstado().catch(() => null),
    ]);
    return NextResponse.json({ meses: serie, techo });
  } catch (error) {
    console.error('[admin/analytics/crecimiento] error:', error);
    return NextResponse.json({ error: 'No se pudo calcular el crecimiento' }, { status: 500 });
  }
}
