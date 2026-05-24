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
   * Sends an offline conversion (Purchase) to Meta Ads via the Conversions API.
   */
  public static async sendOfflineConversion(order: OrderData) {
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
      
      if (order.client.email) {
        userData.em = [this.hashData(order.client.email)];
      }
      
      if (order.client.phone) {
        userData.ph = [this.hashData(this.normalizePhone(order.client.phone))];
      }

      const eventData = [
        {
          event_name: 'Purchase',
          event_time: timeOfEvent,
          action_source: 'physical_store',
          user_data: userData,
          custom_data: {
            currency: 'ARS',
            value: order.total,
            order_id: order.id
          }
        }
      ];

      const apiUrl = `https://graph.facebook.com/v19.0/${pixelId}/events`;
      
      // Enviamos el request de forma asíncrona sin bloquear
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: eventData,
          access_token: metaToken,
        }),
      })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          console.error('[AdsService] Meta CAPI Error:', data.error);
        } else {
          console.log(`[AdsService] Conversión Offline enviada a Meta. Eventos procesados: ${data.events_received}`);
        }
      })
      .catch(error => {
        console.error('[AdsService] Excepción enviando a Meta CAPI:', error);
      });

    } catch (err) {
      console.error('[AdsService] Error general preparando evento CAPI:', err);
    }
  }
}
