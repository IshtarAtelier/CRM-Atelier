import { NextResponse } from 'next/server';
import { fetchWa } from '@/lib/wa-config';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const res = await fetchWa('/api/sync', { method: 'POST', cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message || 'WhatsApp server no disponible' });
    }
}
