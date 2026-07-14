import { Metadata } from 'next';
import Link from "next/link";
import { WHATSAPP_PHONE } from '@/lib/constants';


export const metadata: Metadata = {
  alternates: { canonical: 'https://atelieroptica.com.ar/blog/colores-cristales' },
  title: { absolute: "Colores de Cristales para Lentes: Guía Definitiva | Atelier Óptica" },
  description: "Descubrí qué color de cristal es ideal para tus anteojos. Guía experta de Atelier Óptica desde el Cerro de las Rosas, Córdoba. Envíos a toda Argentina.",
  keywords: ["colores de cristales para anteojos", "lentes de sol con aumento", "óptica en Córdoba", "Cerro de las Rosas", "Nueva Córdoba", "anteojos de receta", "cristales entintados", "salud visual", "envíos a toda Argentina", "óptica premium"],
};

export default function ColorsGuidePage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-black font-sans selection:bg-black selection:text-white pb-20">
      
      {/* HEADER MINIMALISTA ESTILO GM */}
      <header className="fixed top-0 w-full z-50 px-5 py-4 flex justify-between items-center bg-transparent mix-blend-difference text-white">
        <Link href="/" className="text-[13px] font-medium hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
          Volver
        </Link>
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 text-[16px] font-medium tracking-tight tracking-[0.15em] drop-shadow-md font-serif">
          ATELIER ÓPTICA
        </Link>
        <div className="flex gap-5">
           <button className="text-[13px] font-medium hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>Carrito(0)</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-24 lg:pt-40">
        <div className="mb-12 lg:mb-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#999] mb-4">Guía Estética y Funcional en Córdoba</p>
          <h1 className="text-3xl lg:text-5xl font-normal tracking-tight mb-6 lg:mb-8">El verdadero significado del color en tus lentes</h1>
          <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed max-w-xl mx-auto">
            El teñido de tus cristales es mucho más que una declaración de moda. En <strong>Atelier Óptica</strong> sabemos que cada tonalidad filtra la luz de manera diferente, optimizando el contraste, la percepción de profundidad y reduciendo la fatiga visual según la actividad que realices. Ya sea para pasear por Nueva Córdoba o para manejar largas distancias, descubrí el tono perfecto para tu mirada.
          </p>
        </div>

        <div className="space-y-12 lg:space-y-16">
          <section className="border-t border-black/10 pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">Tonos Clásicos Neutros</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-8">
               <div className="border border-black/10 p-6 lg:p-8 relative overflow-hidden group hover:border-black/30 transition-all duration-300 hover:shadow-md transition-colors">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#555555] opacity-10 rounded-bl-full transition-transform group-hover:scale-110" />
                  <div className="w-8 h-8 rounded-full shadow-inner mb-4 bg-[#555555] opacity-85" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Gris: Equilibrio Perfecto</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Transmite toda la gama de colores de forma fiel, reduciendo el brillo de manera neutra. Es la elección ideal para el uso diario, la conducción y los días soleados de alta intensidad. Un clásico infalible para proteger tus ojos con elegancia.</p>
               </div>
               
               <div className="border border-black/10 p-6 lg:p-8 relative overflow-hidden group hover:border-black/30 transition-all duration-300 hover:shadow-md transition-colors">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#2c4c3b] opacity-10 rounded-bl-full transition-transform group-hover:scale-110" />
                  <div className="w-8 h-8 rounded-full shadow-inner mb-4 bg-[#2c4c3b] opacity-85" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Verde G15: Visión Natural</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">El tono emblemático de los clásicos Aviadores. Ofrece una visión sumamente relajante al transmitir los colores de forma muy natural. Bloquea la luz azul sutilmente y maximiza el confort visual bajo cualquier tipo de iluminación.</p>
               </div>
               
               <div className="sm:col-span-2 border border-black/10 p-6 lg:p-8 relative overflow-hidden group hover:border-black/30 transition-all duration-300 hover:shadow-md transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#6b4c3a] opacity-10 rounded-bl-full transition-transform group-hover:scale-110" />
                  <div className="w-8 h-8 rounded-full shadow-inner mb-4 bg-[#6b4c3a] opacity-85" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Marrón: Contraste Versátil</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed max-w-2xl">Bloquea una gran cantidad de luz azul, lo que agudiza el enfoque y mejora drásticamente la percepción de profundidad. Es el color más versátil, ya que funciona a la perfección tanto en días soleados radiantes como en tardes nubladas o variables típicas de las sierras cordobesas.</p>
               </div>
            </div>
          </section>

          <section className="border-t border-black/10 pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">Tonos Especiales de Alto Contraste</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
               <div className="p-6 lg:p-8 bg-[#f9f9f9] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#e1b854] opacity-20 rounded-bl-full" />
                  <div className="w-6 h-6 rounded-full shadow-inner mb-4 bg-[#e1b854] opacity-90" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Amarillo: Máxima Agudeza</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Proporciona un contraste extremo al bloquear casi por completo la luz azul y la bruma. Su uso es altamente técnico: conducción nocturna, días de niebla densa o largas sesiones frente a pantallas. Ideal para mantener la alerta visual al máximo.</p>
               </div>

               <div className="p-6 lg:p-8 bg-[#f9f9f9] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#d6804a] opacity-20 rounded-bl-full" />
                  <div className="w-6 h-6 rounded-full shadow-inner mb-4 bg-[#d6804a] opacity-90" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Naranja: Profundidad Absoluta</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Lleva los beneficios del amarillo a entornos parcialmente soleados, aumentando de forma dramática la profundidad de campo. Es el aliado indiscutido para deportes dinámicos al aire libre como el ciclismo o las actividades en la nieve.</p>
               </div>

               <div className="p-6 lg:p-8 bg-[#f9f9f9] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#d4a3a3] opacity-30 rounded-bl-full" />
                  <div className="w-6 h-6 rounded-full shadow-inner mb-4 bg-[#d4a3a3] opacity-90" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Rosa Vintage: Relax Visual</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Más allá de su innegable carga estética y editorial, el cristal rosado relaja profundamente los músculos oculares. Es especialmente útil para quienes sufren migrañas por fotosensibilidad, exceso de iluminación o trabajan extensas jornadas en interiores.</p>
               </div>
               
               <div className="p-6 lg:p-8 bg-[#f9f9f9] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#ab4040] opacity-20 rounded-bl-full" />
                  <div className="w-6 h-6 rounded-full shadow-inner mb-4 bg-[#ab4040] opacity-90" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Rojo: Rendimiento Audaz</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Bloquea agresivamente el espectro azul y realza el contraste sobre fondos verdes o nevados. Una elección audaz y muy funcional, escogida frecuentemente por deportistas de alto rendimiento para lograr una definición insuperable del entorno.</p>
               </div>
            </div>
          </section>
        </div>

        <div className="mt-16 lg:mt-20 p-8 lg:p-12 border border-black text-center">
          <h3 className="text-xl font-medium mb-3">¿Necesitás asesoramiento personalizado?</h3>
          <p className="text-[14px] text-[#666] mb-8">Si vas a realizar actividades específicas y no estás seguro de qué cristal es el ideal para vos, estamos listos para ayudarte. Visitá nuestro exclusivo showroom en el Cerro de las Rosas, Córdoba, o consultá online desde cualquier rincón de Argentina con envío asegurado.</p>
          <a href={`https://wa.me/${WHATSAPP_PHONE}`} target="_blank" rel="noopener noreferrer" className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:opacity-70 transition-all duration-300 transition-opacity">Hablar con un Asesor Especializado</a>
        </div>
      </main>
    </div>
  );
}