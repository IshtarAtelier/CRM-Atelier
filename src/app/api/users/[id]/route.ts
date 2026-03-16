import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// PATCH /api/users/[id] — Update user (name, role, password)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, role, password } = body;

        const data: any = {};
        if (name) data.name = name;
        if (role) data.role = role;
        if (password) {
            data.password = await bcrypt.hash(password, 10);
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
