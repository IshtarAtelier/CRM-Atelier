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
    <div className="fixed bottom-0 inset-x-0 z-[90] p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg p-4 sm:flex sm:items-center sm:gap-4">
        <p className="text-sm text-foreground/80 flex-1">
          Usamos cookies de medición para mejorar tu experiencia y nuestras campañas.
          Podés aceptarlas o rechazarlas. La analítica interna del sitio no usa cookies ni datos personales.
        </p>
        <div className="mt-3 sm:mt-0 flex gap-2 shrink-0">
          <button
            onClick={() => { setConsent('denied'); setDecided(true); }}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Rechazar
          </button>
          <button
            onClick={() => { setConsent('granted'); setDecided(true); }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
