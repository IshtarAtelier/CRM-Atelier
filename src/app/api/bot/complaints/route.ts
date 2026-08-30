import { NextResponse } from 'next/server';
import { BOT_ACTOR } from '@/lib/actor';
import { reportComplaint } from '@/services/complaint.service';

export const dynamic = 'force-dynamic';

/**
 * Reclamo post-venta levantado por el bot de WhatsApp.
 *
 * Por qué existe: el wa-service pegaba a `/api/complaints`, que está FUERA de
 * `/api/bot/` y por lo tanto el middleware le exige sesión JWT. El bot solo
 * tiene `x-api-key`, así que la llamada devolvía 401 SIEMPRE — ningún reclamo
 * del bot llegó nunca a la administración. Misma solución que
 * `src/app/api/bot/orders/[id]/send-pdf/route.ts`: puerta propia bajo
 * `/api/bot/` (autenticada con BOT_API_KEY en el middleware), lógica compartida
 * en `src/services/complaint.service.ts` y actor = BOT_ACTOR.
 */
export async function POST(request: Request) {
    try {
        const { clientId, details } = await request.json();
        const result = await reportComplaint({ clientId, details }, BOT_ACTOR);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        return NextResponse.json({ success: true, message: 'Reclamo reportado correctamente' });
    } catch (error: any) {
        console.error('[bot complaints] Error:', error?.message);
        return NextResponse.json({ error: `Error interno: ${error?.message}` }, { status: 500 });
    }
}
