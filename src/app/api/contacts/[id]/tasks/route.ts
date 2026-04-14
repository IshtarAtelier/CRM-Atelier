import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const tasks = await ContactService.getTasks(id);
        return NextResponse.json(tasks);
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener tareas' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { description, dueDate } = body;

        if (!description) {
            return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 });
        }

        const task = await ContactService.addTask(id, description, dueDate);
        return NextResponse.json(task);
    } catch (error) {
        return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params; // Note: id here might be taskId if we nested differently, but for now we use clientId/tasks
        const body = await request.json();
        const { taskId, status } = body;

        const task = await ContactService.updateTaskStatus(taskId, status);
        return NextResponse.json(task);
    } catch (error) {
        return NextResponse.json({ error: 'Error al actualizar tarea' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('taskId');

        if (!taskId) {
            return NextResponse.json({ error: 'taskId es requerido' }, { status: 400 });
        }

        const task = await ContactService.deleteTask(taskId);
        return NextResponse.json(task);
    } catch (error) {
        return NextResponse.json({ error: 'Error al eliminar tarea' }, { status: 500 });
    }
}


