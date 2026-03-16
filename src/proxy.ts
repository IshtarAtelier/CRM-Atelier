import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

export async function proxy(request: NextRequest) {
    const token = request.cookies.get('session')?.value
    const { pathname } = request.nextUrl

    // Rutas públicas
    if (pathname === '/login' || pathname.startsWith('/api/auth')) {
        if (token && pathname === '/login') {
            const payload = await decrypt(token)
            if (payload) {
                return NextResponse.redirect(new URL('/', request.url))
            }
        }
        return NextResponse.next()
    }

    // Para API routes, si no tiene token devolver 401 en vez de redirect
    if (pathname.startsWith('/api/')) {
        if (!token) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }
        const payload = await decrypt(token)
        if (!payload) {
            return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
        }

        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('x-user-id', payload.id as string)
        requestHeaders.set('x-user-role', payload.role as string)
        requestHeaders.set('x-user-name', payload.name as string)

        return NextResponse.next({ request: { headers: requestHeaders } })
    }

    // Rutas de páginas protegidas
    if (!token) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    const payload = await decrypt(token)
    if (!payload) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Inject user info into headers for server components
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', payload.id as string)
    requestHeaders.set('x-user-role', payload.role as string)
    requestHeaders.set('x-user-name', payload.name as string)

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })
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
