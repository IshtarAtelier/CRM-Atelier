import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const contact = await ContactService.getById(id);
        if (!contact) {
            return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 });
        }
        return NextResponse.json(contact);
    } catch (error) {
        console.error('Error fetching contact detail:', error);
        return NextResponse.json({ error: 'Error al obtener el detalle del contacto' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const contact = await ContactService.update(id, body);
        return NextResponse.json(contact);
    } catch (error: any) {
        console.error('Error updating contact:', error);
        return NextResponse.json({
            error: 'Error al actualizar contacto',
            details: error.message
        }, { status: 500 });
    }
}
