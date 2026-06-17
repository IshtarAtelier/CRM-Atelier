import { Metadata } from "next";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";

export const metadata: Metadata = {
  alternates: { canonical: '/blog/filtro-azul-vs-antirreflejo' },
  title: "Filtro Azul vs Antirreflejo: ¿Cuál necesitas realmente?",
  description: "Descubrí la diferencia entre los cristales con filtro azul (blue cut) y el tratamiento antirreflejo. Asesoramiento óptico en Córdoba, Argentina. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "filtro azul vs antirreflejo"],
};

export default function FiltroAzulVsAntirreflejoPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] font-sans text-[#111]">
      <StorefrontNavbar theme="light" />
      
      <main className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        <article className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-8 md:p-14 border border-black/5">
          <header className="mb-12 text-center">
            <div className="inline-block px-3 py-1 mb-6 text-sm font-medium text-[#111] bg-[#faf8f5] rounded-full">
              Salud Visual y Tecnología
            </div>
            <h1 className="text-3xl md:text-5xl font-medium tracking-tight text-[#111] mb-6 leading-tight tracking-tight">
              Filtro Azul (Blue Cut) vs Antirreflejo: ¿Cuál necesitás realmente?
            </h1>
            <p className="text-lg md:text-xl text-[#666] max-w-2xl mx-auto leading-relaxed">
              Dos de los tratamientos más pedidos en la óptica, pero que muchas veces se confunden. Te explicamos de forma sencilla para qué sirve cada uno y cómo elegir el cristal ideal para tu rutina.
            </p>
          </header>

          <div className="prose prose-lg md:prose-xl max-w-none prose-neutral prose-headings:font-medium tracking-tight prose-headings:text-[#111] prose-a:text-[#111]">
            <p className="lead">
              Cuando venís a <strong>Atelier Óptica</strong> en Córdoba a hacerte tus anteojos nuevos, es muy común que surja la misma duda: <em>&quot;¿Le pongo filtro azul o con antirreflejo está bien?&quot;</em>. Las opciones de cristales avanzaron un montón gracias a la tecnología, y hoy tenemos soluciones muy específicas para cada estilo de vida.
            </p>

            <p>
              En este artículo te vamos a explicar la diferencia desde nuestro lugar de ópticos. Recordá siempre que <strong>nuestro primer consejo es que visites a tu médico oftalmólogo</strong>. Ellos son los únicos profesionales capacitados para evaluar tu salud visual y recetar la graduación exacta que necesitás. Una vez que tengas tu receta en mano, nosotros en la óptica te asesoramos sobre los armazones y los cristales más adecuados para vos.
            </p>

            <hr className="my-10 border-black/10" />

            <h2 className="text-3xl mt-12 mb-6">¿Qué es el tratamiento Antirreflejo?</h2>
            <p>
              El tratamiento antirreflejo (o antireflex) es una serie de capas microscópicas que se aplican sobre la superficie del cristal. Su objetivo principal, como lo dice su nombre, es <strong>reducir los reflejos de luz</strong> que rebotan en la lente.
            </p>
            <ul className="space-y-3 my-6">
              <li><strong>Mayor nitidez:</strong> Al evitar que la luz rebote, pasa más cantidad de luz hacia tus ojos, lo que mejora el contraste y la claridad de visión.</li>
              <li><strong>Estética:</strong> Tus ojos se ven a través del lente. Los molestos reflejos blancos que salen en las fotos o cuando hablás con alguien casi desaparecen.</li>
              <li><strong>Manejo nocturno:</strong> Ayuda muchísimo a disminuir el encandilamiento producido por las luces de otros autos o la iluminación de la calle.</li>
            </ul>

            <h2 className="text-3xl mt-12 mb-6">¿Qué es el Filtro Azul (Blue Cut)?</h2>
            <p>
              Los cristales con filtro azul, conocidos comercialmente como <em>Blue Cut</em> o <em>Blue Block</em>, están diseñados específicamente para <strong>atenuar el paso de la luz azul-violeta</strong> que emiten las pantallas digitales (celulares, computadoras, televisores) y las luces LED.
            </p>
            <p>
              Hoy en día pasamos muchísimas horas frente a las pantallas, y esta tecnología busca hacer que la experiencia visual sea más descansada. Un dato importante que solemos comentar en la óptica es que, en la gran mayoría de los laboratorios actuales, <strong>los cristales con filtro azul ya traen incluido el tratamiento antirreflejo</strong>. Es decir, tenés el beneficio de atenuar la luz de las pantallas más las ventajas de un lente que no refleja.
            </p>

            <h2 className="text-3xl mt-12 mb-6">Entonces, ¿cuál es el mejor para vos?</h2>
            <p>
              Todo depende de cómo sea tu día a día y el uso que le des a tus anteojos:
            </p>
            
            <div className="bg-[#faf8f5]/50 border border-black/10 p-8 rounded-2xl my-8">
              <ul className="m-0 space-y-6">
                <li className="flex gap-4 items-start">
                  <span className="text-2xl">💻</span>
                  <div>
                    <strong className="block text-[#111] mb-1">Si trabajás todo el día en la compu o con el celu:</strong> 
                    <span className="text-neutral-700">El <strong>Filtro Azul</strong> es tu gran aliado. Está pensado justamente para brindarte mayor confort frente a las pantallas durante jornadas extensas.</span>
                  </div>
                </li>
                <li className="flex gap-4 items-start">
                  <span className="text-2xl">🚗</span>
                  <div>
                    <strong className="block text-[#111] mb-1">Si no usás tantas pantallas, pero manejás mucho de noche o querés la mejor estética:</strong> 
                    <span className="text-neutral-700">El <strong>Antirreflejo tradicional</strong> es una opción excelente. Te va a dar nitidez, va a reducir encandilamientos y hará que los cristales pasen casi desapercibidos.</span>
                  </div>
                </li>
              </ul>
            </div>

            <h2 className="text-3xl mt-12 mb-6">El paso a paso correcto</h2>
            <p>
              No te olvides que ninguna tecnología óptica "cura" problemas visuales. Los cristales corrigen tu visión y te brindan confort basándose estrictamente en lo que indicó un profesional médico. Por eso, el camino correcto siempre es:
            </p>
            <ol className="space-y-2 mb-10">
              <li>Sacá turno y visitá a tu <strong>médico oftalmólogo</strong>.</li>
              <li>El médico evaluará tu salud visual y te dará la receta correspondiente.</li>
              <li>Venite a <strong>Atelier Óptica</strong> con tu receta y te ayudamos a elegir el armazón ideal y los cristales (¡ya sea con filtro azul o antirreflejo!) que mejor se adapten a vos.</li>
            </ol>

            <div className="mt-16 p-10 bg-neutral-900 rounded-2xl text-center text-white">
              <h3 className="text-2xl font-medium tracking-tight mb-4 text-white">¿Ya tenés tu receta oftalmológica?</h3>
              <p className="mb-8 text-neutral-300 text-lg max-w-lg mx-auto">
                Te esperamos en nuestro local en Córdoba para brindarte el mejor asesoramiento personalizado.
              </p>
              <a href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer" 
                className="inline-block bg-white text-[#111] font-semibold px-8 py-4 rounded-full hover:bg-neutral-100 transition-colors shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
              >
                Contactanos o visitanos
              </a>
            </div>
          </div>
        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}
