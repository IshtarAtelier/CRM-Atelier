/**
 * Analítica propia de la tienda (fuente de verdad interna del embudo web).
 *
 * Diseño clave: NUNCA en el critical path. Los inserts son fire-and-forget
 * (`recordEvents` no se `await`-ea desde rutas calientes como checkout) y
 * cualquier error se traga silenciosamente — medir jamás debe romper ni frenar
 * una venta. Ver src/app/api/track/route.ts (ingesta cliente) y el uso
 * server-side en el checkout (evento `purchase`).
 */
import { prisma } from '@/lib/db';
import { captureError } from '@/lib/logger';

export const ANALYTICS_EVENT_TYPES = [
  'page_view', // navegación general
  'zone_view', // vista de una zona/categoría de la tienda
  'view_content', // vista de ficha de producto
  'search', // búsqueda en la tienda
  'add_to_cart',
  'begin_checkout', // entró al checkout
  'add_contact', // dejó email/teléfono en el checkout
  'purchase', // compra confirmada (server-side)
  'wholesale_catalog_view', // abrió el link del catálogo mayorista (/mayorista/catalogo)
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

const EVENT_TYPE_SET: Set<string> = new Set(ANALYTICS_EVENT_TYPES);

export interface AnalyticsEventInput {
  type: AnalyticsEventType | string;
  sessionId: string;
  path?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  productId?: string | null;
  productName?: string | null;
  value?: number | null;
  quantity?: number | null;
  orderId?: string | null;
  device?: string | null;
  meta?: Record<string, unknown> | null;
}

const MAX_STR = 512;
const clip = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > MAX_STR ? s.slice(0, MAX_STR) : s;
};
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown): number | null => {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
};

/** Normaliza y descarta eventos con tipo/sesión inválidos. */
export function sanitizeEvents(raw: unknown, fallback: Partial<AnalyticsEventInput> = {}) {
  const list = Array.isArray(raw) ? raw : [raw];
  const out: AnalyticsEventInput[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const type = clip(e.type ?? fallback.type);
    const sessionId = clip(e.sessionId ?? fallback.sessionId);
    if (!type || !EVENT_TYPE_SET.has(type) || !sessionId) continue;
    out.push({
      type,
      sessionId,
      path: clip(e.path ?? fallback.path),
      referrer: clip(e.referrer ?? fallback.referrer),
      utmSource: clip(e.utmSource ?? fallback.utmSource),
      utmMedium: clip(e.utmMedium ?? fallback.utmMedium),
      utmCampaign: clip(e.utmCampaign ?? fallback.utmCampaign),
      utmContent: clip(e.utmContent ?? fallback.utmContent),
      utmTerm: clip(e.utmTerm ?? fallback.utmTerm),
      productId: clip(e.productId),
      productName: clip(e.productName),
      value: num(e.value),
      quantity: int(e.quantity),
      orderId: clip(e.orderId),
      device: clip(e.device ?? fallback.device),
      meta:
        e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : null,
    });
  }
  return out;
}

/**
 * Inserta eventos sin bloquear ni lanzar. Devuelve la cantidad insertada.
 * Llamar SIN await desde rutas calientes.
 */
export async function recordEvents(events: AnalyticsEventInput[]): Promise<number> {
  if (!events.length) return 0;
  try {
    const res = await prisma.analyticsEvent.createMany({
      data: events.map((e) => ({
        type: e.type,
        sessionId: e.sessionId,
        path: e.path ?? null,
        referrer: e.referrer ?? null,
        utmSource: e.utmSource ?? null,
        utmMedium: e.utmMedium ?? null,
        utmCampaign: e.utmCampaign ?? null,
        utmContent: e.utmContent ?? null,
        utmTerm: e.utmTerm ?? null,
        productId: e.productId ?? null,
        productName: e.productName ?? null,
        value: e.value ?? null,
        quantity: e.quantity ?? null,
        orderId: e.orderId ?? null,
        device: e.device ?? null,
        meta: (e.meta ?? undefined) as never,
      })),
    });
    return res.count;
  } catch (err) {
    captureError(err, { scope: 'analytics.recordEvents', count: events.length });
    return 0;
  }
}

/**
 * Registra un único evento server-side (fire-and-forget).
 *
 * Si el evento no trae atribución (caso típico: `purchase`, que el server graba
 * conociendo solo el sessionId), hereda las UTM del último evento de esa sesión
 * que las tenga. Así la compra queda autocontenida y los reportes de ads pueden
 * agrupar por utmCampaign directo, sin joins frágiles por sesión.
 */
export function recordServerEvent(event: AnalyticsEventInput): void {
  const clean = sanitizeEvents([event]);
  if (!clean.length) return;
  void (async () => {
    const e = clean[0];
    try {
      if (!e.utmSource && !e.utmCampaign && e.sessionId) {
        const select = {
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          utmTerm: true,
          referrer: true,
        } as const;
        // Regla canónica de atribución (igual en attribution_report y el cron
        // ads-report): último evento CON campaña; si la sesión nunca tuvo
        // utm_campaign, último evento con al menos utm_source.
        const attr =
          (await prisma.analyticsEvent.findFirst({
            where: { sessionId: e.sessionId, utmCampaign: { not: null } },
            orderBy: { createdAt: 'desc' },
            select,
          })) ??
          (await prisma.analyticsEvent.findFirst({
            where: { sessionId: e.sessionId, utmSource: { not: null } },
            orderBy: { createdAt: 'desc' },
            select,
          }));
        if (attr) {
          e.utmSource = e.utmSource ?? attr.utmSource;
          e.utmMedium = e.utmMedium ?? attr.utmMedium;
          e.utmCampaign = e.utmCampaign ?? attr.utmCampaign;
          e.utmContent = e.utmContent ?? attr.utmContent;
          e.utmTerm = e.utmTerm ?? attr.utmTerm;
          e.referrer = e.referrer ?? attr.referrer;
        }
      }
    } catch (err) {
      captureError(err, { scope: 'analytics.attribution-inherit' });
    }
    await recordEvents(clean);
  })();
}
