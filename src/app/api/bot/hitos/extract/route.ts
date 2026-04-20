import { NextResponse } from 'next/server';
import { BotService } from '@/services/bot.service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { clientId } = await request.json();

        if (!clientId) {
            return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
        }

        const hitos = await BotService.extractHitos(clientId);
        return NextResponse.json(hitos);
    } catch (error: any) {
        console.error('[Hitos Extract] Error:', error);
        return NextResponse.json({ error: error.message || 'Error interno al extraer hitos' }, { status: 500 });
    }
}
