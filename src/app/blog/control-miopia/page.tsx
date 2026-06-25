import { Metadata } from 'next';
import Link from "next/link";
import { WHATSAPP_PHONE } from '@/lib/constants';
import Image from "next/image";


export const metadata: Metadata = {
  alternates: { canonical: '/blog/control-miopia' },
  title: "Control de Miopía en Córdoba | Cristales Stellest - Atelier Óptica",
  description: "Descubrí el revolucionario tratamiento de control de miopía con cristales Essilor Stellest en Córdoba. Asesoramiento en Cerro de las Rosas y Nueva Córdoba.",
  keywords: ["control de miopía Córdoba", "cristales Stellest Córdoba", "desenfoque periférico", "Essilor Stellest", "óptica Cerro de las Rosas", "óptica Nueva Córdoba", "salud visual infantil", "frenar miopía niños"],
};

export default function MyopiaControlPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-black font-sans selection:bg-black selection:text-white pb-20">
      
      {/* HEADER MINIMALISTA ESTILO GM */}
      <header className="fixed top-0 w-full z-50 px-5 py-4 flex justify-between items-center bg-transparent mix-blend-difference text-white">
        <Link href="/blog" className="text-[13px] font-medium hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
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
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#999] mb-4">Salud Visual e Innovación</p>
          <h1 className="text-3xl lg:text-5xl font-normal tracking-tight mb-6 lg:mb-8">Control de Miopía: La revolución del desenfoque periférico</h1>
          <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed max-w-xl mx-auto">
            La miopía ya no es solo un problema de corrección visual; es un desafío global. Descubrí cómo la tecnología de cristales <strong>Essilor Stellest</strong> con desenfoque periférico está cambiando el futuro visual de niños y adultos jóvenes en <strong>Córdoba</strong>.
          </p>
        </div>

        {/* Hero Image */}
        <div className="w-full h-64 md:h-[400px] relative mb-12 lg:mb-16 bg-stone-100 overflow-hidden">
          { }
          <Image unoptimized 
            src="/images/blog/vidriera-atelier.webp" 
            alt="Interior de Atelier Óptica" 
            className="w-full h-full object-cover"
            fill
            sizes="(max-width: 768px) 100vw, 800px" 
          />
        </div>

        <div className="space-y-12 lg:space-y-16">
          {/* Secciones del artículo */}
          <section className="border-t border-black/10 pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">¿Qué es el Desenfoque Periférico?</h2>
            <div className="p-6 lg:p-8 border border-black/10 relative overflow-hidden">
                <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed mb-6">
                Históricamente, los cristales monofocales tradicionales se limitaban a corregir la visión central, enfocando la luz directamente en la retina. Sin embargo, esto puede generar un &quot;desenfoque hipermetrópico&quot; en la periferia del ojo, lo que paradójicamente estimula su elongación y empeora la miopía.
                </p>
                <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed">
                La tecnología <strong>H.A.L.T. (Highly Aspherical Lenslet Target)</strong> de <strong>Essilor Stellest</strong> cambia las reglas del juego. Mediante una constelación de microlentillas invisibles, crea un volumen de luz no enfocada frente a la retina periférica. ¿El resultado? Envía una señal clara al ojo para detener su alargamiento anormal y proteger la salud visual a largo plazo.
                </p>
            </div>
          </section>

          <section className="border-t border-black/10 pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">Eficacia Clínica en Niños</h2>
            <div className="p-6 lg:p-8 bg-[#f9f9f9] relative overflow-hidden">
                <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed mb-6">
                El desarrollo visual infantil es crítico. Cuando la miopía aparece tempranamente, su progresión suele ser rápida, lo que aumenta el riesgo de futuras patologías oculares graves. Actuar a tiempo es la mejor inversión para los más chicos.
                </p>
                <ul className="list-disc list-inside text-[14px] lg:text-[15px] text-[#666] leading-relaxed space-y-3">
                  <li><strong>Freno demostrado:</strong> Ensayos clínicos revelan que usar los cristales <strong>Essilor Stellest</strong> al menos 12 horas diarias ralentiza la progresión de la miopía en un 67% promedio frente a los lentes tradicionales.</li>
                  <li><strong>Adaptación inmediata:</strong> A pesar de su ingeniería óptica avanzada, la adaptación visual y estética de los niños es asombrosa, dado que las microlentillas resultan completamente imperceptibles.</li>
                  <li><strong>Seguridad a largo plazo:</strong> Contribuyen activamente a un desarrollo ocular mucho más estable y saludable.</li>
                </ul>
            </div>
          </section>

          <section className="border-t border-black/10 pt-12">
            <h2 className="text-xl font-medium mb-6 lg:mb-8 text-center">¿El tratamiento es válido para adultos?</h2>
            <div className="p-6 lg:p-8 border border-black/10 relative overflow-hidden">
                <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed mb-6">
                Aunque el foco de la tecnología <strong>H.A.L.T.</strong> está puesto en la etapa de crecimiento ocular infantil (entre los 6 y 14 años), el control de la miopía capta cada vez más atención en la población adulta joven, especialmente en <strong>Córdoba</strong> y sus zonas universitarias como <strong>Nueva Córdoba</strong>, donde la exigencia visual frente a pantallas es constante.
                </p>
                <p className="text-[14px] lg:text-[15px] text-[#666] leading-relaxed">
                En casos de miopías que continúan progresando de forma inusual, frenar la elongación axial mediante el desenfoque periférico resulta un principio prometedor. Siempre bajo estricta supervisión de profesionales de la oftalmología, esta solución complementa hábitos preventivos fundamentales para el cuidado integral de los ojos.
                </p>
            </div>
          </section>

        </div>

        <div className="mt-16 lg:mt-20 p-8 lg:p-12 border border-black text-center">
          <h3 className="text-xl font-medium mb-3">Evaluación Especializada en Atelier Óptica</h3>
          <p className="text-[14px] text-[#666] mb-8">
            El control de la miopía exige un compromiso profesional. Acercate con tu receta médica a <strong>Atelier Óptica</strong> en el corazón de <strong>Cerro de las Rosas</strong> o contactanos desde cualquier punto de la ciudad de <strong>Córdoba</strong>. Nuestro equipo verificará, con la máxima precisión, si estos cristales son la opción ideal indicada por tu oftalmólogo.
          </p>
          <a href={`https://wa.me/${WHATSAPP_PHONE}`} target="_blank" rel="noopener noreferrer" className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:opacity-70 transition-all duration-300">Coordinar Asesoramiento</a>
        </div>
      </main>
    </div>
  );
}
