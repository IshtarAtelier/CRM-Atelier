import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

function safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const encoder = new TextEncoder();
    const aBuf = encoder.encode(a);
    const bBuf = encoder.encode(b);
    let result = 0;
    for (let i = 0; i < aBuf.length; i++) {
        result |= aBuf[i] ^ bBuf[i];
    }
    return result === 0;
}

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
                if (payload.role === 'OPTICA') {
                    return NextResponse.redirect(new URL('/tienda', request.url));
                }
                return NextResponse.redirect(new URL('/admin', request.url));
            }
        }
        return NextResponse.next();
    }

    // Proteger rutas API (excepto auth, cron, upload y whatsapp proxy)
    // Las rutas de bot (/api/bot/) tienen su propia validación de API KEY abajo
    // Las rutas públicas del e-commerce (store, web, checkout) no requieren auth
    const isCheckoutBypass = pathname.startsWith('/api/checkout/') && !(pathname === '/api/checkout/session' && request.method === 'GET');
    const isPublicGetApi = request.method === 'GET' && (pathname === '/api/settings' || pathname === '/api/reviews' || pathname === '/api/health');
    
    if (isApiRoute && !isAuthRoute && !pathname.startsWith('/api/cron/') && !pathname.startsWith('/api/bot/') && !pathname.startsWith('/api/whatsapp/') && !pathname.startsWith('/api/upload') && !pathname.startsWith('/api/store/') && !pathname.startsWith('/api/web/') && !isCheckoutBypass && !pathname.startsWith('/api/storage/view') && !pathname.startsWith('/api/admin/alert') && !isPublicGetApi) {
        if (!token) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }
        const payload = await decrypt(token);
        if (!payload) {
            return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
        }

        if (payload.role === 'OPTICA') {
            return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
        }

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', payload.id as string);
        requestHeaders.set('x-user-role', payload.role as string);
        requestHeaders.set('x-user-name', payload.name as string);

        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Proteger rutas internas de bot (wa-service) o admin panel (incluyendo alertas de admin)
    if (pathname.startsWith('/api/bot/') || pathname.startsWith('/api/whatsapp/') || pathname.startsWith('/api/admin/alert')) {
        const apiKey = request.headers.get('x-api-key');
        const validKey = process.env.BOT_API_KEY;
        
        // 1. Validar por API Key (usado por wa-service)
        if (apiKey && validKey && safeCompare(apiKey, validKey)) {
            return NextResponse.next();
        }
        
        // 2. Validar por Cookie de Sesión (usado por panel de administración)
        if (token) {
            const payload = await decrypt(token);
            if (payload) {
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
        }
        
        return NextResponse.json({ error: 'Acceso denegado. Se requiere API Key o sesión válida.' }, { status: 403 });
    }

    // Proteger la ruta de subida de archivos (acepta JWT o BOT_API_KEY)
    if (pathname.startsWith('/api/upload')) {
        const apiKey = request.headers.get('x-api-key');
        const validKey = process.env.BOT_API_KEY;
        
        if (apiKey && validKey && safeCompare(apiKey, validKey)) {
            return NextResponse.next(); // Autorizado como bot
        }
        
        if (!token) {
            return NextResponse.json({ error: 'No autenticado para subir archivos' }, { status: 401 });
        }
        const payload = await decrypt(token);
        if (!payload) {
            return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
        }
        return NextResponse.next();
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

        if (payload.role === 'OPTICA') {
            return NextResponse.redirect(new URL('/tienda', request.url));
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
