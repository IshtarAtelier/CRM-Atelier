import { NextResponse } from 'next/server';

import { WA_SERVER_URL } from '@/lib/wa-config';

// GET /api/whatsapp/chats — listar chats
export async function GET() {
    try {
        const res = await fetch(`${WA_SERVER_URL}/api/chats`, { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json([]);
    }
}
