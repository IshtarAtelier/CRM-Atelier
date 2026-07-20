/**
 * Tracker de analítica del lado del cliente.
 *
 * - Identidad anónima por visitante (localStorage, sin PII, sin cookies →
 *   no requiere banner de consentimiento).
 * - Atribución first-touch (UTMs + referrer) persistida en la primera visita.
 * - Envío por navigator.sendBeacon: no bloquea la navegación ni el checkout.
 *
 * Seguro en SSR: toda función chequea `typeof window`.
 */

const SID_KEY = 'ate_sid';
const ATTR_KEY = 'ate_attr';

type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
};

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return 'sid-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid = uuid();
      localStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return null;
  }
}

function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** Captura UTMs de la URL en la primera visita y los persiste (first-touch). */
export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  try {
    const existing = localStorage.getItem(ATTR_KEY);
    if (existing) return JSON.parse(existing) as Attribution;

    const params = new URLSearchParams(window.location.search);
    const attr: Attribution = {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmContent: params.get('utm_content') || undefined,
      utmTerm: params.get('utm_term') || undefined,
      referrer:
        document.referrer && !document.referrer.includes(window.location.host)
          ? document.referrer
          : undefined,
    };
    // Solo persistir si hay algo de señal (evita pisar con vacío en cada visita directa)
    if (Object.values(attr).some(Boolean)) {
      localStorage.setItem(ATTR_KEY, JSON.stringify(attr));
    }
    return attr;
  } catch {
    return {};
  }
}

export interface TrackProps {
  path?: string;
  productId?: string;
  productName?: string;
  value?: number;
  quantity?: number;
  orderId?: string;
  meta?: Record<string, unknown>;
}

/** Registra un evento de la tienda. No bloquea ni lanza. */
export function track(type: string, props: TrackProps = {}): void {
  if (typeof window === 'undefined') return;
  try {
    const sessionId = getSessionId();
    if (!sessionId) return;
    const attr = captureAttribution();

    const payload = {
      type,
      sessionId,
      device: detectDevice(),
      path: props.path ?? window.location.pathname,
      referrer: attr.referrer ?? null,
      utmSource: attr.utmSource ?? null,
      utmMedium: attr.utmMedium ?? null,
      utmCampaign: attr.utmCampaign ?? null,
      utmContent: attr.utmContent ?? null,
      utmTerm: attr.utmTerm ?? null,
      productId: props.productId ?? null,
      productName: props.productName ?? null,
      value: props.value ?? null,
      quantity: props.quantity ?? null,
      orderId: props.orderId ?? null,
      meta: props.meta ?? null,
    };

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon && navigator.sendBeacon('/api/web/track', blob)) return;

    // Fallback si sendBeacon no está disponible/fue rechazado.
    fetch('/api/web/track', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* medir nunca rompe la UX */
  }
}
