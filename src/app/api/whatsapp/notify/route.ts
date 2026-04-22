import { NextResponse } from 'next/server';

import { WA_SERVER_URL } from '@/lib/wa-config';

// POST /api/whatsapp/notify — notificar estado de pedido
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const res = await fetch(`${WA_SERVER_URL}/api/notify-order`, {
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
