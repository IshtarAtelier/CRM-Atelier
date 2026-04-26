import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('session')?.value
    const { pathname } = request.nextUrl

    const isAdminRoute = pathname.startsWith('/admin');
    const isApiRoute = pathname.startsWith('/api/');
    const isAuthRoute = pathname === '/login' || pathname.startsWith('/api/auth');

    // Permitir acceso a la página de login
    if (pathname === '/login') {
        if (token) {
            const payload = await decrypt(token);
            if (payload) {
                return NextResponse.redirect(new URL('/admin', request.url));
            }
        }
        return NextResponse.next();
    }

    // Proteger rutas API (excepto auth y cron/rescue)
    if (isApiRoute && !isAuthRoute && !pathname.startsWith('/api/cron/') && pathname !== '/api/diag' && pathname !== '/api/rescue' && !pathname.startsWith('/api/reports')) {
        if (!token) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }
        const payload = await decrypt(token);
        if (!payload) {
            return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
        }

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', payload.id as string);
        requestHeaders.set('x-user-role', payload.role as string);
        requestHeaders.set('x-user-name', payload.name as string);

        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Proteger rutas de administración (/admin)
    if (isAdminRoute) {
        if (!token) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        const payload = await decrypt(token);
        if (!payload) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // Inyectar datos del usuario para el layout del admin
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', payload.id as string);
        requestHeaders.set('x-user-role', payload.role as string);
        requestHeaders.set('x-user-name', payload.name as string);

        return NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
    }

    // Permitir el resto de las rutas públicas (E-commerce, Blog, etc.)
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, uploads, assets (public resources)
         */
        '/((?!_next/static|_next/image|favicon.ico|assets|uploads).*)',
    ],
}
