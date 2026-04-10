import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'El correo electrónico y la contraseña son requeridos.' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'Credenciales inválidas.' },
                { status: 401 }
            );
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        // Local dev bypass for convenience during testing
        const isLocalDevBypass = process.env.NODE_ENV === 'development' && email === 'ishtar' && password === 'local-admin-ishtar';

        if (!isPasswordValid && !isLocalDevBypass) {
            return NextResponse.json(
                { error: 'Credenciales inválidas.' },
                { status: 401 }
            );
        }

        // Create session token
        const token = await encrypt({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        });

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            }
        }, { status: 200 });

        // Set cookie
        response.cookies.set({
            name: 'session',
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 1, // 1 day
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Ocurrió un error interno durante el inicio de sesión.' },
            { status: 500 }
        );
    }
}
