import { BUSINESS_INFO } from "@/lib/business-info";

/**
 * Pie de las landings de campaña.
 *
 * Las landings tienen un solo objetivo —que el visitante escriba— así que no
 * llevan navbar ni links al catálogo. Pero "sin links" a secas no es la
 * respuesta: Google Ads y Meta piden transparencia del negocio en el destino
 * (quién sos, dónde estás, cómo se tratan los datos) y la falta de política de
 * privacidad es motivo de desaprobación, sobre todo con remarketing activo.
 *
 * Este pie es el equilibrio: los datos que dan confianza y cumplen la política
 * de las plataformas, en tamaño chico y al final, donde no compiten con el CTA.
 * Lo único que NO va acá es navegación a la tienda, que es lo que desviaba.
 *
 * El teléfono va como `tel:` a propósito: no es una fuga, es otro canal de
 * contacto — el mismo objetivo de la landing.
 */
export function LandingFooter({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const isDark = theme === "dark";
  const wrap = isDark
    ? "bg-[#0F0F0F] border-white/10"
    : "bg-[#FCFCFC] border-gray-200";
  const strong = isDark ? "text-stone-300" : "text-gray-700";
  const muted = isDark ? "text-stone-500" : "text-gray-400";
  const linkCls = isDark
    ? "text-stone-400 hover:text-white underline underline-offset-4 decoration-white/20"
    : "text-gray-500 hover:text-black underline underline-offset-4 decoration-gray-300";

  return (
    <footer className={`w-full border-t py-12 px-6 text-center ${wrap}`}>
      <div className="max-w-3xl mx-auto space-y-4">
        <p className={`text-sm ${strong}`}>
          {BUSINESS_INFO.address}
        </p>
        <p className={`text-sm ${strong}`}>
          <a href={`tel:${BUSINESS_INFO.phoneE164}`} className={linkCls}>
            {BUSINESS_INFO.phone}
          </a>
        </p>
        <p className={`text-[13px] ${muted}`}>{BUSINESS_INFO.hours}</p>

        <div className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 text-[12px]`}>
          <a href="/politicas-de-privacidad" className={linkCls}>
            Política de privacidad
          </a>
          <a href="/terminos-y-condiciones" className={linkCls}>
            Términos y condiciones
          </a>
        </div>

        <p className={`text-[11px] pt-2 ${muted}`}>
          © {new Date().getFullYear()} {BUSINESS_INFO.name}
        </p>
      </div>
    </footer>
  );
}
