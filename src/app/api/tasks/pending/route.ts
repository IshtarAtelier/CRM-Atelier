import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export async function GET() {
    try {
        const tasks = await ContactService.getAllPendingTasks();
        return NextResponse.json(tasks);
    } catch (error) {
        console.error('Error fetching pending tasks:', error);
        return NextResponse.json({ error: 'Error al obtener tareas' }, { status: 500 });
    }
}
