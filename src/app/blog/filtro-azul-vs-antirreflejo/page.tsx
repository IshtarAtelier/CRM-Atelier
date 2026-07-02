import { Metadata } from "next";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";

export const metadata: Metadata = {
  alternates: { canonical: '/blog/filtro-azul-vs-antirreflejo' },
  title: "Filtro Azul vs Antirreflejo: ¿Cuál elegir? | Óptica en Córdoba",
  description: "Descubrí la diferencia entre cristales con filtro azul (blue cut) y el tratamiento antirreflejo. Asesoramiento óptico especializado en Córdoba (Cerro de las Rosas, Nueva Córdoba). Envíos a todo el país y cuotas sin interés.",
  keywords: ["filtro azul vs antirreflejo", "lentes blue cut", "tratamiento antireflex", "óptica en Córdoba", "Cerro de las Rosas", "Nueva Córdoba", "anteojos de receta", "salud visual", "fatiga visual"],
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
              Dos de los tratamientos más pedidos en nuestra óptica en Córdoba, pero que suelen confundirse. Descubrí de forma sencilla para qué sirve cada uno y cómo elegir el cristal ideal según tu rutina.
            </p>
          </header>

          <div className="blog-article w-full max-w-none">
            <p className="lead">
              Cuando nos visitás en <strong>Atelier Óptica</strong>, ya sea desde Nueva Córdoba, el Cerro de las Rosas o cualquier punto de la ciudad, para hacerte tus anteojos nuevos, surge una duda muy frecuente: <em>&quot;¿Le pongo filtro azul o con antirreflejo está bien?&quot;</em>. Gracias a los avances en la tecnología óptica, hoy contamos con soluciones específicas para cada estilo de vida y necesidad visual.
            </p>

            <p>
              En este artículo, te explicamos la diferencia desde nuestra experiencia como ópticos. Pero recordá: <strong>nuestro primer consejo es que visites a tu oftalmólogo</strong>. Ellos son los únicos profesionales de la salud capacitados para recetar tu graduación exacta. Una vez que tengas tu receta, en nuestra óptica te brindamos un asesoramiento estético y técnico 100% personalizado.
            </p>

            <hr className="my-10 border-black/10" />

            <h2 className="text-3xl mt-12 mb-6">¿Qué es el tratamiento Antirreflejo (Antireflex)?</h2>
            <p>
              El tratamiento antirreflejo consta de capas microscópicas aplicadas sobre la lente. Su propósito es <strong>reducir drásticamente los reflejos de luz</strong> que impactan en el cristal.
            </p>
            <ul className="space-y-3 my-6">
              <li><strong>Mayor nitidez:</strong> Al evitar el rebote de la luz, entra más claridad a tus ojos, mejorando significativamente el contraste visual.</li>
              <li><strong>Estética impecable:</strong> Tu mirada resalta a través del lente. Esos molestos destellos blancos en las fotos o videollamadas desaparecen casi por completo.</li>
              <li><strong>Manejo nocturno seguro:</strong> Es ideal para disminuir el encandilamiento provocado por las luces de los autos y el alumbrado público.</li>
            </ul>

            <h2 className="text-3xl mt-12 mb-6">¿Qué son los cristales con Filtro Azul (Blue Cut)?</h2>
            <p>
              Conocidos también como <em>Blue Block</em> o <em>Blue Cut</em>, estos cristales están desarrollados para <strong>bloquear y atenuar la luz azul-violeta</strong> emitida por pantallas digitales (celulares, monitores, tablets) y luces LED.
            </p>
            <p>
              Dado que pasamos gran parte de nuestro día frente a las pantallas, esta tecnología busca reducir la fatiga visual. Un gran beneficio que siempre destacamos en nuestro local es que <strong>los lentes con filtro azul de alta calidad ya incluyen el tratamiento antirreflejo</strong>. ¡Tenés lo mejor de ambos mundos: atenuás la luz de las pantallas y evitás que el lente refleje!
            </p>

            <h2 className="text-3xl mt-12 mb-6">Entonces, ¿cuál es el cristal perfecto para vos?</h2>
            <p>
              La elección dependerá íntegramente de tu rutina diaria y el uso que le des a tus anteojos de receta:
            </p>
            
            <div className="bg-[#faf8f5]/50 border border-black/10 p-8 rounded-2xl my-8">
              <ul className="m-0 space-y-6">
                <li className="flex gap-4 items-start">
                  <span className="text-2xl">💻</span>
                  <div>
                    <strong className="block text-[#111] mb-1">Si trabajás todo el día frente a la compu o el celular:</strong> 
                    <span className="text-neutral-700">El <strong>Filtro Azul</strong> es tu aliado indiscutible. Previene el cansancio ocular y te brinda un máximo confort durante largas jornadas frente a pantallas.</span>
                  </div>
                </li>
                <li className="flex gap-4 items-start">
                  <span className="text-2xl">🚗</span>
                  <div>
                    <strong className="block text-[#111] mb-1">Si usás menos pantallas, pero manejás de noche o priorizás la estética:</strong> 
                    <span className="text-neutral-700">El <strong>Antirreflejo tradicional</strong> es una excelente decisión. Te garantiza nitidez absoluta, evita encandilamientos y hace que tus anteojos luzcan casi invisibles.</span>
                  </div>
                </li>
              </ul>
            </div>

            <h2 className="text-3xl mt-12 mb-6">El paso a paso para cuidar tu vista</h2>
            <p>
              Recordá que ninguna tecnología óptica &quot;cura&quot; problemas visuales por sí sola. Los cristales corrigen tu visión basándose en una indicación médica. El camino sugerido siempre es:
            </p>
            <ol className="space-y-2 mb-10">
              <li>Visitá a tu <strong>médico oftalmólogo</strong> de confianza para un chequeo de rutina.</li>
              <li>Obtené tu receta oftalmológica actualizada.</li>
              <li>Vení a <strong>Atelier Óptica</strong> en Córdoba: te acompañamos a elegir el armazón soñado y los cristales (ya sea con filtro azul o antirreflejo) que mejor se adapten a tu día a día.</li>
            </ol>

            <div className="mt-16 p-10 bg-neutral-900 rounded-2xl text-center text-white">
              <h3 className="text-2xl font-medium tracking-tight mb-4 text-white">¿Ya tenés tu receta oftalmológica?</h3>
              <p className="mb-8 text-neutral-300 text-lg max-w-lg mx-auto">
                Te esperamos en nuestra óptica para brindarte el mejor asesoramiento personalizado. ¡Hacemos envíos a todo el país!
              </p>
              <a href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer" 
                className="inline-block bg-white text-[#111] font-semibold px-8 py-4 rounded-full hover:bg-neutral-100 transition-colors shadow-[0_2px_10px_rgba(0,0,0,0.02)]]"
              >
                Contactanos por WhatsApp
              </a>
            </div>
          </div>
        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}