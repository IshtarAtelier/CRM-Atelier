import crypto from 'crypto';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';

/**
 * Meta Conversions API (CAPI) — la ÚNICA puerta server-side al píxel.
 * Endpoint: POST https://graph.facebook.com/v24.0/{META_PIXEL_ID}/events.
 *
 * Credenciales: `META_PIXEL_ID` + `META_ACCESS_TOKEN` (el token del
 * Conversions API; cómo generarlo en 2 minutos está en `.env.example`).
 * Sin credenciales el service no rompe nada: loguea y sale.
 *
 * DEDUPLICACIÓN Pixel ↔ CAPI — estrategia única del proyecto:
 * - Embudo (ViewContent / AddToCart / InitiateCheckout / Contact): el id nace
 *   en UN solo lugar, `newEventId()` de `src/lib/tracking.ts`. Viaja al Pixel
 *   como `{ eventID }` y a `/api/web/track` dentro de `meta.eventId`, desde
 *   donde esta clase lo reenvía como `event_id`. Meta recibe los dos y cuenta
 *   UNO: el del navegador llega antes, el del server resiste adblock/ITP.
 * - Purchase: `event_id = order.id` en los dos lados — `trackPurchase()` en el
 *   navegador y el evento que arma `buildPurchaseEvent()` acá. Quien lo MANDA
 *   es `MetaConversionService` (outbox `MetaConversion` + reintentos): las DOS
 *   ramas de cobro web (Payway en línea y webhook de Mercado Pago vía
 *   `finalize-web-payment.ts`) y la venta del local (`order.service.ts`, al
 *   convertir el presupuesto en venta) registran la compra ahí. Este archivo
 *   no manda compras por su cuenta: arma el evento y hace el POST.
 * - Por eso NO hay un ViewContent disparado desde el server component de la
 *   ficha: el id nace en el cliente, así que un evento emitido en el render
 *   del server no podría compartirlo con el Pixel y Meta lo contaría doble.
 *
 * Datos personales: SIEMPRE hasheados con SHA-256 antes de salir (email,
 * teléfono, nombre), normalizados como pide Meta. Este archivo no loguea
 * jamás un email o teléfono en claro. fbp/fbc/IP/user-agent van en claro
 * porque así lo exige el Conversions API.
 */

interface ClientData {
  phone?: string | null;
  email?: string | null;
  /** Nombre completo. Si no vienen firstName/lastName, se parte acá (1ª palabra = nombre). */
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface PurchaseOrderData {
  id: string;
  total: number;
  client: ClientData;
  createdAt?: Date;
  /**
   * Ids de los productos comprados, los MISMOS que usa el catálogo de Meta
   * (`<g:id>` del feed = id del Product). Con esto el anuncio de catálogo sabe
   * QUÉ se vendió y puede optimizar por producto; sin esto solo sabe que hubo
   * una compra. Armarlos con `idsDeProductos()`.
   */
  contentIds?: string[];
}

/**
 * Los ids de producto de una lista de ítems, sin repetir, en el formato del
 * catálogo. Acepta las tres formas que existen: el ítem del carrito web
 * (`productId`), la línea de una orden del CRM (`product.id`) y un id suelto.
 */
export function idsDeProductos(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const ids = new Set<string>();
  for (const it of items as any[]) {
    const crudo = it?.productId ?? it?.product?.id ?? (typeof it === 'string' ? it : null);
    if (crudo == null || crudo === 'unknown') continue;
    const id = String(crudo).replace(/[^a-zA-Z0-9_-]/g, '');
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * Señales de matching del navegador (cookies del Pixel + red). Cuantas más
 * lleguen, mejor atribuye Meta la conversión al click del anuncio — fbc/fbp
 * son las de mayor peso. Van en texto plano (así lo exige CAPI), no se hashean.
 */
export interface MatchData {
  fbc?: string | null;
  fbp?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
}

/** Dónde ocurrió la compra, en el vocabulario de Meta. */
export type ActionSource = 'website' | 'physical_store';

/**
 * Resultado de un POST al Conversions API, clasificado para que la outbox
 * decida qué hacer: `transitorio` se reintenta (red, rate limit, token caído
 * hasta que alguien lo reponga), `vencido` y `rechazo` no (insistir no los
 * cambia), `sin_credenciales` se reintenta y avisa (no puede quedar mudo).
 */
export type ResultadoEnvio =
  | { ok: true; eventsReceived: number }
  | { ok: false; tipo: 'transitorio' | 'vencido' | 'rechazo' | 'sin_credenciales'; error: string };

/**
 * Traduce el error JSON de la Graph API a un tipo de fallo. El texto nunca
 * incluye el token (Meta no lo devuelve), así que es seguro guardarlo.
 */
export function clasificarErrorMeta(error: {
  code?: number | string;
  message?: string;
  error_subcode?: number;
}): { tipo: 'transitorio' | 'vencido' | 'rechazo'; error: string } {
  const code = Number(error?.code);
  const msg = String(error?.message || 'error de Meta');
  const texto = `Meta #${code}${error?.error_subcode ? '/' + error.error_subcode : ''}: ${msg}`.slice(0, 500);
  // #100 sobre event_time: la compra ya tiene más de 7 días para Meta.
  if (code === 100 && /event_time|older than|7 days|too old|too far/i.test(msg)) return { tipo: 'vencido', error: texto };
  // #100 = parámetro inválido, #368 = política: reintentar no lo cambia.
  if (code === 100 || code === 368) return { tipo: 'rechazo', error: texto };
  // 190 token, 10/200-299 permisos, 1/2/4/17/32/613 rate limit o genérico: se
  // arregla afuera (token nuevo, esperar) y el reintento lo recupera.
  return { tipo: 'transitorio', error: texto };
}

export class AdsService {
  /**
   * Hashes a string using SHA-256 as required by Meta CAPI.
   */
  private static hashData(data: string): string {
    return crypto.createHash('sha256').update(data.trim().toLowerCase()).digest('hex');
  }

  /**
   * Teléfono en E.164 sin el '+' (549…), que es como lo exige Meta. Reusa el
   * canon argentino de `src/lib/phone-utils` (el mismo con el que se escribe
   * por WhatsApp): "0351 15 612-3456" y "+54 9 351 612-3456" hashean IGUAL.
   * Antes solo se sacaban los no-dígitos, y un número tipeado en formato local
   * producía un hash que no matcheaba con nadie.
   */
  private static normalizePhone(phone: string): string {
    const e164 = formatPhoneForWhatsApp(phone);
    // Menos de 12 dígitos no llega a ser un número argentino completo
    // (549 + área + abonado ≈ 13). Hashear basura no matchea a nadie.
    return e164.length >= 12 ? e164 : '';
  }

  /**
   * Nombre/apellido como los pide Meta para fn/ln: minúsculas, sin espacios en
   * los bordes y sin tildes (Meta recomienda a-z). "María" tipeado con y sin
   * tilde tiene que producir el mismo hash o no matchea.
   */
  private static normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Arma un evento Purchase del Conversions API. PURO: no manda nada y no toca
   * la base. Quien lo manda es `MetaConversionService`, que primero lo anota en
   * la tabla `MetaConversion` y después insiste hasta que Meta lo acepte.
   *
   * `eventTime` es el momento REAL de la compra: `labSentAt` en la venta del
   * local, `createdAt` en la web. Antes iba `order.createdAt` siempre, y en una
   * venta del local eso es la fecha del PRESUPUESTO: Meta rechaza cualquier
   * evento con más de 7 días, así que toda venta cerrada sobre un presupuesto
   * de la semana anterior se perdía en silencio (auditoría del 25/9/2026).
   *
   * `event_id = order.id` SIEMPRE, también en physical_store: es lo que permite
   * reintentar sin que Meta cuente la misma venta dos veces, y deduplicar con el
   * Purchase que dispara el navegador en la web.
   */
  public static buildPurchaseEvent(
    order: PurchaseOrderData,
    actionSource: ActionSource,
    opts: { eventTime: Date; eventSourceUrl?: string; matchData?: MatchData },
  ): Record<string, unknown> {
    const userData: any = {};
    if (order.client.email) userData.em = [this.hashData(order.client.email)];
    if (order.client.phone) {
      const telefono = this.normalizePhone(order.client.phone);
      if (telefono) userData.ph = [this.hashData(telefono)];
    }
    // fn/ln hasheados: más señales de matching = mejor atribución. Si el
    // caller solo tiene el nombre completo (fichas del CRM), se parte acá:
    // primera palabra = nombre, el resto = apellido. Un split imperfecto
    // solo baja un poco el matcheo; nunca expone nada (viaja hasheado).
    const nombre =
      order.client.firstName || (order.client.name || '').trim().split(/\s+/)[0] || '';
    const apellido =
      order.client.lastName ||
      (order.client.name || '').trim().split(/\s+/).slice(1).join(' ') ||
      '';
    if (nombre) userData.fn = [this.hashData(this.normalizeName(nombre))];
    if (apellido) userData.ln = [this.hashData(this.normalizeName(apellido))];
    const match = opts.matchData;
    if (match?.fbc) userData.fbc = match.fbc;
    if (match?.fbp) userData.fbp = match.fbp;
    if (match?.clientIp) userData.client_ip_address = match.clientIp;
    if (match?.userAgent) userData.client_user_agent = match.userAgent;

    const event: Record<string, unknown> = {
      event_name: 'Purchase',
      event_time: Math.floor(opts.eventTime.getTime() / 1000),
      // event_id permite a Meta descartar el duplicado (Pixel del navegador o
      // un reintento nuestro): compara event_name + event_id.
      event_id: order.id,
      action_source: actionSource,
      user_data: userData,
      custom_data: {
        currency: 'ARS',
        value: order.total,
        order_id: order.id,
        // Qué se compró, con los ids del catálogo: es lo que deja a la campaña
        // de catálogo optimizar por producto (sin esto solo ve "hubo una compra").
        ...(order.contentIds?.length
          ? { content_ids: order.contentIds, content_type: 'product', num_items: order.contentIds.length }
          : {}),
      },
    };
    if (opts.eventSourceUrl) event.event_source_url = opts.eventSourceUrl;
    return event;
  }

  /**
   * POST de UN evento al Conversions API. Devuelve el resultado clasificado en
   * vez de tragárselo: la outbox de compras necesita saber si reintentar.
   * Nunca lanza. Nunca loguea el token.
   */
  public static async postEvent(event: Record<string, unknown>): Promise<ResultadoEnvio> {
    const metaToken = process.env.META_ACCESS_TOKEN;
    const pixelId = process.env.META_PIXEL_ID;
    if (!metaToken || !pixelId) {
      return { ok: false, tipo: 'sin_credenciales', error: 'META_ACCESS_TOKEN o META_PIXEL_ID sin configurar' };
    }

    // v24.0: la Marketing API rechaza versiones viejas desde jun-2026 (#2635).
    const apiUrl = `https://graph.facebook.com/v24.0/${pixelId}/events`;
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [event], access_token: metaToken }),
        signal: AbortSignal.timeout(15_000),
      });
      const data: any = await response.json().catch(() => ({}));
      if (data?.error) return { ok: false, ...clasificarErrorMeta(data.error) };
      if (!response.ok) return { ok: false, tipo: 'transitorio', error: `HTTP ${response.status} sin detalle` };
      return { ok: true, eventsReceived: Number(data?.events_received ?? 0) };
    } catch (error) {
      return { ok: false, tipo: 'transitorio', error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Envío fire-and-forget para el EMBUDO (ViewContent, AddToCart, …): un evento
   * de embudo perdido no vale un reintento. Las COMPRAS no pasan por acá.
   */
  private static postToMeta(event: Record<string, unknown>, label: string) {
    void this.postEvent(event).then((r) => {
      if (r.ok) console.log(`[AdsService] ${label} enviada a Meta. Eventos procesados: ${r.eventsReceived}`);
      else if (r.tipo !== 'sin_credenciales') console.error(`[AdsService] ${label} no llegó a Meta (${r.tipo}): ${r.error}`);
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
