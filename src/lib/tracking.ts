/**
 * E-commerce Conversion Tracking Utility
 * Mapped to Meta Pixel (fbq) and Google Analytics (gtag)
 */

export function trackAddToCart(item: { id: string | number; name: string; price: number; quantity: number }) {
  if (typeof window !== "undefined") {
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
    // Meta Pixel Event
    if ((window as any).fbq) {
      (window as any).fbq("track", "Purchase", {
        value: totalValue,
        currency: "ARS",
        transaction_id: orderId,
      });
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
