import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import { recordEvents, sanitizeEvents, type AnalyticsEventInput } from '@/lib/analytics';
import { AdsService } from '@/services/ads.service';
import { esNavegadorMayorista, esTraficoInterno } from '@/lib/trafico-interno';
import { decrypt } from '@/lib/auth';

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

/**
 * Quién navega, según la sesión del CRM (la cookie `session` es httpOnly y
 * firmada: el navegador no la puede leer ni falsificar, este es el dato firme).
 *  - equipo: una sesión que no es OPTICA. Cubre el navegador donde alguien del
 *    equipo tiene sesión pero todavía no pasó por /admin para marcarse.
 *  - mayorista: una óptica logueada, o un navegador que ya se marcó como tal.
 * Sin sesión no se verifica nada: el costo es solo para quien la tiene.
 */
async function quienNavega(req: Request): Promise<'equipo' | 'mayorista' | 'cliente'> {
  const token = readCookie(req, 'session');
  if (token) {
    const payload = await decrypt(token);
    if (payload?.role === 'OPTICA') return 'mayorista';
    if (payload?.role) return 'equipo';
  }
  return esNavegadorMayorista(req.headers.get('cookie')) ? 'mayorista' : 'cliente';
}

/** Eventos propios → nombre estándar del Conversions API de Meta. */
const CAPI_EVENT: Record<string, 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Contact'> = {
  view_content: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  // El contacto por WhatsApp es la conversión real del negocio: si un bloqueador
  // voltea el Pixel, este es el único camino por el que llega.
  whatsapp_click: 'Contact',
  phone_click: 'Contact',
};

/**
 * Espeja el embudo a Meta por server-side, con las mismas señales del navegador
 * que usa el Pixel (fbp/fbc/IP/user-agent) y el `eventId` que generó el cliente,
 * así Meta deduplica y no cuenta doble.
 *
 * Corre para todo el tráfico: el cartel de cookies se retiró del sitio el
 * 13/8/2026 (decisión del dueño; la Ley 25.326 no lo exige en Argentina). El
 * gate anterior por la cookie `ate_consent` dejaba el espejo casi apagado —
 * los públicos de remarketing web juntaban ~20 personas. Las excepciones son
 * el equipo y las ópticas mayoristas, que se filtran antes de llegar acá (ver
 * POST y src/lib/trafico-interno.ts).
 */
function mirrorToMetaCapi(events: AnalyticsEventInput[], req: Request) {
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
    // Navegador del equipo (ver src/lib/trafico-interno.ts): ni a Meta ni a la
    // analítica propia. Se corta acá y no en el cliente porque este es el único
    // camino al CAPI: un bundle viejo cacheado o un script que no mire la
    // cookie igual pasa por esta puerta. Las compras no entran por esta ruta.
    if (esTraficoInterno(req.headers.get('cookie'))) return ended();

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
      const quien = await quienNavega(req);
      if (quien === 'equipo') return ended();
      // No await: responder ya, insertar en segundo plano.
      void recordEvents(events);
      // La óptica mayorista queda en la analítica propia pero no se le enseña
      // a Meta: es un público B2B que ninguna campaña persigue.
      if (quien === 'cliente') mirrorToMetaCapi(events, req);
    }
    return ended();
  } catch {
    return ended();
  }
}
