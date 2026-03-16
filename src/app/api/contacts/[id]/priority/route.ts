import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { priority } = body;

        if (typeof priority !== 'number') {
            return NextResponse.json({ error: 'Prioridad inválida' }, { status: 400 });
        }

        const contact = await ContactService.updatePriority(id, priority);
        return NextResponse.json(contact);
    } catch (error) {
        console.error('Error updating contact priority:', error);
        return NextResponse.json({ error: 'Error al actualizar la prioridad' }, { status: 500 });
    }
}
