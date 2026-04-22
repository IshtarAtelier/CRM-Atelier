import { NextResponse } from 'next/server';

import { WA_SERVER_URL } from '@/lib/wa-config';

// GET /api/whatsapp/chats/[id]/messages
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const res = await fetch(`${WA_SERVER_URL}/api/chats/${id}/messages`, { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json([]);
    }
}
