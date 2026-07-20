import { NextResponse } from 'next/server';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';

export const dynamic = 'force-dynamic';

// GET /api/lab-costs/report?month=2026-06 — reporte mensual de operaciones de
// laboratorio: costo sistema vs. costo real facturado (solo ADMIN).
export async function GET(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const search = (searchParams.get('search') || '').trim();
        const day = (searchParams.get('day') || '').trim();

        // Modo búsqueda: si viene texto o día, buscar en todo el histórico (sin acotar al mes).
        if (search || day) {
            const report = await LabCostReconciliationService.searchReport(search, day);
            return NextResponse.json(report);
        }

        const monthParam = searchParams.get('month') || '';
        const m = monthParam.match(/^(\d{4})-(\d{2})$/);
        if (!m) {
            return NextResponse.json({ error: 'Parámetro month inválido (formato AAAA-MM)' }, { status: 400 });
        }

        const report = await LabCostReconciliationService.monthlyReport(parseInt(m[1]), parseInt(m[2]));
        return NextResponse.json(report);
    } catch (error: any) {
        console.error('[lab-costs report] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
