import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";

export const metadata: Metadata = {
  title: "Blue UV Filter System | Atelier Óptica",
  description: "Filtro de luz azul en la masa del cristal. Protección sin reflejos estéticos indeseados. Evita el envejecimiento celular retiniano y la fatiga digital.",
  keywords: "Blue UV, Filtro Azul, Pantallas, Protección UV, Blue UV Capture, Cristales, Óptica, Atelier",
};

export default function BlueUvPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero 
        preTitle="Higiene Visual Digital"
        title="Blue UV Filter System"
        description={
          <>
            El fin de los reflejos azules antiestéticos.
            <br className="hidden md:block" />
            Atrás quedaron los antiguos filtros &quot;Blue Cut&quot; que hacían que tus cristales se vieran azules y el mundo amarillento. La nueva tecnología <strong>Blue UV Capture</strong> de Essilor protege tu retina manteniendo el lente estéticamente translúcido.
          </>
        }
      />

      <CristalFeatures 
        features={[
          { icon: "📱", title: "Filtro Selectivo", subtitle: "Bloquea solo la luz nociva azul-violeta" },
          { icon: "🌙", title: "Ciclo Circadiano", subtitle: "Deja pasar la luz azul-turquesa beneficiosa" },
          { icon: "💎", title: "Transparencia", subtitle: "Sin el molesto tono azul superficial" },
        ]}
      />

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

      <CristalCTA 
        title="Terminá tu día de trabajo sin agotamiento"
        description={
          <>
            Sentir los ojos ardientes o pesados después de la jornada laboral no es normal, es fatiga inducida. Al filtrar la parte nociva del espectro y relajar la acomodación ocular, tu rendimiento cambiará por completo.
          </>
        }
        buttonText="Proteger mis ojos hoy"
        whatsappMotivo="Consulta por cristales Blue UV para pantallas"
      />
    </div>
  );
}
