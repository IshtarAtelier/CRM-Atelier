import { Metadata } from 'next';
import Link from "next/link";
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/guia-cristales' },
  title: "Guía de Cristales para Anteojos en Córdoba | Atelier Óptica",
  description: "Descubrí cómo elegir los cristales perfectos en Atelier Óptica, Córdoba. Cristales multifocales, filtro azul y diseño exclusivo como joyería artesanal.",
  keywords: ["óptica Córdoba", "guía cristales", "anteojos de receta", "cristales multifocales", "filtro azul", "Cerro de las Rosas", "Nueva Córdoba", "joyería artesanal", "piedras naturales", "diseño exclusivo"],
};

export default function CrystalGuidePage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-black font-sans selection:bg-black selection:text-white pb-20">
      
      {/* HEADER MINIMALISTA ESTILO GM */}
      <header className="fixed top-0 w-full z-50 px-5 py-4 flex justify-between items-center bg-transparent mix-blend-difference text-white">
        <Link href="/" className="text-[13px] font-medium hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
          Back
        </Link>
        <Link href="/" className=" font-serif">
          ATELIER ÓPTICA
        </Link>
        <div className="flex gap-5">
           <button className="text-[13px] font-medium hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>Cart(0)</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-24 lg:pt-40">
        <div className="mb-12 lg:mb-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#999] mb-4">Guía Exclusiva de Compra</p>
          <h1 className="text-3xl lg:text-5xl font-normal tracking-tight mb-6 lg:mb-8">El arte de elegir tus cristales</h1>
          <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed max-w-xl mx-auto">
            Tu visión merece el mismo nivel de precisión que una pieza de <strong>joyería artesanal</strong>. Descubrí nuestra selección de materiales premium para optimizar tu vista, logrando un <strong>diseño exclusivo</strong> para cada armazón en el corazón de <strong>Córdoba</strong>.
          </p>
        </div>

        <div className="space-y-12 lg:space-y-16">
          <section className="border-t border-black/10 pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">Encontrá el Cristal Perfecto</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-8">
               <div className="border border-black/10 p-6 lg:p-8">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Monofocal</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Ideales para corregir miopía, hipermetropía o astigmatismo. Ya sea que recorras <strong>Nueva Córdoba</strong> o leas tu libro favorito, vas a disfrutar de una nitidez impecable en un solo campo visual.</p>
               </div>
               <div className="border border-black/10 p-6 lg:p-8">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Bifocal</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Combinan visión lejana y de cerca con alta durabilidad. Una opción tradicional, tallada con la precisión de un orfebre, perfecta para acompañarte en tus rutinas diarias.</p>
               </div>
               <div className="sm:col-span-2 border border-black/10 p-6 lg:p-8">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Multifocal</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed max-w-2xl">La tecnología óptica más avanzada. Ofrece una transición invisible entre visión lejana, intermedia y cercana. Imprescindibles después de los 40 años para quienes buscan una experiencia fluida, sin saltos visuales.</p>
               </div>
            </div>
          </section>

          <section className="border-t border-black/10 pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">Tratamientos Premium para tu Visión</h2>
            <div className="grid grid-cols-1 gap-4 lg:gap-6">
               <div className="p-6 lg:p-8 bg-[#f9f9f9]">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Antirreflex (AR)</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Elimina los reflejos artificiales. Tu mirada va a destacar libre de brillos, tan nítida como las <strong>piedras naturales</strong>. Además, reduce la fatiga visual al manejar de noche por el <strong>Cerro de las Rosas</strong> o las rutas cordobesas.</p>
               </div>
               <div className="p-6 lg:p-8 bg-[#f9f9f9]">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Filtro Azul</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Bloquea la luz nociva de pantallas y monitores. Si pasás horas frente a la computadora, este tratamiento es vital para cuidar tu vista y prevenir el insomnio al final de cada jornada de trabajo.</p>
               </div>
               <div className="p-6 lg:p-8 bg-[#f9f9f9]">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3">Lentes de Sol a Medida</h3>
                  <p className="text-[13px] text-[#666] leading-relaxed">Transformamos tus cristales recetados en gafas de sol de excelencia. Disfrutá de protección UV total y lucí un estilo único bajo el sol deslumbrante de las sierras de Córdoba.</p>
               </div>
            </div>
          </section>
        </div>

        <div className="mt-16 lg:mt-20 p-8 lg:p-12 border border-black text-center">
          <h3 className="text-xl font-medium mb-3">¿Tenés dudas sobre tu receta médica?</h3>
          <p className="text-[14px] text-[#666] mb-8">Nuestros especialistas en óptica están en línea para brindarte asesoramiento personalizado. Estamos en <strong>Córdoba</strong>, listos para guiarte hacia la mejor decisión.</p>
          <a href={`https://wa.me/${WHATSAPP_PHONE}`} target="_blank" rel="noopener noreferrer" className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:opacity-70 transition-all duration-300 transition-opacity">Hablar con Asesor Técnico</a>
        </div>
      </main>
    </div>
  );
}
