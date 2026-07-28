import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import { recordEvents, sanitizeEvents, type AnalyticsEventInput } from '@/lib/analytics';
import { AdsService } from '@/services/ads.service';

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

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('=')) || null;
  }
  return null;
}

/** Eventos propios → nombre estándar del Conversions API de Meta. */
const CAPI_EVENT: Record<string, 'ViewContent' | 'AddToCart' | 'InitiateCheckout'> = {
  view_content: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
};

/**
 * Espeja el embudo a Meta por server-side, con las mismas señales del navegador
 * que usa el Pixel (fbp/fbc/IP/user-agent) y el `eventId` que generó el cliente,
 * así Meta deduplica y no cuenta doble.
 *
 * Solo corre con consentimiento explícito: lo dice la cookie propia `ate_consent`
 * que escribe el banner (ver CookieConsent). No se usa `_fbp` como semáforo
 * porque esa cookie falta justo cuando un adblocker voltea al Pixel, que es el
 * caso donde el envío server-side es lo único que queda.
 */
function mirrorToMetaCapi(events: AnalyticsEventInput[], req: Request) {
  if (readCookie(req, 'ate_consent') !== 'granted') return;

  const fbp = readCookie(req, '_fbp');
  const fbc = readCookie(req, '_fbc');
  const ip = clientIp(req);
  const matchData = {
    fbp,
    fbc,
    clientIp: ip === 'unknown' ? null : ip,
    userAgent: req.headers.get('user-agent'),
  };
  const referer = req.headers.get('referer') || undefined;

  for (const e of events) {
    const eventName = CAPI_EVENT[e.type];
    if (!eventName) continue;
    const eventId = typeof e.meta?.eventId === 'string' ? e.meta.eventId : undefined;

    void AdsService.sendWebFunnelEvent(eventName, {
      eventId,
      eventSourceUrl: referer,
      matchData,
      value: e.value ?? null,
      contentIds: e.productId ? [e.productId] : undefined,
      contentName: e.productName ?? null,
      numItems: eventName === 'InitiateCheckout' ? e.quantity ?? null : null,
    });
  }
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
      mirrorToMetaCapi(events, req);
    }
    return ended();
  } catch {
    return ended();
  }
}
