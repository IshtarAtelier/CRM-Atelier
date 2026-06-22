import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";
import { CristalHero } from "@/components/cristales/CristalHero";
import { CristalFeatures } from "@/components/cristales/CristalFeatures";
import { CristalCTA } from "@/components/cristales/CristalCTA";
import { VariluxLensVisualizer } from "@/components/cristales/VariluxLensVisualizer";
import { VariluxQuiz } from "@/components/cristales/VariluxQuiz";

export const metadata: Metadata = {
  alternates: { canonical: '/cristales-opticos/varilux' },
  title: "Varilux Multifocales Avanzados",
  description: "Tecnología Varilux XR Series con Inteligencia Artificial. Visión nítida a todas las distancias. Diseñada para tu vida real.",
  keywords: "Varilux XR Series, Multifocales, Inteligencia Artificial, Cristales, Lentes, Presbicia, Óptica, Atelier, Córdoba",
};

export default function VariluxPage() {
  return (
    <div className="bg-[#faf8f5]">
      <CristalHero 
        preTitle="Centro Certificado: Varilux Expert"
        title="Varilux · Multifocales"
        description={
          <>
            La lente progresiva #1 a nivel mundial.
            <br className="hidden md:block" />
            Como <strong>Especialistas Varilux Expert</strong>, en Atelier no vendemos simplemente un cristal. Diseñamos una <strong>solución visual de precisión</strong> con tecnología de medición avanzada para garantizar que tu adaptación sea inmediata y perfecta.
          </>
        }
      />

      <CristalFeatures 
        features={[
          { icon: "🧠", title: "IA Conductual", subtitle: "Predicción de movimientos oculares" },
          { icon: "📐", title: "Medición Fina", subtitle: "Centrados y alturas milimétricas" },
          { icon: "🤝", title: "Garantía Essilor", subtitle: "Acompañamiento y adaptación asegurada" },
        ]}
      />

      <section className="w-full py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">El Portafolio Experto Varilux</h2>
            <p className="text-black/60 text-lg">
              Conocé en detalle la tecnología detrás de cada línea y descubrí por qué somos especialistas en adaptación.
            </p>
          </div>

          <AccordionItem 
            title="Varilux XR Series™" 
            subtitle="La revolución de la Inteligencia Artificial conductual."
            defaultOpen={true}
          >
            <p className="mb-4">
              <strong>Varilux XR Series</strong> es el primer cristal progresivo diseñado con inteligencia artificial conductual. Nuestro estilo de vida actual nos exige mover los ojos constantemente entre pantallas, el tablero del auto, y el entorno a nuestro alrededor (realizando hasta 100.000 movimientos oculares por día).
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li><strong>Predicción Visual:</strong> Utilizando más de 1 millón de datos, la IA predice cómo vas a mover los ojos para enfocar, creando un &quot;gemelo digital&quot; de tu comportamiento en 3D.</li>
              <li><strong>Nitidez en movimiento:</strong> +49% de volumen de visión en comparación con generaciones anteriores.</li>
              <li><strong>Adaptación instintiva:</strong> 9 de cada 10 usuarios se adaptan desde el primer día.</li>
            </ul>
            <p className="text-sm bg-[#faf8f5] p-4 rounded-lg border border-[#e8e2db]">
              <strong>Tip de Especialista:</strong> Es la lente ideal si sos un usuario hiper-conectado, pasás de la computadora al celular constantemente o conducís y necesitás reaccionar rápido con tu visión periférica.
            </p>
            <VariluxLensVisualizer type="xr" />
          </AccordionItem>

          <AccordionItem 
            title="Varilux Physio 3.0" 
            subtitle="Alta resolución y mapeo pupilar avanzado."
          >
            <p className="mb-4">
              La línea <strong>Physio 3.0</strong> incorpora la tecnología <em>W.A.V.E. 2.0</em> y mapeo pupilar. ¿Qué significa esto? Analiza el tamaño de tu pupila en diferentes condiciones de luz para garantizar que la transición entre lejos y cerca sea lo más estable posible.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>Contraste superior, incluso en condiciones de baja iluminación (ideal para manejo nocturno).</li>
              <li>Menor distorsión lateral (&quot;efecto balanceo&quot;).</li>
              <li>Transición fluida sin el salto de imagen abrupto de multifocales convencionales.</li>
            </ul>
            <VariluxLensVisualizer type="physio" />
          </AccordionItem>

          <AccordionItem 
            title="Varilux Comfort Max" 
            subtitle="Ergonomía y flexibilidad postural."
          >
            <p className="mb-4">
              Diseñado para el confort de todo el día. El lente <strong>Comfort Max</strong> amplía la &quot;zona de tolerancia&quot; postural. Esto significa que no tenés que buscar la posición exacta y rígida del cuello para poder leer nítidamente.
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>226 perfiles posturales analizados para maximizar la flexibilidad.</li>
              <li>Reduce drásticamente la tensión en el cuello y hombros al final de la jornada.</li>
              <li>Ideal para usuarios que buscan su primer lente multifocal premium sin miedos a la adaptación.</li>
            </ul>
            <VariluxLensVisualizer type="comfort" />
          </AccordionItem>

          <AccordionItem 
            title="Varilux Liberty 3.0" 
            subtitle="La puerta de entrada a la visión progresiva premium."
          >
            <p className="mb-4">
              <strong>Liberty 3.0</strong> democratiza la tecnología Varilux, ofreciendo una solución equilibrada y sumamente superior a los cristales genéricos del mercado, manteniendo la calidad y el pulido óptico de Essilor.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Visión clara a todas las distancias.</li>
              <li>Diseño optimizado para una adaptación sencilla.</li>
              <li>Excelente relación costo-beneficio para el día a día.</li>
            </ul>
            <VariluxLensVisualizer type="liberty" />
          </AccordionItem>
        </div>
      </section>

      <VariluxQuiz />

      <CristalCTA 
        title="Centro Varilux Expert: Precisión en la toma de medidas para Multifocales"
        description={
          <>
            Podés invertir en el mejor cristal multifocal del mundo, como el Varilux XR, pero si la altura pupilar o la distancia nasopupilar no están calculadas con exactitud milimétrica, la adaptación fallará y no lograrás una visión nítida. 
            <br className="mt-4" />
            Al ser un <strong>Centro Varilux Expert</strong> certificado, en Atelier Óptica la toma de medidas es realizada artesanalmente por nuestra Óptica Contactóloga Ishtar Pissano (con más de 10 años de experiencia). Te garantizamos una toma de medidas perfecta y personalizada para que la adaptación a tus nuevos multifocales sea rápida, natural y tu inversión rinda al 100%.
          </>
        }
        buttonText="Reservar Asesoramiento Visual"
        whatsappMotivo="Asesoramiento experto para Multifocales Varilux"
      />
    </div>
  );
}
