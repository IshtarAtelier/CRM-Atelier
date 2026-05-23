import { NextResponse, NextRequest } from 'next/server';
import { WA_SERVER_URL } from '@/lib/wa-config';

// Next.js App Router: aumentar límite de body para imágenes base64
export const maxDuration = 60; // Aumentar timeout a 60s (el bot puede tardar)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // Debug: log si viene media
        const hasMedia = body.messages?.some((m: any) => m.mediaBase64);
        if (hasMedia) {
            const mediaMsg = body.messages.find((m: any) => m.mediaBase64);
            console.log(`[Test Chat Proxy] Imagen detectada: ${(mediaMsg.mediaBase64.length / 1024).toFixed(0)} KB, mime: ${mediaMsg.mediaMime}`);
        }

        const res = await fetch(`${WA_SERVER_URL}/api/test/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[Test Chat Proxy] WA-Service error:', res.status, errorText.substring(0, 500));
            try {
                return NextResponse.json(JSON.parse(errorText), { status: res.status });
            } catch {
                return NextResponse.json({ error: errorText.substring(0, 200) }, { status: res.status });
            }
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[Test Chat Proxy] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
