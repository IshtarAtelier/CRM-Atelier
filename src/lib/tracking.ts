declare global {
  interface Window {
    fbq?: any;
    gtag?: any;
  }
}

export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return;

  // Meta Pixel
  if (window.fbq) {
    try {
      window.fbq('track', eventName, params);
      console.log(`[Tracking] Meta Pixel Event: ${eventName}`, params);
    } catch (err) {
      console.error(`[Tracking] Error tracking Meta event ${eventName}:`, err);
    }
  }

  // Google Analytics / Ads
  if (window.gtag) {
    try {
      window.gtag('event', eventName, params);
      console.log(`[Tracking] Google Analytics Event: ${eventName}`, params);
    } catch (err) {
      console.error(`[Tracking] Error tracking GA event ${eventName}:`, err);
    }
  }
}
