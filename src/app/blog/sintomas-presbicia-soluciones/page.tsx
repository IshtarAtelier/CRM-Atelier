import { Metadata } from "next";
import Link from "next/link";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { WHATSAPP_PHONE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "¿Te alejás el celular para leer? Presbicia y soluciones | Atelier Óptica",
  description: "Conocé los síntomas de la presbicia, por qué empezás a alejar el celular y cuáles son las mejores soluciones ópticas (como los multifocales) tras visitar a tu médico oftalmólogo. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "sintomas presbicia soluciones"],
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

          <div className="prose prose-lg prose-neutral mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#e8e2db]">
            <p className="lead text-xl text-black/80 font-medium mb-8">
              Estás en un restaurante, querés leer el menú y de repente te das cuenta de que necesitás estirar el brazo para ver las letras con claridad. Si esto te suena familiar, es muy probable que estés experimentando los primeros síntomas de la presbicia.
            </p>

            <h2 className="text-2xl font-medium tracking-tight mt-10 mb-4 text-[#111]">¿Qué es exactamente la presbicia?</h2>
            <p className="mb-6 text-black/70 leading-relaxed">
              La presbicia no es una enfermedad, sino una condición fisiológica natural y evolutiva. Con el paso de los años, generalmente a partir de los 40, el cristalino (la lente natural del ojo) pierde su elasticidad y capacidad de acomodación. Esto hace que enfocar objetos cercanos cueste cada vez más esfuerzo.
            </p>

            <h2 className="text-2xl font-medium tracking-tight mt-10 mb-4 text-[#111]">Síntomas más comunes</h2>
            <ul className="list-disc pl-6 mb-8 text-black/70 space-y-3">
              <li><strong>Alejar los objetos:</strong> La necesidad instintiva de sostener el celular, los libros o las etiquetas más lejos para poder enfocarlos.</li>
              <li><strong>Visión borrosa:</strong> Dificultad para ver letras pequeñas a una distancia de lectura normal (unos 35-40 cm).</li>
              <li><strong>Fatiga visual:</strong> Sentir los ojos cansados, pesados o enrojecidos después de leer o trabajar en la computadora.</li>
              <li><strong>Dolor de cabeza:</strong> Especialmente alrededor de los ojos o en la frente tras intentar enfocar de cerca durante un buen rato.</li>
              <li><strong>Necesidad de más luz:</strong> Notar que requerís iluminación más brillante o directa para poder leer bien.</li>
            </ul>

            <div className="bg-[#f0f4f8] border-l-4 border-[#111] p-6 rounded-r-lg my-10">
              <h3 className="text-lg font-medium tracking-tight text-[#111] mb-2">El primer paso: Visitá a tu médico oftalmólogo</h3>
              <p className="text-black/80 m-0">
                Como ópticos, nuestra especialidad es asesorarte sobre la mejor solución técnica y estética en armazones y cristales, pero <strong>no diagnosticamos ni medimos la vista en el local</strong>. Ante cualquier síntoma visual, es fundamental que saques turno con tu oftalmólogo de confianza. Solo un médico profesional puede realizar un chequeo completo de tu salud ocular, descartar otras patologías y emitir la receta exacta que tus ojos necesitan.
              </p>
            </div>

            <h2 className="text-2xl font-medium tracking-tight mt-10 mb-4 text-[#111]">Soluciones ópticas: ¿Qué hacemos con la receta?</h2>
            <p className="mb-6 text-black/70 leading-relaxed">
              Una vez que fuiste al médico y tenés tu receta oftalmológica en mano, en Atelier Óptica nos encargamos del resto. Dependiendo de tu estilo de vida y necesidades, existen dos caminos principales para corregir la presbicia:
            </p>

            <h3 className="text-xl font-medium tracking-tight mt-8 mb-3">1. Anteojos de lectura (Monofocales)</h3>
            <p className="mb-6 text-black/70 leading-relaxed">
              Son lentes diseñadas con una única graduación, específica para ver de cerca. Son ideales si pasás largos períodos concentrado en tareas de lectura o manualidades.
              <br/><br/>
              <em>El inconveniente:</em> Solo sirven para ver de cerca. Si levantás la vista para mirar algo a la distancia o a la computadora, vas a ver borroso y vas a tener que sacarte y ponerte los anteojos constantemente (el famoso "anteojo en la punta de la nariz").
            </p>

            <h3 className="text-xl font-medium tracking-tight mt-8 mb-3">2. Lentes Multifocales (Progresivos)</h3>
            <p className="mb-6 text-black/70 leading-relaxed">
              Es la solución más avanzada, cómoda y estética. Estos cristales te permiten ver nítidamente a tres distancias: <strong>lejos, intermedio y cerca</strong>, todo en la misma lente y sin líneas divisorias visibles.
            </p>
            <ul className="list-disc pl-6 mb-8 text-black/70 space-y-2">
              <li><strong>Comodidad total:</strong> Te los ponés a la mañana y te olvidás. Te sirven para manejar, trabajar en la compu y ver el celular sin tener que cambiarlos.</li>
              <li><strong>Estética impecable:</strong> Al no tener la "rayita" de los viejos lentes bifocales, nadie nota que estás usando corrección para la presbicia.</li>
              <li><strong>Adaptación:</strong> Los diseños modernos tienen tecnologías de transición muy suaves que hacen que acostumbrarse sea rápido y natural.</li>
            </ul>

            <h2 className="text-2xl font-medium tracking-tight mt-10 mb-4 text-[#111]">Asesoramiento personalizado en Atelier</h2>
            <p className="mb-6 text-black/70 leading-relaxed">
              Elegir el lente correcto depende de tu receta, tu tipo de armazón favorito y tu rutina diaria. Traé tu receta al local o envianosla por WhatsApp; te vamos a explicar en detalle las diferencias entre las tecnologías disponibles para que tomes la mejor decisión para tus ojos.
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
      <FloatingWhatsApp />
    </div>
  );
}
