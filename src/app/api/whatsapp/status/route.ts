import { NextResponse } from 'next/server';
import { fetchWa } from '@/lib/wa-config';

export const dynamic = 'force-dynamic';

// GET /api/whatsapp/status — estado de conexión + QR
export async function GET() {
    try {
        const res = await fetchWa('/api/status', { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json({
            ...data,
            socketToken: process.env.WA_API_KEY || '',
            socketUrl: process.env.WA_SERVER_URL || 'http://localhost:3100'
        });
    } catch {
        return NextResponse.json({
            connected: false,
            qr: null,
            error: 'WhatsApp server no disponible',
            socketToken: process.env.WA_API_KEY || '',
            socketUrl: process.env.WA_SERVER_URL || 'http://localhost:3100'
        });
    }
}
