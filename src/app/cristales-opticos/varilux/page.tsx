import Link from "next/link";
import { Metadata } from "next";
import { AccordionItem } from "@/components/Storefront/Accordion";

export const metadata: Metadata = {
  title: "Varilux Multifocales Avanzados | Atelier Óptica",
  description: "Tecnología Varilux XR Series con Inteligencia Artificial. Visión nítida a todas las distancias. Diseñada para tu vida real.",
  keywords: "Varilux XR Series, Multifocales, Inteligencia Artificial, Cristales, Lentes, Presbicia, Óptica, Atelier, Córdoba",
};

export default function VariluxPage() {
  return (
    <div className="bg-[#faf8f5]">
      {/* HERO SECTION */}
      <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">Cristales Premium Essilor</p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Varilux · Multifocales
          </h1>
          <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
            La lente progresiva #1 a nivel mundial.
            <br className="hidden md:block" />
            En Atelier no vendemos simplemente un cristal, diseñamos una <strong>solución visual personalizada</strong> utilizando la tecnología más avanzada de Essilor para que tu transición entre lejos y cerca sea invisible.
          </p>
        </div>
      </section>

      {/* VALUE PROPOSITION STRIP */}
      <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🧠</span>
            <div>
              <h4 className="text-white font-bold text-sm">IA Conductual</h4>
              <p className="text-white/60 text-xs mt-0.5">Predicción de movimientos oculares</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">📐</span>
            <div>
              <h4 className="text-white font-bold text-sm">Medición Fina</h4>
              <p className="text-white/60 text-xs mt-0.5">Centrados y alturas milimétricas</p>
            </div>
          </div>
          <div className="hidden md:block w-px h-10 bg-white/20"></div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">🤝</span>
            <div>
              <h4 className="text-white font-bold text-sm">Garantía Essilor</h4>
              <p className="text-white/60 text-xs mt-0.5">Acompañamiento y adaptación asegurada</p>
            </div>
          </div>
        </div>
      </div>

      {/* DEEP DIVE ACCORDION SECTION */}
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
          </AccordionItem>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="w-full bg-white py-24 px-6 border-t border-[#e8e2db]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">El éxito está en la toma de medidas</h2>
          <p className="text-lg text-black/70 mb-10 leading-relaxed">
            Podés tener el mejor cristal del mundo (Varilux XR), pero si la altura pupilar, la distancia nasopupilar o el ángulo pantoscópico del armazón no están calculados a la perfección por un profesional, no verás bien. 
            <br className="mt-4" />
            En <strong>Atelier</strong>, nuestro proceso de consulta asegura que tu inversión rinda al 100%.
          </p>
          <Link 
            href={`/contacto?motivo=${encodeURIComponent("Asesoramiento experto para Multifocales Varilux")}`}
            className="inline-block bg-[#283f5a] hover:bg-[#1e3047] text-white px-10 py-4 rounded-full font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Reservar Asesoramiento Visual
          </Link>
        </div>
      </section>
    </div>
  );
}
