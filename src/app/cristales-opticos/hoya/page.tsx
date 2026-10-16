import { Metadata } from "next";
import Link from "next/link";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";

/**
 * Ficha de Hoya (y Pentax, que es de Hoya Vision Care). Pedido de Ishtar,
 * 16/10/2026. El detalle modelo por modelo vive en /blog/cristales-hoya;
 * la promo es la de src/lib/promo-segundo-par-hoya.ts (80% en el 2º par).
 */
export const metadata: Metadata = {
  alternates: { canonical: '/cristales-opticos/hoya' },
  title: "Cristales Hoya y Pentax",
  description: "Multifocales Hoya iD LifeStyle 4, Summit, Array 2 y Argos, monofocales Nulux y Sync III, ocupacional Tact y Pentax Allfocus. Segundo par con 80% de descuento.",
  keywords: "Hoya, iD LifeStyle 4, Array 2, Summit, Argos, Sync III, Nulux, Tact, Pentax Allfocus, multifocales, Córdoba, Atelier",
};

export default function HoyaPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero
        preTitle="Ingeniería óptica japonesa"
        title="Cristales Hoya"
        description={
          <>
            Desde 1941 en Tokio, Hoya es uno de los grandes fabricantes de cristales del mundo.
            <br className="hidden md:block" />
            Progresivos con <strong>armonización binocular</strong>, monofocales personalizados y lentes para pantallas, más la línea <strong>Pentax</strong>, que también es de Hoya.
          </>
        }
      />

      <CristalFeatures
        features={[
          { icon: "👓", title: "Armonización binocular", subtitle: "Cada cristal calculado según su ojo" },
          { icon: "🎯", title: "Tallado free-form", subtitle: "Personalizado a tu receta y armazón" },
          { icon: "🎁", title: "2º par con 80% off", subtitle: "En progresivos seleccionados" },
        ]}
      />

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Familia de productos Hoya</h2>
            <p className="text-black/60 text-lg">De la presbicia a las pantallas, un cristal para cada uso.</p>
          </div>

          <AccordionItem title="Progresivos Hoya" subtitle="iD LifeStyle 4, Summit, Array 2, Argos y Mi Primer Hoya." defaultOpen={true}>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>iD LifeStyle 4:</strong> el más completo. Suma 3D Binocular Vision, Integrated Dual Surface y armonización binocular, con seis largos de corredor y diseño según tu estilo de vida.</li>
              <li><strong>Summit:</strong> clásico de Hoya con tallado BKS, campos amplios.</li>
              <li><strong>Array 2:</strong> el más versátil, en casi cualquier material, y apto para armazones bajos.</li>
              <li><strong>Argos:</strong> la puerta de entrada a los progresivos Hoya.</li>
              <li><strong>Mi Primer Hoya:</strong> versiones de Array y Summit para quien estrena multifocales.</li>
            </ul>
          </AccordionItem>

          <AccordionItem title="Monofocales y ocupacionales" subtitle="Nulux iDentity V+, Sync III, Tact y Visión Simple Digital.">
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>Nulux iDentity V+:</strong> monofocal free-form bi-asférico, calculado según tu armazón y tus medidas.</li>
              <li><strong>Sync III:</strong> alivia la fatiga por pantallas. Para 13 a 45 años con 2 horas o más por día de pantalla.</li>
              <li><strong>Tact:</strong> ocupacional para la compu y el escritorio, con zonas intermedia y de cerca muy anchas.</li>
              <li><strong>Visión Simple Digital:</strong> el monofocal digital para todos los días.</li>
            </ul>
          </AccordionItem>

          <AccordionItem title="Pentax Allfocus y Pentax Office" subtitle="La otra marca de Hoya Vision Care.">
            <p className="mb-4">
              Los cristales Pentax son de Hoya desde 2008 (nada que ver con las cámaras).
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>Allfocus Flex:</strong> para quien empieza con progresivos o busca más comodidad.</li>
              <li><strong>Allfocus Pro:</strong> máxima comodidad en todas las distancias.</li>
              <li><strong>Pentax Office:</strong> ocupacional para quien pasa muchas horas en la oficina.</li>
            </ul>
          </AccordionItem>

          <AccordionItem title="Promo: segundo par con 80% de descuento" subtitle="Progresivos Hoya y Pentax Allfocus.">
            <p className="mb-4">
              Comprando un progresivo Hoya iD LifeStyle 4, Array 2, Summit o Argos, o un Pentax Allfocus, el segundo par del mismo diseño (igual o menor valor) o un ocupacional Tact lleva <strong>80% de descuento</strong>. Mi Primer Hoya no participa.
            </p>
          </AccordionItem>

          <p className="text-center mt-10 text-stone-700">
            ¿Querés el detalle modelo por modelo?{" "}
            <Link href="/blog/cristales-hoya" className="underline font-bold">Leé la guía de cristales Hoya</Link>{" "}
            o la de <Link href="/blog/cristales-pentax-allfocus" className="underline font-bold">Pentax Allfocus</Link>.
          </p>
        </div>
      </section>

      <CristalCTA
        pathname="/cristales-opticos/hoya"
        title="¿Hoya es para vos?"
        description={
          <>
            Traé tu receta y te comparamos <strong>Hoya</strong> con las otras marcas que trabajamos, según tu graduación, tu armazón y lo que hacés en el día.
          </>
        }
        buttonText="Cotizar mis cristales Hoya"
        whatsappMotivo="Cotización cristales Hoya"
      />
    </div>
  );
}
