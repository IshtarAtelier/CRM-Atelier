import { NextResponse } from 'next/server';
import { CashService } from '@/services/cash.service';
import { getActor } from '@/lib/actor';

export const dynamic = 'force-dynamic';

// GET: arqueos históricos + saldo teórico actual (solo encargada de caja / ADMIN).
export async function GET(request: Request) {
    try {
        const actor = getActor(request);
        if (!actor.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const canManage = await CashService.canManageCash(actor);
        if (!canManage) return NextResponse.json({ canManage: false, counts: [], preview: null });

        const [counts, preview] = await Promise.all([
            CashService.listCashCounts(),
            CashService.getArqueoPreview(),
        ]);
        return NextResponse.json({ canManage: true, counts, preview });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: cerrar un arqueo (conteo físico vs. teórico).
export async function POST(request: Request) {
    try {
        const actor = getActor(request);
        if (!actor.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const canManage = await CashService.canManageCash(actor);
        if (!canManage) {
            return NextResponse.json({ error: 'Solo la encargada de caja o un admin pueden cerrar arqueos.' }, { status: 403 });
        }

        const { countedAmount, notes } = await request.json();
        const count = await CashService.createCashCount(actor, Number(countedAmount), notes);
        return NextResponse.json(count, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
