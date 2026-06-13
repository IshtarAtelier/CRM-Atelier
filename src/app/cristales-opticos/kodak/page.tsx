import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";

export const metadata: Metadata = {
  title: "Lentes Multifocales Kodak | Atelier Óptica",
  description: "Lentes multifocales Kodak Unique DRO y Kodak Precise. Transición suave, reducción de fatiga visual y adaptación rápida garantizada.",
  keywords: "Kodak, Unique DRO, Precise, Multifocales, Presbicia, Óptica, Atelier, Lentes progresivos",
};

export default function KodakPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero 
        preTitle="Precisión y Confort Visual"
        title="Multifocales Kodak"
        description={
          <>
            Una de las marcas más reconocidas del mundo óptico por su <strong>facilidad de adaptación</strong>.
            <br className="hidden md:block" />
            Descubrí la línea premium <strong>Kodak Unique DRO</strong> (Dynamic Reading Optimization) y el clásico <strong>Kodak Precise</strong>, diseñados para ofrecer campos visuales amplios y una transición natural entre visión lejana, intermedia y cercana.
          </>
        }
      />

      <CristalFeatures 
        features={[
          { icon: "📱", title: "Optimización de Lectura (DRO)", subtitle: "Diseñado para uso prolongado en pantallas" },
          { icon: "✨", title: "Vision First Design", subtitle: "Reduce distorsiones periféricas y mareos" },
          { icon: "🎯", title: "Tecnología Digital HD", subtitle: "Tallado digital personalizado" },
        ]}
      />

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Familia de Productos Kodak</h2>
            <p className="text-black/60 text-lg">
              Soluciones para cada etapa de la presbicia y estilo de vida.
            </p>
          </div>

          <AccordionItem 
            title="Kodak Unique DRO (Dynamic Reading Optimization)" 
            subtitle="El lente premium para la vida digital."
            defaultOpen={true}
          >
            <p className="mb-4">
              La tecnología DRO está específicamente diseñada para el mundo actual donde leemos constantemente en el celular. Este diseño <strong>optimiza significativamente la zona de lectura e intermedia</strong>, permitiendo un uso prolongado sin forzar la vista ni posturas incómodas del cuello.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Incrementa el área efectiva de lectura hasta un 17% en comparación con multifocales tradicionales.</li>
              <li>Reduce las distorsiones (aberraciones oblicuas) en un 54%, logrando una visión súper nítida.</li>
              <li>La versión <strong>HD (Alta Definición)</strong> se personaliza tomando en cuenta el ángulo de tu armazón y la forma en que calza en tu rostro.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="Kodak Precise y Precise Short" 
            subtitle="La transición más suave del mercado."
          >
            <p className="mb-4">
              Reconocido mundialmente por ser uno de los multifocales más fáciles para adaptarse. Utiliza la tecnología <em>Vision First Design™</em>, la cual calcula las propiedades ópticas ideales para cada punto del cristal, eliminando el clásico &quot;efecto de balanceo&quot; o mareo que causan los multifocales antiguos.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>Kodak Precise:</strong> Diseñado para armazones estándar o grandes.</li>
              <li><strong>Kodak Precise Short:</strong> Optimizado para aquellos que prefieren armazones de lectura más pequeños y delgados, sin sacrificar el campo visual de cerca.</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="¿A quiénes se recomiendan los lentes Kodak?" 
            subtitle="Presbicia y primeros usuarios."
          >
            <p className="mb-4">
              Son altamente recomendados para:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Primeros usuarios de multifocales:</strong> Su suave progresión de aumento hace que la adaptación sea instintiva.</li>
              <li><strong>Profesionales activos:</strong> Aquellos que cambian de enfoque constantemente entre la computadora, el celular y el entorno.</li>
              <li><strong>Compatibilidad:</strong> Se pueden combinar con filtro azul (BlueTech) o tecnología fotosensible (Transitions).</li>
            </ul>
          </AccordionItem>
        </div>
      </section>

      <CristalCTA 
        title="Probá la diferencia de un multifocal HD"
        description={
          <>
            En Atelier analizaremos tu receta, estilo de vida y la forma de tu armazón elegido para recomendarte si <strong>Kodak Precise</strong> o el avanzado <strong>Kodak Unique DRO</strong> es la mejor inversión para tu visión.
          </>
        }
        buttonText="Cotizar mi multifocal Kodak"
        whatsappMotivo="Cotización multifocales Kodak"
      />
    </div>
  );
}
