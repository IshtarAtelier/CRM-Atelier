import { Metadata } from "next";
import Link from "next/link";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { WHATSAPP_PHONE } from "@/lib/constants";

export const metadata: Metadata = {
  alternates: { canonical: 'https://atelieroptica.com.ar/blog/sintomas-presbicia-soluciones' },
  title: "¿Te alejás el celular para leer? Presbicia y soluciones en Córdoba",
  description: "Descubrí los síntomas de la presbicia y por qué alejás el celular. Conocé las mejores soluciones en lentes multifocales en Atelier Óptica (Córdoba). Envíos a todo el país y cuotas sin interés.",
  keywords: ["presbicia síntomas", "lentes multifocales Córdoba", "óptica Cerro de las Rosas", "óptica Nueva Córdoba", "anteojos de receta", "soluciones presbicia", "Atelier Óptica"],
};

export default function SintomasPresbiciaPage() {
  return (
    <div className="bg-[#faf8f5] text-black min-h-screen flex flex-col font-sans selection:bg-[#111] selection:text-white">
      <StorefrontNavbar theme="dark" />
      
      <main className="flex-grow pt-32 pb-20">
        <article className="max-w-3xl mx-auto px-6">
          <header className="mb-12 text-center">
            <span className="inline-block py-1 px-3 rounded-full bg-[#e8e2db] text-black/60 text-xs font-medium tracking-tight tracking-widest uppercase mb-6">
              Salud Visual
            </span>
            <h1 className="text-3xl md:text-5xl font-medium tracking-tight tracking-tight mb-6 leading-tight">
              ¿Te alejás el celular para leer? Síntomas de la presbicia y soluciones
            </h1>
            <p className="text-lg text-black/60 mb-6 flex items-center justify-center gap-3">
              <span>Por el equipo de Atelier Óptica</span>
              <span>·</span>
              <span>Tiempo de lectura: 4 min</span>
            </p>
          </header>

          <div className="blog-article w-full max-w-none">
            <p className="lead text-xl text-black/80 font-medium mb-8">
              Estás en tu café favorito de Nueva Córdoba o del Cerro de las Rosas, querés leer el menú y de repente te das cuenta de que necesitás estirar el brazo para ver las letras con claridad. Si esta escena te resulta familiar, es muy probable que estés experimentando los primeros síntomas de la presbicia.
            </p>

            <h2 className="text-2xl font-medium tracking-tight mt-10 mb-4 text-[#111]">¿Qué es exactamente la presbicia?</h2>
            <p className="mb-6 text-black/70 leading-relaxed">
              La presbicia no es una enfermedad, sino una evolución natural de nuestra visión. A partir de los 40 años, el cristalino (la lente natural del ojo) pierde su elasticidad. Esto significa que enfocar objetos cercanos exige cada vez más esfuerzo, afectando tu comodidad visual en el día a día.
            </p>

            <h2 className="text-2xl font-medium tracking-tight mt-10 mb-4 text-[#111]">Síntomas más comunes que no debés ignorar</h2>
            <ul className="list-disc pl-6 mb-8 text-black/70 space-y-3">
              <li><strong>Alejar los objetos:</strong> La necesidad instintiva de sostener el celular, los libros o las etiquetas a mayor distancia para poder enfocarlos correctamente.</li>
              <li><strong>Visión borrosa:</strong> Dificultad para leer letras pequeñas a una distancia normal (entre 35 y 40 cm).</li>
              <li><strong>Fatiga visual:</strong> Sentir los ojos cansados, pesados o enrojecidos luego de trabajar en la computadora o leer durante un rato.</li>
              <li><strong>Dolor de cabeza:</strong> Puntadas molestas alrededor de los ojos o en la frente tras intentar enfocar de cerca.</li>
              <li><strong>Necesidad de más luz:</strong> Notar que requerís iluminación más intensa y directa para ver con nitidez.</li>
            </ul>

            <div className="bg-[#f0f4f8] border-l-4 border-[#111] p-6 rounded-r-lg my-10">
              <h3 className="text-lg font-medium tracking-tight text-[#111] mb-2">El primer paso: Consultá a tu médico oftalmólogo</h3>
              <p className="text-black/80 m-0">
                En Atelier Óptica somos expertos en asesorarte sobre la mejor solución técnica y estética en armazones y cristales, pero <strong>no diagnosticamos ni medimos la vista en el local</strong>. Ante cualquier síntoma, es clave que agendes un turno con tu oftalmólogo de confianza en Córdoba. Solo un profesional médico puede realizar un chequeo completo, cuidar tu salud ocular y emitir la receta exacta que tus ojos necesitan.
              </p>
            </div>

            <h2 className="text-2xl font-medium tracking-tight mt-10 mb-4 text-[#111]">Soluciones ópticas: ¿Qué hacemos con tu receta?</h2>
            <p className="mb-6 text-black/70 leading-relaxed">
              Una vez que visitaste al médico y tenés tu receta en mano, en Atelier nos encargamos del resto. Según tu estilo de vida y exigencias visuales, existen dos caminos principales para corregir la presbicia:
            </p>

            <h3 className="text-xl font-medium tracking-tight mt-8 mb-3">1. Anteojos de lectura (Lentes Monofocales)</h3>
            <p className="mb-6 text-black/70 leading-relaxed">
              Diseñados con una única graduación, son perfectos para ver de cerca. Resultan ideales si pasás muchas horas concentrado en la lectura o realizando trabajos manuales minuciosos.
              <br/><br/>
              <em>El inconveniente:</em> Solo sirven para la distancia corta. Si levantás la vista para mirar la computadora o a alguien que te habla, vas a ver borroso. Esto te obliga a ponerte y sacarte los anteojos constantemente (el típico efecto &quot;anteojo en la punta de la nariz&quot;).
            </p>

            <h3 className="text-xl font-medium tracking-tight mt-8 mb-3">2. Lentes Multifocales (Progresivos)</h3>
            <p className="mb-6 text-black/70 leading-relaxed">
              La solución más avanzada, cómoda y estética del mercado óptico. Estos cristales te permiten ver con total nitidez a tres distancias: <strong>lejos, intermedia y cerca</strong>, todo en una misma lente y sin líneas divisorias visibles.
            </p>
            <ul className="list-disc pl-6 mb-8 text-black/70 space-y-2">
              <li><strong>Comodidad total:</strong> Te los ponés a la mañana y te olvidás. Te sirven para manejar por las calles de Córdoba, trabajar en la oficina y responder mensajes en el celular.</li>
              <li><strong>Estética impecable:</strong> Al no tener la &quot;rayita&quot; de los antiguos bifocales, nadie notará que estás usando corrección para la presbicia.</li>
              <li><strong>Adaptación rápida:</strong> Los diseños modernos cuentan con tecnologías de transición sumamente suaves, logrando que el acostumbramiento sea un proceso natural y sin mareos.</li>
            </ul>

            <h2 className="text-2xl font-medium tracking-tight mt-10 mb-4 text-[#111]">Asesoramiento personalizado en Atelier Óptica</h2>
            <p className="mb-6 text-black/70 leading-relaxed">
              Elegir el lente perfecto depende de tu receta, tu armazón ideal y tu rutina. Vení a visitarnos a nuestro local, o envianos tu receta por WhatsApp desde cualquier punto del país. Te vamos a explicar en detalle las diferencias entre las tecnologías disponibles para que tomés una decisión inteligente y a la medida de tus ojos.
            </p>

            <div className="mt-12 pt-8 border-t border-[#e8e2db] flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a 
                href={`https://wa.me/${WHATSAPP_PHONE}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-4 bg-[#111] text-white text-sm font-medium tracking-tight tracking-widest uppercase rounded-full hover:bg-black transition-colors w-full sm:w-auto"
              >
                Tengo mi receta, quiero cotizar
              </a>
              <Link 
                href="/blog"
                className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-black text-sm font-medium tracking-tight tracking-widest uppercase rounded-full border border-black/20 hover:border-black/30 transition-all duration-300 hover:shadow-md transition-colors w-full sm:w-auto"
              >
                Volver al Blog
              </Link>
            </div>
          </div>
        </article>
      </main>

      <StorefrontFooter />
      
    </div>
  );
}