import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session');

        if (!session?.value) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const payload = await decrypt(session.value);
        if (!payload) {
            return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
        }

        return NextResponse.json({
            id: payload.id,
            name: payload.name,
            email: payload.email,
            role: payload.role,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
