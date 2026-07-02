import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';
import { serverCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cacheKey = 'tasks-pending';
        const cached = serverCache.get<any>(cacheKey);
        if (cached !== null) {
            return NextResponse.json(cached);
        }

        const tasks = await ContactService.getAllPendingTasks();
        serverCache.set(cacheKey, tasks, 30); // Cache for 30 seconds
        return NextResponse.json(tasks);
    } catch (error) {
        console.error('Error fetching pending tasks:', error);
        return NextResponse.json({ 
            error: 'Error al obtener tareas',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
