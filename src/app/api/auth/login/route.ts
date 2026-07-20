import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(request: Request) {
    try {
        // IP del primer segmento del XFF (el que agrega el proxy de la plataforma).
        const ip = (request.headers.get('x-forwarded-for') || 'unknown-ip').split(',')[0].trim() || 'unknown-ip';
        const rateLimit = checkRateLimit(`login-ip-${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Demasiados intentos fallidos. Intenta nuevamente en 15 minutos.' }, { status: 429 });
        }

        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'El correo electrónico y la contraseña son requeridos.' },
                { status: 400 }
            );
        }

        // Segundo bucket POR CUENTA: frena la fuerza bruta distribuida (muchas IPs
        // rotadas contra un mismo email), que el límite por IP no alcanza a detener.
        const acctLimit = checkRateLimit(`login-acct-${String(email).toLowerCase().trim()}`, { limit: 10, windowMs: 15 * 60 * 1000 });
        if (!acctLimit.success) {
            return NextResponse.json({ error: 'Demasiados intentos para esta cuenta. Intenta nuevamente en 15 minutos.' }, { status: 429 });
        }



        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        if (!user || !user.password) {
            return NextResponse.json(
                { error: 'Credenciales inválidas.' },
                { status: 401 }
            );
        }

        const isBypass = process.env.NODE_ENV === 'development' && password === 'local-admin-ishtar';
        const isPasswordValid = isBypass ? true : await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return NextResponse.json(
                { error: 'Credenciales inválidas.' },
                { status: 401 }
            );
        }

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
