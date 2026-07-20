import { NextResponse } from 'next/server';
import { checkRateLimit, type RateLimiterOptions } from '@/lib/rate-limiter';

/** IP del cliente detrás del proxy de Railway. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Aplica rate limit por IP a una ruta pública. Devuelve una respuesta 429 si se
 * excedió, o null para seguir. Uso:
 *   const limited = enforceRateLimit(req, 'contacto', { limit: 5, windowMs: 60_000 });
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  req: Request,
  keyPrefix: string,
  options: RateLimiterOptions,
): NextResponse | null {
  const result = checkRateLimit(`${keyPrefix}:${clientIp(req)}`, options);
  if (result.success) return null;
  return NextResponse.json(
    { error: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, Math.ceil((result.reset.getTime() - Date.now()) / 1000))),
      },
    },
  );
}
