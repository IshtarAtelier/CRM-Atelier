import { NextResponse } from 'next/server';
import { CashService } from '@/services/cash.service';

export async function GET() {
    try {
        const balance = await CashService.getCashBalance();
        return NextResponse.json(balance);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
