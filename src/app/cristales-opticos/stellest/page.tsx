import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stellest Control Miopía Infantil | Atelier Óptica",
  description: "Tecnología Stellest de Essilor para acompañar el control de la miopía en niños y adolescentes.",
  keywords: "Stellest, Miopía, Niños, Cristales Infantiles, Control Miopía, Óptica, Atelier, Córdoba",
};

const CARDS = [
  {
    category: "DÍA A DÍA",
    title: "Visión Clara Continua",
    description: "Claridad para la escuela, los deportes y sus actividades favoritas.",
    features: [
      "Corrección óptica precisa según su receta médica.",
      "Confort visual total en su rutina diaria.",
      "Compatibilidad total con armazones infantiles flexibles."
    ],
    bg: "bg-white",
  },
  {
    category: "TECNOLOGÍA",
    title: "Control de Progresión",
    description: "Diseño pensado para acompañar el control de la miopía con seguimiento profesional.",
    features: [
      "Tecnología H.A.L.T. altamente innovadora.",
      "Diseño óptico especial en el cristal.",
      "Busca frenar la elongación del globo ocular."
    ],
    bg: "bg-white"
  },
  {
    category: "ASESORAMIENTO",
    title: "Plan y Controles",
    description: "La miopía no es 'solo poner aumento', requiere seguimiento.",
    features: [
      "Se evalúa con el oftalmólogo profesional.",
      "Se analizan los hábitos (pantallas vs juegos en exterior).",
      "Controles periódicos fundamentales para el éxito."
    ],
    bg: "bg-[#f8fafc]",
    buttonText: "Iniciar consulta"
  }
];

export default function StellestPage() {
  return (
    <div className="bg-[#faf8f5]">
      <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Salud Visual Infantil</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Stellest · Control Miopía
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            Una solución diseñada para acompañar el control de la miopía.
            <br className="hidden md:block" />
            Stellest® es una propuesta de Essilor® pensada para niños y adolescentes: combina visión clara para el día a día con un diseño óptico orientado a ayudar a controlar la progresión.
          </p>
        </div>
      </section>

      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">👦🏽</span>
            <div>
              <h4 className="text-white font-bold text-sm">Niños y Adolescentes</h4>
              <p className="text-white/60 text-xs mt-0.5">Adaptado a sus hábitos visuales</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">📋</span>
            <div>
              <h4 className="text-white font-bold text-sm">Seguimiento</h4>
              <p className="text-white/60 text-xs mt-0.5">Controles dentro de su plan oftalmológico</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🎯</span>
            <div>
              <h4 className="text-white font-bold text-sm">Precisión Óptica</h4>
              <p className="text-white/60 text-xs mt-0.5">Corrige la miopía en todo el lente</p>
            </div>
          </div>
        </div>
      </div>

      <section className="w-full py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Por qué se recomienda Stellest?</h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Cuando la miopía progresa, la idea no es “solo ver bien”, sino también acompañar el manejo a largo plazo con hábitos y una solución adecuada.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    href={`/contacto?motivo=${encodeURIComponent(`Consulta por Stellest Miopía - ${card.title}`)}`}
                    className="inline-flex items-center justify-center bg-[#283f5a] hover:bg-[#1e3047] text-white px-8 py-3 rounded-full text-[13px] font-bold transition-all w-full flex-1"
                  >
                    {card.buttonText || "Solicitar asesoramiento"}
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
              <h3 className="text-2xl font-bold mb-6">Importancia de actuar a tiempo</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                La miopía infantil tiende a progresar muy rápido. Controlarla en las primeras etapas de desarrollo no solo mejora la calidad de vida actual del niño, sino que reduce significativamente el riesgo de patologías oculares graves en el futuro.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Visión nítida asegurada.
                </li>
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Evita altos niveles de graduación en la adultez.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-6">Orientación Atelier</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                En Óptica Cingolani / Atelier te orientamos con un enfoque muy práctico: analizamos la receta de tu oftalmólogo, sugerimos hábitos positivos (menos pantallas, más aire libre) y establecemos el calendario de controles.
              </p>
              <div className="bg-white p-6 rounded-xl border border-[#e8e2db]">
                <h4 className="font-bold text-sm mb-2">Compromiso Total</h4>
                <p className="text-sm text-black/70">El éxito del tratamiento radica tanto en la tecnología del cristal como en la adaptación y constancia del niño. Nosotros acompañamos a las familias en todo ese proceso de aprendizaje.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
