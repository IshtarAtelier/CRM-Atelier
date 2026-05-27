import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Protect with CRON_SECRET
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || (secret !== cronSecret && token !== cronSecret)) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const tasks = await ContactService.getAllPendingTasks();
        const orders = await ContactService.getOrdersWithBalance();
        return NextResponse.json({ tasksCount: tasks.length, ordersCount: orders.length, status: 'OK' });
    } catch (error: any) {
        return NextResponse.json({ 
            error: 'Database or Logic Crash',
            message: error.message
        }, { status: 500 });
    }
}
