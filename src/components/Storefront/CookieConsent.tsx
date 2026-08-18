'use client';

import { useEffect, useState } from 'react';
import { track } from '@/lib/client-analytics';

const CONSENT_KEY = 'ate_consent';
const EVENT = 'ate-consent-change';

export type ConsentValue = 'granted' | 'denied';

function readStored(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Opt-out: sin decisión explícita se mide igual (devuelve 'granted'). Antes
 * era opt-in y el cartel bloqueaba la medición hasta un clic que casi nadie
 * daba — los públicos de remarketing de la tienda quedaban vacíos aunque el
 * píxel estuviera sano. Ver PARTE 0 de docs/buenas-practicas-meta-google.md.
 */
export function getConsent(): ConsentValue {
  return readStored() === 'denied' ? 'denied' : 'granted';
}

function writeCookie(v: ConsentValue) {
  try {
    // Única forma de que el servidor sepa si puede medir (ver api/web/track).
    document.cookie = `${CONSENT_KEY}=${v}; max-age=15552000; path=/; SameSite=Lax`;
  } catch {
    /* noop */
  }
}

function decidir(v: ConsentValue) {
  try {
    localStorage.setItem(CONSENT_KEY, v);
    writeCookie(v);
    window.dispatchEvent(new Event(EVENT));
    // Cruzado con `consent_shown` da cuántos tocan "Rechazar" de verdad.
    track('consent_decision', { meta: { decision: v } });
  } catch {
    /* noop */
  }
}

/** Hook para componentes que deben reaccionar al consentimiento (ver TrackingScripts). */
export function useConsent(): ConsentValue {
  const [consent, setConsentState] = useState<ConsentValue>('granted');
  useEffect(() => {
    setConsentState(getConsent());
    const handler = () => setConsentState(getConsent());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return consent;
}

/** Si el cartel sigue en pantalla (nadie lo cerró todavía). Ver FloatingWhatsApp. */
export function useCookieBannerVisible(): boolean {
  const [visible, setVisible] = useState(false); // false hasta montar: evita flash SSR
  useEffect(() => {
    const actualizar = () => setVisible(readStored() === null);
    actualizar();
    window.addEventListener(EVENT, actualizar);
    return () => window.removeEventListener(EVENT, actualizar);
  }, []);
  return visible;
}

/**
 * Cartel de cookies, chico y parejo entre sus dos botones. La medición NO
 * espera a que se cierre: ya está midiendo desde que se monta la página
 * (ver el `writeCookie` de acá abajo, corrido en cuanto entra el visitante).
 * "Aceptar" solo cierra el cartel; "Rechazar" es el único que cambia algo.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Sincroniza la cookie del servidor con el valor por defecto (granted)
    // desde el primer render, sin esperar ningún clic.
    writeCookie(getConsent());
    const noDecidioTodavia = readStored() === null;
    setVisible(noDecidioTodavia);
    if (noDecidioTodavia) track('consent_shown');
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Consentimiento de cookies"
      className="fixed bottom-0 inset-x-0 z-[90] p-2 pointer-events-none animate-[tiendaFadeUp_0.35s_ease-out]"
    >
      <div className="pointer-events-auto mx-auto max-w-md rounded-xl bg-stone-900/90 text-white/70 shadow-lg p-2 flex items-center gap-2 text-[11px] leading-snug">
        <p className="flex-1">Usamos cookies para mejorar tu experiencia.</p>
        <button
          onClick={() => { decidir('denied'); setVisible(false); }}
          className="underline hover:text-white/90 transition-colors shrink-0"
        >
          Rechazar
        </button>
        <button
          onClick={() => { decidir('granted'); setVisible(false); }}
          className="underline hover:text-white/90 transition-colors shrink-0"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
