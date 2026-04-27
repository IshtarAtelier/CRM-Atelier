import Link from "next/link";

export default function ColorsGuidePage() {
  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white pb-20">
      
      {/* HEADER MINIMALISTA ESTILO GM */}
      <header className="fixed top-0 w-full z-50 px-5 py-4 flex justify-between items-center bg-transparent mix-blend-difference text-white">
        <Link href="/" className="text-[13px] font-medium hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
          Back
        </Link>
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 text-[16px] font-bold tracking-[0.15em] drop-shadow-md" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
          ATELIER ÓPTICA
        </Link>
        <div className="flex gap-5">
           <button className="text-[13px] font-medium hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>Cart(0)</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-24 lg:pt-40">
        <div className="mb-12 lg:mb-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#999] mb-4">Guía Estética y Funcional</p>
          <h1 className="text-3xl lg:text-5xl font-normal tracking-tight mb-6 lg:mb-8">El significado del color</h1>
          <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed max-w-xl mx-auto">
            El teñido de tus cristales es más que una declaración de moda. Cada tonalidad filtra la luz de forma distinta, alterando el contraste, la percepción de profundidad y reduciendo la fatiga visual según la actividad que realices.
          </p>
        </div>

        <div className="space-y-12 lg:space-y-16">
          <section className="border-t border-[#e5e5e5] pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">Tonos Clásicos Neutros</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-8">
               <div className="border border-[#e5e5e5] p-6 lg:p-8 relative overflow-hidden group hover:border-black transition-colors">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#555555] opacity-10 rounded-bl-full transition-transform group-hover:scale-110" />
                  <div className="w-8 h-8 rounded-full shadow-inner mb-4 bg-[#555555] opacity-85" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Gris</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Transmite toda la gama de colores de forma fiel, reduciendo el brillo de forma neutra y equilibrada. Ideal para uso general, conducción y días soleados muy brillantes.</p>
               </div>
               
               <div className="border border-[#e5e5e5] p-6 lg:p-8 relative overflow-hidden group hover:border-black transition-colors">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#2c4c3b] opacity-10 rounded-bl-full transition-transform group-hover:scale-110" />
                  <div className="w-8 h-8 rounded-full shadow-inner mb-4 bg-[#2c4c3b] opacity-85" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Verde G15</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">El tono originario de los clásicos Aviadores. Ofrece una visión muy relajante y natural. Bloquea ligeramente el azul, aumentando un poco el contraste visual general.</p>
               </div>
               
               <div className="sm:col-span-2 border border-[#e5e5e5] p-6 lg:p-8 relative overflow-hidden group hover:border-black transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#6b4c3a] opacity-10 rounded-bl-full transition-transform group-hover:scale-110" />
                  <div className="w-8 h-8 rounded-full shadow-inner mb-4 bg-[#6b4c3a] opacity-85" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Marrón</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed max-w-2xl">Bloquea una gran cantidad de luz azul, lo que agudiza el enfoque y la percepción de profundidad. Es el color más versátil, ya que funciona perfectamente tanto en días soleados como en tardes nubladas o variables.</p>
               </div>
            </div>
          </section>

          <section className="border-t border-[#e5e5e5] pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">Tonos Especiales de Alto Contraste</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
               <div className="p-6 lg:p-8 bg-[#f9f9f9] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#e1b854] opacity-20 rounded-bl-full" />
                  <div className="w-6 h-6 rounded-full shadow-inner mb-4 bg-[#e1b854] opacity-90" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Amarillo</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Proporciona el máximo contraste al bloquear casi por completo la bruma y la luz azul. Su uso es técnico: conducción nocturna, niebla densa, amaneceres u ordenadores (gamers).</p>
               </div>

               <div className="p-6 lg:p-8 bg-[#f9f9f9] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#d6804a] opacity-20 rounded-bl-full" />
                  <div className="w-6 h-6 rounded-full shadow-inner mb-4 bg-[#d6804a] opacity-90" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Naranja</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Lleva los beneficios del amarillo a entornos parcialmente soleados. Aumenta drásticamente la profundidad de campo. Favorito indiscutido para deportes de nieve o ciclismo.</p>
               </div>

               <div className="p-6 lg:p-8 bg-[#f9f9f9] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#d4a3a3] opacity-30 rounded-bl-full" />
                  <div className="w-6 h-6 rounded-full shadow-inner mb-4 bg-[#d4a3a3] opacity-90" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Rosa Vintage</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Más allá de su profunda carga estética y editorial, el cristal rosado relaja excesivamente los músculos del ojo. Muy útil para quienes sufren migrañas por exceso de luz o trabajan mucho en interiores.</p>
               </div>
               
               <div className="p-6 lg:p-8 bg-[#f9f9f9] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#ab4040] opacity-20 rounded-bl-full" />
                  <div className="w-6 h-6 rounded-full shadow-inner mb-4 bg-[#ab4040] opacity-90" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Rojo</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Bloquea agresivamente el azul y realza el contraste en fondos verdes o nevados. Es una elección audaz, elegida frecuentemente por esquiadores y ciclistas de alto rendimiento.</p>
               </div>
            </div>
          </section>
        </div>

        <div className="mt-16 lg:mt-20 p-8 lg:p-12 border border-black text-center">
          <h3 className="text-xl font-medium mb-3">¿Necesitás asesoramiento?</h3>
          <p className="text-[14px] text-[#666] mb-8">Si vas a realizar actividades específicas y no estás seguro qué cristal es el ideal para vos, te ayudamos a elegir.</p>
          <a href="https://wa.me/5493541215971" target="_blank" rel="noopener noreferrer" className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity">Hablar con Asesor Técnico</a>
        </div>
      </main>
    </div>
  );
}
