"use client";

/**
 * Franja de confianza para el punto de decisión (debajo del botón de compra):
 * "5,0 ★ · 698 reseñas en Google · Garantía de adaptación 30 días".
 *
 * REGLA: nada tipeado a mano. La nota y la cantidad de reseñas salen de
 * /api/reviews (Google Places, los mismos datos que ya usa <GoogleReviews/>);
 * si Google no responde o devuelve cero, esa parte directamente no se muestra
 * — nunca un número inventado. El texto de la garantía es el BADGE canónico de
 * src/lib/garantia.ts, con el detalle (alcance y letra chica) a un clic.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, ShieldCheck } from "lucide-react";
import { GARANTIA_ADAPTACION } from "@/lib/garantia";

export function TrustStrip({ onGarantiaClick }: { onGarantiaClick?: () => void }) {
  const [rating, setRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    fetch("/api/reviews")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        // Solo números reales de Google. El fallback del endpoint (sin API key
        // o sin respuesta) trae rating 0 → esta parte no se renderiza.
        if (data && data.rating > 0 && data.userRatingCount > 0) {
          setRating(data.rating);
          setReviewCount(data.userRatingCount);
        }
      })
      .catch(() => {});
  }, []);

  const conResenas = rating > 0 && reviewCount > 0;

  const garantiaContenido = (
    <>
      <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
      {GARANTIA_ADAPTACION.BADGE}
    </>
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-[11px] font-bold text-stone-700 mb-4 -mt-1">
      {conResenas && (
        <>
          <Link
            href="/resenas"
            className="inline-flex items-center gap-1.5 hover:text-black transition-colors underline decoration-stone-300 underline-offset-2"
          >
            <span className="flex items-center gap-0.5 text-stone-900">
              {rating.toFixed(1).replace(".", ",")}
              <Star aria-hidden="true" className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            </span>
            <span>{reviewCount.toLocaleString("es-AR")} reseñas en Google</span>
          </Link>
          <span aria-hidden="true" className="text-stone-400">·</span>
        </>
      )}
      {onGarantiaClick ? (
        <button
          type="button"
          onClick={onGarantiaClick}
          className="inline-flex items-center gap-1.5 hover:text-black transition-colors underline decoration-stone-300 underline-offset-2"
        >
          {garantiaContenido}
        </button>
      ) : (
        <Link
          href="/politicas-de-cambio"
          className="inline-flex items-center gap-1.5 hover:text-black transition-colors underline decoration-stone-300 underline-offset-2"
        >
          {garantiaContenido}
        </Link>
      )}
    </div>
  );
}
