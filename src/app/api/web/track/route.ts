import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import { recordEvents, sanitizeEvents } from '@/lib/analytics';

/**
 * Ingesta de analítica propia. Público, liviano y no bloqueante.
 * El cliente postea vía navigator.sendBeacon (ver src/lib/client-analytics.ts).
 * Siempre responde 204 rápido: medir no debe fallar de cara al usuario.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_EVENTS_PER_REQUEST = 30;
const ended = () => new NextResponse(null, { status: 204 });

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: Request) {
  try {
    // Rate limit generoso por IP (una visita normal emite varios eventos/min).
    const rl = checkRateLimit(`track:${clientIp(req)}`, { limit: 240, windowMs: 60_000 });
    if (!rl.success) return ended();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return ended();

    const rawEvents = Array.isArray((body as any).events)
      ? (body as any).events
      : [body];

    const fallback = {
      sessionId: (body as any).sessionId,
      device: (body as any).device,
    };

    const events = sanitizeEvents(rawEvents, fallback).slice(0, MAX_EVENTS_PER_REQUEST);
    if (events.length) {
      // No await: responder ya, insertar en segundo plano.
      void recordEvents(events);
    }
    return ended();
  } catch {
    return ended();
  }
}
