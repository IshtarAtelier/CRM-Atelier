'use client';

import { useEffect, useState } from 'react';

const CONSENT_KEY = 'ate_consent';
const EVENT = 'ate-consent-change';

export type ConsentValue = 'granted' | 'denied';

export function getConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

function setConsent(v: ConsentValue) {
  try {
    localStorage.setItem(CONSENT_KEY, v);
    // Además del localStorage, una cookie propia: es la ÚNICA forma de que el
    // servidor sepa si puede medir. La usa /api/web/track para decidir si
    // espeja el evento al Conversions API de Meta — no alcanza con mirar la
    // cookie _fbp del Pixel, porque justamente cuando un adblocker lo bloquea
    // (que es cuando más hace falta el envío server-side) esa cookie no existe.
    document.cookie = `${CONSENT_KEY}=${v}; max-age=15552000; path=/; SameSite=Lax`;
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* noop */
  }
}

/** Hook para componentes que deben reaccionar al consentimiento (ver TrackingScripts). */
export function useConsent(): ConsentValue | null {
  const [consent, setState] = useState<ConsentValue | null>(null);
  useEffect(() => {
    setState(getConsent());
    const handler = () => setState(getConsent());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return consent;
}

/**
 * Banner de consentimiento. Solo gobierna las cookies de marketing (Meta Pixel / GA).
 * La analítica propia de la tienda no usa cookies ni PII, así que sigue funcionando.
 */
export default function CookieConsent() {
  const [decided, setDecided] = useState(true); // asumir decidido hasta montar (evita flash SSR)

  useEffect(() => {
    setDecided(getConsent() !== null);
  }, []);

  if (decided) return null;

  return (
    <div
      role="region"
      aria-label="Consentimiento de cookies"
      className="fixed bottom-0 inset-x-0 z-[90] p-2 sm:p-5 pointer-events-none animate-[tiendaFadeUp_0.35s_ease-out]"
    >
      {/* Fondo OPACO y a contramano del sitio (la tienda es blanca): el banner
          tiene que leerse como una capa aparte, no como parte de la página.
          Nada de bg-card/border-border acá — esos tokens no existen en el
          @theme de globals.css y Tailwind los resuelve a "sin color", que es
          justo lo que dejaba el cartel transparente sobre el hero.

          En celular va en UNA FILA y con el texto corto: apilado ocupaba ~190px
          y tapaba los dos CTAs del hero (que viven entre 116 y 220px del borde
          inferior en 375x812). Así queda en ~76px, por debajo de los botones.
          El aviso completo se lee en /privacidad; el banner solo tiene que
          alcanzar para decidir. */}
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl bg-stone-900 text-white ring-1 ring-[#c8a55c]/50 shadow-2xl shadow-black/40 p-3 sm:p-6 flex items-center gap-3 sm:gap-6">
        <p className="text-[13px] sm:text-[15px] leading-snug sm:leading-relaxed text-white/90 flex-1">
          <span className="sm:hidden">Usamos cookies de medición.</span>
          <span className="hidden sm:inline">
            Usamos cookies de medición para mejorar tu experiencia y nuestras campañas.
            Podés aceptarlas o rechazarlas. La analítica interna del sitio no usa cookies ni datos personales.
          </span>
        </p>
        <div className="flex gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => { setConsent('denied'); setDecided(true); }}
            className="px-3 py-2 sm:px-5 sm:py-3 rounded-full border border-white/35 text-[12px] sm:text-sm text-white/85 hover:bg-white/10 transition-colors"
          >
            Rechazar
          </button>
          <button
            onClick={() => { setConsent('granted'); setDecided(true); }}
            className="px-4 py-2 sm:px-7 sm:py-3 rounded-full bg-[#c8a55c] text-stone-900 text-[12px] sm:text-sm font-bold uppercase tracking-widest hover:bg-[#d8b76d] transition-colors shadow-lg shadow-[#c8a55c]/25"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
