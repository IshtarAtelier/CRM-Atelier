import crypto from 'crypto';

/**
 * Comparación en tiempo constante de dos strings (evita timing side-channels).
 */
function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

/**
 * Autoriza una request de cron. Acepta el secret por header
 * `Authorization: Bearer <CRON_SECRET>` (preferido — no queda en logs/proxies) O por
 * query `?secret=<CRON_SECRET>` (fallback para cron-job.org). Compara en tiempo constante.
 *
 * Devuelve un objeto con `ok` y, si falla, el `status`/`error` a responder.
 */
export function verifyCronAuth(request: Request): { ok: true } | { ok: false; status: number; error: string } {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return { ok: false, status: 500, error: 'CRON_SECRET no está configurado.' };
    }
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get('secret') || '';
    const authHeader = request.headers.get('Authorization') || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (safeEqual(querySecret, cronSecret) || safeEqual(headerToken, cronSecret)) {
        return { ok: true };
    }
    return { ok: false, status: 401, error: 'No autorizado' };
}
