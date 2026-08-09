import crypto from 'crypto';

interface ClientData {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}

interface OrderData {
  id: string;
  total: number;
  client: ClientData;
  createdAt?: Date;
}

/**
 * Señales de matching del navegador (cookies del Pixel + red). Cuantas más
 * lleguen, mejor atribuye Meta la conversión al click del anuncio — fbc/fbp
 * son las de mayor peso. Van en texto plano (así lo exige CAPI), no se hashean.
 */
interface MatchData {
  fbc?: string | null;
  fbp?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
}

export class AdsService {
  /**
   * Hashes a string using SHA-256 as required by Meta CAPI.
   */
  private static hashData(data: string): string {
    return crypto.createHash('sha256').update(data.trim().toLowerCase()).digest('hex');
  }

  /**
   * Cleans and normalizes phone numbers (removes spaces, +, etc.)
   */
  private static normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Núcleo de envío de un evento Purchase al Conversions API de Meta.
   * No bloquea (fetch fire-and-forget) ni lanza: medir no rompe la venta.
   * @param eventId  Para deduplicar con el Pixel client-side (mismo id en ambos lados).
   */
  private static dispatchPurchase(
    order: OrderData,
    actionSource: 'physical_store' | 'website',
    opts: {
      eventId?: string;
      eventSourceUrl?: string;
      matchData?: MatchData;
    } = {},
  ) {
    const metaToken = process.env.META_ACCESS_TOKEN;
    const pixelId = process.env.META_PIXEL_ID;

    // Si no están configuradas las variables, salimos silenciosamente
    // para no interrumpir el flujo de la aplicación.
    if (!metaToken || !pixelId) {
      console.log('[AdsService] Meta CAPI ignorado: credenciales no configuradas.');
      return;
    }

    try {
      const timeOfEvent = Math.floor((order.createdAt?.getTime() || Date.now()) / 1000);

      const userData: any = {};
      if (order.client.email) userData.em = [this.hashData(order.client.email)];
      if (order.client.phone) userData.ph = [this.hashData(this.normalizePhone(order.client.phone))];
      const match = opts.matchData;
      if (match?.fbc) userData.fbc = match.fbc;
      if (match?.fbp) userData.fbp = match.fbp;
      if (match?.clientIp) userData.client_ip_address = match.clientIp;
      if (match?.userAgent) userData.client_user_agent = match.userAgent;

      const event: any = {
        event_name: 'Purchase',
        event_time: timeOfEvent,
        action_source: actionSource,
        user_data: userData,
        custom_data: {
          currency: 'ARS',
          value: order.total,
          order_id: order.id,
        },
      };
      // event_id permite a Meta descartar el duplicado del Pixel (dedup client+server).
      if (opts.eventId) event.event_id = opts.eventId;
      if (opts.eventSourceUrl) event.event_source_url = opts.eventSourceUrl;

      this.postToMeta(event, `Conversión ${actionSource}`);
    } catch (err) {
      console.error('[AdsService] Error general preparando evento CAPI:', err);
    }
  }

  /**
   * Transporte al Conversions API. Fire-and-forget: no se `await`-ea nunca desde
   * una ruta de venta ni de medición.
   */
  private static postToMeta(event: Record<string, unknown>, label: string) {
    const metaToken = process.env.META_ACCESS_TOKEN;
    const pixelId = process.env.META_PIXEL_ID;
    if (!metaToken || !pixelId) return;

    // v24.0: la Marketing API rechaza versiones viejas desde jun-2026 (#2635).
    const apiUrl = `https://graph.facebook.com/v24.0/${pixelId}/events`;

    // Enviamos el request de forma asíncrona sin bloquear
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], access_token: metaToken }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          console.error('[AdsService] Meta CAPI Error:', data.error);
        } else {
          console.log(
            `[AdsService] ${label} enviada a Meta. Eventos procesados: ${data.events_received}`,
          );
        }
      })
      .catch((error) => {
        console.error('[AdsService] Excepción enviando a Meta CAPI:', error);
      });
  }

  /**
   * Conversión offline (venta del local/CRM). action_source: physical_store.
   */
  public static async sendOfflineConversion(order: OrderData) {
    this.dispatchPurchase(order, 'physical_store');
  }

  /**
   * Conversión de una compra WEB (checkout online). action_source: website.
   * Respaldo server-side del Pixel: resiste adblock/iOS/ITP. Usa event_id =
   * order.id para deduplicar con el Purchase del Pixel del navegador.
   */
  public static async sendWebPurchase(
    order: OrderData,
    opts: { eventSourceUrl?: string; matchData?: MatchData } = {},
  ) {
    this.dispatchPurchase(order, 'website', {
      eventId: order.id,
      eventSourceUrl: opts.eventSourceUrl,
      matchData: opts.matchData,
    });
  }

  /**
   * Evento de embudo (ViewContent / AddToCart / InitiateCheckout) por CAPI.
   *
   * Por qué también server-side y no solo con el Pixel: el navegador pierde
   * eventos por adblock, iOS/ITP y pestañas que se cierran antes de que dispare
   * el script. El server manda siempre, y `eventId` (el mismo que usó el Pixel)
   * hace que Meta cuente UNO solo cuando llegan los dos.
   *
   * No lleva email ni teléfono: en el embudo previo a la compra todavía no hay
   * datos del cliente. El matching se apoya en fbp/fbc + IP + user-agent.
   */
  public static async sendWebFunnelEvent(
    eventName: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Contact',
    opts: {
      eventId?: string;
      eventSourceUrl?: string;
      matchData?: MatchData;
      value?: number | null;
      contentIds?: string[];
      contentName?: string | null;
      numItems?: number | null;
      eventTime?: Date;
    } = {},
  ) {
    const metaToken = process.env.META_ACCESS_TOKEN;
    const pixelId = process.env.META_PIXEL_ID;
    if (!metaToken || !pixelId) return;

    try {
      const match = opts.matchData;
      const userData: any = {};
      if (match?.fbc) userData.fbc = match.fbc;
      if (match?.fbp) userData.fbp = match.fbp;
      if (match?.clientIp) userData.client_ip_address = match.clientIp;
      if (match?.userAgent) userData.client_user_agent = match.userAgent;

      // Sin ninguna señal del navegador el evento no matchea con nadie: Meta lo
      // recibe y lo descarta. Preferimos no mandarlo antes que ensuciar el pixel.
      if (!Object.keys(userData).length) return;

      const customData: any = { currency: 'ARS' };
      if (typeof opts.value === 'number' && opts.value > 0) customData.value = opts.value;
      if (opts.contentIds?.length) {
        customData.content_ids = opts.contentIds;
        customData.content_type = 'product';
      }
      if (opts.contentName) customData.content_name = opts.contentName;
      if (typeof opts.numItems === 'number' && opts.numItems > 0) customData.num_items = opts.numItems;

      const event: Record<string, unknown> = {
        event_name: eventName,
        event_time: Math.floor((opts.eventTime?.getTime() || Date.now()) / 1000),
        action_source: 'website',
        user_data: userData,
        custom_data: customData,
      };
      if (opts.eventId) event.event_id = opts.eventId;
      if (opts.eventSourceUrl) event.event_source_url = opts.eventSourceUrl;

      this.postToMeta(event, eventName);
    } catch (err) {
      console.error('[AdsService] Error preparando evento de embudo CAPI:', err);
    }
  }

  /**
   * Salud del píxel consultada a la Graph API: si existe, cuándo disparó por
   * última vez y qué eventos recibió en los últimos 7 días. Solo lectura.
   *
   * `configured` sale de las env del server; el resto puede venir null si el
   * token no tiene permiso para stats (el error se devuelve como texto, nunca
   * el token). Con timeout corto: es un panel, no puede colgar al admin.
   */
  public static async getPixelHealth(): Promise<{
    configured: { pixelId: boolean; capiToken: boolean };
    pixel: { name: string; lastFiredTime: string | null; isUnavailable: boolean } | null;
    events7d: { event: string; count: number }[] | null;
    error: string | null;
  }> {
    const pixelId = process.env.META_PIXEL_ID;
    const configured = {
      pixelId: Boolean(pixelId),
      capiToken: Boolean(process.env.META_ACCESS_TOKEN),
    };

    // Los tokens NO son intercambiables. META_ACCESS_TOKEN es el que usa el
    // Conversions API para ESCRIBIR eventos y no trae `ads_read`: pidiéndole
    // las stats del píxel devuelve "(#100) Missing Permission", que parece un
    // píxel roto y no lo es. La lectura la hace META_ADS_TOKEN (system user con
    // ads_read). Se prueban en orden; el mismo orden que scripts/checks/pixel-salud.mjs.
    const tokens = [
      process.env.META_ADS_TOKEN,
      process.env.META_SYSTEM_USER_TOKEN,
      process.env.META_ACCESS_TOKEN,
    ].filter((t): t is string => Boolean(t));

    if (!pixelId || !tokens.length) {
      return {
        configured,
        pixel: null,
        events7d: null,
        error: 'Falta META_PIXEL_ID o algún token de Meta',
      };
    }

    const graph = async (ruta: string, token: string) => {
      const sep = ruta.includes('?') ? '&' : '?';
      const res = await fetch(
        `https://graph.facebook.com/v24.0/${ruta}${sep}access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(6000), cache: 'no-store' },
      );
      return res.json();
    };

    let ultimoError: string | null = null;

    for (const token of tokens) {
      try {
        const desde = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
        const [info, stats] = await Promise.all([
          graph(`${pixelId}?fields=name,last_fired_time,is_unavailable`, token),
          graph(`${pixelId}/stats?aggregation=event&start_time=${desde}`, token),
        ]);

        // Los mensajes de error de Meta no incluyen el token; son seguros de mostrar.
        if (info?.error || stats?.error) {
          ultimoError = info?.error?.message || stats?.error?.message || null;
          continue; // sin permiso con este token: probar el siguiente
        }

        const porEvento = new Map<string, number>();
        for (const bloque of stats?.data ?? []) {
          for (const fila of bloque?.data ?? []) {
            porEvento.set(fila.value, (porEvento.get(fila.value) ?? 0) + Number(fila.count || 0));
          }
        }

        return {
          configured,
          pixel: {
            name: String(info.name ?? ''),
            lastFiredTime: info.last_fired_time ?? null,
            isUnavailable: Boolean(info.is_unavailable),
          },
          events7d: [...porEvento.entries()]
            .map(([event, count]) => ({ event, count }))
            .sort((a, b) => b.count - a.count),
          error: null,
        };
      } catch (err) {
        ultimoError = err instanceof Error ? err.message : 'Error consultando la Graph API';
      }
    }

    return { configured, pixel: null, events7d: null, error: ultimoError };
  }
}
