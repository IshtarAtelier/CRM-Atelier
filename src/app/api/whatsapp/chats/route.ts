import { NextResponse } from 'next/server';

const WA_SERVER = 'http://localhost:3100';

// GET /api/whatsapp/chats — listar chats
export async function GET() {
    try {
        const res = await fetch(`${WA_SERVER}/api/chats`, { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json([]);
    }
}
