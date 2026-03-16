import { NextResponse } from 'next/server';

const WA_SERVER = 'http://localhost:3100';

// GET /api/whatsapp/status — estado de conexión + QR
export async function GET() {
    try {
        const res = await fetch(`${WA_SERVER}/api/status`, { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ connected: false, qr: null, error: 'WhatsApp server no disponible' });
    }
}
