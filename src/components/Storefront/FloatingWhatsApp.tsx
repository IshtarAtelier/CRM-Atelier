"use client";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useState, useEffect } from "react";
import { buildWhatsAppUrl, currentPageUrl } from "@/lib/whatsapp-link";
import { WHOLESALE_WHATSAPP_PHONE } from "@/lib/constants";
import { BUSINESS_INFO } from "@/lib/business-info";
import { trackPhoneClick } from "@/lib/tracking";
import { usePathname } from "next/navigation";

export function FloatingWhatsApp({ message, productName }: { message?: string; productName?: string } = {}) {
  const [tiempoCumplido, setTiempoCumplido] = useState(false);
  // Arranca en true (oculto) hasta comprobar si esta página declara un hero con
  // su propio CTA: es mejor tardar un tick que pisar el botón principal.
  const [heroTapando, setHeroTapando] = useState(true);
  // Óptica logueada (mayorista): el botón usa el número y el tono de Cápsula
  // Escarlata, no los de Atelier. Señal = localStorage 'user' (la cookie es
  // httpOnly). Ver el patrón en StorefrontNavbar.
  const [isOptica, setIsOptica] = useState(false);
  const [tituloNota, setTituloNota] = useState<string | null>(null);
  const pathname = usePathname();

  // 1,5s, no 5s: WhatsApp es el canal donde se cierra la venta de ticket alto y
  // este es el botón más visible del sitio. A los 5 segundos, buena parte del
  // tráfico pago de celular ya se fue sin haberlo visto nunca.
  useEffect(() => {
    const timer = setTimeout(() => {
      setTiempoCumplido(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Una pantalla que trae su propio CTA a WhatsApp se marca con `data-hero`
  // (hoy: el hero de la home). Mientras ese bloque está a la vista, la burbuja
  // flotante se le montaba ENCIMA en celular — medido en 360x740: el botón de
  // teléfono caía en y600-648 sobre el "Hablar con un Asesor" del hero, que va
  // de y585 a y631. Se usa IntersectionObserver y no el scroll porque no
  // depende de qué elemento sea el que scrollea en cada página.
  useEffect(() => {
    const hero = document.querySelector("[data-hero]");
    if (!hero) {
      setHeroTapando(false); // páginas sin CTA propio: la burbuja es el único camino
      return;
    }
    const io = new IntersectionObserver(
      ([entrada]) => setHeroTapando(entrada.isIntersecting),
      { threshold: 0.25 },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [pathname]);

  const isVisible = tiempoCumplido && !heroTapando;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored && JSON.parse(stored)?.role === "OPTICA") setIsOptica(true);
    } catch { /* noop */ }
  }, []);

  // Título de la nota del blog que se está leyendo.
  //
  // Quien escribe desde un artículo ya declaró su tema —miopía infantil, cómo
  // leer una receta, multifocales— y ese es el dato más útil para arrancar la
  // conversación. Hasta acá el mensaje llegaba genérico ("Los vi en la nueva
  // web") y el asesor tenía que preguntar de cero lo que la persona ya había
  // dicho con su lectura.
  //
  // Se lee el <h1> del DOM en vez de pasar el título por props: las notas son de
  // dos clases —las de la base (/blog/[slug]) y las ~20 escritas a mano, cada
  // una su propio archivo— y ninguna renderiza este componente; lo pone el
  // layout raíz. Tomarlo del <h1> cubre las dos de una y no obliga a tocar cada
  // artículo ni a acordarse de pasarlo en el próximo que se escriba. Verificado:
  // ambas variantes traen exactamente un <h1>, que es el titular del artículo.
  useEffect(() => {
    const esNota =
      pathname?.startsWith("/blog/") &&
      !pathname.startsWith("/blog/categoria/") &&
      !pathname.startsWith("/blog/busquedas/") &&
      pathname !== "/blog/faq";
    if (!esNota) {
      setTituloNota(null);
      return;
    }
    const texto = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
    // Los titulares SEO son largos ("… en Córdoba: Todo lo que necesitás
    // saber"); recortado, el mensaje sigue entrando de un vistazo en WhatsApp.
    setTituloNota(texto ? (texto.length > 80 ? `${texto.slice(0, 79).trimEnd()}…` : texto) : null);
  }, [pathname]);

  // El catálogo (/capsulaescarlata) ya trae su propia barra de CTA con WhatsApp
  // fija abajo (mismo ancho de pantalla): la burbuja flotante quedaba superpuesta.
  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/mayorista") ||
    pathname?.startsWith("/capsulaescarlata")
  ) {
    return null;
  }

  let defaultText = "Los vi en la nueva web de Atelier, quisiera que me asesoren.";

  if (isOptica) {
    // Óptica en la tienda mayorista: tono y marca Cápsula Escarlata.
    defaultText = productName
      ? `Hola! Consulta mayorista sobre el modelo ${productName} (Cápsula Escarlata).`
      : "Hola! Consulta sobre el canal mayorista de Cápsula Escarlata.";
  } else if (productName) {
    defaultText = `¡Hola! Tengo dudas sobre el modelo ${productName} y me gustaría recibir asesoramiento.`;
  } else if (message) {
    defaultText = message;
  } else if (tituloNota) {
    defaultText = `¡Hola Atelier! Estaba leyendo "${tituloNota}" y me gustaría recibir asesoramiento.`;
  } else if (pathname?.includes("/tienda") || pathname?.includes("/producto/")) {
    defaultText = "¡Hola Atelier! Estoy recorriendo la tienda online y me gustaría recibir asesoramiento.";
  } else if (pathname?.includes("/arma-tus-lentes")) {
    defaultText = "¡Hola Atelier! Me gustaría recibir asesoramiento para armar mis lentes.";
  }

  // En ficha de producto, tienda y notas del blog mandamos también el link de la
  // página: WhatsApp arma la previsualización, así el asesor ve qué está mirando
  // y puede abrir la nota para responder sobre lo mismo que la persona leyó.
  const sharesPageUrl = Boolean(
    productName || pathname?.includes("/producto/") || pathname?.includes("/tienda") || tituloNota
  );

  const WHATSAPP_URL = buildWhatsAppUrl(defaultText, {
    pageUrl: sharesPageUrl ? currentPageUrl(pathname || "") : undefined,
    ...(isOptica ? { phone: WHOLESALE_WHATSAPP_PHONE } : {}),
  });

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      
      {/* Tooltip de Invitación tipo Chat Bubble.
          La animación va por CSS (`.wa-tooltip-in`, ya definida en globals.css con
          el mismo delay y duración, y anulada bajo prefers-reduced-motion). Era un
          motion.div, y este componente vive en el layout raíz: por una sola
          animación de entrada, framer-motion entraba al bundle inicial de TODAS
          las páginas del sitio. */}
      <div className="relative bg-white px-5 py-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-stone-100 hidden sm:block pointer-events-auto mr-2 wa-tooltip-in">
        <p className="text-[13px] font-bold text-stone-800 tracking-tight mb-0.5">
          ¿Necesitás ayuda? 👋
        </p>
        <p className="text-[11px] font-medium text-stone-500">
          Chateá con nuestros asesores.
        </p>
        {/* El piquito del globo (Tail) */}
        <div className="absolute -bottom-2 right-4 w-4 h-4 bg-white border-b border-r border-stone-100 transform rotate-45 rounded-sm"></div>
      </div>

      {/* Llamar. Segunda vía de contacto real para una óptica con local: en
          celular abre el discador directo. La medición va por trackPhoneClick
          porque un `tel:` no pasa por el interceptor de links a wa.me. */}
      {!isOptica && (
        <a
          href={`tel:${BUSINESS_INFO.phoneE164}`}
          onClick={() => trackPhoneClick(BUSINESS_INFO.phoneE164)}
          className="relative group pointer-events-auto"
          aria-label={`Llamar al ${BUSINESS_INFO.phone}`}
        >
          <div className="relative bg-white text-stone-800 border border-stone-200 w-12 h-12 rounded-full flex items-center justify-center shadow-xl hover:scale-110 hover:border-stone-300 transition-all duration-300">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
        </a>
      )}

      {/* Botón Flotante con animación de pulso */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="relative group pointer-events-auto flex items-center gap-2"
        aria-label="Contactar por WhatsApp"
      >
        {/* En celular el globo de arriba está oculto (hidden sm:block), así que
            el botón era un círculo verde sin decir para qué sirve. Esta etiqueta
            nombra lo que la gente viene a pedir. */}
        <span className="sm:hidden rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-stone-800 shadow-lg border border-stone-100">
          Presupuesto
        </span>

        {/* El pulso va relativo al botón, no al <a>: con la etiqueta al lado, un
            `inset-0` sobre el ancla estiraba el anillo verde detrás del texto. */}
        <span className="relative block">
          {/* Anillo exterior que hace pulso */}
          <span className="absolute inset-0 bg-green-500 rounded-full opacity-30 animate-pulse group-hover:animate-none" />

          {/* Botón principal (con logo oficial SVG de WhatsApp) */}
          <span className="relative bg-gradient-to-tr from-green-600 to-green-500 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 hover:shadow-green-500/30 transition-all duration-300">
            <WhatsAppIcon className="w-7 h-7" />
          </span>
        </span>
      </a>
      
    </div>
  );
}
