import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { fetchWa } from '@/lib/wa-config';
import { createSocketToken } from '@/lib/socket-token';

export const dynamic = 'force-dynamic';

// El navegador necesita autenticarse contra el socket.io del wa-service, pero
// no puede recibir la clave entre servicios (quedaría expuesta a todo el staff
// en devtools — y eso era exactamente lo que hacía esta ruta: mandaba
// process.env.WA_API_KEY cruda como `socketToken`). Ahora entrega un token de
// corta vida FIRMADO con esa clave, que el bot verifica localmente.
async function buildSocketAuth() {
    // La identidad viene del middleware (x-user-*), que ya validó BOT_API_KEY
    // o la cookie de sesión antes de dejar pasar la request hasta acá.
    const h = await headers();
    const user = {
        id: h.get('x-user-id') || 'crm',
        name: h.get('x-user-name') || 'CRM',
    };
    return {
        socketToken: createSocketToken(user) || '',
        socketUrl: process.env.WA_SERVER_URL || 'http://localhost:3100',
    };
}

// GET /api/whatsapp/status — estado de conexión + QR
export async function GET() {
    try {
        const res = await fetchWa('/api/status', { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json({
            ...data,
            ...(await buildSocketAuth()),
        });
    } catch {
        return NextResponse.json({
            connected: false,
            qr: null,
            error: 'WhatsApp server no disponible',
            ...(await buildSocketAuth()),
        });
    }
}
