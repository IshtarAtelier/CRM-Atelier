import { NextResponse } from 'next/server';

import { WA_SERVER_URL } from '@/lib/wa-config';

// GET /api/whatsapp/agent — obtener configuración del agente
export async function GET() {
    try {
        const res = await fetch(`${WA_SERVER_URL}/api/agent`, { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[WhatsApp Agent API] Error:', error.message);
        return NextResponse.json({ 
            prompt: '', 
            enabled: false, 
            apiKey: '', 
            model: 'gpt-4o-mini', 
            configured: false,
            error: 'Servidor de WhatsApp no disponible' 
        });
    }
}

// POST /api/whatsapp/agent — guardar configuración del agente (prompt, enabled, apiKey, model)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const res = await fetch(`${WA_SERVER_URL}/api/agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[WhatsApp Agent POST] Error:', error.message);
        return NextResponse.json({ error: 'Servidor de WhatsApp no disponible' }, { status: 503 });
    }
}
