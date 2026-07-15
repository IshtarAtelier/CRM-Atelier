import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// PATCH /api/users/[id] — Update user (name, role, password)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const roleHeader = request.headers.get('x-user-role');
        const requesterId = request.headers.get('x-user-id');

        const { id } = await params;
        const body = await request.json();
        const { name, role, password } = body;

        const isAdmin = roleHeader === 'ADMIN';
        const isSelf = !!requesterId && requesterId === id;

        // ADMIN puede editar a cualquiera; cualquier usuario puede editar SOLO su propia cuenta
        if (!isAdmin && !isSelf) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const data: any = {};
        // Nombre y rol solo los puede tocar un ADMIN (evita que uno se auto-ascienda)
        if (isAdmin) {
            if (name) data.name = name;
            if (role) data.role = role;
        }
        // La contraseña la puede cambiar el ADMIN o el propio usuario
        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'No hay cambios para aplicar' }, { status: 400 });
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        return NextResponse.json(user);
    } catch (error: any) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: error.message || 'Error updating user' }, { status: 500 });
    }
}

// DELETE /api/users/[id] — Delete user
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const roleHeader = request.headers.get('x-user-role');
        if (roleHeader !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        // Don't allow deleting the last admin
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        const userToDelete = await prisma.user.findUnique({ where: { id } });

        if (userToDelete?.role === 'ADMIN' && admins.length <= 1) {
            return NextResponse.json(
                { error: 'No se puede eliminar el último administrador' },
                { status: 400 }
            );
        }

        await prisma.user.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: error.message || 'Error deleting user' }, { status: 500 });
    }
}
