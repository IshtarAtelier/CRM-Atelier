'use client';

// ────────────────────────────────────────────────────────────────────────────
// Un short de YouTube insertado en una nota del blog. Formato VERTICAL
// (9:16) a propósito: son Shorts, no videos de escritorio, y forzarlos a un
// marco 16:9 los deja con franjas negras a los costados.
//
// Carga diferida: se muestra la miniatura real de YouTube (sin JS de Google)
// y el iframe recién se monta cuando alguien hace clic. Insertar 2-3 iframes
// de YouTube de una sola vez en una nota es plomo extra en cada visita,
// aunque nadie mire ninguno.
// ────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Play } from 'lucide-react';

export function YouTubeEmbed({ videoId, titulo }: { videoId: string; titulo: string }) {
  const [reproduciendo, setReproduciendo] = useState(false);

  return (
    <figure className="mx-auto my-10 w-full max-w-[280px]">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-black/10 bg-black shadow-lg">
        {reproduciendo ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={titulo}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            onClick={() => setReproduciendo(true)}
            aria-label={`Reproducir: ${titulo}`}
            className="group absolute inset-0 h-full w-full"
          >
            {/* hq2 existe siempre para un Short; maxresdefault no siempre. */}
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hq2.jpg`}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-md transition-transform group-hover:scale-110">
                <Play className="h-6 w-6 fill-black text-black" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-center text-[13px] text-stone-500">{titulo}</figcaption>
    </figure>
  );
}
