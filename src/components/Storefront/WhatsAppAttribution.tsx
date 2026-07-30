'use client';

import { useEffect } from 'react';
import { adPlatformSentence } from '@/lib/client-analytics';

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
 */
export default function WhatsAppAttribution() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement | null;
        const link = target?.closest?.('a[href*="wa.me"], a[href*="api.whatsapp.com"]') as HTMLAnchorElement | null;
        if (!link) return;

        const frase = adPlatformSentence();
        if (!frase) return;

        const url = new URL(link.href);
        const texto = url.searchParams.get('text');
        // Sin texto prellenado no hay dónde poner el origen: el cliente escribe
        // de cero y meterle una frase que no tipeó sería inventarle el mensaje.
        if (!texto) return;
        // Ya viene con origen (doble clic, o el link lo traía): no duplicar.
        if (/^Los vi en (Google Ads|Meta)\./i.test(texto.trim())) return;

        // Se reescribe a mano en vez de usar searchParams.set: ese serializa los
        // espacios como "+" y el resto del sitio los manda como %20. No mezclamos
        // codificaciones en algo que el cliente va a ver escrito en su WhatsApp.
        const nuevoTexto = encodeURIComponent(`${frase} ${texto}`);
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
