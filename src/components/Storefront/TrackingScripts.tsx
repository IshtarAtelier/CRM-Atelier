"use client";

import Script from "next/script";
import { useConsent } from "@/components/Storefront/CookieConsent";

interface TrackingScriptsProps {
  /** Medición de GA4 (G-XXXXXXXXXX). Lo resuelve el layout en el servidor. */
  gaId?: string;
  /** Etiqueta de Google Ads (G-/AW-XXXXXXXX) para medir conversiones de las campañas. Idem. */
  adsId?: string;
  /**
   * Etiqueta de la acción de conversión "Compra web" de Google Ads (la parte
   * después de la barra en `AW-123456789/AbC-D_efGh`). Sin esto, Google Ads
   * recibe pageviews pero NINGUNA compra: Shopping y PMax no pueden pujar por
   * conversiones. Se saca de Google Ads → Objetivos → Conversiones → la acción
   * → "Configurar la etiqueta" → "Instalar manualmente".
   */
  adsPurchaseLabel?: string;
  /** Píxel de Meta. Idem. */
  pixelId?: string;
}

/**
 * Los IDs llegan por props desde el layout (servidor) en vez de leerse acá con
 * process.env. Motivo: `NEXT_PUBLIC_*` se incrusta al COMPILAR, y el caché de
 * build de Next no se invalida cuando solo cambia una variable de entorno —
 * el 22/7/2026 se cargó NEXT_PUBLIC_GA_ID en Railway, se redeployó dos veces
 * (una forzada desde el fuente) y el bundle siguió saliendo con el valor viejo
 * porque ningún archivo había cambiado. Leyéndolo en el servidor, alcanza con
 * reiniciar para que tome un valor nuevo.
 */
export function TrackingScripts({ gaId, adsId, adsPurchaseLabel, pixelId }: TrackingScriptsProps) {
  const GA_MEASUREMENT_ID = gaId || process.env.NEXT_PUBLIC_GA_ID;
  const GOOGLE_ADS_ID = adsId || process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID;
  const GOOGLE_ADS_PURCHASE_LABEL =
    adsPurchaseLabel || process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;
  const META_PIXEL_ID = pixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const consent = useConsent();

  // Las cookies de marketing (Pixel/GA/Ads) solo cargan con consentimiento explícito.
  // La analítica propia (sin cookies) va aparte y no depende de esto.
  //
  // Los Script van con strategy="afterInteractive", NO "lazyOnload": lazyOnload
  // espera el evento `load` de la ventana, que en esta pantalla ya pasó cuando
  // el visitante toca "Aceptar" — el evento no vuelve a dispararse y los scripts
  // no se inyectaban nunca. Resultado: la visita entera en la que aceptaba se
  // perdía (recién medía si recargaba la página).
  if (consent !== "granted") return null;

  // Un solo gtag.js alcanza para GA4 y Google Ads: se carga una vez con
  // cualquiera de los dos IDs y después se hace un gtag('config', …) por destino.
  const primaryGtagId = GA_MEASUREMENT_ID || GOOGLE_ADS_ID;
  // El destino de la conversión de compra queda colgado de window para que
  // trackPurchase() lo use sin volver a leer env del lado del cliente (mismo
  // motivo que los IDs: se resuelven en el servidor). Solo se publica si hay
  // etiqueta AW- Y label: un `send_to` a medias no registra nada en Google Ads.
  const purchaseSendTo =
    GOOGLE_ADS_ID && GOOGLE_ADS_ID.startsWith("AW-") && GOOGLE_ADS_PURCHASE_LABEL
      ? `${GOOGLE_ADS_ID}/${GOOGLE_ADS_PURCHASE_LABEL}`
      : null;
  const gtagInit = [
    "window.dataLayer = window.dataLayer || [];",
    "function gtag(){window.dataLayer.push(arguments);}",
    "gtag('js', new Date());",
    GA_MEASUREMENT_ID ? `gtag('config', '${GA_MEASUREMENT_ID}');` : null,
    GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : null,
    purchaseSendTo
      ? `window.__ateAdsConversions = { purchase: '${purchaseSendTo}' };`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      {/* Google tag (gtag.js) — GA4 + Google Ads en una sola carga */}
      {primaryGtagId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${primaryGtagId}`}
            strategy="afterInteractive"
          />
          <Script id="google-gtag" strategy="afterInteractive">
            {gtagInit}
          </Script>
        </>
      )}

      {/* Meta Pixel */}
      {META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
