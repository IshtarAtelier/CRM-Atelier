import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { reportarExitoDeIA, reportarFallaDeIA } from '@/services/ia-credito.service';
import { CLASE_ERROR_IA, type ClaseErrorIA } from '@/lib/ia/errores-ia';

/**
 * El wa-service reporta acá que la IA se quedó sin crédito (o volvió)
 * (16/10/2026). El bot no manda la plantilla ni deduplica: el CRM tiene el
 * candado en la base y el envío de `nota_interna` a la dueña.
 *
 * Solo con la API key del bot (mismo criterio que /api/bot/aviso-sistema).
 */
function esElBot(request: Request): boolean {
    const dada = request.headers.get('x-api-key') || '';
    const valida = process.env.BOT_API_KEY || '';
    if (!dada || !valida) return false;
    const a = Buffer.from(dada);
    const b = Buffer.from(valida);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

const CLASES = new Set<string>(Object.values(CLASE_ERROR_IA));

export async function POST(request: Request) {
    if (!esElBot(request)) return NextResponse.json({ error: 'Solo el wa-service' }, { status: 403 });
    let body: { estado?: unknown; origen?: unknown; detalle?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const estado = typeof body.estado === 'string' ? body.estado : '';
    if (estado === 'ok') {
        const avisada = await reportarExitoDeIA();
        return NextResponse.json({ ok: true, vuelta: avisada });
    }
    if (!CLASES.has(estado)) return NextResponse.json({ error: 'estado inválido' }, { status: 400 });
    const origen = typeof body.origen === 'string' ? body.origen.slice(0, 100) : 'wa-service';
    const detalle = typeof body.detalle === 'string' ? body.detalle.slice(0, 400) : '';
    await reportarFallaDeIA({ message: detalle }, origen, { clase: estado as ClaseErrorIA });
    return NextResponse.json({ ok: true });
}
