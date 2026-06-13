import { NextResponse } from 'next/server';
import { SmartLabService } from '@/services/smartlab.service';

export async function POST() {
    try {
        const result = await SmartLabService.syncOrders();
        
        return NextResponse.json({
            success: true,
            ...result,
        });

    } catch (error: any) {
        console.error('[SmartLab Sync] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Error interno al sincronizar con SmartLab.' },
            { status: 500 }
        );
    }
}
