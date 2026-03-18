// ⚠️ TEMPORAL — Borrar después de usar
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
    try {
        const hashedPassword = await bcrypt.hash('atelier', 10);

        const admin = await prisma.user.upsert({
            where: { email: 'ishtar' },
            update: { password: hashedPassword },
            create: {
                name: 'Ishtar',
                email: 'ishtar',
                password: hashedPassword,
                role: 'ADMIN',
            },
        });

        const staff = await prisma.user.upsert({
            where: { email: 'matias' },
            update: { password: hashedPassword },
            create: {
                name: 'Matías',
                email: 'matias',
                password: hashedPassword,
                role: 'STAFF',
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Contraseñas reseteadas correctamente',
            users: [
                { email: admin.email, role: admin.role, password: 'atelier' },
                { email: staff.email, role: staff.role, password: 'atelier' },
            ],
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
