import { NextResponse, type NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';
import { COOKIE_MAYORISTA, opcionesCookieMarca } from '@/lib/trafico-interno';

export async function GET(request: NextRequest) {
    try {
        const session = request.cookies.get('session');

        if (!session?.value) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const payload = await decrypt(session.value);
        if (!payload) {
            return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
        }

        const response = NextResponse.json({
            id: payload.id,
            name: payload.name,
            email: payload.email,
            role: payload.role,
        });
        // La tienda, la ficha y el checkout preguntan esto al cargar: es donde
        // una óptica que ya tenía sesión antes del login nuevo queda marcada y
        // su navegador deja de cargar el píxel de Meta (src/lib/trafico-interno.ts).
        if (payload.role === 'OPTICA' && !request.cookies.has(COOKIE_MAYORISTA)) {
            response.cookies.set(COOKIE_MAYORISTA, '1', opcionesCookieMarca());
        }
        return response;
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
