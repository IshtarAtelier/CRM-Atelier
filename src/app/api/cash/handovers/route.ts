import { NextResponse } from 'next/server';
import { CashService } from '@/services/cash.service';
import { getActor } from '@/lib/actor';

export const dynamic = 'force-dynamic';

// GET: mi pendiente de rendición + historial (los STAFF ven solo el suyo;
// encargada de caja y ADMIN ven todas las rendiciones).
export async function GET(request: Request) {
    try {
        const actor = getActor(request);
        if (!actor.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const canManage = await CashService.canManageCash(actor);
        const [pending, handovers] = await Promise.all([
            CashService.getVendorPendingCash(actor.id),
            CashService.listHandovers(canManage ? undefined : actor.id),
        ]);

        return NextResponse.json({ canManage, pending, handovers });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: el vendedor registra la entrega de su efectivo (queda PENDING).
export async function POST(request: Request) {
    try {
        const actor = getActor(request);
        if (!actor.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const { declaredAmount, notes } = await request.json();
        const handover = await CashService.createHandover(actor, Number(declaredAmount), notes);
        return NextResponse.json(handover, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
