import { NextRequest, NextResponse } from 'next/server';

const WA_URL = process.env.WA_SERVER_URL || 'http://localhost:3100';

// PATCH /api/whatsapp/chats/[id]
// { chatLabels?, archived?, botEnabled? }
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const body = await req.json();
    const res = await fetch(`${WA_URL}/api/chats/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}
