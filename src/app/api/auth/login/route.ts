import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(request: Request) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
        const rateLimit = checkRateLimit(`login-${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
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



        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        if (!user || !user.password) {
            return NextResponse.json(
                { error: 'Credenciales inválidas.' },
                { status: 401 }
            );
        }

        // ── ESCOTILLA DE DESARROLLO ────────────────────────────────────────
        // Había una contraseña maestra escrita en el código que entraba a
        // CUALQUIER cuenta con solo que `NODE_ENV` no fuera 'production'. Eso
        // no es "solo local": una preview, un staging, un contenedor sin la
        // variable seteada o un `next start` mal invocado alcanzan — y la clave
        // está en el repo y en todo el historial de git, así que la tiene
        // cualquiera que haya clonado el proyecto alguna vez.
        //
        // Ahora hacen falta TRES condiciones a la vez, y la del medio no está
        // en ningún .env commiteado: hay que ponerla a mano en la máquina donde
        // se quiera usar. Además nunca puede tomar una cuenta de sistema (la
        // del Asistente), que no es de nadie y no debería poder iniciar sesión.
        const isBypass = process.env.NODE_ENV === 'development'
            && process.env.PERMITIR_LOGIN_DEV === '1'
            && user.role !== 'SISTEMA'
            && password === (process.env.CLAVE_LOGIN_DEV || '');
        if (isBypass) {
            console.warn(`[Login] ⚠️ ESCOTILLA DE DESARROLLO usada para entrar como ${user.email}. Esto NO debería aparecer nunca en producción.`);
        }
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
