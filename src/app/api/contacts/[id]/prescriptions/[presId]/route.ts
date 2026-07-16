import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { ContactService } from '@/services/contact.service';
import { getActor } from '@/lib/actor';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string, presId: string }> }
) {
    try {
        const { presId } = await params;
        const role = (await headers()).get('x-user-role');
        const body = await request.json();
        const prescription = await ContactService.updatePrescription(presId, body, role, getActor(request));
        return NextResponse.json(prescription);
    } catch (error) {
        if ((error as any)?.code === 'PRESCRIPTION_LOCKED') {
            return NextResponse.json({ error: (error as Error).message }, { status: 403 });
        }
        console.error('Error updating prescription:', error);
        return NextResponse.json({ error: 'Error al actualizar receta' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string, presId: string }> }
) {
    try {
        const { presId } = await params;
        const role = (await headers()).get('x-user-role');
        await ContactService.deletePrescription(presId, role, getActor(request));
        return NextResponse.json({ success: true });
    } catch (error) {
        if ((error as any)?.code === 'PRESCRIPTION_LOCKED') {
            return NextResponse.json({ error: (error as Error).message }, { status: 403 });
        }
        console.error('Error deleting prescription:', error);
        return NextResponse.json({ error: 'Error al eliminar receta' }, { status: 500 });
    }
}
