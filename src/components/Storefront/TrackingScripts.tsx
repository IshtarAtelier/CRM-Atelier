"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useConsent } from "@/components/Storefront/CookieConsent";

interface TrackingScriptsProps {
  /** Medición de GA4 (G-XXXXXXXXXX). Lo resuelve el layout en el servidor. */
  gaId?: string;
  /**
   * Segunda propiedad de GA4, si el negocio mide en dos.
   *
   * Existe por un caso real: `NEXT_PUBLIC_GOOGLE_ADS_TAG_ID` tenía cargado un id
   * de GA4 (G-…) en lugar de uno de Google Ads (AW-…), así que esa propiedad se
   * configuraba "de prestado" por el slot de Ads. Al corregir el id de Ads esa
   * medición se habría cortado en silencio —y de ahí sale la conversión de compra
   * que Google Ads importa desde GA4—. Este slot la mantiene viva.
   */
  gaSecondaryId?: string;
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
  /**
   * Etiqueta de la acción "WhatsApp" de Google Ads. En una óptica el contacto
   * se cierra por WhatsApp, no en el checkout: sin esta conversión, las campañas
   * de búsqueda optimizan a ciegas sobre el canal que más factura.
   */
  adsWhatsAppLabel?: string;
  /** Etiqueta de la acción "Llamada" de Google Ads. */
  adsCallLabel?: string;
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
export function TrackingScripts({
  gaId,
  gaSecondaryId,
  adsId,
  adsPurchaseLabel,
  adsWhatsAppLabel,
  adsCallLabel,
  pixelId,
}: TrackingScriptsProps) {
  const GA_MEASUREMENT_ID = gaId || process.env.NEXT_PUBLIC_GA_ID;
  const GA_SECONDARY_ID = gaSecondaryId || process.env.NEXT_PUBLIC_GA_ID_SECONDARY;
  const GOOGLE_ADS_ID = adsId || process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID;
  const GOOGLE_ADS_PURCHASE_LABEL =
    adsPurchaseLabel || process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;
  const META_PIXEL_ID = pixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const consent = useConsent();

  // Consent Mode v2 (Google): el tag SIEMPRE carga, pero arranca con todo
  // DENEGADO. Sin consentimiento no escribe ninguna cookie ni identificador —
  // manda pings sin cookies que Google usa solo para modelar agregados. Cuando
  // el visitante acepta, se emite un `consent update` y recién ahí hay cookies.
  //
  // Por qué cambió: antes este componente devolvía null sin consentimiento, así
  // que quien ignoraba el banner (la mayoría) no se medía de ninguna forma. No
  // era más privado, era ciego: la persona igual navegaba, pero el negocio no
  // podía saber siquiera cuánta gente había. Denegado-por-defecto es el
  // comportamiento que Google espera y el que corresponde.
  //
  // El Pixel de Meta NO tiene equivalente cookieless, así que ese sigue atado a
  // "granted"; su respaldo sin consentimiento es el Conversions API del server,
  // que a su vez exige la cookie propia `ate_consent` (ver api/web/track).
  //
  // Los Script van con strategy="afterInteractive", NO "lazyOnload": lazyOnload
  // espera el evento `load` de la ventana, que en esta pantalla ya pasó cuando
  // el visitante toca "Aceptar" — el evento no vuelve a dispararse y los scripts
  // no se inyectaban nunca. Resultado: la visita entera en la que aceptaba se
  // perdía (recién medía si recargaba la página).
  const otorgado = consent === "granted";

  // Un solo gtag.js alcanza para GA4 y Google Ads: se carga una vez con
  // cualquiera de los dos IDs y después se hace un gtag('config', …) por destino.
  const primaryGtagId = GA_MEASUREMENT_ID || GA_SECONDARY_ID || GOOGLE_ADS_ID;
  // El destino de la conversión de compra queda colgado de window para que
  // trackPurchase() lo use sin volver a leer env del lado del cliente (mismo
  // motivo que los IDs: se resuelven en el servidor). Solo se publica si hay
  // etiqueta AW- Y label: un `send_to` a medias no registra nada en Google Ads.
  // Un destino por acción de conversión. Se publica solo lo que tenga etiqueta:
  // un `send_to` a medias (sin la parte después de la barra) no registra nada.
  const isAdsAccount = Boolean(GOOGLE_ADS_ID && GOOGLE_ADS_ID.startsWith("AW-"));
  const sendTo = (label?: string) =>
    isAdsAccount && label ? `${GOOGLE_ADS_ID}/${label}` : null;
  const conversions: Record<string, string> = {};
  const purchaseSendTo = sendTo(GOOGLE_ADS_PURCHASE_LABEL);
  const whatsappSendTo = sendTo(adsWhatsAppLabel || process.env.NEXT_PUBLIC_GOOGLE_ADS_WHATSAPP_LABEL);
  const callSendTo = sendTo(adsCallLabel || process.env.NEXT_PUBLIC_GOOGLE_ADS_CALL_LABEL);
  if (purchaseSendTo) conversions.purchase = purchaseSendTo;
  if (whatsappSendTo) conversions.whatsapp = whatsappSendTo;
  if (callSendTo) conversions.call = callSendTo;

  // El estado por defecto va ANTES de cualquier `config`: dataLayer es una cola
  // y gtag.js la procesa en orden, así que si el config saliera primero se
  // mandaría un evento con consentimiento sin declarar.
  const gtagInit = [
    "window.dataLayer = window.dataLayer || [];",
    "function gtag(){window.dataLayer.push(arguments);}",
    `gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
      wait_for_update: 500
    });`,
    "gtag('js', new Date());",
    GA_MEASUREMENT_ID ? `gtag('config', '${GA_MEASUREMENT_ID}');` : null,
    GA_SECONDARY_ID ? `gtag('config', '${GA_SECONDARY_ID}');` : null,
    GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : null,
    Object.keys(conversions).length
      ? `window.__ateAdsConversions = ${JSON.stringify(conversions)};`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Se emite solo cuando el visitante aceptó. Va en su propio <Script> con una
  // key distinta para que Next lo monte al cambiar el consentimiento, sin
  // recargar la página (el hook useConsent re-renderiza este componente).
  const gtagUpdate = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });`;

  // PageView del Pixel en cada navegación del App Router.
  //
  // Por qué: el snippet de abajo corre UNA sola vez (Next no re-ejecuta un
  // <Script> inline con el mismo id, y este componente vive en el layout raíz,
  // así que nunca se desmonta). Como la tienda es una SPA, ir de la home a una
  // ficha de producto no disparaba nada: Meta veía una sola URL por visita y los
  // públicos de remarketing por URL salían mucho más chicos de lo real —
  // remarketing más chico = campañas más caras.
  //
  // Solo mira el pathname, no los query params: usar useSearchParams acá
  // obligaría a envolver el layout entero en <Suspense> y a renderizar en
  // cliente todas las páginas. Filtros y utm_* no definen públicos por URL.
  const pathname = usePathname();
  const pixelActivo = otorgado && Boolean(META_PIXEL_ID);
  // Última ruta ya contada. En null significa "el Pixel todavía no arrancó":
  // la primera corrida con el Pixel activo NO dispara nada, porque de esa vista
  // ya se encarga el `fbq('track','PageView')` del snippet — así no se duplica
  // ni la carga inicial ni la vista en la que el visitante toca "Aceptar".
  const ultimaRutaMedida = useRef<string | null>(null);

  useEffect(() => {
    if (!pixelActivo) return;
    if (ultimaRutaMedida.current === null) {
      ultimaRutaMedida.current = pathname;
      return;
    }
    if (ultimaRutaMedida.current === pathname) return;
    ultimaRutaMedida.current = pathname;
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq !== "function") return;
    fbq("track", "PageView");
  }, [pathname, pixelActivo]);

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
          {/* Se monta recién cuando hay consentimiento y libera las cookies. */}
          {otorgado && (
            <Script id="google-consent-update" strategy="afterInteractive">
              {gtagUpdate}
            </Script>
          )}
        </>
      )}

      {/* Meta Pixel: sin modo cookieless, va solo con consentimiento. */}
      {otorgado && META_PIXEL_ID && (
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
            /* Solo la vista en la que se monta el Pixel. Las navegaciones
               siguientes las manda el useEffect de arriba. */
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
