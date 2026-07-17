import { NextResponse } from 'next/server';
import { fetchWa } from '@/lib/wa-config';

// POST /api/whatsapp/send — enviar mensaje
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Identidad confiable: si hay sesión, el senderName SIEMPRE sale del JWT
        // (middleware), nunca del body — es spoofeable (localStorage, DevTools).
        // Ningún flujo automático real llega con cookie de sesión, así que no
        // hace falta (ni conviene) una excepción para 'Sistema Atelier': antes
        // permitía a cualquier vendedor logueado lavar su firma mandándola en el body.
        const sessionUserName = request.headers.get('x-user-name');
        if (sessionUserName) {
            body.senderName = sessionUserName;
        }

        console.log('[WhatsApp Send] Sending to:', body.chatId, '| Has media:', !!body.media, '| From:', body.senderName || 'CRM');

        const res = await fetchWa('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('[WhatsApp Send] Non-JSON response from wa-service:', res.status, text.substring(0, 200));
            return NextResponse.json({ error: `wa-service respondió con formato inválido (${res.status})` }, { status: 502 });
        }
        
        if (!res.ok) {
            console.error('[WhatsApp Send] wa-service error:', res.status, data);
        }
        
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        console.error('[WhatsApp Send] Error connecting to wa-service:', error.message);
        return NextResponse.json({ error: `Servidor de WhatsApp no disponible: ${error.message}` }, { status: 503 });
    }
}
