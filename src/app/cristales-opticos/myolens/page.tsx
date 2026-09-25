import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";
import { GaleriaDiapositivas } from "@/components/cristales/GaleriaDiapositivas";
import { MYOLENS } from "@/lib/cristales/smart-lens";

export const metadata: Metadata = {
  alternates: { canonical: "/cristales-opticos/myolens" },
  title: "MyoLens · Monofocal para miopes de Smart Lens",
  description:
    "MyoLens de Smart Lens: el monofocal diseñado con inteligencia artificial solo para miopes. Visión precisa en todo el cristal, relajación para la visión de cerca y cristales más finos. Atelier Óptica, Córdoba.",
  keywords: "MyoLens, Smart Lens, lentes para miopes, monofocal miopía, Microcell Optimization, Córdoba, Atelier Óptica",
};

export default function MyoLensPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero
        preTitle="Monofocal para miopes"
        title="MyoLens · Smart Lens"
        description={
          <>
            Un monofocal común usa la misma geometría para un miope que para un hipermétrope. <strong>MyoLens</strong> no:
            está diseñado con inteligencia artificial solo para miopes, para que veas con la potencia justa en todo el
            cristal, con más confort de cerca y en un lente más fino.
          </>
        }
      />

      <section className="px-6">
        <div className="max-w-4xl mx-auto">
          <Image src={MYOLENS.portada.src} alt={MYOLENS.portada.alt} width={1580} height={890} priority sizes="(min-width: 896px) 896px, 100vw" className="w-full h-auto rounded-2xl shadow-lg" />
        </div>
      </section>

      <CristalFeatures
        features={[
          { icon: "🎯", title: "Precisión en todo el cristal", subtitle: "Microcell Optimization Tech" },
          { icon: "📱", title: "Relajación de cerca", subtitle: "Booster de potencia con IA" },
          { icon: "🪶", title: "Más fino y liviano", subtitle: "Geometría individualizada" },
        ]}
      />

      <section className="w-full py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">La paradoja del monofocal común</h2>
            <p className="text-stone-700 text-lg">
              En el centro, un cristal común tiene la graduación exacta. Hacia los bordes, por la curva del lente, la
              inclinación del armazón y la distancia al ojo, el miope termina recibiendo más potencia de la que necesita.
            </p>
          </div>
          <GaleriaDiapositivas diapositivas={MYOLENS.problema} credito="Láminas: Smart Lens." />

          <div className="text-center mt-16 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Lo que lo hace de avanzada</h2>
          </div>
          <GaleriaDiapositivas diapositivas={MYOLENS.tecnologia} />

          <AccordionItem title="¿Para quién es MyoLens?" subtitle="Miopes de cualquier edad." defaultOpen={true}>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Para cualquier persona miope, con o sin astigmatismo, que use anteojos todo el día.</li>
              <li>Especialmente para quien pasa muchas horas de cerca: lectura, computadora y celular.</li>
              <li>No es un tratamiento para frenar la miopía: para chicos con miopía en aumento está <Link href="/cristales-opticos/myofix" className="underline font-bold">MyoFix</Link>.</li>
            </ul>
          </AccordionItem>

          <AccordionItem title="Graduaciones, materiales y tratamientos" subtitle="De neutro a -12,00 y cilindro hasta -6,00.">
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>Rango:</strong> esfera hasta -12,00 y cilindro hasta -6,00 dioptrías.</li>
              <li><strong>Materiales:</strong> orgánico 1.5, orgánico 1.56, policarbonato 1.59, orgánico 1.61 y alto índice 1.67.</li>
              <li><strong>Incluye:</strong> protección UV, antirraya, antirreflejo y antiestático.</li>
              <li><strong>Opcionales:</strong> polarizado, fotosensible y BlueTech (filtro de luz azul).</li>
            </ul>
          </AccordionItem>

          <GaleriaDiapositivas diapositivas={[...MYOLENS.uso, ...MYOLENS.especificaciones]} />
          <GaleriaDiapositivas diapositivas={[MYOLENS.familia]} columnas={1} credito="MyoFix y MyoLens, la familia de Smart Lens para la miopía." />
        </div>
      </section>

      <CristalCTA
        pathname="/cristales-opticos/myolens"
        title="¿Sos miope y querés ver mejor todo el día?"
        description={<>Traé tu receta a Atelier y te contamos si MyoLens es para vos, con qué material y en cuánto tiempo lo tenés.</>}
        buttonText="Consultar por MyoLens"
        whatsappMotivo="Consulta sobre cristales MyoLens"
      />
    </div>
  );
}
