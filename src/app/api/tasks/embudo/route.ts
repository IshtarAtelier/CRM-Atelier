import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';
import { serverCache } from '@/lib/cache';

/**
 * Las tareas que calcula el EMBUDO — separadas de las del vendedor a pedido de
 * Ishtar (10/9/2026). Mismo contrato que `/api/tasks/pending`, otra lista.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cacheKey = 'tasks-embudo';
        const cached = serverCache.get<any>(cacheKey);
        if (cached !== null) {
            return NextResponse.json(cached);
        }

        const tasks = await ContactService.getAllPendingEmbudoTasks();
        serverCache.set(cacheKey, tasks, 30);
        return NextResponse.json(tasks);
    } catch (error) {
        console.error('Error fetching embudo tasks:', error);
        return NextResponse.json({
            error: 'Error al obtener las tareas del embudo',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
