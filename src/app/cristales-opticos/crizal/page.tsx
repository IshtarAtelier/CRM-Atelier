import Link from "next/link";
import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";

export const metadata: Metadata = {
  title: "Crizal Tratamientos Antirreflejo | Atelier Óptica",
  description: "Descubrí la familia Crizal de Essilor: Sapphire HR, Rock, Prevencia. Tratamientos antirreflejo para mayor claridad y extrema resistencia.",
  keywords: "Crizal, Antirreflejo, Sapphire, Rock, Prevencia, Cristales, Lentes Limpias, Protección, Óptica, Atelier",
};

export default function CrizalPage() {
  return (
    <div className="bg-[#faf8f5]">
      <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Tratamientos Premium Essilor</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Crizal · Tratamientos
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            El escudo invisible para tus ojos y tus lentes.
            <br className="hidden md:block" />
            La tecnología Crizal® no es solo un &quot;antirreflejo&quot;. Es un sistema integral que actúa contra los 5 enemigos de la claridad: <strong>reflejos, rayas, suciedad, polvo y agua</strong>.
          </p>
        </div>
      </section>

      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">✨</span>
            <div>
              <h4 className="text-white font-bold text-sm">Transparencia</h4>
              <p className="text-white/60 text-xs mt-0.5">Visión sin reflejos parásitos</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🛡️</span>
            <div>
              <h4 className="text-white font-bold text-sm">Resistencia Rock</h4>
              <p className="text-white/60 text-xs mt-0.5">Soporta el rigor del uso diario</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">💦</span>
            <div>
              <h4 className="text-white font-bold text-sm">Hidrofóbico</h4>
              <p className="text-white/60 text-xs mt-0.5">Repele el agua y la grasa facial</p>
            </div>
          </div>
        </div>
      </div>

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Conocé la Familia Crizal</h2>
            <p className="text-black/60 text-lg">
              Dependiendo de tu ritmo de vida y exigencias visuales, existe una tecnología Crizal específica para vos.
            </p>
          </div>

          <AccordionItem 
            title="Crizal Sapphire™ HR" 
            subtitle="La mayor transparencia. Invisible desde todos los ángulos."
            defaultOpen={true}
          >
            <p className="mb-4">
              <strong>Crizal Sapphire HR</strong> es la joya de la corona en antirreflejos. Utiliza tecnología de mitigación de luz Multi-Angular para reducir los reflejos sin importar de dónde venga la luz (frente, laterales o por detrás).
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>Invisibilidad:</strong> El cristal parece desaparecer del armazón, resaltando tus ojos.</li>
              <li><strong>High Resistance (HR):</strong> Combina la transparencia absoluta con una capa ultra-resistente contra rayas (derivada de la industria aeroespacial).</li>
              <li><strong>Visión nocturna:</strong> Elimina dramáticamente los halos de luz de los faros de los autos al conducir de noche.</li>
            </ul>
            <p className="text-sm bg-[#faf8f5] p-4 rounded-lg border border-[#e8e2db]">
              <strong>Recomendación Atelier:</strong> Ideal para creadores de contenido, conductores nocturnos y personas que buscan estética premium sin compromisos.
            </p>
          </AccordionItem>

          <AccordionItem 
            title="Crizal Rock™" 
            subtitle="Extrema resistencia a rayas y manchas."
          >
            <p className="mb-4">
              La vida real está llena de accidentes: limpiar los anteojos con la remera, que se caigan sobre la mesa o que los toquen los niños. <strong>Crizal Rock</strong> está diseñado específicamente para ser la lente de Essilor más resistente a los rasguños y las manchas.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Sometido a rigurosos &quot;Torture Tests&quot; (test de arena, test de sacudidas, test de lavado intenso).</li>
              <li>Posee óxidos específicos en sus capas que triplican la durabilidad frente al desgaste diario.</li>
              <li>Capacidad superior de repelencia de suciedad y grasa (dedos).</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Crizal Prevencia®" 
            subtitle="Protección avanzada contra la luz azul-violeta."
          >
            <p className="mb-4">
              El pionero en filtrado selectivo. <strong>Crizal Prevencia</strong> utiliza tecnología <em>Light Scan</em> para bloquear la luz azul-violeta nociva (emitida por el sol y las pantallas LED) mientras deja pasar la luz azul-turquesa esencial para el ciclo del sueño y el bienestar.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Reduce el índice de muerte celular retiniana en un 25%.</li>
              <li>Reflejo característico púrpura/violeta suave en el frente del cristal.</li>
              <li>Excelente opción para protección integral en oficinas iluminadas.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Crizal Easy Pro" 
            subtitle="El estándar de limpieza y protección."
          >
            <p className="mb-4">
              <strong>Crizal Easy Pro</strong> es la base de la línea premium. Un excelente tratamiento antirreflejo que se destaca por su recubrimiento &quot;Top Coat&quot; hidrofóbico y oleofóbico superior.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Las gotas de agua resbalan en forma esférica sin dejar rastros.</li>
              <li>Facilita enormemente el proceso de limpieza diaria.</li>
              <li>Elimina los molestos reflejos frontales básicos.</li>
            </ul>
          </AccordionItem>
        </div>
      </section>

      <section className="w-full bg-white py-24 px-6 border-t border-[#e8e2db]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">¿Por qué rechazar un Antirreflejo Genérico?</h2>
          <p className="text-lg text-black/70 mb-10 leading-relaxed">
            Los antirreflejos baratos suelen rayarse en pocos meses, descascararse o ensuciarse constantemente (dejando una película grasosa difícil de quitar). 
            <br className="mt-4" />
            Un tratamiento <strong>Crizal Original</strong> se fusiona a nivel molecular con el cristal y viene con su <strong>Certificado de Autenticidad</strong>. Es una inversión que preserva tus cristales recetados durante años.
          </p>
          <Link 
            href={`/contacto?motivo=${encodeURIComponent("Consulta técnica Tratamiento Crizal")}`}
            className="inline-block bg-[#283f5a] hover:bg-[#1e3047] text-white px-10 py-4 rounded-full font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Cotizar tratamiento Crizal
          </Link>
        </div>
      </section>
    </div>
  );
}
