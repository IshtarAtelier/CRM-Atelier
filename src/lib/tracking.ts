/**
 * E-commerce Conversion Tracking Utility
 * Espeja cada evento a TRES destinos:
 *   1. Meta Pixel (fbq)          — client-side
 *   2. Google Analytics (gtag)   — client-side (si NEXT_PUBLIC_GA_ID está seteado)
 *   3. Analítica propia (/api/track) — fuente de verdad interna del embudo
 *
 * `purchase` se registra en la analítica propia del lado SERVIDOR (checkout),
 * no acá, para no duplicar la conversión; acá solo se dispara a Meta/GA.
 */
import { track } from '@/lib/client-analytics';

export function trackViewContent(item: {
  id: string | number;
  name: string;
  price: number;
}) {
  if (typeof window === 'undefined') return;
  // Analítica propia
  track('view_content', {
    productId: String(item.id),
    productName: item.name,
    value: item.price,
  });
  // Meta Pixel
  if ((window as any).fbq) {
    (window as any).fbq('track', 'ViewContent', {
      content_name: item.name,
      content_ids: [String(item.id)],
      content_type: 'product',
      value: item.price,
      currency: 'ARS',
    });
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
    // Analítica propia
    track('add_to_cart', {
      productId: String(item.id),
      productName: item.name,
      value: item.price,
      quantity: item.quantity,
    });
    // Meta Pixel Event
    if ((window as any).fbq) {
      (window as any).fbq("track", "AddToCart", {
        content_name: item.name,
        content_ids: [String(item.id)],
        content_type: "product",
        value: item.price,
        currency: "ARS",
      });
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
    // Analítica propia
    track('begin_checkout', {
      value: totalValue,
      quantity: cartItems.length,
    });
    // Meta Pixel Event
    if ((window as any).fbq) {
      (window as any).fbq("track", "InitiateCheckout", {
        value: totalValue,
        currency: "ARS",
        num_items: cartItems.length,
      });
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
  }
}
