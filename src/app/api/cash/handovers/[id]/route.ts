import { NextResponse } from 'next/server';
import { CashService } from '@/services/cash.service';
import { getActor } from '@/lib/actor';

export const dynamic = 'force-dynamic';

// PATCH: la encargada de caja / ADMIN confirma la recepción del efectivo.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const actor = getActor(request);
        if (!actor.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const canManage = await CashService.canManageCash(actor);
        if (!canManage) {
            return NextResponse.json({ error: 'Solo la encargada de caja o un admin pueden confirmar rendiciones.' }, { status: 403 });
        }

        const { id } = await params;
        const { countedAmount, notes } = await request.json();
        const handover = await CashService.confirmHandover(id, Number(countedAmount), actor, notes);
        return NextResponse.json(handover);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
