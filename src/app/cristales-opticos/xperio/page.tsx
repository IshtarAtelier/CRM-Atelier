import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Xperio Polarizados | Atelier Óptica",
  description: "Lentes polarizados que reducen reflejos y mejoran el confort al aire libre. Ideales para manejo diurno, playa y actividades outdoor.",
  keywords: "Xperio, Polarizados, Lentes de Sol, Reflejos, Conducción, Óptica, Atelier, Córdoba",
};

const CARDS = [
  {
    category: "MANEJO",
    title: "Polarizado para Conducción",
    description: "Pensado para reducir reflejos del asfalto y mejorar confort en días brillantes.",
    features: [
      "Ideal si manejás seguido de día.",
      "Ayuda con el deslumbramiento en ruta.",
      "Se arma con tu receta médica."
    ],
    bg: "bg-white",
  },
  {
    category: "OUTDOOR",
    title: "Playa y Actividades",
    description: "Reflejos fuertes en agua/arena: polarizado recomendado para confort prolongado.",
    features: [
      "Mejora la 'calma visual'.",
      "Útil en náutica y deportes al aire libre.",
      "Definimos el color según tu preferencia."
    ],
    bg: "bg-white"
  },
  {
    category: "ASESORAMIENTO",
    title: "¿Cuál te conviene?",
    description: "Te lo definimos con 4 preguntas + tu receta (si la tenés).",
    features: [
      "¿Manejás seguido?",
      "¿Exterior frecuente?",
      "¿Playa, agua o deporte?",
      "¿Preferís color más suave o más oscuro?"
    ],
    bg: "bg-[#f8fafc]",
    buttonText: "Iniciar consulta"
  }
];

export default function XperioPage() {
  return (
    <div className="bg-[#faf8f5]">
      {/* HERO SECTION */}
      <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Confort al aire libre</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Xperio · Polarizados
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            Polarizados que reducen reflejos y mejoran el confort al aire libre.
            <br className="hidden md:block" />
            Xperio® es una familia de lentes pensados para exterior: ayudan a reducir reflejos molestos (ruta, agua, superficies brillantes) y aportan una visión más limpia y confortable.
          </p>
        </div>
      </section>

      {/* VALUE PROPOSITION STRIP */}
      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">☀️</span>
            <div>
              <h4 className="text-white font-bold text-sm">Menos reflejos</h4>
              <p className="text-white/60 text-xs mt-0.5">Ayuda en agua/ruta/superficies</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">👓</span>
            <div>
              <h4 className="text-white font-bold text-sm">Con Receta</h4>
              <p className="text-white/60 text-xs mt-0.5">Se arma con tu graduación</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🎨</span>
            <div>
              <h4 className="text-white font-bold text-sm">Estética</h4>
              <p className="text-white/60 text-xs mt-0.5">Opciones de color disponibles</p>
            </div>
          </div>
        </div>
      </div>

      {/* PRODUCT GRID SECTION */}
      <section className="w-full py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Opciones recomendadas</h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Te sugerimos la opción ideal según rutina + receta.
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
                  <Link 
                    href={`/contacto?motivo=${encodeURIComponent(`Consulta por Xperio - ${card.title}`)}`}
                    className="inline-flex items-center justify-center bg-[#283f5a] hover:bg-[#1e3047] text-white px-8 py-3 rounded-full text-[13px] font-bold transition-all w-full sm:w-auto flex-1"
                  >
                    {card.buttonText || "Consultar por mi caso"}
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
              <h3 className="text-2xl font-bold mb-6">¿Qué te resuelve un polarizado?</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                Si te molestan los reflejos del sol o terminás &quot;forzando&quot; la vista en exterior, el polarizado suele ser el salto más notorio. Especialmente para manejo diurno, playa, náutica y actividades al aire libre.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Filtra reflejos intensos horizontales (ruta/agua).
                </li>
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Visión más relajada en días brillantes.
                </li>
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Mejor lectura de contrastes al aire libre.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-6">¿Se puede hacer con mi receta?</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                Sí. Lo armamos con tu graduación y lo ajustamos al armazón para un buen centrado y confort.
                Te sugerimos el armado correcto y opciones de color disponibles según el stock.
              </p>
              <div className="bg-white p-6 rounded-xl border border-[#e8e2db]">
                <h4 className="font-bold text-sm mb-2">Tip de Atelier</h4>
                <p className="text-sm text-black/70">Si tu prioridad es la ruta o la ciudad, buscamos confort y claridad en condiciones reales. Consideramos tus horarios y exposición a la hora de armar tu polarizado Xperio.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
