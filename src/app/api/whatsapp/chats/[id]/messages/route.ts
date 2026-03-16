import { NextResponse } from 'next/server';

const WA_SERVER = 'http://localhost:3100';

// GET /api/whatsapp/chats/[id]/messages
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const res = await fetch(`${WA_SERVER}/api/chats/${id}/messages`, { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json([]);
    }
}
