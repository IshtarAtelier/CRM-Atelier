import { NextResponse } from 'next/server';
import { CashService } from '@/services/cash.service';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const actor = getActor(request);

        // El saldo acumulado de la caja lo ven solo ADMIN y el/la encargado/a de
        // caja (User.cashManager, editable en Configuración → Usuarios). El resto
        // del staff ve cada movimiento con su monto real, pero sin totales.
        let canViewTotals = actor.role === 'ADMIN';
        if (!canViewTotals && actor.id) {
            const user = await prisma.user.findUnique({
                where: { id: actor.id },
                select: { cashManager: true },
            });
            canViewTotals = !!user?.cashManager;
        }

        const balance = await CashService.getCashBalance();

        if (!canViewTotals) {
            return NextResponse.json({
                canViewTotals: false,
                total: 0,
                paymentsTotal: 0,
                manualBalance: 0,
                manualIn: 0,
                manualOut: 0,
                movements: balance.movements,
            });
        }

        return NextResponse.json({ canViewTotals: true, ...balance });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
