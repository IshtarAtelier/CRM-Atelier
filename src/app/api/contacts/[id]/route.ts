import { NextResponse } from 'next/server';
import { ContactService } from '@/services/contact.service';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { getActor } from '@/lib/actor';

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

        // Foto previa para auditar solo los campos que cambian
        const before = await ContactService.getById(id);

        const contact = await ContactService.update(id, body);

        if (before) {
            const watched = ['name', 'phone', 'dni', 'email', 'doctor', 'insurance'] as const;
            const changed: Record<string, { from: unknown; to: unknown }> = {};
            for (const field of watched) {
                if ((before as any)[field] !== (contact as any)[field]) {
                    changed[field] = { from: (before as any)[field], to: (contact as any)[field] };
                }
            }
            if (Object.keys(changed).length > 0) {
                const actor = getActor(request);
                await logAudit({
                    userId: actor.id,
                    userName: actor.name,
                    action: 'UPDATE',
                    entityType: 'CONTACT',
                    entityId: id,
                    details: { changed },
                });
            }
        }

        return NextResponse.json(contact);
    } catch (error: any) {
        console.error('Error updating contact:', error);
        return NextResponse.json({
            error: 'Error al actualizar contacto',
            details: error.message
        }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session');
        if (!session?.value) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const payload = await decrypt(session.value);
        if (!payload || payload.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Acceso denegado: Solo los administradores pueden eliminar contactos.' }, { status: 403 });
        }

        const { id } = await params;
        const contact = await ContactService.getById(id);
        await ContactService.delete(id);

        await logAudit({
            userId: payload.id as string,
            userName: payload.name as string,
            action: 'DELETE',
            entityType: 'CONTACT',
            entityId: id,
            details: { contactName: contact?.name }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting contact:', error);
        return NextResponse.json({
            error: 'Error al eliminar contacto',
            details: error.message
        }, { status: 500 });
    }
}
