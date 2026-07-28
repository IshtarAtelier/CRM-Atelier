/**
 * E-commerce Conversion Tracking Utility
 * Espeja cada evento a TRES destinos:
 *   1. Meta Pixel (fbq)              — client-side
 *   2. Google Analytics / Ads (gtag) — client-side
 *   3. Analítica propia (/api/web/track) — fuente de verdad interna del embudo
 *
 * `purchase` se registra en la analítica propia del lado SERVIDOR (checkout),
 * no acá, para no duplicar la conversión; acá solo se dispara a Meta/GA/Ads.
 *
 * Cada evento lleva un `eventId` propio que viaja a los DOS lados: al Pixel como
 * `{ eventID }` y a la analítica propia dentro de `meta`, desde donde el server
 * lo reenvía al Conversions API con el mismo id (ver src/app/api/web/track).
 * Es lo que permite mandar el evento por los dos canales sin que Meta lo cuente
 * dos veces: el server-side resiste adblock/ITP, el del navegador llega antes.
 */
import { track } from '@/lib/client-analytics';

/** Id de deduplicación Pixel ↔ CAPI. Único por evento, no por producto. */
function newEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* seguimos con el fallback */
  }
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function trackViewContent(item: {
  id: string | number;
  name: string;
  price: number;
}) {
  if (typeof window === 'undefined') return;
  const eventId = newEventId();
  // Analítica propia (y desde ahí, espejo server-side a Meta CAPI)
  track('view_content', {
    productId: String(item.id),
    productName: item.name,
    value: item.price,
    meta: { eventId },
  });
  // Meta Pixel
  if ((window as any).fbq) {
    (window as any).fbq('track', 'ViewContent', {
      content_name: item.name,
      content_ids: [String(item.id)],
      content_type: 'product',
      value: item.price,
      currency: 'ARS',
    }, { eventID: eventId });
  }
  // GA4
  if ((window as any).gtag) {
    (window as any).gtag('event', 'view_item', {
      currency: 'ARS',
      value: item.price,
      items: [{ item_id: String(item.id), item_name: item.name, price: item.price }],
    });
  }
}

export function trackAddToCart(item: { id: string | number; name: string; price: number; quantity: number }) {
  if (typeof window !== "undefined") {
    const eventId = newEventId();
    // Analítica propia (y desde ahí, espejo server-side a Meta CAPI)
    track('add_to_cart', {
      productId: String(item.id),
      productName: item.name,
      value: item.price,
      quantity: item.quantity,
      meta: { eventId },
    });
    // Meta Pixel Event
    if ((window as any).fbq) {
      (window as any).fbq("track", "AddToCart", {
        content_name: item.name,
        content_ids: [String(item.id)],
        content_type: "product",
        value: item.price,
        currency: "ARS",
      }, { eventID: eventId });
    }
    // Google Analytics 4 Event
    if ((window as any).gtag) {
      (window as any).gtag("event", "add_to_cart", {
        currency: "ARS",
        value: item.price,
        items: [
          {
            item_id: String(item.id),
            item_name: item.name,
            price: item.price,
            quantity: item.quantity,
          },
        ],
      });
    }
  }
}

export function trackInitiateCheckout(cartItems: any[], totalValue: number) {
  if (typeof window !== "undefined") {
    const eventId = newEventId();
    // Analítica propia (y desde ahí, espejo server-side a Meta CAPI)
    track('begin_checkout', {
      value: totalValue,
      quantity: cartItems.length,
      meta: { eventId },
    });
    // Meta Pixel Event
    if ((window as any).fbq) {
      (window as any).fbq("track", "InitiateCheckout", {
        value: totalValue,
        currency: "ARS",
        num_items: cartItems.length,
      }, { eventID: eventId });
    }
    // Google Analytics 4 Event
    if ((window as any).gtag) {
      (window as any).gtag("event", "begin_checkout", {
        currency: "ARS",
        value: totalValue,
        items: cartItems.map(item => ({
          item_id: String(item.productId || item.id),
          item_name: `${item.brand || ''} ${item.model || ''}`.trim() || item.name,
          price: item.price,
          quantity: item.quantity || 1,
        })),
      });
    }
  }
}

export function trackPurchase(orderId: string, totalValue: number, cartItems: any[]) {
  if (typeof window !== "undefined") {
    // (La analítica propia registra `purchase` server-side en el checkout.)
    // Meta Pixel Event. El 4º arg { eventID } deduplica con el evento server-side
    // del Conversions API (AdsService.sendWebPurchase usa event_id = order.id).
    if ((window as any).fbq) {
      (window as any).fbq("track", "Purchase", {
        value: totalValue,
        currency: "ARS",
        transaction_id: orderId,
      }, { eventID: orderId });
    }
    // Google Analytics 4 Event
    if ((window as any).gtag) {
      (window as any).gtag("event", "purchase", {
        transaction_id: orderId,
        value: totalValue,
        currency: "ARS",
        items: cartItems.map(item => ({
          item_id: String(item.productId || item.id),
          item_name: `${item.brand || ''} ${item.model || ''}`.trim() || item.name,
          price: item.price,
          quantity: item.quantity || 1,
        })),
      });
    }
    // Conversión de Google Ads. Es un evento APARTE del `purchase` de GA4: sin
    // este `send_to` (AW-…/label), la campaña no ve una sola compra y no puede
    // pujar por conversiones. El destino lo publica TrackingScripts cuando están
    // cargadas GOOGLE_ADS_CONVERSION_ID y GOOGLE_ADS_CONVERSION_LABEL.
    const adsPurchase = (window as any).__ateAdsConversions?.purchase;
    if (adsPurchase && (window as any).gtag) {
      (window as any).gtag("event", "conversion", {
        send_to: adsPurchase,
        value: totalValue,
        currency: "ARS",
        transaction_id: orderId,
      });
    }
  }
}
