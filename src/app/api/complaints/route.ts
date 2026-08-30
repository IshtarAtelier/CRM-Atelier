import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { reportComplaint } from '@/services/complaint.service';

/**
 * Puerta histórica de reclamos post-venta. El middleware le exige sesión JWT
 * (no está en los bypass), así que solo la puede usar un humano logueado: el
 * bot entra por `/api/bot/complaints`, que es la que tiene BOT_API_KEY.
 *
 * La lógica (email a administración + interacción firmada en la ficha + audit)
 * es una sola y vive en `src/services/complaint.service.ts`.
 */
export async function POST(req: NextRequest) {
    try {
        const { clientId, details } = await req.json();
        const result = await reportComplaint({ clientId, details }, getActor(req));
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        return NextResponse.json({ success: true, message: 'Reclamo reportado correctamente' });
    } catch (error: any) {
        console.error('Error reporting complaint:', error);
        return NextResponse.json({ error: error?.message }, { status: 500 });
    }
}
