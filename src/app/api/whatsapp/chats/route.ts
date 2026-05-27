import { NextResponse } from 'next/server';

import { fetchWa } from '@/lib/wa-config';

// GET /api/whatsapp/chats — listar chats
export async function GET() {
    try {
        const res = await fetchWa('/api/chats', { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json([]);
    }
}
