import { NextResponse } from 'next/server';

import { WA_SERVER_URL } from '@/lib/wa-config';

// GET /api/whatsapp/agent/catalog — obtener catálogo de precios formateado
export async function GET() {
    try {
        const res = await fetch(`${WA_SERVER_URL}/api/agent/catalog`, { cache: 'no-store' });
        const text = await res.text();
        return new NextResponse(text, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    } catch {
        return NextResponse.json({ error: 'Error al obtener catálogo' }, { status: 500 });
    }
}
