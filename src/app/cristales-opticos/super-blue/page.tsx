import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";

export const metadata: Metadata = {
  alternates: { canonical: '/cristales-opticos/super-blue' },
  title: "Super Blue 1.60 | Cristal Monofocal Asférico Antirreflejo",
  description: "Orgánico Super Blue asférico 1.60 con antirreflejo: cristal monofocal más fino y liviano que el estándar, con filtro de luz azul para pantallas.",
  keywords: "Super Blue, 1.60, Cristal Monofocal, Asférico, Antirreflejo, Filtro Luz Azul, Óptica, Atelier",
};

export default function SuperBluePage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero
        preTitle="Monofocal · Alto Índice"
        title="Super Blue 1.60"
        description={
          <>
            El paso natural desde el antirreflejo común.
            <br className="hidden md:block" />
            Cristal orgánico <strong>asférico de índice 1.60</strong>, más fino y liviano que el estándar 1.50, con antirreflejo y filtro de luz azul incluidos en el mismo tratamiento.
          </>
        }
      />

      <CristalFeatures
        features={[
          { icon: "✨", title: "Índice 1.60", subtitle: "Más fino que el orgánico estándar 1.50" },
          { icon: "🔷", title: "Diseño Asférico", subtitle: "Menos distorsión y aro más plano" },
          { icon: "🔵", title: "Filtro Blue", subtitle: "Antirreflejo + protección de luz azul" },
        ]}
      />

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Por qué elegir 1.60 en vez del antirreflejo común?</h2>
            <p className="text-black/60 text-lg">
              A mayor índice, el cristal comprime más luz en menos espacio: el resultado es un lente más delgado, más liviano y más estético en la montura.
            </p>
          </div>

          <AccordionItem
            title="Asférico: menos aumento visible"
            subtitle="Un armado más plano, sobre todo en graduaciones medias."
            defaultOpen={true}
          >
            <p className="mb-4">
              El diseño asférico aplana la curvatura del cristal respecto de un esférico tradicional, por lo que el ojo se ve menos aumentado o achicado detrás de la lente y el borde queda más fino.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Ideal para monturas medianas a grandes, donde un 1.50 estándar quedaría demasiado grueso.</li>
              <li>Mejora la estética general del anteojo sin necesidad de saltar a un índice 1.67.</li>
            </ul>
          </AccordionItem>

          <AccordionItem
            title="Filtro de luz azul incluido"
            subtitle="Un solo tratamiento, dos protecciones."
          >
            <p className="mb-4">
              El Super Blue suma protección contra la luz azul-violeta de pantallas y LED al mismo antirreflejo de superficie, sin necesidad de pedir un tratamiento aparte.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Pensado para quien usa pantallas a diario pero no necesita el boost de lectura de Eyezen.</li>
              <li>Buena opción intermedia entre el antirreflejo común y las líneas premium Essilor.</li>
            </ul>
          </AccordionItem>

          <AccordionItem
            title="¿Cuándo conviene sumar más índice?"
            subtitle="Guía rápida según tu graduación."
          >
            <p className="mb-4">
              Como referencia general en Atelier: recetas bajas se ven bien en 1.60, mientras que miopías o astigmatismos altos suelen beneficiarse de un 1.67.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Traé tu receta y te mostramos cómo se vería en distintos índices antes de elegir montura.</li>
            </ul>
          </AccordionItem>
        </div>
      </section>

      <CristalCTA
        title="Un cristal más fino, sin cambiar de presupuesto drásticamente"
        description={
          <>
            El Super Blue 1.60 es el paso lógico cuando el antirreflejo común te queda demasiado grueso en la montura. Contanos tu graduación y te confirmamos si es la mejor opción para vos.
          </>
        }
        buttonText="Consultar por Super Blue 1.60"
        whatsappMotivo="Consulta por cristal Super Blue 1.60"
      />
    </div>
  );
}
