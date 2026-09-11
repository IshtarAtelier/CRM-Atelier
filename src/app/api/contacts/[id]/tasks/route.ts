import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';
import { getActor } from '@/lib/actor';
import { ESTADOS_DE_TAREA } from '@/lib/tareas/origen';

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

        const task = await ContactService.addTask(id, description, dueDate, getActor(request));
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
        const { id } = await params;
        const { taskId, status } = await request.json();

        if (typeof taskId !== 'string' || !ESTADOS_DE_TAREA.includes(status)) {
            return NextResponse.json({ error: 'taskId y un estado válido son requeridos' }, { status: 400 });
        }
        // La URL dice de qué cliente es: antes se ignoraba y se podía cerrar la
        // tarea de cualquier ficha desde la de otra.
        if (!(await ContactService.tareaEsDelCliente(taskId, id))) {
            return NextResponse.json({ error: 'La tarea no es de este cliente' }, { status: 404 });
        }

        const task = await ContactService.updateTaskStatus(taskId, status, getActor(request));
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
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('taskId');

        if (!taskId) {
            return NextResponse.json({ error: 'taskId es requerido' }, { status: 400 });
        }
        if (!(await ContactService.tareaEsDelCliente(taskId, id))) {
            return NextResponse.json({ error: 'La tarea no es de este cliente' }, { status: 404 });
        }

        const task = await ContactService.deleteTask(taskId, getActor(request));
        return NextResponse.json(task);
    } catch (error) {
        return NextResponse.json({ error: 'Error al eliminar tarea' }, { status: 500 });
    }
}


