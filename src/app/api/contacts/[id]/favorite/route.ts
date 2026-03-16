import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const contact = await ContactService.toggleFavorite(id);
        return NextResponse.json(contact);
    } catch (error) {
        console.error('Error toggling favorite:', error);
        return NextResponse.json({ error: 'Error al actualizar favorito' }, { status: 500 });
    }
}
