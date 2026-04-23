import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const tasks = await ContactService.getAllPendingTasks();
        const orders = await ContactService.getOrdersWithBalance();
        return NextResponse.json({ tasksCount: tasks.length, ordersCount: orders.length, status: 'OK' });
    } catch (error: any) {
        return NextResponse.json({ 
            error: 'Database or Logic Crash',
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
