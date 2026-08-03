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
        {/* Marcas de CRISTALES, no de armazones: la lista de armazones de la
            landing vieja (Rusty, Sarkany, Hanoover…) ya no existe en el
            catálogo — verificado contra producción, solo quedan 3 Vulk en
            salón. Las que sí se venden y la gente busca por nombre son estas. */}
        <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${muted}`}>
          Más de 10 años de experiencia · Essilor · Varilux · Kodak · Transitions
        </p>
        <p className={`text-sm ${strong}`}>
          {BUSINESS_INFO.address}
        </p>
        <p className={`text-sm ${strong}`}>
          <a href={`tel:${BUSINESS_INFO.phoneE164}`} className={linkCls}>
            {BUSINESS_INFO.phone}
          </a>
          <span className={`mx-2 ${muted}`}>·</span>
          {/* mailto no es fuga: es otro canal de contacto, mismo objetivo. Es
              la casilla que el negocio ya publica en promo.atelieroptica.com.ar. */}
          <a href="mailto:ventas@atelieroptica.com.ar" className={linkCls}>
            ventas@atelieroptica.com.ar
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
