import Link from "next/link";
import { WHATSAPP_PHONE } from '@/lib/constants';

export default function MyopiaControlPage() {
  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white pb-20">
      
      {/* HEADER MINIMALISTA ESTILO GM */}
      <header className="fixed top-0 w-full z-50 px-5 py-4 flex justify-between items-center bg-transparent mix-blend-difference text-white">
        <Link href="/blog" className="text-[13px] font-medium hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
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
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#999] mb-4">Salud Visual e Innovación</p>
          <h1 className="text-3xl lg:text-5xl font-normal tracking-tight mb-6 lg:mb-8">Control de Miopía: La revolución del desenfoque periférico</h1>
          <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed max-w-xl mx-auto">
            La miopía ya no es solo un problema de corrección visual; es un desafío global. Descubrí cómo la tecnología de cristales Essilor Stellest con desenfoque periférico está cambiando el futuro visual de niños y adultos jóvenes.
          </p>
        </div>

        {/* Hero Image */}
        <div className="w-full h-64 md:h-[400px] relative mb-12 lg:mb-16 bg-stone-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/images/blog/vidriera-atelier.jpg" 
            alt="Interior de Atelier Óptica" 
            className="w-full h-full object-cover" 
          />
        </div>

        <div className="space-y-12 lg:space-y-16">
          {/* Secciones del artículo */}
          <section className="border-t border-[#e5e5e5] pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">¿Qué es el Desenfoque Periférico?</h2>
            <div className="p-6 lg:p-8 border border-[#e5e5e5] relative overflow-hidden">
                <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed mb-6">
                Históricamente, los cristales monofocales tradicionales se han limitado a corregir la visión central, enfocando la luz directamente en la retina. Sin embargo, esto puede generar un "desenfoque hipermetrópico" en la periferia del ojo, lo que paradójicamente estimula su elongación y el aumento de la miopía.
                </p>
                <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed">
                La innovación de Essilor con su tecnología <strong>H.A.L.T. (Highly Aspherical Lenslet Target)</strong> introduce una constelación de microlentillas invisibles. Estas crean un volumen de luz no enfocada frente a la retina periférica, enviando una señal clara al ojo: detener su alargamiento anormal.
                </p>
            </div>
          </section>

          <section className="border-t border-[#e5e5e5] pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">Eficacia Clínica en Niños</h2>
            <div className="p-6 lg:p-8 bg-[#f9f9f9] relative overflow-hidden">
                <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed mb-6">
                El desarrollo visual en la etapa infantil es crítico. Cuando la miopía aparece de forma temprana, su progresión suele ser rápida, aumentando el riesgo de patologías oculares graves en el futuro.
                </p>
                <ul className="list-disc list-inside text-[14px] lg:text-[15px] text-[#666] leading-relaxed space-y-3">
                  <li><strong>Ralentización demostrada:</strong> Estudios clínicos indican que el uso constante (12 horas al día) de cristales Essilor Stellest ralentiza la progresión de la miopía en un promedio de 67% comparado con lentes estándar.</li>
                  <li><strong>Adaptación inmediata:</strong> A pesar de su compleja estructura óptica, los niños se adaptan visual y estéticamente en tiempo récord, ya que las microlentillas son imperceptibles.</li>
                  <li><strong>Estabilidad:</strong> Contribuye a un desarrollo ocular más saludable y seguro.</li>
                </ul>
            </div>
          </section>

          <section className="border-t border-[#e5e5e5] pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">¿El tratamiento es válido para adultos?</h2>
            <div className="p-6 lg:p-8 border border-[#e5e5e5] relative overflow-hidden">
                <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed mb-6">
                Si bien el objetivo principal de la tecnología H.A.L.T. es intervenir durante la etapa de crecimiento ocular infantil (entre los 6 y 14 años), el concepto de control de miopía ha despertado un gran interés en la población adulta joven.
                </p>
                <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed">
                En casos de adultos jóvenes cuya miopía continúa experimentando una progresión activa y poco habitual, los especialistas evalúan el uso de lentes con desenfoque periférico. Aunque la evidencia clínica es más fuerte en niños, frenar la elongación axial sigue siendo un principio válido y prometedor bajo supervisión optométrica y oftalmológica rigurosa, complementando hábitos como la reducción de la fatiga digital.
                </p>
            </div>
          </section>

        </div>

        <div className="mt-16 lg:mt-20 p-8 lg:p-12 border border-black text-center">
          <h3 className="text-xl font-medium mb-3">Evaluación Especializada en Atelier</h3>
          <p className="text-[14px] text-[#666] mb-8">La gestión de la miopía requiere de un diagnóstico preciso y seguimiento constante. Agendá una consulta con nuestro equipo para evaluar si la tecnología Essilor es la indicada para vos o para tu hijo.</p>
          <a href={`https://wa.me/${WHATSAPP_PHONE}`} target="_blank" rel="noopener noreferrer" className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity">Coordinar Asesoramiento</a>
        </div>
      </main>
    </div>
  );
}
