import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";

export const metadata: Metadata = {
  alternates: { canonical: '/cristales-opticos/eyezen' },
  title: "Eyezen | Cristales Monofocales Essilor",
  description: "Eyezen de Essilor: el monofocal pensado para la vida digital. Boost de lectura, filtro de luz azul de fábrica y menos fatiga visual frente a las pantallas.",
  keywords: "Eyezen, Essilor, Cristales Monofocales, Lentes de Descanso, Fatiga Visual, Óptica, Atelier",
};

export default function EyezenPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero
        preTitle="Monofocal · Essilor"
        title="Eyezen"
        description={
          <>
            El monofocal que fue reinventado para pantallas.
            <br className="hidden md:block" />
            No es un lente de descanso genérico: es un cristal de visión sencilla con un leve <strong>boost</strong> de potencia en la parte inferior, pensado para relajar el ojo durante horas de celular, notebook y trabajo de cerca.
          </>
        }
      />

      <CristalFeatures
        features={[
          { icon: "📲", title: "Eyezen Focus", subtitle: "Boost de lectura que relaja el enfoque cercano" },
          { icon: "🔵", title: "Blue UV Capture", subtitle: "Filtro de luz azul incluido de fábrica" },
          { icon: "👁️", title: "Sin receta especial", subtitle: "Válido con o sin miopía/astigmatismo" },
        ]}
      />

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Cuatro versiones, una para cada estilo de vida</h2>
            <p className="text-black/60 text-lg">
              En Atelier trabajamos las variantes Start, Boost y Kids según cuánto tiempo pasás frente a una pantalla.
            </p>
          </div>

          <AccordionItem
            title="Eyezen Start / Boost"
            subtitle="La potencia se ajusta a tu rutina digital."
            defaultOpen={true}
          >
            <p className="mb-4">
              Ambas versiones son cristales monofocales de visión sencilla con boost de lectura, la diferencia está en la intensidad del refuerzo:
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>Eyezen Start:</strong> boost más suave, ideal para quienes usan pantallas de forma moderada durante el día.</li>
              <li><strong>Eyezen Boost:</strong> mayor refuerzo, pensado para quienes trabajan 8 horas o más frente a una computadora.</li>
              <li>Disponibles en material Orma (estándar) o Airwear 1.59, y también con Stylis 1.67 para recetas más altas.</li>
            </ul>
          </AccordionItem>

          <AccordionItem
            title="Eyezen Kids"
            subtitle="Protección digital desde la infancia."
          >
            <p className="mb-4">
              Chicos y adolescentes pasan cada vez más horas frente a pantallas para estudiar y jugar. Eyezen Kids aporta el mismo filtro Blue UV Capture y el boost de lectura adaptado a ojos en desarrollo.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Reduce la fatiga visual asociada a tareas escolares con tablet o notebook.</li>
              <li>Se puede combinar con Transitions Gen S para sumar protección solar automática.</li>
            </ul>
          </AccordionItem>

          <AccordionItem
            title="Sumale Crizal y Transitions"
            subtitle="El combo completo de protección."
          >
            <p className="mb-4">
              Todos nuestros Eyezen se entregan con tratamiento antirreflejo Crizal, y podés sumarles fotocromático Transitions Gen S para que se oscurezcan al sol sin cambiar de anteojos.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Es la combinación que más recomendamos para quienes viven con el celular en la mano.</li>
              <li>Consultanos por tu graduación para saber qué variante de Eyezen te conviene.</li>
            </ul>
          </AccordionItem>
        </div>
      </section>

      <CristalCTA
        title="Descansá la vista sin dejar de mirar la pantalla"
        description={
          <>
            Si terminás el día con los ojos pesados o dolor de cabeza por el celular y la compu, Eyezen es el monofocal indicado. Contanos tu rutina y te asesoramos sobre qué versión elegir.
          </>
        }
        buttonText="Quiero probar Eyezen"
        whatsappMotivo="Consulta por cristales Eyezen monofocales"
      />
    </div>
  );
}
