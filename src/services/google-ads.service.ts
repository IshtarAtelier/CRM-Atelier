/**
 * Carga de conversiones offline a Google Ads.
 *
 * POR QUÉ EXISTE
 * La venta de la óptica se cierra conversando por WhatsApp o en el mostrador,
 * no en el checkout. Meta ya recibe ese cierre por el Conversions API
 * (`AdsService.sendOfflineConversion`), pero Google Ads no recibía nada: veía
 * el clic del anuncio y nunca se enteraba de que terminó en una venta. Como
 * Google concentra la mayor parte del gasto, estaba pujando a ciegas.
 *
 * CÓMO EMPAREJA GOOGLE LA VENTA CON EL CLIC
 * Dos caminos, y se manda el que haya:
 *   1. `gclid` — el identificador del clic. Es el más preciso. Lo tenemos sólo
 *      si la persona llegó por Google Ads y la sesión quedó vinculada al
 *      cliente (ver AnalyticsEvent.meta).
 *   2. Identificadores del usuario hasheados (mail y teléfono). Es lo que
 *      Google llama "conversiones mejoradas para clientes potenciales", y es el
 *      camino que sirve cuando el cierre llegó por WhatsApp y no hay gclid.
 *      Requiere que la acción de conversión tenga habilitadas las conversiones
 *      mejoradas en la interfaz de Google Ads.
 *
 * PRIVACIDAD
 * Mail y teléfono viajan hasheados con SHA-256, nunca en texto plano, igual que
 * en Meta CAPI. El hash se hace sobre el valor normalizado (minúsculas y sin
 * espacios para el mail; formato E.164 para el teléfono), porque Google hashea
 * del mismo modo del otro lado: si la normalización no coincide, el match falla
 * en silencio y la conversión se pierde sin error.
 *
 * NO ROMPE LA VENTA
 * Igual que el service de Meta: si faltan credenciales sale sin hacer nada, y
 * cualquier error se loguea pero nunca se propaga. Medir no puede tumbar una
 * operación de negocio.
 */
import crypto from 'crypto';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';
import { prisma } from '@/lib/db';

const API_VERSION = 'v24';
const API_BASE = 'https://googleads.googleapis.com';

/** Argentina no tiene horario de verano, así que el offset es fijo. */
const AR_UTC_OFFSET_HOURS = -3;

/**
 * Ventana hacia atrás para buscar el clic de la sesión que compró.
 *
 * Google descarta las conversiones cuyo clic queda fuera de la ventana de
 * conversión de la acción (90 días es el techo habitual), así que rescatar un
 * gclid más viejo que eso no sirve: la conversión se sube y la rechazan.
 */
const VENTANA_CLIC_MS = 90 * 24 * 60 * 60 * 1000;

interface OfflineClient {
  email?: string | null;
  phone?: string | null;
}

export interface OfflineConversionInput {
  /** Id de la orden. Va como `orderId` y evita que Google cuente dos veces la misma venta. */
  orderId: string;
  /** Importe cobrado. Es lo que permite a Google pujar por valor y no por cantidad. */
  value: number;
  /** Cuándo se cerró la venta. */
  occurredAt: Date;
  client: OfflineClient;
  /** Si la sesión que compró vino de un clic de Google Ads. */
  gclid?: string | null;
  /** Variantes de gclid para iOS/app; se mandan en su lugar si están. */
  wbraid?: string | null;
  gbraid?: string | null;
}

/** Los identificadores de clic de Google, tal como los guarda el checkout web. */
export interface ClickIds {
  gclid?: string;
  wbraid?: string;
  gbraid?: string;
}

export interface UploadResult {
  ok: boolean;
  skipped?: string;
  /** Errores por fila que devuelve la API cuando `partialFailure` está activo. */
  partialErrors?: unknown;
  validateOnly?: boolean;
}

/** Token cacheado en memoria: dura una hora y se pide de nuevo antes de vencer. */
let cachedToken: { value: string; expiresAt: number } | null = null;

export class GoogleAdsService {
  private static hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /** Minúsculas y sin espacios: es como hashea Google del otro lado. */
  private static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * E.164. Reusa el normalizador argentino que ya usa WhatsApp (devuelve
   * `549…`) y le antepone el `+` que exige Google.
   */
  private static normalizePhoneE164(phone: string): string | null {
    const local = formatPhoneForWhatsApp(phone);
    return local ? `+${local}` : null;
  }

  /** `yyyy-MM-dd HH:mm:ss-03:00`, el único formato que acepta la API. */
  private static conversionDateTime(date: Date): string {
    const shifted = new Date(date.getTime() + AR_UTC_OFFSET_HOURS * 3600 * 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    return (
      `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())} ` +
      `${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}-03:00`
    );
  }

  private static customerId(): string | null {
    const raw = process.env.GOOGLE_ADS_CUSTOMER_ID;
    return raw ? raw.replace(/-/g, '') : null;
  }

  /**
   * La acción de conversión se configura en la interfaz de Google Ads y su id
   * se carga por entorno. Se acepta el id pelado o el resource name completo.
   */
  private static conversionAction(customerId: string): string | null {
    const raw = process.env.GOOGLE_ADS_OFFLINE_CONVERSION_ACTION?.trim();
    if (!raw) return null;
    if (raw.startsWith('customers/')) return raw;
    return `customers/${customerId}/conversionActions/${raw.replace(/\D/g, '')}`;
  }

  /** Saca los identificadores de clic del `meta` de un AnalyticsEvent, si los tiene. */
  private static leerClickIds(meta: unknown): ClickIds | null {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
    const m = meta as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const ids: ClickIds = {
      gclid: texto(m.gclid),
      wbraid: texto(m.wbraid),
      gbraid: texto(m.gbraid),
    };
    return ids.gclid || ids.wbraid || ids.gbraid ? ids : null;
  }

  /**
   * Busca el clic de Google que trajo la venta.
   *
   * DE DÓNDE SALE. El tracker de la tienda guarda el gclid (y sus variantes de
   * app) en `localStorage` y lo manda con cada evento; el checkout lo repite en
   * el evento `purchase`, que es el único que queda atado a la orden por
   * `AnalyticsEvent.orderId`. O sea: el dato ya estaba en la base, pero el
   * llamador que sube la venta a Google no lo leía y toda conversión offline
   * viajaba sin identificador de clic. Sin gclid, Google no puede decir qué
   * anuncio produjo esa venta: la conversión se sube y no sirve para pujar.
   *
   * POR QUÉ TAMBIÉN SE MIRA LA SESIÓN. El evento de compra no siempre trae el
   * `meta` completo (una compra por transferencia o un pedido cargado a mano
   * pueden no repetirlo), pero la sesión que compró suele tener el gclid en el
   * `page_view` con el que entró desde el anuncio. Se limita a la ventana de
   * conversión y a eventos anteriores a la compra, para no atribuirle la venta a
   * un clic posterior ni a uno que Google ya va a rechazar por viejo.
   *
   * Nunca lanza: si la lectura falla, devuelve vacío y la conversión sale por el
   * camino de los identificadores hasheados, que es el que ya existía.
   */
  public static async findClickIds(orderId: string): Promise<ClickIds> {
    if (!orderId) return {};
    try {
      const deLaOrden = await prisma.analyticsEvent.findMany({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
        select: { sessionId: true, meta: true, createdAt: true },
        take: 20,
      });

      for (const evento of deLaOrden) {
        const ids = this.leerClickIds(evento.meta);
        if (ids) return ids;
      }

      const referencia = deLaOrden[0];
      if (!referencia?.sessionId) return {};

      const deLaSesion = await prisma.analyticsEvent.findMany({
        where: {
          sessionId: referencia.sessionId,
          createdAt: {
            lte: referencia.createdAt,
            gte: new Date(referencia.createdAt.getTime() - VENTANA_CLIC_MS),
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { meta: true },
        take: 50,
      });

      for (const evento of deLaSesion) {
        const ids = this.leerClickIds(evento.meta);
        if (ids) return ids;
      }

      return {};
    } catch (err) {
      console.error(`[GoogleAdsService] No se pudo leer el clic de la orden ${orderId}:`, err);
      return {};
    }
  }

  /** Access token vía refresh token de OAuth2. Se cachea hasta poco antes de vencer. */
  private static async getAccessToken(): Promise<string | null> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) return null;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      // No se loguea el cuerpo: puede traer parte del token.
      console.error(`[GoogleAdsService] No se pudo renovar el token OAuth (HTTP ${res.status}).`);
      return null;
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    cachedToken = {
      value: data.access_token,
      // 60 s de margen para no usar un token que vence en pleno vuelo.
      expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
    };
    return cachedToken.value;
  }

  /**
   * Sube una venta cerrada a Google Ads.
   *
   * Devuelve un resultado en vez de lanzar, para que el llamador de runtime lo
   * ignore y un script de backfill pueda informarlo.
   */
  public static async uploadOfflineConversion(
    input: OfflineConversionInput,
    opts: { validateOnly?: boolean } = {},
  ): Promise<UploadResult> {
    const customerId = this.customerId();
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!customerId || !developerToken) {
      return { ok: false, skipped: 'credenciales de Google Ads no configuradas' };
    }

    // Doble llave, igual que `mutate()` de scripts/ads/lib/google_client.js.
    // `uploadClickConversions` es un endpoint de mutación, y la regla del repo
    // es que ninguna escritura a Google Ads ocurra sola: hay que habilitarla a
    // propósito. Sin esta variable el service queda inerte aunque el resto de
    // las credenciales estén cargadas.
    if (process.env.GOOGLE_ADS_UPLOAD_CONVERSIONS !== '1') {
      return { ok: false, skipped: 'carga de conversiones no habilitada (GOOGLE_ADS_UPLOAD_CONVERSIONS)' };
    }

    const conversionAction = this.conversionAction(customerId);
    if (!conversionAction) {
      return {
        ok: false,
        skipped:
          'falta GOOGLE_ADS_OFFLINE_CONVERSION_ACTION — hay que crear la acción de conversión en Google Ads y cargar su id',
      };
    }

    // Sin valor no tiene sentido subirla: el objetivo es que Google puje por
    // facturación, no por cantidad de ventas.
    if (!(input.value > 0)) {
      return { ok: false, skipped: `orden ${input.orderId} sin importe cobrado` };
    }

    const userIdentifiers: Array<Record<string, string>> = [];
    if (input.client.email) {
      userIdentifiers.push({ hashedEmail: this.hash(this.normalizeEmail(input.client.email)) });
    }
    if (input.client.phone) {
      const e164 = this.normalizePhoneE164(input.client.phone);
      if (e164) userIdentifiers.push({ hashedPhoneNumber: this.hash(e164) });
    }

    const hasClickId = Boolean(input.gclid || input.wbraid || input.gbraid);
    // Sin clic identificado y sin datos de contacto no hay forma de emparejar:
    // subirla sólo ensucia la cuenta con una conversión que Google descarta.
    if (!hasClickId && userIdentifiers.length === 0) {
      return { ok: false, skipped: `orden ${input.orderId} sin gclid ni datos de contacto` };
    }

    const conversion: Record<string, unknown> = {
      conversionAction,
      conversionDateTime: this.conversionDateTime(input.occurredAt),
      conversionValue: input.value,
      currencyCode: 'ARS',
      // Google usa `orderId` para desduplicar: si la misma venta se sube dos
      // veces (por reintento o por el backfill), la cuenta una sola vez.
      orderId: input.orderId,
    };

    // gclid y las variantes de app son mutuamente excluyentes entre sí.
    if (input.gclid) conversion.gclid = input.gclid;
    else if (input.wbraid) conversion.wbraid = input.wbraid;
    else if (input.gbraid) conversion.gbraid = input.gbraid;

    if (userIdentifiers.length > 0) conversion.userIdentifiers = userIdentifiers;

    const accessToken = await this.getAccessToken();
    if (!accessToken) return { ok: false, skipped: 'no se pudo obtener el access token' };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    // Si el acceso es a través de una cuenta administradora (MCC).
    if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
      headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');
    }

    // `validateOnly` permite probar la integración sin registrar nada en la
    // cuenta. Se puede forzar por entorno para un primer despliegue en seco.
    const validateOnly = opts.validateOnly ?? process.env.GOOGLE_ADS_VALIDATE_ONLY === '1';

    const res = await fetch(
      `${API_BASE}/${API_VERSION}/customers/${customerId}:uploadClickConversions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversions: [conversion],
          // Sin esto, un solo dato mal formado tira abajo el lote entero.
          partialFailure: true,
          validateOnly,
        }),
      },
    );

    const body = (await res.json().catch(() => null)) as {
      partialFailureError?: unknown;
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      console.error(
        `[GoogleAdsService] Falló la carga de la orden ${input.orderId} (HTTP ${res.status}): ${body?.error?.message ?? 'sin detalle'}`,
      );
      return { ok: false };
    }

    if (body?.partialFailureError) {
      console.error(
        `[GoogleAdsService] Google rechazó la orden ${input.orderId}:`,
        JSON.stringify(body.partialFailureError),
      );
      return { ok: false, partialErrors: body.partialFailureError, validateOnly };
    }

    return { ok: true, validateOnly };
  }

  /**
   * Envoltorio para el runtime: dispara y se olvida. Nunca lanza ni frena la
   * venta, y deja constancia en consola de por qué se salteó cuando aplica.
   *
   * El llamador debería resolver antes los identificadores de clic con
   * `findClickIds(orderId)` y pasarlos en el input: sin ellos la conversión sale
   * igual, pero apoyada sólo en el match por mail/teléfono.
   */
  public static sendOfflineConversion(input: OfflineConversionInput): void {
    this.uploadOfflineConversion(input)
      .then((r) => {
        if (r.skipped) console.log(`[GoogleAdsService] Conversión no enviada: ${r.skipped}`);
        else if (r.ok) {
          console.log(
            `[GoogleAdsService] Conversión de la orden ${input.orderId} enviada${r.validateOnly ? ' (sólo validación)' : ''}.`,
          );
        }
      })
      .catch((e) => console.error('[GoogleAdsService] Excepción enviando la conversión:', e));
  }

  /**
   * Gasto de Google Ads del mes en curso, en pesos.
   *
   * Es la mitad que faltaba para poder vigilar el techo mensual de inversión:
   * de Meta ya se leía el gasto (`src/lib/ads/meta-insights.ts`), de Google no
   * — este service solo sabía escribir conversiones.
   *
   * Devuelve `null` si la integración no está configurada o si la consulta
   * falla, para que quien vigila el techo pueda decir "no pude leer Google" en
   * vez de informar un gasto de cero, que se interpretaría como "hay margen".
   * Esa distinción importa: un cero falso invita a gastar de más.
   */
  public static async getMonthToDateSpendArs(): Promise<number | null> {
    const customerId = this.customerId();
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!customerId || !developerToken) return null;

    const accessToken = await this.getAccessToken();
    if (!accessToken) return null;

    const hoy = new Date();
    const desde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    const hasta = hoy.toISOString().slice(0, 10);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
      headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');
    }

    try {
      const res = await fetch(`${API_BASE}/${API_VERSION}/customers/${customerId}/googleAds:search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `SELECT metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${desde}' AND '${hasta}'`,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        // El cuerpo del error puede traer el customer id pero no credenciales.
        console.error(`[GoogleAdsService] No se pudo leer el gasto del mes (HTTP ${res.status}).`);
        return null;
      }

      const body = (await res.json()) as { results?: Array<{ metrics?: { costMicros?: string } }> };
      const micros = (body.results ?? []).reduce((acc, r) => acc + Number(r.metrics?.costMicros ?? 0), 0);
      return micros / 1_000_000;
    } catch (err) {
      console.error('[GoogleAdsService] Excepción leyendo el gasto del mes:', err);
      return null;
    }
  }
}
