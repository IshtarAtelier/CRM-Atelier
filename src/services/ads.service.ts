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

      const apiUrl = `https://graph.facebook.com/v19.0/${pixelId}/events`;

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
              `[AdsService] Conversión ${actionSource} enviada a Meta. Eventos procesados: ${data.events_received}`,
            );
          }
        })
        .catch((error) => {
          console.error('[AdsService] Excepción enviando a Meta CAPI:', error);
        });
    } catch (err) {
      console.error('[AdsService] Error general preparando evento CAPI:', err);
    }
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
}
