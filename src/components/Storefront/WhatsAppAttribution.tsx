'use client';

import { useEffect } from 'react';
import { adPlatformSentence } from '@/lib/client-analytics';
import { trackWhatsAppClick } from '@/lib/tracking';
import { WHATSAPP_PHONE } from '@/lib/constants';
import { conMarcaDeLaWeb } from '@/lib/whatsapp-origen-web';

/** El número del link: wa.me/<número> o api.whatsapp.com/send?phone=<número>. */
function numeroDelLink(url: URL): string {
  return (url.searchParams.get('phone') || url.pathname).replace(/\D/g, '');
}

/**
 * Agrega el origen ("Los vi en Google Ads." / "Los vi en Meta.") al mensaje de
 * cualquier link a WhatsApp, en el momento del clic.
 *
 * Por qué en el clic y no al armar el link: el identificador de clic vive en el
 * navegador, así que el HTML del servidor no lo conoce. Si la frase se agregara
 * al renderizar, el href del servidor y el del cliente diferirían y React 19 no
 * parchea atributos durante la hidratación — el href sin frase quedaba pegado en
 * la ficha de producto, que es justo donde aterriza el tráfico pago.
 *
 * Interceptar el clic además cubre TODOS los links del sitio: los que se arman a
 * mano en las notas del blog y los que se renderizan en el servidor, que de otra
 * forma quedaban afuera.
 *
 * No pisa nada si el mensaje ya trae el origen (doble clic, o un link que ya lo
 * incluía), y ante cualquier error deja el link intacto: la medición no puede
 * romper una consulta de venta.
 *
 * 10/10/2026: también asegura la marca "Estoy en la web de Atelier." en los
 * mensajes al número de la tienda que no traían ninguna frase conocida (ver
 * src/lib/whatsapp-origen-web.ts). Nunca en el CRM: ahí los links son para
 * escribirle a un cliente, y el mensaje es del vendedor.
 */
export default function WhatsAppAttribution() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement | null;
        const link = target?.closest?.('a[href*="wa.me"], a[href*="api.whatsapp.com"]') as HTMLAnchorElement | null;
        if (!link) return;

        // La conversión se mide SIEMPRE, venga o no de un anuncio: este listener
        // es el único punto por el que pasan todos los links a WhatsApp del
        // sitio. Va antes del `return` de abajo, que solo corta el agregado de
        // la frase de origen.
        trackWhatsAppClick(window.location.pathname);

        const enElCrm = /^\/(admin|login)(\/|$)/.test(window.location.pathname);
        if (enElCrm) return;

        const url = new URL(link.href);
        const texto = url.searchParams.get('text');
        // Sin texto prellenado no hay dónde poner el origen: el cliente escribe
        // de cero y meterle una frase que no tipeó sería inventarle el mensaje.
        if (!texto) return;

        let nuevo = texto;
        const frase = adPlatformSentence();
        // Ya viene con origen (doble clic, o el link lo traía): no duplicar.
        if (frase && !/^Los vi en (Google Ads|Meta|un anuncio de (Google|Instagram))\./i.test(texto.trim())) {
          nuevo = `${frase} ${texto}`;
        }
        // Sin anuncio adelante, que el mensaje diga que viene de la web.
        if (numeroDelLink(url) === WHATSAPP_PHONE.replace(/\D/g, '')) nuevo = conMarcaDeLaWeb(nuevo);
        if (nuevo === texto) return;

        // Se reescribe a mano en vez de usar searchParams.set: ese serializa los
        // espacios como "+" y el resto del sitio los manda como %20. No mezclamos
        // codificaciones en algo que el cliente va a ver escrito en su WhatsApp.
        const nuevoTexto = encodeURIComponent(nuevo);
        const otros = [...url.searchParams.entries()]
          .filter(([k]) => k !== 'text')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
        link.href = `${url.origin}${url.pathname}?${['text=' + nuevoTexto, ...otros].join('&')}`;
      } catch {
        /* la medición nunca rompe el link */
      }
    };

    // Fase de captura: corre antes de cualquier handler propio del componente,
    // así el href ya está reescrito cuando el navegador abre WhatsApp.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
