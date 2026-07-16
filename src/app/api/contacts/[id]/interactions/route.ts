import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';
import { getActor } from '@/lib/actor';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { type, content } = body;

        if (!content) {
            return NextResponse.json({ error: 'El contenido es obligatorio' }, { status: 400 });
        }

        // La nota queda firmada por el usuario logueado (quién la dejó)
        const interaction = await ContactService.addInteraction(id, type || 'NOTE', content, getActor(request));
        return NextResponse.json(interaction);
    } catch (error) {
        console.error('Error adding interaction:', error);
        return NextResponse.json({ error: 'Error al registrar la información' }, { status: 500 });
    }
}
