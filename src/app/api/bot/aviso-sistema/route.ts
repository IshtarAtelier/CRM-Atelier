import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { avisarAdmins } from '@/lib/avisos/aviso-al-equipo';

/**
 * Puerta del wa-service al canal "🔧 Fallos y salud del sistema" de la
 * mensajería interna (15/10/2026).
 *
 * Los fallos de robots van a la mensajería, no al mail (regla del 8/10/2026),
 * pero el wa-service solo tenía `notifyAdminDown` → /api/admin/alert, que
 * manda MAIL. Este endpoint es el `avisarAdmins()` del CRM para él: misma
 * deduplicación de 20 h por `dedupePrefijo`.
 *
 * Solo con la API key del bot: el middleware deja pasar /api/bot/ también
 * con sesión del panel, y esto no es algo que deba poder disparar un usuario.
 */
function esElBot(request: Request): boolean {
    const dada = request.headers.get('x-api-key') || '';
    const valida = process.env.BOT_API_KEY || '';
    if (!dada || !valida) return false;
    // Longitud en BYTES: con caracteres multibyte dos strings del mismo largo
    // dan Buffers distintos y timingSafeEqual lanza (→ 500 en vez de 403).
    const a = Buffer.from(dada);
    const b = Buffer.from(valida);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
    if (!esElBot(request)) return NextResponse.json({ error: 'Solo el wa-service' }, { status: 403 });
    let body: { asunto?: unknown; cuerpo?: unknown; urgente?: unknown; dedupePrefijo?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const asunto = typeof body.asunto === 'string' ? body.asunto.trim().slice(0, 200) : '';
    const cuerpo = typeof body.cuerpo === 'string' ? body.cuerpo.trim().slice(0, 4000) : '';
    if (!asunto || !cuerpo) return NextResponse.json({ error: 'Faltan asunto y cuerpo' }, { status: 400 });
    const llegaron = await avisarAdmins({
        asunto,
        cuerpo,
        urgente: body.urgente === true,
        dedupePrefijo: typeof body.dedupePrefijo === 'string' ? body.dedupePrefijo.slice(0, 200) : undefined,
    });
    return NextResponse.json({ ok: llegaron > 0 });
}
