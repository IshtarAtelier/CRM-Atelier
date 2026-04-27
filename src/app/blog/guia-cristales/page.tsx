import Link from "next/link";

export default function CrystalGuidePage() {
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

      <main className="max-w-3xl mx-auto px-6 pt-32 lg:pt-40">
        <div className="mb-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#999] mb-4">Guía de Compra</p>
          <h1 className="text-4xl lg:text-5xl font-normal tracking-tight mb-8">Cómo elegir tus cristales</h1>
          <p className="text-[15px] text-[#666] leading-relaxed max-w-xl mx-auto">
            Una selección meticulosa de materiales y tratamientos diseñados para optimizar tu visión y complementar la estética de cada armazón.
          </p>
        </div>

        <div className="space-y-16">
          <section className="border-t border-[#e5e5e5] pt-12">
            <h2 className="text-xl font-medium mb-8 text-center">Tipos de Visión</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
               <div className="border border-[#e5e5e5] p-8">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Monofocal</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Ideales para corregir un solo campo visual (miopía, hipermetropía o astigmatismo). Perfectos para anteojos de uso continuo o lectura.</p>
               </div>
               <div className="border border-[#e5e5e5] p-8">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Bifocal</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Combinan visión lejana y de cerca en un mismo cristal, con una línea divisoria visible. Una opción clásica de alta durabilidad.</p>
               </div>
               <div className="sm:col-span-2 border border-[#e5e5e5] p-8">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Multifocal</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed max-w-2xl">La tecnología más avanzada. Ofrece una transición suave e invisible entre la visión lejana, intermedia y cercana. Son imprescindibles para el día a día de pacientes con presbicia (después de los 40 años).</p>
               </div>
            </div>
          </section>

          <section className="border-t border-[#e5e5e5] pt-12">
            <h2 className="text-xl font-medium mb-8 text-center">Tratamientos Premium</h2>
            <div className="grid grid-cols-1 gap-6">
               <div className="p-8 bg-[#f9f9f9]">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Antirreflex (AR)</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Elimina los molestos reflejos de las luces artificiales. Esto mejora drásticamente la estética (los demás pueden ver tus ojos sin brillos) y reduce la fatiga visual nocturna al conducir.</p>
               </div>
               <div className="p-8 bg-[#f9f9f9]">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Filtro Azul</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Bloquea la luz nociva emitida por pantallas (celulares, computadoras, televisores). Previene el insomnio y la fatiga ocular digital. Altamente recomendado si pasás más de 4 horas frente a monitores.</p>
               </div>
               <div className="p-8 bg-[#f9f9f9]">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Teñido de Color (Lentes de Sol)</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Transforma tus cristales recetados en lentes de sol puros, bloqueando los rayos UV y proporcionando un confort visual total en exteriores.</p>
               </div>
            </div>
          </section>
        </div>

        <div className="mt-20 p-12 border border-black text-center">
          <h3 className="text-xl font-medium mb-3">¿Seguís con dudas?</h3>
          <p className="text-[14px] text-[#666] mb-8">Nuestro equipo de ópticos está en línea para asesorarte con tu receta médica y asegurar que elijas la mejor opción.</p>
          <a href="https://wa.me/5493541215971" target="_blank" rel="noopener noreferrer" className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity">Hablar con Asesor Técnico</a>
        </div>
      </main>
    </div>
  );
}
