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

// Hosts que SÍ deben indexarse. Hasta el cutover DNS, el dominio real sirve
// Tienda Nube y esta app solo se sirve por el subdominio de Railway, así que
// todo el tráfico rastreable acá es no-canónico y debe ir noindex. Post-cutover,
// cuando esta app sirva atelieroptica.com.ar, ese host pasa a ser indexable.
const CANONICAL_HOSTS = new Set(['atelieroptica.com.ar', 'www.atelieroptica.com.ar']);

function isNonCanonicalHost(request: NextRequest): boolean {
    const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
    return host !== '' && !CANONICAL_HOSTS.has(host);
}

export async function middleware(request: NextRequest) {

    const token = request.cookies.get('session')?.value
    const { pathname } = request.nextUrl

    // Los headers x-user-* SOLO pueden nacer en este middleware (JWT validado).
    // Se eliminan de TODA request entrante: sin esto, un caller con BOT_API_KEY
    // (o en rutas públicas) podría mandar x-user-name y firmar acciones como
    // si fueran de un vendedor real. Las ramas que autentican por sesión los
    // re-inyectan sobre esta misma base ya saneada.
    const sanitizedHeaders = new Headers(request.headers);
    sanitizedHeaders.delete('x-user-id');
    sanitizedHeaders.delete('x-user-role');
    sanitizedHeaders.delete('x-user-name');

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
        // Links viejos al login mayorista (?type=mayorista) van a la puerta
        // propia del área: /mayorista/ingreso (branding del canal, no del CRM).
        if (request.nextUrl.searchParams.get('type') === 'mayorista') {
            return NextResponse.redirect(new URL('/mayorista/ingreso', request.url));
        }
        return NextResponse.next({ request: { headers: sanitizedHeaders } });
    }

    // Puerta del área mayorista: una óptica ya logueada pasa directo a la
    // tienda. Cuentas del equipo NO se redirigen al CRM desde acá — esta
    // página es del canal mayorista, el CRM tiene su propio /login.
    if (pathname === '/mayorista/ingreso') {
        if (token) {
            const payload = await decrypt(token);
            if (payload?.role === 'OPTICA') {
                return NextResponse.redirect(new URL('/tienda', request.url));
            }
        }
        return NextResponse.next({ request: { headers: sanitizedHeaders } });
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

        sanitizedHeaders.set('x-user-id', payload.id as string);
        sanitizedHeaders.set('x-user-role', payload.role as string);
        sanitizedHeaders.set('x-user-name', payload.name as string);

        return NextResponse.next({ request: { headers: sanitizedHeaders } });
    }

    // Proteger rutas internas de bot (wa-service) o admin panel (incluyendo alertas de admin)
    if (pathname.startsWith('/api/bot/') || pathname.startsWith('/api/whatsapp/') || pathname.startsWith('/api/admin/alert')) {
        const apiKey = request.headers.get('x-api-key');
        const validKey = process.env.BOT_API_KEY;

        // 1. Validar por API Key (usado por wa-service) — pasa SIN identidad de usuario
        if (apiKey && validKey && safeCompare(apiKey, validKey)) {
            return NextResponse.next({ request: { headers: sanitizedHeaders } });
        }

        // 2. Validar por Cookie de Sesión (usado por panel de administración)
        if (token) {
            const payload = await decrypt(token);
            if (payload) {
                // Las cuentas OPTICA (mayoristas externos) solo deben ver /tienda:
                // sin este check, una sesión OPTICA válida podía escribir en la
                // ficha de cualquier cliente o mandar WhatsApp por la línea del negocio.
                if (payload.role === 'OPTICA') {
                    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
                }

                sanitizedHeaders.set('x-user-id', payload.id as string);
                sanitizedHeaders.set('x-user-role', payload.role as string);
                sanitizedHeaders.set('x-user-name', payload.name as string);

                return NextResponse.next({
                    request: {
                        headers: sanitizedHeaders,
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
            return NextResponse.next({ request: { headers: sanitizedHeaders } }); // Autorizado como bot
        }

        if (!token) {
            return NextResponse.json({ error: 'No autenticado para subir archivos' }, { status: 401 });
        }
        const payload = await decrypt(token);
        if (!payload) {
            return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
        }
        if (payload.role === 'OPTICA') {
            return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
        }
        // Sesión válida: el que sube el archivo queda identificado
        sanitizedHeaders.set('x-user-id', payload.id as string);
        sanitizedHeaders.set('x-user-role', payload.role as string);
        sanitizedHeaders.set('x-user-name', payload.name as string);
        return NextResponse.next({ request: { headers: sanitizedHeaders } });
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
        sanitizedHeaders.set('x-user-id', payload.id as string);
        sanitizedHeaders.set('x-user-role', payload.role as string);
        sanitizedHeaders.set('x-user-name', payload.name as string);

        return NextResponse.next({
            request: {
                headers: sanitizedHeaders,
            },
        });
    }

    // Permitir el resto de las rutas públicas (E-commerce, Blog, etc.)
    const response = NextResponse.next({ request: { headers: sanitizedHeaders } });
    // Segunda barrera contra contenido duplicado: el canonical tag es solo una
    // sugerencia; este header es una directiva dura para el subdominio de Railway.
    if (isNonCanonicalHost(request)) {
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    }
    return response;
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
