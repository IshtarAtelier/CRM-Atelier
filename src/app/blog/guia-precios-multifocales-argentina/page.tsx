import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import Link from 'next/link';
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  title: '¿Cuánto cuesta un lente multifocal en Argentina? (Guía 2026) | Atelier Óptica',
  description: "Descubrí en nuestra guía 2026 los valores de lentes multifocales en Argentina. Conocé el valor de invertir en marcas como Varilux y Kodak. Asesoramiento en Córdoba. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "guia precios multifocales argentina"],
};

export default function BlogMultifocales2026() {
  return (
    <main className="min-h-screen bg-[#faf8f5] selection:bg-neutral-900 selection:text-white">
      <StorefrontNavbar theme="light" />

      <article className="pt-32 pb-24 px-6 md:px-12 max-w-4xl mx-auto font-sans text-[#111]">
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight tracking-tight mb-6 leading-tight">
            ¿Cuánto cuesta un lente multifocal en Argentina? (Guía 2026)
          </h1>
          <p className="text-lg text-[#666] mb-6">
            Por el equipo de ópticos de Atelier Óptica, Córdoba.
          </p>
          <div className="h-1 w-20 bg-neutral-900 mb-8"></div>
        </header>

        <section className="prose prose-lg md:prose-xl prose-neutral max-w-none space-y-8">
          <p>
            Si rondás los 40 o más, es muy probable que hayas empezado a notar que estirar el brazo para leer el celular ya no alcanza. Esta etapa natural de la visión, conocida como presbicia, tiene una solución óptica excepcional: los <strong>lentes multifocales</strong> o progresivos.
          </p>

          <div className="bg-[#faf8f5] p-6 border-l-4 border-neutral-800 my-8">
            <h3 className="text-xl font-medium tracking-tight mb-3 mt-0">El paso más importante: Tu visita al médico oftalmólogo</h3>
            <p className="m-0 text-base">
              Antes de hablar de cristales y armazones, queremos ser muy claros: <strong>en Atelier Óptica somos ópticos, no médicos</strong>. Nuestro trabajo comienza donde termina el del profesional de la salud. Por ley, y por tu propio bienestar, es <strong>indispensable</strong> que primero visites a tu médico oftalmólogo de confianza. Solo ellos pueden realizar un examen visual completo, descartar patologías y emitir una receta médica. Con esa receta en mano, nosotros nos encargamos de la magia óptica. No diagnosticamos ni "medimos la vista" en el local.
            </p>
          </div>

          <p>
            En este 2026, la pregunta que más recibimos en nuestro local en Córdoba es: <em>"¿Cuánto me va a salir el anteojo?"</em>. En Argentina, hablar de precios fijos puede ser complejo, pero sí podemos hablar de <strong>valor</strong> y de cómo se estructura la inversión en tu visión.
          </p>

          <h2 className="text-3xl font-semibold mt-12 mb-6">El valor de tus ojos: ¿Por qué hay tanta diferencia de precios?</h2>
          
          <p>
            El costo de un lente multifocal depende fundamentalmente de la tecnología aplicada en su diseño. Un cristal progresivo tiene tres zonas de visión (lejos, intermedia y cerca) talladas de forma invisible. Cuanto más avanzado es el diseño, más amplio y natural es el campo visual, y más rápida es tu adaptación.
          </p>

          <h3 className="text-2xl font-semibold mt-10 mb-4">Varilux: La excelencia tecnológica</h3>
          <p>
            Cuando hablamos de <strong>Varilux (Essilor)</strong>, estamos hablando de la marca que inventó el lente multifocal. Hoy, sus cristales representan el tope de gama. Su tecnología está pensada para reducir casi a cero el "efecto balanceo" y ofrecerte transiciones súper suaves al cambiar la mirada de la calle a la computadora, y de ahí al papel.
          </p>
          <p>
            Invertir en Varilux es apostar por un nivel de confort visual que pocas marcas alcanzan. Ideal si sos una persona muy dinámica, si pasás muchas horas frente a pantallas o si alguna vez tuviste problemas para adaptarte a otros progresivos. Al ser premium, su valor es superior, pero la calidad de vida que ganás es inmensa.
          </p>

          <h3 className="text-2xl font-semibold mt-10 mb-4">Kodak Lens: El equilibrio perfecto</h3>
          <p>
            Otra excelente opción que solemos recomendar en Atelier Óptica es la línea de multifocales <strong>Kodak</strong>. Se trata de un cristal de altísima calidad a un precio más accesible (gama media-alta), con un respaldo tecnológico internacional impecable.
          </p>
          <p>
            Los diseños de Kodak ofrecen campos visuales amplios y colores nítidos (su tratamiento antirreflejo es legendario por la historia de la marca). Si buscás una excelente relación costo-beneficio para tu primer multifocal, Kodak es una decisión muy inteligente.
          </p>

          <h2 className="text-3xl font-semibold mt-12 mb-6">Tratamientos que suman valor</h2>
          
          <p>
            Más allá de la marca y el diseño del cristal, el valor final se ajusta según los tratamientos que agreguemos a tu receta:
          </p>
          <ul className="list-disc pl-6 space-y-3">
            <li><strong>Antirreflejo:</strong> Indispensable para manejar de noche y descansar la vista en el trabajo. Marcas como <em>Crizal</em> ofrecen una resistencia superior a rayas y manchas.</li>
            <li><strong>Filtro de Luz Azul:</strong> Vital si pasás horas frente al monitor o al celular.</li>
            <li><strong>Lentes fotocromáticos (Transitions):</strong> Aquellos que se oscurecen con el sol y se aclaran en interiores. Un verdadero 2 en 1.</li>
          </ul>

          <h2 className="text-3xl font-semibold mt-12 mb-6">Nuestra promesa en Atelier Óptica</h2>
          
          <p>
            Un lente multifocal no es un producto que sacás de una caja y te lo ponés. Es un cristal hecho a medida de tus ojos, tu postura, tu receta médica y el armazón que elijás.
          </p>

          <p>
            No vendemos soluciones mágicas ni curamos condiciones visuales, nuestra tarea es puramente óptica y estética. Pero te aseguramos que con la receta de tu oftalmólogo, nuestro asesoramiento personalizado y cristales de calidad como Varilux o Kodak, vas a recuperar la comodidad de ver bien a todas las distancias.
          </p>

          <div className="bg-neutral-900 text-white p-8 rounded-xl mt-12">
            <h4 className="text-2xl font-medium tracking-tight mb-4">¿Tenés tu receta lista?</h4>
            <p className="mb-6">
              Vení a visitarnos a nuestro espacio en Córdoba. Traé la receta de tu oftalmólogo y juntos vamos a encontrar el armazón perfecto y el cristal que mejor se ajuste a tu rutina y presupuesto.
            </p>
            <a href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer" className="inline-block bg-white text-[#111] font-semibold px-6 py-3 hover:bg-neutral-200 transition-colors">
              Contactanos para asesoramiento
            </a>
          </div>
        </section>
      </article>

      <StorefrontFooter />
    </main>
  );
}
