import { Metadata } from "next";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";

export const metadata: Metadata = {
  alternates: { canonical: '/blog/varilux-vs-kodak-vs-zeiss' },
  title: "Varilux vs Kodak vs Zeiss: ¿Qué multifocal premium elegir?",
  description: "Descubrí las diferencias entre Varilux, Zeiss y Kodak. Comparativa de multifocales premium, adaptación y campos visuales para presbicia. Asesoramiento en Córdoba. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "varilux vs kodak vs zeiss"],
};

export default function VariluxVsKodakVsZeissPage() {
  return (
    <div className="bg-[#faf8f5] text-black min-h-screen flex flex-col">
      <StorefrontNavbar theme="dark" />
      
      <main className="flex-grow pt-32 pb-16">
        <article className="max-w-3xl mx-auto px-6">
          <header className="mb-12 text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#111]">
                Cristales
              </span>
              <span className="text-xs text-black/40">·</span>
              <span className="text-xs text-black/40">Tiempo de lectura: 5 min</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight tracking-tight mb-6">
              Varilux vs Kodak vs Zeiss: ¿Qué multifocal premium elegir?
            </h1>
            <p className="text-lg text-black/60 md:text-xl">
              Comparativa de adaptación, campos visuales y tecnologías para que inviertas en la mejor visión posible, siempre partiendo de la receta de tu médico oftalmólogo.
            </p>
          </header>

          <div className="prose prose-lg prose-headings:font-medium tracking-tight prose-a:text-[#111] max-w-none text-black/80">
            <p>
              Cuando llega el momento de hacerte tus anteojos multifocales (o progresivos), la cantidad de opciones en el mercado puede ser abrumadora. Las marcas premium prometen la mejor visión, pero ¿qué las hace diferentes entre sí? En <strong>Atelier Óptica</strong>, escuchamos todos los días la misma pregunta: <em>“¿Vale la pena invertir en Varilux, o me conviene Zeiss o Kodak?”</em>.
            </p>
            <p>
              Antes de empezar, es fundamental aclarar algo: nosotros somos <strong>ópticos</strong>, no médicos. Nuestro trabajo es asesorarte sobre la mejor tecnología en cristales para tu estilo de vida, pero <strong>todo empieza con una visita a tu médico oftalmólogo</strong>. Es él quien debe evaluar la salud de tus ojos y emitir la receta con la graduación exacta. Una vez que tengas tu receta, nos encargamos de que esa indicación médica se traduzca en unos anteojos perfectos para vos.
            </p>

            <h2 className="text-2xl mt-12 mb-6">¿Qué hace que un multifocal sea "Premium"?</h2>
            <p>
              Un lente multifocal tiene tres zonas de visión (lejos, intermedia y cerca) talladas en el mismo cristal, sin la clásica "rayita" de los bifocales antiguos. El gran desafío de los multifocales son las zonas borrosas en los laterales (aberraciones).
            </p>
            <p>
              Los multifocales <strong>premium</strong> (como las líneas altas de Varilux, Zeiss y Kodak) utilizan tecnología de tallado digital punto por punto en la cara interna del cristal. Esto se traduce en:
            </p>
            <ul className="list-disc pl-6 mb-8 space-y-2">
              <li><strong>Campos visuales más amplios:</strong> Menos distorsión en los bordes.</li>
              <li><strong>Transición suave:</strong> El paso de mirar de lejos a leer un mensaje en el celular se siente natural.</li>
              <li><strong>Adaptación rápida:</strong> Si sos primerizo, el cerebro se acostumbra mucho más rápido.</li>
            </ul>

            <h2 className="text-2xl mt-12 mb-6">1. Varilux (Essilor): El inventor del multifocal</h2>
            <p>
              Varilux es casi un sinónimo de multifocal. Fueron los primeros en el mundo en crearlos y hoy siguen liderando en innovación, con tecnologías como la inteligencia artificial en su línea Varilux XR.
            </p>
            <ul className="list-disc pl-6 mb-8 space-y-2">
              <li><strong>Campos visuales:</strong> Extremadamente amplios y dinámicos. Están pensados para el movimiento constante (mirar el celular, caminar, subir escaleras).</li>
              <li><strong>Adaptación:</strong> Es su punto más fuerte. Tienen tasas de éxito altísimas, incluso en personas que nunca antes usaron multifocales o que tuvieron malas experiencias en el pasado.</li>
              <li><strong>Perfil ideal:</strong> Para el usuario exigente, dinámico y que busca garantía absoluta de confort visual inmediato.</li>
            </ul>

            <h2 className="text-2xl mt-12 mb-6">2. Zeiss: Precisión alemana y alta definición</h2>
            <p>
              La legendaria marca alemana Carl Zeiss es famosa por fabricar las ópticas de los mejores microscopios y cámaras del mundo. En anteojos, esa herencia se nota.
            </p>
            <ul className="list-disc pl-6 mb-8 space-y-2">
              <li><strong>Campos visuales:</strong> Zeiss destaca por la nitidez extrema. Su tecnología SmartLife está optimizada para la vida conectada (pantallas, smartphones) teniendo en cuenta cómo cambia el tamaño de la pupila.</li>
              <li><strong>Adaptación:</strong> Requiere una toma de medidas milimétrica en la óptica. Al ser tan personalizables, una vez bien centrados, la sensación de "alta definición" es inigualable.</li>
              <li><strong>Perfil ideal:</strong> Para quienes valoran el detalle, tienen astigmatismos altos o simplemente quieren la óptica más nítida disponible en el mercado.</li>
            </ul>

            <h2 className="text-2xl mt-12 mb-6">3. Kodak: La decisión inteligente</h2>
            <p>
              Kodak Lenses ofrece una alternativa fantástica en el segmento de alta gama, manteniendo precios más accesibles que las líneas top de Essilor o Zeiss, sin sacrificar calidad digital.
            </p>
            <ul className="list-disc pl-6 mb-8 space-y-2">
              <li><strong>Campos visuales:</strong> Sus diseños digitales (como Kodak Unique) ofrecen zonas de visión muy confortables y una excelente relación entre precio y amplitud visual.</li>
              <li><strong>Adaptación:</strong> Muy fluida gracias a sus diseños de progresión suave. Además, sus tratamientos antirreflejo y de protección son súper duraderos.</li>
              <li><strong>Perfil ideal:</strong> Para quien busca dar el salto a la tecnología digital premium sin gastar el presupuesto de las marcas líderes, obteniendo un resultado excelente.</li>
            </ul>

            <h2 className="text-2xl mt-12 mb-6">Comparativa Final: ¿Con cuál me quedo?</h2>
            <p>
              No hay una respuesta única. La elección depende de varios factores que analizamos juntos en el local:
            </p>
            <ol className="list-decimal pl-6 mb-8 space-y-2">
              <li><strong>Tu receta:</strong> Miopías, hipermetropías o astigmatismos altos pueden beneficiarse de diseños específicos de Zeiss o Varilux.</li>
              <li><strong>Tu historial:</strong> Si ya usás Varilux y estás cómodo, muchas veces la recomendación es actualizar a una versión más moderna de la misma marca.</li>
              <li><strong>Tu trabajo y uso de pantallas:</strong> Analizamos cuántas horas pasás frente a la compu o manejando.</li>
            </ol>
            <p>
              Por favor, recordá que si tenés síntomas como visión borrosa repentina, destellos o dolor, <strong>debes consultar urgente a un médico oftalmólogo</strong>. En nuestra óptica no diagnosticamos patologías ni recetamos graduaciones.
            </p>

            <div className="bg-[#e8e2db]/30 p-8 rounded-2xl mt-12 text-center border border-[#e8e2db]">
              <h3 className="text-xl font-medium tracking-tight mb-4">Vení a visitarnos con tu receta</h3>
              <p className="mb-6 text-black/70">
                Traé la receta de tu oftalmólogo a nuestro local en Córdoba. Te vamos a mostrar los diferentes armazones y te explicaremos en detalle qué cristal se adapta mejor a tu prescripción médica y a tu presupuesto.
              </p>
              <a href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer" 
                className="inline-block bg-[#111] text-white px-8 py-3 rounded-full font-medium tracking-tight hover:bg-black transition-colors"
              >
                Solicitar Asesoramiento
              </a>
            </div>
          </div>
        </article>
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
