import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";

export const metadata: Metadata = {
  alternates: { canonical: '/cristales-opticos/policarbonato' },
  title: "HD 1.67 Poli | Cristal Monofocal Irrompible",
  description: "HD MR7 Asférico: cristal monofocal de Policarbonato, índice 1.67, con tratamiento SHMC, filtro UV420 y luz azul. Irrompible y ultra liviano, ideal para chicos, deporte y recetas altas.",
  keywords: "HD 1.67, Poli, Policarbonato, MR7, Cristal Monofocal, Irrompible, UV420, Blue, Óptica, Atelier",
};

export default function PolicarbonatoPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero
        preTitle="Monofocal · Alto Índice"
        title="HD 1.67 Poli"
        description={
          <>
            El monofocal para cuando la resistencia es prioridad.
            <br className="hidden md:block" />
            Línea <strong>HD MR7 Asférico</strong>, en Policarbonato índice 1.67, con tratamiento SHMC, filtro UV420 y luz azul. Hasta 10 veces más resistente al impacto que un orgánico común, y notablemente más fino y liviano.
          </>
        }
      />

      <CristalFeatures
        features={[
          { icon: "🛡️", title: "Irrompible", subtitle: "Resistencia al impacto muy superior al orgánico" },
          { icon: "🪶", title: "Índice 1.67", subtitle: "Fino y ultra liviano incluso en recetas altas" },
          { icon: "☀️", title: "UV420 + Blue", subtitle: "Protección solar total y filtro de luz azul" },
        ]}
      />

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Para quién es el HD 1.67 Poli?</h2>
            <p className="text-black/60 text-lg">
              Combina la mayor resistencia del mercado con uno de los índices más altos disponibles en monofocal.
            </p>
          </div>

          <AccordionItem
            title="Máxima resistencia al impacto"
            subtitle="El material que eligen chicos y deportistas."
            defaultOpen={true}
          >
            <p className="mb-4">
              El Policarbonato es un material de origen aeroespacial, prácticamente irrompible ante golpes o caídas. Es la opción que más recomendamos para anteojos de niños y para quienes practican deporte con receta.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Reduce drásticamente el riesgo de que el cristal se astille o quiebre ante un golpe.</li>
              <li>Ideal también para monturas sin marco (al aire), donde el cristal queda más expuesto.</li>
            </ul>
          </AccordionItem>

          <AccordionItem
            title="Índice 1.67: fino a pesar de ser irrompible"
            subtitle="El mejor equilibrio entre seguridad y estética."
          >
            <p className="mb-4">
              Además de resistente, el Policarbonato es liviano de por sí. En índice 1.67 el resultado es un cristal fino y con muy bajo peso, cómodo incluso en recetas de miopía o astigmatismo elevadas.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Terminación asférica SHMC (superficie endurecida y multicapa) para mayor durabilidad.</li>
              <li>Menor peso sobre la nariz y las orejas, especialmente notable en monturas grandes.</li>
            </ul>
          </AccordionItem>

          <AccordionItem
            title="Protección UV420 y filtro Blue"
            subtitle="Un solo cristal, protección completa."
          >
            <p className="mb-4">
              El Policarbonato bloquea de forma natural una porción muy alta de la radiación UV, y esta versión suma además filtro de luz azul para uso frente a pantallas.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Recomendado especialmente para anteojos infantiles, deportivos y de uso intensivo.</li>
              <li>Consultanos tu graduación para confirmar disponibilidad en tu montura.</li>
            </ul>
          </AccordionItem>
        </div>
      </section>

      <CristalCTA
        title="Resistencia real para el día a día"
        description={
          <>
            Si buscás un anteojo que aguante caídas, deporte o el uso diario de los más chicos, el HD 1.67 Poli es la opción más segura. Contanos para quién es y te asesoramos.
          </>
        }
        buttonText="Consultar por HD 1.67 Poli"
        whatsappMotivo="Consulta por cristal HD 1.67 Poli"
      />
    </div>
  );
}
