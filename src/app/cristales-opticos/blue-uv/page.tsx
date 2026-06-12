import Link from "next/link";
import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";

export const metadata: Metadata = {
  title: "Blue UV Filter System | Atelier Óptica",
  description: "Filtro de luz azul en la masa del cristal. Protección sin reflejos estéticos indeseados. Evita el envejecimiento celular retiniano y la fatiga digital.",
  keywords: "Blue UV, Filtro Azul, Pantallas, Protección UV, Blue UV Capture, Cristales, Óptica, Atelier",
};

export default function BlueUvPage() {
  return (
    <div className="bg-[#faf8f5]">
      <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Higiene Visual Digital</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Blue UV Filter System
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            El fin de los reflejos azules antiestéticos.
            <br className="hidden md:block" />
            Atrás quedaron los antiguos filtros &quot;Blue Cut&quot; que hacían que tus cristales se vieran azules y el mundo amarillento. La nueva tecnología <strong>Blue UV Capture</strong> de Essilor protege tu retina manteniendo el lente estéticamente translúcido.
          </p>
        </div>
      </section>

      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">📱</span>
            <div>
              <h4 className="text-white font-bold text-sm">Filtro Selectivo</h4>
              <p className="text-white/60 text-xs mt-0.5">Bloquea solo la luz nociva azul-violeta</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🌙</span>
            <div>
              <h4 className="text-white font-bold text-sm">Ciclo Circadiano</h4>
              <p className="text-white/60 text-xs mt-0.5">Deja pasar la luz azul-turquesa beneficiosa</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">💎</span>
            <div>
              <h4 className="text-white font-bold text-sm">Transparencia</h4>
              <p className="text-white/60 text-xs mt-0.5">Sin el molesto tono azul superficial</p>
            </div>
          </div>
        </div>
      </div>

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Por qué es superior al Blue Cut genérico?</h2>
            <p className="text-black/60 text-lg">
              La innovación técnica radica en *dónde* está ubicado el filtro de protección.
            </p>
          </div>

          <AccordionItem 
            title="La diferencia clave: En Masa vs Superficie" 
            subtitle="Por qué tus ojos se ven mejor."
            defaultOpen={true}
          >
            <p className="mb-4">
              En los filtros azules tradicionales (genéricos), la protección se aplica como una &quot;pintura&quot; de antirreflejo en la capa exterior del cristal. Esto hace que reboten luces azules brillantes todo el tiempo (notorio en selfies o videollamadas) y daña la estética del lente.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>La revolución Blue UV Capture:</strong> Essilor inyecta moléculas absorbedoras directamente en la *masa fundida del monómero* (el material del cristal).</li>
              <li>El cristal absorbe la luz azul en su interior como una esponja, en lugar de hacerla rebotar.</li>
              <li>El resultado es un lente prácticamente sin tintes, logrando una estética natural donde la gente ve tus ojos y no un espejo azul.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Toxicidad Lumínica: Azul-Violeta vs Turquesa" 
            subtitle="Protección Inteligente Selectiva."
          >
            <p className="mb-4">
              No toda la luz azul es mala. Los filtros viejos bloquean toda la luz azul de manera plana. 
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>Luz Azul-Violeta (415-455nm):</strong> Emitida fuertemente por pantallas y luces LED. Es altamente tóxica para las células de la retina y contribuye a la fatiga visual. <em>Esta línea es la que bloquea Blue UV</em>.</li>
              <li><strong>Luz Azul-Turquesa (465-495nm):</strong> Vital para la vida humana. Regula los reflejos pupilares, nuestra memoria, estado de ánimo y el reloj biológico (ciclo del sueño). <em>Blue UV la deja pasar intacta</em>.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="El Combo Perfecto: Sumale Crizal" 
            subtitle="El cristal definitivo de escritorio."
          >
            <p className="mb-4">
              Dado que Blue UV Capture está &quot;adentro&quot; del material del lente, deja libre la superficie para aplicarle el tratamiento que vos elijas.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Al sumarle un tratamiento <strong>Crizal Sapphire HR</strong> en la superficie, obtenés un lente que frena el daño interno retiniano (gracias a la masa) y además corta los reflejos de las luces del techo y el monitor (gracias al antirreflejo).</li>
              <li>Es el estándar de oro médico actual para quienes trabajan +8 horas frente a una computadora.</li>
            </ul>
          </AccordionItem>
        </div>
      </section>

      <section className="w-full bg-white py-24 px-6 border-t border-[#e8e2db]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Terminá tu día de trabajo sin agotamiento</h2>
          <p className="text-lg text-black/70 mb-10 leading-relaxed">
            Sentir los ojos ardientes o pesados después de la jornada laboral no es normal, es fatiga inducida. Al filtrar la parte nociva del espectro y relajar la acomodación ocular, tu rendimiento cambiará por completo.
          </p>
          <Link 
            href={`/contacto?motivo=${encodeURIComponent("Consulta por cristales Blue UV para pantallas")}`}
            className="inline-block bg-[#283f5a] hover:bg-[#1e3047] text-white px-10 py-4 rounded-full font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Proteger mis ojos hoy
          </Link>
        </div>
      </section>
    </div>
  );
}
