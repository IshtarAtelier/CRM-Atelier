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
  /**
   * Google no siempre manda `gclid`. En iOS y cuando el navegador limita las
   * cookies manda `wbraid` (Búsqueda) o `gbraid` (resto de la red). Sin estos
   * dos se pierde una parte grande de los clics desde celular.
   */
  wbraid?: string;
  gbraid?: string;
  /** Epoch ms en que se vio el fbclid (para reconstruir fbc si no hay cookie _fbc). */
  fbclidAt?: number;
  /**
   * Epoch ms del último identificador de Google. Hace falta para decidir el
   * origen cuando el visitante trae los dos: alguien que hizo clic en un aviso
   * de Google en mayo y hoy entra por Meta tiene ambos guardados, y sin fecha
   * ganaba siempre el primero que se chequeaba.
   */
  gclidAt?: number;
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
    const wbraid = params.get('wbraid') || undefined;
    const gbraid = params.get('gbraid') || undefined;

    const existing = localStorage.getItem(ATTR_KEY);
    if (existing) {
      // Si el valor guardado está corrupto, JSON.parse lanza y sin este borrado
      // el navegador quedaba con la atribución muerta PARA SIEMPRE: cada visita
      // futura fallaba en el mismo parse antes de poder guardar el gclid nuevo.
      let attr: Attribution;
      try {
        attr = JSON.parse(existing) as Attribution;
      } catch {
        localStorage.removeItem(ATTR_KEY);
        return capturarFresco(params, { fbclid, gclid, wbraid, gbraid });
      }
      if (fbclid || gclid || wbraid || gbraid) {
        if (fbclid) {
          attr.fbclid = fbclid;
          attr.fbclidAt = Date.now();
        }
        if (gclid || wbraid || gbraid) {
          if (gclid) attr.gclid = gclid;
          if (wbraid) attr.wbraid = wbraid;
          if (gbraid) attr.gbraid = gbraid;
          attr.gclidAt = Date.now();
        }
        localStorage.setItem(ATTR_KEY, JSON.stringify(attr));
      }
      return attr;
    }

    return capturarFresco(params, { fbclid, gclid, wbraid, gbraid });
  } catch {
    return {};
  }
}

/** Primera visita (o dato corrupto recién borrado): se guarda lo que traiga la URL. */
function capturarFresco(
  params: URLSearchParams,
  ids: { fbclid?: string; gclid?: string; wbraid?: string; gbraid?: string },
): Attribution {
  try {
    const { fbclid, gclid, wbraid, gbraid } = ids;
    const attr: Attribution = {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmContent: params.get('utm_content') || undefined,
      utmTerm: params.get('utm_term') || undefined,
      fbclid,
      fbclidAt: fbclid ? Date.now() : undefined,
      gclid,
      wbraid,
      gbraid,
      gclidAt: gclid || wbraid || gbraid ? Date.now() : undefined,
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

/**
 * De dónde vino este visitante, si se puede saber con certeza.
 *
 * Solo devuelve algo cuando hay un identificador de clic de la plataforma en la
 * URL con la que entró: no adivina por referrer ni por UTMs, que se pueden
 * copiar y pegar. Ante la duda devuelve null y el vendedor elige a mano — un
 * origen inventado es peor que un origen vacío (por eso no hay default a Meta).
 */
/**
 * Ventana de atribución: un clic más viejo que esto ya no cuenta como origen.
 *
 * Sin ventana, alguien que hizo clic en un aviso hace dos meses y hoy entra
 * escribiendo la dirección a mano seguía mandando "Los vi en Google Ads." — y el
 * portero lo metía en la cohorte de pauta. Es el mismo sobreconteo que infló el
 * ROAS de 70×. 30 días es la ventana estándar de Google; Meta usa 7 para el clic.
 */
const VENTANA_GOOGLE_MS = 30 * 24 * 60 * 60 * 1000;
const VENTANA_META_MS = 7 * 24 * 60 * 60 * 1000;

export function adPlatform(): 'Google Ads' | 'Meta' | null {
  if (typeof window === 'undefined') return null;
  try {
    const attr = captureAttribution();
    const ahora = Date.now();

    // Un identificador sin fecha es de antes de que se guardara `gclidAt`: es
    // viejo por definición, así que no cuenta. Mejor sin origen que con uno
    // vencido.
    const vigente = (visto?: number, ventana?: number) =>
      Boolean(visto && ventana && ahora - visto <= ventana);

    const google = Boolean(attr.gclid || attr.wbraid || attr.gbraid) && vigente(attr.gclidAt, VENTANA_GOOGLE_MS);
    const meta = Boolean(attr.fbclid) && vigente(attr.fbclidAt, VENTANA_META_MS);

    if (!google && !meta) return null;
    if (google && !meta) return 'Google Ads';
    if (meta && !google) return 'Meta';
    // Los dos vigentes: gana el clic más reciente.
    return (attr.gclidAt ?? 0) > (attr.fbclidAt ?? 0) ? 'Google Ads' : 'Meta';
  } catch {
    return null;
  }
}

/**
 * La frase que se agrega al mensaje de WhatsApp para que el origen viaje con la
 * consulta. La lee el portero (detectContactSourceFromChat) y la ve el vendedor
 * en el buzón: el dato queda a la vista, no escondido en un código.
 */
export function adPlatformSentence(): string {
  const p = adPlatform();
  if (p === 'Google Ads') return 'Los vi en Google Ads.';
  if (p === 'Meta') return 'Los vi en Meta.';
  return '';
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
