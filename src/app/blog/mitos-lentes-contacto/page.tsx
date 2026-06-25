import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/mitos-lentes-contacto' },
  title: "Mitos, verdades y primera adaptación a lentes de contacto en Córdoba",
  description: "Descubrí la verdad sobre los lentes de contacto. Guía para tu primera adaptación en Córdoba (Cerro de las Rosas, Nueva Córdoba). Oxigenación, descartables e higiene. Consultá con tu oftalmólogo y visitá Atelier Óptica.",
  keywords: ["lentes de contacto Córdoba", "adaptación lentes de contacto", "mitos lentes de contacto", "óptica Cerro de las Rosas", "óptica Nueva Córdoba", "lentes descartables", "Atelier Óptica", "salud visual", "cuotas sin interés"],
};

export default function LentesDeContactoBlog() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-800">
      <StorefrontNavbar />
      
      <main className="flex-grow">
        <div className="container mx-auto px-4 py-16 max-w-3xl">
          <header className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-serif text-stone-900 mb-4 leading-tight">
              Mitos, verdades y tu primera adaptación a lentes de contacto
            </h1>
            <p className="text-lg text-stone-600 mb-6">
              Por el equipo de Atelier Óptica, tu óptica de confianza en Córdoba
            </p>
            <div className="w-24 h-1 bg-stone-300 mx-auto rounded-full"></div>
          </header>

          <article className="prose prose-stone prose-lg max-w-none">
            <p>
              Dar el salto a los lentes de contacto por primera vez puede generar dudas e inseguridades. ¿Duelen? ¿Se pueden perder detrás del ojo? ¿Serán muy difíciles de cuidar? En <strong>Atelier Óptica</strong> —con atención de primera tanto para quienes nos visitan desde el <strong>Cerro de las Rosas</strong> como desde <strong>Nueva Córdoba</strong> y alrededores— queremos acompañarte. Hoy te ayudamos a despejar todos esos miedos y te contamos por qué, gracias a la innovación en biometría y materiales, la adaptación es más cómoda, segura y rápida que nunca.
            </p>
            <p className="font-medium text-stone-700 bg-stone-100 p-4 rounded-lg border-l-4 border-stone-400">
              <strong>Paso Cero:</strong> Antes de considerar el uso de lentes de contacto, tu primer paso siempre debe ser consultar a tu <strong>médico oftalmólogo</strong>. En nuestra óptica no realizamos diagnósticos oftalmológicos. Nuestra magia comienza cuando nos traés tu receta: a partir de ahí, te brindamos un asesoramiento estético y técnico de excelencia para encontrar el material ideal y guiarte en cada etapa de la adaptación.
            </p>

            <h2 className="text-2xl font-serif mt-10 mb-4 text-stone-800">Los 3 mitos más comunes sobre los lentes de contacto</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-2">Mito #1: &quot;El lente se me puede ir detrás del ojo&quot;</h3>
            <p>
              <strong>Verdad:</strong> Es anatómicamente imposible. Existe una fina membrana protectora, llamada conjuntiva, que recubre la parte blanca del ojo y se conecta directamente con el interior de tus párpados. Esto forma una barrera que bloquea cualquier paso hacia &quot;atrás&quot;. Lo máximo que podría ocurrir es que el lente se deslice mínimamente bajo el párpado, pero resulta muy fácil de reubicar y retirar.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-2">Mito #2: &quot;Son incómodos y siento que los tengo puestos todo el día&quot;</h3>
            <p>
              <strong>Verdad:</strong> Si están correctamente adaptados y respetan la graduación exacta de tu receta, prácticamente olvidarás que los llevás puestos. Si bien durante los primeros días de tu adaptación podés sentir una leve sensación de roce, los materiales de vanguardia con los que trabajamos se amoldan a la curvatura de tu ojo en tiempo récord.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-2">Mito #3: &quot;Puedo dormir con mis lentes sin problemas&quot;</h3>
            <p>
              <strong>Verdad:</strong> A menos que tu oftalmólogo te haya recetado expresamente lentes de uso prolongado (aprobados para dormir con ellos), la regla inquebrantable es retirarlos antes de ir a la cama. Tus ojos, al igual que vos, necesitan descansar, hidratarse de forma natural y respirar.
            </p>

            <h2 className="text-2xl font-serif mt-10 mb-4 text-stone-800">El verdadero secreto del confort absoluto: La Oxigenación</h2>
            <p>
              Para mantenerse sana y cristalina, nuestra córnea necesita oxígeno, y lo obtiene directamente del aire, no de la sangre. Los lentes de contacto de última generación —como los fabricados en hidrogel de silicona— destacan por su altísima permeabilidad. Esto permite que fluya una cantidad óptima de oxígeno hacia tu ojo, manteniéndolo blanco, fresco y sin irritaciones durante toda la jornada indicada por el profesional.
            </p>

            <h2 className="text-2xl font-serif mt-10 mb-4 text-stone-800">Lentes descartables: Tu visión con la máxima higiene</h2>
            <p>
              Actualmente, el mercado ofrece modalidades de reemplazo que se ajustan a cualquier estilo de vida. Los lentes de contacto descartables (sean de recambio diario o mensual) representan una de las soluciones más seguras e higiénicas que te podemos ofrecer en <strong>Atelier Óptica</strong>.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Descartables diarios:</strong> El lujo de estrenar un par cada mañana y desecharlo por la noche. Son la elección número uno si practicás deportes, viajás constantemente o simplemente priorizás la máxima higiene. Al no acumular proteínas ni requerir líquidos o estuches, reducen el riesgo de infecciones al mínimo.</li>
              <li><strong>Descartables mensuales:</strong> Diseñados para usarse durante el día y retirarse para dormir. Al cumplirse el mes de uso, se reemplazan. Representan una alternativa sumamente práctica y rentable, siempre y cuando te comprometas con una rutina de limpieza rigurosa.</li>
            </ul>

            <h2 className="text-2xl font-serif mt-10 mb-4 text-stone-800">Higiene: La regla de oro en contactología</h2>
            <p>
              Una adaptación exitosa depende en gran parte de tu compromiso. En nuestra sucursal nos tomamos todo el tiempo necesario para enseñarte cómo colocar y retirar tus lentes. Sin embargo, en casa, el cuidado diario está en tus manos:
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li><strong>Lavate las manos siempre:</strong> Utilizá jabón neutro y secalas con toallas de papel o paños que no desprendan pelusas antes de manipular los lentes o tocar tus ojos.</li>
              <li><strong>Exclusividad de líquidos:</strong> Jamás laves tus lentes o el estuche con agua de la canilla o mineral. El agua contiene microorganismos invisibles (como la <em>Acanthamoeba</em>) que ponen en riesgo tu visión. Utilizá de forma exclusiva las soluciones multipropósito certificadas que te recomendemos.</li>
              <li><strong>Respetá las fechas de vencimiento:</strong> Si tus lentes son mensuales, a los 30 días deben ir a la basura, incluso si los &quot;sentís bien&quot;. Ahorrar unos días de uso nunca vale más que la salud de tus ojos.</li>
            </ol>

            <h2 className="text-2xl font-serif mt-10 mb-4 text-stone-800">Vení a vivir tu primera experiencia en Atelier Óptica</h2>
            <p>
              Entendemos perfectamente que enfrentarte al espejo intentando colocarte un lente por primera vez puede generar algo de ansiedad. ¡Tranquilidad total! Te invitamos a visitarnos en <strong>Córdoba</strong> con tu receta oftalmológica en mano. Nos sentaremos con vos, con infinita paciencia, para practicar la técnica correcta de colocación, repasar la rutina de limpieza y erradicar cualquier inquietud que tengas.
            </p>
            <p>
              Recordá que en <strong>Atelier Óptica</strong> nuestra prioridad es tu bienestar visual. Brindamos envíos a toda Argentina y cuotas sin interés, asegurando que tu única preocupación sea disfrutar de una visión impecable, apoyada siempre en las directrices de tu médico.
            </p>

            <div className="mt-12 bg-stone-100 p-8 rounded-2xl text-center shadow-sm">
              <h3 className="text-2xl font-serif mb-4 text-stone-800">¿Ya visitaste a tu oftalmólogo y tenés la receta lista?</h3>
              <p className="mb-6 text-stone-600">Te esperamos para encontrar los lentes de contacto perfectos para vos y acompañarte en cada paso de tu adaptación.</p>
              <a href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer" className="inline-block bg-stone-900 text-white px-8 py-3 rounded-full hover:bg-stone-800 transition-colors shadow-md hover:shadow-lg font-medium">
                Quiero agendar mi asesoramiento
              </a>
            </div>
          </article>
        </div>
      </main>

      <StorefrontFooter />
    </div>
  );
}
