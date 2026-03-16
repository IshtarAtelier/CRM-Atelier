import { NextResponse } from 'next/server';

const WA_SERVER = 'http://localhost:3100';

// POST /api/whatsapp/notify — notificar estado de pedido
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const res = await fetch(`${WA_SERVER}/api/notify-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json({ error: 'Error al notificar' }, { status: 500 });
    }
}
