import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crizal Tratamientos | Atelier Óptica",
  description: "Tratamientos antirreflejo Crizal para mayor claridad. Lentes más fáciles de limpiar, resistentes a marcas y reflejos molestos.",
  keywords: "Crizal, Antirreflejo, Cristales, Lentes Limpias, Protección, Óptica, Atelier, Córdoba",
};

const CARDS = [
  {
    category: "TRANSPARENCIA",
    title: "Claridad y Confort",
    description: "Menos reflejos molestos y mejor visión en todas las situaciones.",
    features: [
      "Reduce reflejos de luces y pantallas.",
      "Mejor estética (lente 'más invisible').",
      "Ideal para uso intensivo de pantallas y manejo nocturno."
    ],
    bg: "bg-white",
  },
  {
    category: "MANTENIMIENTO",
    title: "Fácil de Limpiar",
    description: "Tratamientos pensados para resistir manchas y huellas en tu día a día.",
    features: [
      "Menos 'marcas' en el cristal.",
      "Mayor limpieza con menos esfuerzo.",
      "Excelente opción para uso continuo."
    ],
    bg: "bg-white"
  },
  {
    category: "DURABILIDAD",
    title: "Resistencia Diaria",
    description: "Soporta el ritmo de la vida real con una durabilidad excepcional.",
    features: [
      "Protección contra rayas ligeras del uso.",
      "Repele el agua y el polvo.",
      "Alarga la vida útil de tus cristales."
    ],
    bg: "bg-white"
  },
  {
    category: "ASESORAMIENTO",
    title: "¿Cuál es ideal para mí?",
    description: "Encontramos el tratamiento adecuado según tu rutina.",
    features: [
      "¿Trabajás con pantallas?",
      "¿Manejás de noche?",
      "¿Buscás la máxima resistencia?",
      "Evaluamos tu receta y armazón."
    ],
    bg: "bg-[#f8fafc]",
    buttonText: "Iniciar consulta"
  }
];

export default function CrizalPage() {
  return (
    <div className="bg-[#faf8f5]">
      <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Tratamientos Premium</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Crizal · Tratamientos
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            Más claridad. Menos reflejos. Lentes que se mantienen impecables.
            <br className="hidden md:block" />
            Crizal® es la línea de tratamientos antirreflejo pensada para mejorar la transparencia y sumar una "capa de protección" frente al uso real: manchas, rayas, agua y polvo.
          </p>
        </div>
      </section>

      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">✨</span>
            <div>
              <h4 className="text-white font-bold text-sm">Antirreflejo</h4>
              <p className="text-white/60 text-xs mt-0.5">Más transparencia y confort visual</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">💧</span>
            <div>
              <h4 className="text-white font-bold text-sm">Fácil Limpieza</h4>
              <p className="text-white/60 text-xs mt-0.5">Menos marcas, huellas y polvo</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🛡️</span>
            <div>
              <h4 className="text-white font-bold text-sm">Resistencia</h4>
              <p className="text-white/60 text-xs mt-0.5">Protección frente al uso diario</p>
            </div>
          </div>
        </div>
      </div>

      <section className="w-full py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">La solución para tu rutina</h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Lo definimos como solución (receta + uso + armazón) para que el resultado sea cómodo y duradero.
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
                    href={`/contacto?motivo=${encodeURIComponent(`Consulta por Crizal - ${card.title}`)}`}
                    className="inline-flex items-center justify-center bg-[#283f5a] hover:bg-[#1e3047] text-white px-8 py-3 rounded-full text-[13px] font-bold transition-all w-full flex-1"
                  >
                    {card.buttonText || "Consultar opciones"}
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
              <h3 className="text-2xl font-bold mb-6">¿Qué te aporta Crizal en el día a día?</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                El objetivo es simple: que veas más claro y que tus lentes se mantengan mejor con el uso real (pantallas, luces, polvo, lluvia, huellas). La elección final depende de tu rutina.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Reducción de fatiga visual nocturna.
                </li>
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Visión estética: parece que no tuvieras cristales.
                </li>
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Tratamiento que cuida tu inversión a largo plazo.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-6">Compatible con tu graduación</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                El tratamiento Crizal se puede aplicar sobre casi cualquier receta y armazón. Es el complemento perfecto para cristales monofocales o multifocales.
              </p>
              <div className="bg-white p-6 rounded-xl border border-[#e8e2db]">
                <h4 className="font-bold text-sm mb-2">Tip de Atelier</h4>
                <p className="text-sm text-black/70">Si nunca usaste un tratamiento antirreflejo premium, te sugerimos empezar por Crizal. La diferencia en la nitidez y la facilidad de limpieza es un antes y un después.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
