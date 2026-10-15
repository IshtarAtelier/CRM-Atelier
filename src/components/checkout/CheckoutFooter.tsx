import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { LEYENDA_ENVIO_Y_RETIRO } from "@/lib/constants/envio";

/**
 * Pie COMPACTO para /checkout.
 *
 * El pie de la tienda mide 1.202 px en un iPhone 13 (blog, guías, obras
 * sociales, redes…): en el checkout quedaba debajo del botón de pagar y
 * sumaba un tercio de la página (auditoría 15/10/2026, plan 3.2). Quien está
 * pagando no necesita el blog; necesita lo legal, el envío y un humano.
 * Los links legales son los mismos del pie grande (Fase 4 los completa).
 */
export function CheckoutFooter() {
  return (
    <footer className="border-t border-stone-200 bg-[#fafafa] text-stone-600">
      <div className="max-w-[1200px] mx-auto px-5 py-8 flex flex-col gap-4 text-[11px]">
        <p className="flex items-center gap-2 font-semibold text-stone-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          Pago seguro · {LEYENDA_ENVIO_Y_RETIRO}
        </p>
        <p>
          ¿Dudas antes de pagar?{" "}
          <a
            href={`https://wa.me/${WHATSAPP_PHONE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-stone-900 underline underline-offset-2"
          >
            Escribinos por WhatsApp
          </a>{" "}
          o visitanos en el local.
        </p>
        <nav aria-label="Legales" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/terminos-y-condiciones" className="hover:text-stone-900">Términos y condiciones</Link>
          <Link href="/politicas-de-cambio" className="hover:text-stone-900">Cambios y devoluciones</Link>
          <Link href="/politicas-de-privacidad" className="hover:text-stone-900">Privacidad</Link>
          <Link href="/nuestro-local" className="hover:text-stone-900">Nuestro local</Link>
        </nav>
        <p className="text-stone-400">© {new Date().getFullYear()} Atelier Óptica · Córdoba, Argentina</p>
      </div>
    </footer>
  );
}
