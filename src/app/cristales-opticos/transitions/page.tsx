import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transitions Fotocromáticos | Atelier Óptica",
  description: "Lentes que se adaptan automáticamente a los cambios de iluminación: claros en interiores y más oscuros en exteriores.",
  keywords: "Transitions, Fotocromáticos, Lentes Inteligentes, Luz, Sol, Óptica, Atelier, Córdoba",
};

const CARDS = [
  {
    category: "PROTECCIÓN",
    title: "Bloqueo UV Permanente",
    description: "Diseñados para bloquear el 100% de los rayos UVA y UVB en todo momento.",
    features: [
      "Protección continua interior y exterior.",
      "Cuida tus ojos del daño solar diario.",
      "Complementa perfectamente tus lentes de receta habituales."
    ],
    bg: "bg-white",
  },
  {
    category: "CONFORT",
    title: "Adaptación a la luz",
    description: "Se oscurecen en exteriores y se aclaran en interiores automáticamente.",
    features: [
      "Menos deslumbramiento al salir al sol.",
      "Ideal para días cambiantes y personas dinámicas.",
      "Reduce la necesidad de tener dos pares de anteojos."
    ],
    bg: "bg-white"
  },
  {
    category: "SALUD VISUAL",
    title: "Filtro Azul-Violeta",
    description: "Ayudan a filtrar la luz dañina emitida por pantallas y luz artificial.",
    features: [
      "Descanso visual en la oficina o usando el celular.",
      "Transición rápida al salir a la calle.",
      "Tecnología doble propósito en un solo lente."
    ],
    bg: "bg-white"
  },
  {
    category: "ASESORAMIENTO",
    title: "¿Cuál es tu estilo?",
    description: "Los lentes Transitions vienen en distintos colores vibrantes.",
    features: [
      "Gris, Marrón y Verde Clásico.",
      "Colores Style Colors: Zafiro, Amatista, Ámbar.",
      "Te ayudamos a combinarlos con el armazón perfecto."
    ],
    bg: "bg-[#f8fafc]",
    buttonText: "Iniciar consulta"
  }
];

export default function TransitionsPage() {
  return (
    <div className="bg-[#faf8f5]">
      <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Lentes Inteligentes</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Transitions · Fotocromáticos
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            Un solo par de lentes, listo para cualquier luz.
            <br className="hidden md:block" />
            Se adaptan automáticamente a los cambios de iluminación: claros en interiores y más oscuros en exteriores, para que veas cómodo sin estar cambiando de anteojos.
          </p>
        </div>
      </section>

      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🌓</span>
            <div>
              <h4 className="text-white font-bold text-sm">Transición Automática</h4>
              <p className="text-white/60 text-xs mt-0.5">Interior claro, exterior oscuro</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🛡️</span>
            <div>
              <h4 className="text-white font-bold text-sm">Protección UV</h4>
              <p className="text-white/60 text-xs mt-0.5">Bloqueo UV siempre activo 100%</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🎨</span>
            <div>
              <h4 className="text-white font-bold text-sm">Estilo</h4>
              <p className="text-white/60 text-xs mt-0.5">Colores que marcan tendencia</p>
            </div>
          </div>
        </div>
      </div>

      <section className="w-full py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Qué te resuelven los Transitions?</h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Para quienes viven entrando y saliendo, o son muy sensibles a la luz. La idea es que tus lentes se adapten al ambiente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  <Link 
                    href={`/contacto?motivo=${encodeURIComponent(`Consulta por Transitions - ${card.title}`)}`}
                    className="inline-flex items-center justify-center bg-[#283f5a] hover:bg-[#1e3047] text-white px-8 py-3 rounded-full text-[13px] font-bold transition-all w-full flex-1"
                  >
                    {card.buttonText || "Consultar armado"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full bg-[#faf8f5] py-24 px-6 border-t border-[#e8e2db]">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <h3 className="text-2xl font-bold mb-6">Comodidad inigualable</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                El lente fotocromático te evita tener que cambiar entre tus anteojos de sol con aumento y tus anteojos transparentes cada vez que cruzás una puerta. Todo ocurre de forma fluida.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Ideal para estilos de vida dinámicos.
                </li>
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Reducción de fatiga al evitar guiños por exceso de luz.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-6">Armado y calibración</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                En Atelier Óptica lo armamos como una solución integral (tu receta + tus hábitos + el tratamiento) y lo calibramos cuidadosamente a tu armazón elegido.
              </p>
              <div className="bg-white p-6 rounded-xl border border-[#e8e2db]">
                <h4 className="font-bold text-sm mb-2">Tip de Atelier</h4>
                <p className="text-sm text-black/70">Si sos de los que pierden frecuentemente los anteojos de sol, los Transitions son la mejor manera de asegurar que siempre tengas protección solar cuando salís a la calle sin acordarte de llevar "el otro par".</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
