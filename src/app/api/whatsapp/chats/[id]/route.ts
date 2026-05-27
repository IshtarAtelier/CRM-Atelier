import { NextRequest, NextResponse } from 'next/server';
import { fetchWa } from '@/lib/wa-config';

// PATCH /api/whatsapp/chats/[id]
// { chatLabels?, archived?, botEnabled? }
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await req.json();
    const res = await fetchWa(`/api/chats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}
