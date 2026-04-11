import { NextResponse } from 'next/server';

const WA_SERVER = 'http://localhost:3100';

// POST /api/whatsapp/send — enviar mensaje
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const res = await fetch(`${WA_SERVER}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        console.error('[WhatsApp Send] Error:', error.message);
        return NextResponse.json({ error: 'Servidor de WhatsApp no disponible' }, { status: 503 });
    }
}
