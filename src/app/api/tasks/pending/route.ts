import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const tasks = await ContactService.getAllPendingTasks();
        return NextResponse.json(tasks);
    } catch (error) {
        console.error('Error fetching pending tasks:', error);
        return NextResponse.json({ 
            error: 'Error al obtener tareas',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
