'use client';

import { useEffect } from 'react';

import { WHATSAPP_PHONE } from '@/lib/constants';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';

// Reintento automático: los cortes de DB suelen durar segundos; si el visitante
// cayó justo en uno, la página se recupera sola sin que tenga que hacer nada.
const AUTO_RETRY_MS = 5000;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error Boundary caught:', error);
    const t = setTimeout(() => reset(), AUTO_RETRY_MS);
    return () => clearTimeout(t);
  }, [error, reset]);

  const waText = encodeURIComponent(
    'Hola Atelier! Estaba mirando la web y me gustaría recibir asesoramiento.'
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-white px-4"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      <div className="max-w-md w-full text-center">
        <p className="text-[20px] font-bold tracking-[0.3em] uppercase text-black mb-8">
          Atelier Óptica
        </p>
        <h2 className="text-[15px] font-bold uppercase tracking-widest text-stone-900 mb-3">
          Estamos actualizando el catálogo
        </h2>
        <p className="text-[13px] text-stone-500 mb-8 leading-relaxed">
          La página vuelve a cargarse sola en unos segundos. Si querés, escribinos
          por WhatsApp y te asesoramos al instante.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href={`https://wa.me/${WHATSAPP_PHONE}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1fb958] text-white text-[11px] font-black uppercase tracking-widest py-4 px-4 rounded-full transition-colors"
          >
            <WhatsAppIcon className="w-4 h-4" />
            Hablar con un asesor
          </a>
          <button
            onClick={() => reset()}
            className="w-full bg-black hover:bg-stone-800 text-white text-[11px] font-black uppercase tracking-widest py-4 px-4 rounded-full transition-colors cursor-pointer"
          >
            Reintentar ahora
          </button>
        </div>
      </div>
    </div>
  );
}
