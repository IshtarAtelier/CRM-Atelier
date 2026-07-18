import { NextResponse } from 'next/server';
import { CashService } from '@/services/cash.service';
import { getActor } from '@/lib/actor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const actor = getActor(request);

        // El saldo acumulado de la caja lo ven solo ADMIN y el/la encargado/a de
        // caja (User.cashManager, editable en Configuración → Usuarios). El resto
        // del staff ve cada movimiento con su monto real, pero sin totales.
        // Única fuente de verdad del permiso: CashService.canManageCash.
        const canViewTotals = await CashService.canManageCash(actor);

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

        // Para quien ve totales, el desglose de custodia va junto al saldo:
        // cuánto hay EN CAJA y cuánto sigue en poder de cada vendedor sin rendir.
        const [holdings, dailyCloses] = await Promise.all([
            CashService.getVendorsHolding(),
            CashService.getDailyCloses(14),
        ]);
        const holdingTotal = holdings.reduce((s, v) => s + v.holding, 0);

        // Saldo corrido estilo resumen bancario: cada movimiento lleva el saldo
        // en que quedó la caja en ese momento. Se ancla en el total actual y se
        // camina hacia atrás (la lista viene ordenada del más nuevo al más viejo),
        // así es exacto aunque solo se muestren los últimos 50 movimientos.
        let running = balance.total;
        const movements = balance.movements.map((m: any) => {
            const withBalance = { ...m, balanceAfter: running };
            running -= m.type === 'IN' ? (m.amount || 0) : -(m.amount || 0);
            return withBalance;
        });

        return NextResponse.json({
            canViewTotals: true,
            ...balance,
            movements,
            custody: {
                holdings,
                holdingTotal,
                expectedInDrawer: balance.total - holdingTotal,
            },
            dailyCloses,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
