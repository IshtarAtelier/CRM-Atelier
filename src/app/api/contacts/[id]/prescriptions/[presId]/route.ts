import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string, presId: string }> }
) {
    try {
        const { presId } = await params;
        const body = await request.json();
        const prescription = await ContactService.updatePrescription(presId, body);
        return NextResponse.json(prescription);
    } catch (error) {
        if ((error as any)?.code === 'PRESCRIPTION_LOCKED') {
            return NextResponse.json({ error: (error as Error).message }, { status: 409 });
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
        await ContactService.deletePrescription(presId);
        return NextResponse.json({ success: true });
    } catch (error) {
        if ((error as any)?.code === 'PRESCRIPTION_LOCKED') {
            return NextResponse.json({ error: (error as Error).message }, { status: 409 });
        }
        console.error('Error deleting prescription:', error);
        return NextResponse.json({ error: 'Error al eliminar receta' }, { status: 500 });
    }
}
