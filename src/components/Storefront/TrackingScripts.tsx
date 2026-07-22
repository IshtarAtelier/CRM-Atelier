"use client";

import Script from "next/script";
import { useConsent } from "@/components/Storefront/CookieConsent";

interface TrackingScriptsProps {
  /** Medición de GA4 (G-XXXXXXXXXX). Lo resuelve el layout en el servidor. */
  gaId?: string;
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
export function TrackingScripts({ gaId, pixelId }: TrackingScriptsProps) {
  const GA_MEASUREMENT_ID = gaId || process.env.NEXT_PUBLIC_GA_ID;
  const META_PIXEL_ID = pixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const consent = useConsent();

  // Las cookies de marketing (Pixel/GA) solo cargan con consentimiento explícito.
  // La analítica propia (sin cookies) va aparte y no depende de esto.
  if (consent !== "granted") return null;

  return (
    <>
      {/* Google Analytics 4 */}
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="lazyOnload"
          />
          <Script id="google-analytics" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', '${GA_MEASUREMENT_ID}');
            `}
          </Script>
        </>
      )}

      {/* Meta Pixel */}
      {META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="lazyOnload">
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
