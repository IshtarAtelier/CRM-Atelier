import { NextResponse } from 'next/server';
import { CashService } from '@/services/cash.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || 'STAFF';
        const isStaff = role === 'STAFF';

        const balance = await CashService.getCashBalance();

        if (isStaff) {
            return NextResponse.json({
                total: 0,
                paymentsTotal: 0,
                manualBalance: 0,
                manualIn: 0,
                manualOut: 0,
                movements: balance.movements.map((m: any) => ({
                    ...m,
                    amount: 0,
                })),
            });
        }

        return NextResponse.json(balance);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
