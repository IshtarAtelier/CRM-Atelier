/**
 * ¿Por qué falló una llamada a la IA? — espejo TypeScript de
 * `wa-service/shared/errores-ia.js` (la fuente; mismos patrones). Lo fija
 * `npm run check:credito-ia`, que corre los dos contra los mismos textos de
 * error reales de AI Studio y de Vertex y falla si no coinciden.
 *
 * 'sin_credito' = hay que cargar plata (402 del prepago de AI Studio, Vertex
 * sin facturación). 'cuota' = 429/RESOURCE_EXHAUSTED (se avisa solo si dura).
 * 'transitorio' = 5xx/red. 'otro' = lo demás.
 */

export const CLASE_ERROR_IA = {
    SIN_CREDITO: 'sin_credito',
    CUOTA: 'cuota',
    TRANSITORIO: 'transitorio',
    OTRO: 'otro',
} as const;

export type ClaseErrorIA = (typeof CLASE_ERROR_IA)[keyof typeof CLASE_ERROR_IA];

const PATRONES_SIN_CREDITO = [
    /(?:^|[^\d.,$])402(?![\d]|[.,]\d)/,
    /payment required/i,
    /prepayment credits? (are|is) depleted/i,
    /credits? (are|is) depleted/i,
    /requires billing to be enabled/i,
    /billing (is )?(not enabled|disabled)/i,
    /BILLING_DISABLED/,
    /billing account[^.]{0,80}(disabled|closed|absent|delinquent)/i,
];

const PATRONES_CUOTA = [
    /(?:^|[^\d.,$])429(?![\d]|[.,]\d)/,
    /RESOURCE_EXHAUSTED/,
    /too many requests/i,
    /exceeded your current quota/i,
    /quota (exceeded|exhausted)/i,
    /rate limit/i,
];

const PATRONES_TRANSITORIO = [
    /(?:^|[^\d.,$])50[0234](?![\d]|[.,]\d)/,
    /UNAVAILABLE/,
    /INTERNAL/,
    /DEADLINE_EXCEEDED/,
    /overloaded/i,
    /timeout|timed out/i,
    /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|socket hang up|fetch failed/i,
];

export function textoDelError(err: any, profundidad = 0): string {
    if (err == null || profundidad > 4) return '';
    if (typeof err === 'string') return err;
    const partes: string[] = [];
    for (const k of ['status', 'code', 'statusText', 'message']) {
        const v = err[k];
        if (v != null && (typeof v === 'string' || typeof v === 'number')) partes.push(String(v));
    }
    if (err.error && typeof err.error === 'object') partes.push(textoDelError(err.error, profundidad + 1));
    if (err.cause) partes.push(textoDelError(err.cause, profundidad + 1));
    if (!partes.length) partes.push(String(err));
    return partes.join(' | ');
}

export function clasificarErrorIA(err: unknown): ClaseErrorIA {
    const e = err as any;
    const st = e && typeof e === 'object' ? Number(e.status || e.code) : NaN;
    if (st === 402) return CLASE_ERROR_IA.SIN_CREDITO;
    const texto = textoDelError(err);
    if (PATRONES_SIN_CREDITO.some(p => p.test(texto))) return CLASE_ERROR_IA.SIN_CREDITO;
    if (st === 429 || PATRONES_CUOTA.some(p => p.test(texto))) return CLASE_ERROR_IA.CUOTA;
    if ((st >= 500 && st < 600) || PATRONES_TRANSITORIO.some(p => p.test(texto))) return CLASE_ERROR_IA.TRANSITORIO;
    return CLASE_ERROR_IA.OTRO;
}

export function esFallaDeSaldo(clase: ClaseErrorIA): boolean {
    return clase === CLASE_ERROR_IA.SIN_CREDITO || clase === CLASE_ERROR_IA.CUOTA;
}
