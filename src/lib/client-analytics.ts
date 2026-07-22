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
  fbclid?: string;
  gclid?: string;
  /** Epoch ms en que se vio el fbclid (para reconstruir fbc si no hay cookie _fbc). */
  fbclidAt?: number;
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

/**
 * Captura UTMs de la URL en la primera visita y los persiste (first-touch).
 * Los click ids de ads (fbclid/gclid) son la excepción: se actualizan en CADA
 * visita que los traiga (last-touch), como exige el matching de Meta/Google.
 */
export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get('fbclid') || undefined;
    const gclid = params.get('gclid') || undefined;

    const existing = localStorage.getItem(ATTR_KEY);
    if (existing) {
      const attr = JSON.parse(existing) as Attribution;
      if (fbclid || gclid) {
        if (fbclid) {
          attr.fbclid = fbclid;
          attr.fbclidAt = Date.now();
        }
        if (gclid) attr.gclid = gclid;
        localStorage.setItem(ATTR_KEY, JSON.stringify(attr));
      }
      return attr;
    }

    const attr: Attribution = {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmContent: params.get('utm_content') || undefined,
      utmTerm: params.get('utm_term') || undefined,
      fbclid,
      fbclidAt: fbclid ? Date.now() : undefined,
      gclid,
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

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Datos de matching para Meta CAPI / Google, para adjuntar al checkout.
 * fbc/fbp salen de las cookies del Pixel; si no hay _fbc (adblock, Pixel
 * bloqueado) se reconstruye desde el fbclid persistido (formato oficial
 * fb.1.<timestamp>.<fbclid>).
 */
export function getAdsMatchData(): { fbc?: string; fbp?: string; gclid?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const attr = captureAttribution();
    let fbc = readCookie('_fbc');
    if (!fbc && attr.fbclid) {
      fbc = `fb.1.${attr.fbclidAt ?? Date.now()}.${attr.fbclid}`;
    }
    return { fbc, fbp: readCookie('_fbp'), gclid: attr.gclid };
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
      meta:
        props.meta || attr.fbclid || attr.gclid
          ? {
              ...(attr.fbclid ? { fbclid: attr.fbclid } : {}),
              ...(attr.gclid ? { gclid: attr.gclid } : {}),
              ...(props.meta ?? {}),
            }
          : null,
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
