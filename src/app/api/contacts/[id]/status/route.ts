import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { ContactService } from '@/services/contact.service';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { status } = body;

        // Read role from middleware headers for security
        const headersList = await headers();
        const userRole = headersList.get('x-user-role') || 'STAFF';

        const contact = await ContactService.updateStatus(id, status, userRole);
        return NextResponse.json(contact);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al actualizar el estado';
        console.error('Error updating contact status:', error);
        // Business logic errors from ContactService should be 400, not 500
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
