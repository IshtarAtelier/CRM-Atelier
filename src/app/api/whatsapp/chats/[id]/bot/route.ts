import { NextRequest, NextResponse } from 'next/server';

const WA_URL = process.env.WA_SERVER_URL || 'http://localhost:3100';

// PATCH /api/whatsapp/chats/[id]/bot
// Activa o cancela el bot para una sola conversación
// sin afectar el resto de los chats activos.
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const body = await req.json();
    const res = await fetch(`${WA_URL}/api/chats/${params.id}/bot`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}
