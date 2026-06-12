import Link from "next/link";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Varilux Multifocales | Atelier Óptica",
  description: "Visión nítida a todas las distancias. Diseñada para tu vida real. Descubrí las líneas Varilux XR Pro, Design, Physio, Comfort y Liberty.",
  keywords: "Varilux, Multifocales, Cristales, Lentes, Presbicia, Óptica, Atelier, Córdoba",
};

const CARDS = [
  {
    category: "TOPE DE GAMA",
    title: "Varilux XR Pro",
    description: "La línea de mayor performance de Varilux, para el usuario más exigente.",
    features: [
      "Para quienes buscan performance premium y confort en movimiento.",
      "Ideal si tenés días activos y muchas transiciones de mirada.",
      "Recomendación personalizada según tu uso."
    ],
    bg: "bg-white",
    extraButton: true
  },
  {
    category: "DISEÑO AVANZADO",
    title: "Varilux XR Design",
    description: "Diseñada para visión clara y confort en todas las distancias.",
    features: [
      "Muy buena opción si vivís entre pantallas y actividades múltiples.",
      "Equilibrio entre visión cercana e intermedia.",
      "Perfil de uso dinámico."
    ],
    bg: "bg-white"
  },
  {
    category: "PERFORMANCE",
    title: "Varilux Physio 3.0",
    description: "Pensada para vida intensa y transición suave.",
    features: [
      "Buena estabilidad para uso diario con actividad.",
      "Transición de lejos a cerca continua (según descripción del producto).",
      "Recomendable para usuarios activos."
    ],
    bg: "bg-white"
  },
  {
    category: "CONFORT",
    title: "Varilux Comfort 3.0",
    description: "Orientada a comodidad y adaptación simple.",
    features: [
      "Buena alternativa para quienes priorizan confort.",
      "Acceso simple a zonas de visión (según descripción del producto).",
      "Recomendación por hábitos y postura."
    ],
    bg: "bg-[#f8fafc]"
  },
  {
    category: "ENTRADA INTELIGENTE",
    title: "Varilux Liberty 3.0",
    description: "Solución equilibrada para el día a día.",
    features: [
      "Opción costo/beneficio para uso cotidiano.",
      "Transición suave entre zonas (según descripción del producto).",
      "Ideal como primer multifocal \"bien armado\"."
    ],
    bg: "bg-[#f8fafc]"
  },
  {
    category: "ASESORAMIENTO",
    title: "¿Cuál es para mí?",
    description: "Te lo definimos rápido con 5 preguntas.",
    features: [
      "¿Pantallas muchas horas?",
      "¿Conducción frecuente?",
      "¿Lectura prolongada?",
      "¿Actividad física / movimiento?",
      "¿Primer multifocal o ya usaste?"
    ],
    bg: "bg-[#f8fafc]",
    buttonText: "Iniciar consulta"
  }
];

export default function VariluxPage() {
  return (
    <div className="bg-white text-black selection:bg-black selection:text-white overflow-x-hidden" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      {/* ATELIER NAVBAR */}
      <StorefrontNavbar theme="dark" />

      {/* HERO SECTION */}
      <section className="relative w-full pt-32 pb-20 px-6 md:pt-40 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Cristales Premium</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Varilux · Multifocales
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            Visión nítida a todas las distancias. Diseñada para tu vida real.
            <br className="hidden md:block" />
            En multifocales, la diferencia no es solo el cristal: es la elección correcta del diseño, la medición precisa y el ajuste del armazón. Por eso lo trabajamos como <span className="font-medium text-black">asesoramiento profesional</span>, no como &quot;compra rápida&quot;.
          </p>
        </div>
      </section>

      {/* VALUE PROPOSITION STRIP */}
      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🎯</span>
            <div>
              <h4 className="text-white font-bold text-sm">Medición Fina</h4>
              <p className="text-white/60 text-xs mt-0.5">Centrados y alturas correctas</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🔍</span>
            <div>
              <h4 className="text-white font-bold text-sm">Consulta Guiada</h4>
              <p className="text-white/60 text-xs mt-0.5">Definimos tu mejor opción por uso real</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">✅</span>
            <div>
              <h4 className="text-white font-bold text-sm">Adaptación</h4>
              <p className="text-white/60 text-xs mt-0.5">Acompañamiento post-entrega</p>
            </div>
          </div>
        </div>
      </div>

      {/* PRODUCT GRID SECTION */}
      <section className="w-full py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Líneas Varilux disponibles</h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Estas líneas funcionan mejor como &quot;soluciones&quot; (consulta + recomendación), no como producto de carrito. Cada una tiene un perfil de uso diferente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CARDS.map((card, idx) => (
              <div 
                key={idx} 
                className={`border border-[#e8e2db] rounded-2xl p-8 flex flex-col h-full transition-all hover:shadow-xl hover:-translate-y-1 duration-300 ${card.bg}`}
              >
                <div className="mb-6">
                  {card.category && (
                    <p className="text-[11px] font-bold tracking-[0.1em] text-black/50 uppercase mb-3">
                      {card.category}
                    </p>
                  )}
                  <h3 className="text-2xl font-bold text-black mb-3">{card.title}</h3>
                  <p className="text-sm text-black/70 leading-relaxed min-h-[40px]">
                    {card.description}
                  </p>
                </div>
                
                <ul className="space-y-4 mb-10 flex-grow">
                  {card.features.map((f, i) => (
                    <li key={i} className="text-[14px] text-black/70 flex items-start gap-3">
                      <span className="text-black/40 mt-[2px] text-[10px]">●</span>
                      <span className="leading-tight">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex flex-col sm:flex-row items-center gap-3">
                  {card.extraButton && (
                    <a 
                      href="https://www.essilor.com.ar/productos/varilux" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center border border-black/20 bg-transparent text-black hover:bg-black/5 px-6 py-3 rounded-full text-[13px] font-bold transition-all w-full sm:w-auto"
                    >
                      Ver en Essilor
                    </a>
                  )}
                  <Link 
                    href={`/contacto?motivo=${encodeURIComponent(`Consulta por ${card.title}`)}`}
                    className="inline-flex items-center justify-center bg-[#283f5a] hover:bg-[#1e3047] text-white px-8 py-3 rounded-full text-[13px] font-bold transition-all w-full sm:w-auto flex-1"
                  >
                    {card.buttonText || "Consultar"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US / SEO CONTENT */}
      <section className="w-full bg-[#faf8f5] py-24 px-6 border-t border-[#e8e2db]">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <h3 className="text-2xl font-bold mb-6">¿Qué resuelve un multifocal bien elegido?</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                La presbicia no se &quot;cura&quot;: se compensa. Un multifocal progresivo busca una transición cómoda entre lejos, intermedio y cerca, con campos amplios y visión estable para tu rutina.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Definimos prioridades según tu día
                </li>
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Rutina de trabajo y ocio analizada
                </li>
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Distancias dominantes y posturas
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-6">Protegé tu visión</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                Mejorá tus lentes con tecnologías complementarias que se adaptan a tu entorno y necesidades específicas.
              </p>
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-[#e8e2db]">
                  <h4 className="font-bold text-sm mb-1">Blue UV Filter System</h4>
                  <p className="text-xs text-black/60">Tecnología para filtrar luz azul y ayudar a proteger frente a UV.</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[#e8e2db]">
                  <h4 className="font-bold text-sm mb-1">Crizal</h4>
                  <p className="text-xs text-black/60">Tratamiento antirreflejo para mayor transparencia y resistencia.</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[#e8e2db]">
                  <h4 className="font-bold text-sm mb-1">Transitions</h4>
                  <p className="text-xs text-black/60">Fotocromáticos que se adaptan a la luz para tu día a día.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
