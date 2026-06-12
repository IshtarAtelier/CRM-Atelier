import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blue UV Filter System | Atelier Óptica",
  description: "Protección inteligente frente a luz azul-violeta y rayos UV. Mantené tu vista relajada durante el uso de pantallas.",
  keywords: "Blue UV, Filtro Azul, Pantallas, Protección UV, Cristales, Óptica, Atelier, Córdoba",
};

const CARDS = [
  {
    category: "MUNDO DIGITAL",
    title: "Confort en Pantallas",
    description: "Ayuda a reducir la exposición a luz azul-violeta nociva en el uso diario.",
    features: [
      "Ideal si trabajás muchas horas frente a monitores.",
      "Previene la fatiga visual al final del día.",
      "Se combina perfectamente con tratamientos antirreflejo."
    ],
    bg: "bg-white",
  },
  {
    category: "PROTECCIÓN",
    title: "Filtro + UV Integrado",
    description: "Tecnología diseñada para sumar protección UV además del filtrado selectivo.",
    features: [
      "Bloqueo de rayos UV perjudiciales.",
      "Para uso en interiores y exteriores de forma cotidiana.",
      "El anteojo principal definitivo."
    ],
    bg: "bg-white"
  },
  {
    category: "ESTÉTICA",
    title: "Transparencia Total",
    description: "A diferencia de los filtros amarillentos antiguos, este lente es estético y natural.",
    features: [
      "Cristal claro y transparente.",
      "Look natural para el día a día.",
      "Sin reflejos azules molestos (según versión)."
    ],
    bg: "bg-white"
  },
  {
    category: "ASESORAMIENTO",
    title: "¿Es necesario para mí?",
    description: "Evaluemos cuántas horas pasás frente a luz artificial.",
    features: [
      "¿Trabajás en oficina bajo luces LED?",
      "¿Usás mucho el celular de noche?",
      "¿Sentís los ojos secos o cansados al atardecer?"
    ],
    bg: "bg-[#f8fafc]",
    buttonText: "Iniciar consulta"
  }
];

export default function BlueUvPage() {
  return (
    <div className="bg-[#faf8f5]">
      <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Pantallas y Salud Visual</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Blue UV Filter System
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            Protección inteligente frente a luz azul-violeta y UV.
            <br className="hidden md:block" />
            Blue UV Filter System™ es una tecnología pensada para filtrar selectivamente luz azul-violeta manteniendo un lente claro y estético para uso diario.
          </p>
        </div>
      </section>

      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">💻</span>
            <div>
              <h4 className="text-white font-bold text-sm">Luz Azul-Violeta</h4>
              <p className="text-white/60 text-xs mt-0.5">Filtrado selectivo para uso diario</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">☀️</span>
            <div>
              <h4 className="text-white font-bold text-sm">Protección UV</h4>
              <p className="text-white/60 text-xs mt-0.5">Protección integrada en el material</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">👁️</span>
            <div>
              <h4 className="text-white font-bold text-sm">Claridad Natural</h4>
              <p className="text-white/60 text-xs mt-0.5">Lente transparente, estética impecable</p>
            </div>
          </div>
        </div>
      </div>

      <section className="w-full py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">El escudo para tu rutina digital</h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              La recomendación depende de tus horas frente a pantallas y de tu sensibilidad a la luz.
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
                    href={`/contacto?motivo=${encodeURIComponent(`Consulta por Blue UV - ${card.title}`)}`}
                    className="inline-flex items-center justify-center bg-[#283f5a] hover:bg-[#1e3047] text-white px-8 py-3 rounded-full text-[13px] font-bold transition-all w-full flex-1"
                  >
                    {card.buttonText || "Consultar filtro"}
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
              <h3 className="text-2xl font-bold mb-6">¿Por qué usar Blue UV Filter?</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                Pensado para el mundo real: pasamos gran parte del día bajo luces LED, monitores, celulares y televisores. Esta tecnología filtra la luz nociva y deja pasar la luz "buena" esencial para el ciclo del sueño.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Mejora del confort visual tras jornadas largas.
                </li>
                <li className="flex items-center gap-3 text-black/80 font-medium">
                  <svg className="w-5 h-5 text-[#283f5a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Previene el envejecimiento ocular prematuro.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-6">Diseño invisible</h3>
              <p className="text-black/70 mb-6 leading-relaxed">
                Anteriormente, los filtros azules daban un aspecto amarillo fuerte a los lentes. Hoy, con la tecnología de inmersión en la masa del cristal, el filtro es indetectable y completamente transparente a los ojos de los demás.
              </p>
              <div className="bg-white p-6 rounded-xl border border-[#e8e2db]">
                <h4 className="font-bold text-sm mb-2">Tip de Atelier</h4>
                <p className="text-sm text-black/70">Recomendamos este cristal para usuarios de oficina, programadores y adolescentes que utilizan dispositivos móviles por más de 3 horas diarias.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
