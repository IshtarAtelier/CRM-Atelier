import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';

// GET /api/users — List all users
export async function GET() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(users);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/users — Create a new user
export async function POST(request: Request) {
    try {
        const roleHeader = request.headers.get('x-user-role');
        if (roleHeader !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { name, email, password, role } = await request.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos' }, { status: 400 });
        }

        // Check if email already exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || 'STAFF',
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        // Auditoría: qué admin dio de alta la cuenta y con qué rol
        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'USER',
            entityId: user.id,
            details: { name: user.name, email: user.email, role: user.role }
        });

        // Crear automáticamente la ficha de cliente en el CRM si es una Óptica
        if (user.role === 'OPTICA') {
            const existingClient = await prisma.client.findFirst({
                where: { email: user.email }
            });
            
            if (!existingClient) {
                await prisma.client.create({
                    data: {
                        name: user.name,
                        email: user.email,
                        status: 'CONTACT',
                        contactSource: 'Alta Manual Sistema'
                    }
                });
            }
        }

        return NextResponse.json(user, { status: 201 });
    } catch (error: any) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: error.message || 'Error creating user' }, { status: 500 });
    }
}
