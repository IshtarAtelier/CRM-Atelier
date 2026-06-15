import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import Link from 'next/link';
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Mitos, verdades y primera adaptación a lentes de contacto | Atelier Óptica',
  description: "Todo lo que necesitás saber sobre tu primera vez con lentes de contacto en Córdoba. Oxigenación, descartables y consejos de higiene. Siempre con receta médica. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "mitos lentes contacto"],
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
              Por el equipo de Atelier Óptica
            </p>
            <div className="w-24 h-1 bg-stone-300 mx-auto rounded-full"></div>
          </header>

          <article className="prose prose-stone prose-lg max-w-none">
            <p>
              Dar el salto a los lentes de contacto por primera vez puede generar un montón de preguntas. ¿Duelen? ¿Se pueden perder en el ojo? ¿Son difíciles de cuidar? En <strong>Atelier Óptica</strong> queremos acompañarte a despejar todas esas dudas y contarte por qué hoy, gracias a los avances en materiales, la adaptación es más fácil que nunca.
            </p>
            <p className="font-medium text-stone-700 bg-stone-100 p-4 rounded-lg border-l-4 border-stone-400">
              <strong>Importante:</strong> Antes de pensar en lentes de contacto, el primer paso indiscutible es visitar a tu médico oftalmólogo. En la óptica no realizamos diagnósticos ni recetamos. Nuestra tarea empieza una vez que traés tu receta médica: ahí te asesoramos sobre el mejor material y te acompañamos en el proceso de adaptación.
            </p>

            <h2 className="text-2xl font-serif mt-10 mb-4 text-stone-800">Mitos y verdades más comunes</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-2">Mito: "El lente se me puede ir para atrás del ojo"</h3>
            <p>
              <strong>Verdad:</strong> Físicamente imposible. Tenemos una membrana delgada llamada conjuntiva que cubre la parte blanca del ojo y se conecta con el interior de los párpados. Esto bloquea cualquier paso hacia "atrás". Lo máximo que puede pasar es que el lente se desplace bajo el párpado, pero es fácil de ubicar y retirar.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-2">Mito: "Son incómodos y se sienten todo el tiempo"</h3>
            <p>
              <strong>Verdad:</strong> Si están bien adaptados y corresponden a tu receta, casi ni vas a notar que los llevás puestos. Al principio de tu primera adaptación podés tener una leve sensación de roce, pero los materiales actuales son sumamente suaves y se acomodan al ojo rápidamente.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-2">Mito: "Puedo dormir con los lentes puestos"</h3>
            <p>
              <strong>Verdad:</strong> A menos que tu médico oftalmólogo te haya indicado específicamente un uso prolongado con lentes aprobados para tal fin, la regla de oro es sacarlos antes de dormir. Tus ojos necesitan descansar y respirar libremente.
            </p>

            <h2 className="text-2xl font-serif mt-10 mb-4 text-stone-800">El secreto del confort: La Oxigenación</h2>
            <p>
              Nuestra córnea necesita oxígeno para mantenerse sana, y no lo saca de la sangre, sino directamente del aire. Los lentes de contacto de última generación, como los de hidrogel de silicona, son altamente permeables. Esto significa que dejan pasar una gran cantidad de oxígeno al ojo, manteniéndolo blanco, sano y confortable durante todas las horas de uso que te indicó tu médico.
            </p>

            <h2 className="text-2xl font-serif mt-10 mb-4 text-stone-800">Lentes descartables: Comodidad e higiene</h2>
            <p>
              Hoy en día existen diversas modalidades de reemplazo. Los lentes descartables (ya sean de recambio diario o mensual) son de las mejores opciones que te podemos ofrecer en la óptica. 
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Descartables diarios:</strong> Estrenás un par nuevo cada mañana y lo tirás a la noche. Son ideales si hacés deporte, si viajás, o simplemente si querés la máxima higiene posible, ya que no acumulan depósitos a lo largo de los días ni requieren estuches o líquidos.</li>
              <li><strong>Descartables mensuales:</strong> Se usan todos los días (retirándolos para dormir) y al mes se cambian por un par nuevo. Son una opción muy cómoda y práctica, siempre que mantengas una rutina estricta de limpieza.</li>
            </ul>

            <h2 className="text-2xl font-serif mt-10 mb-4 text-stone-800">Higiene: La regla de oro</h2>
            <p>
              La adaptación exitosa depende en gran medida de tus hábitos. En Atelier Óptica nos tomamos el tiempo para enseñarte cómo poner y sacar los lentes, pero en casa vos sos el responsable de cuidarlos:
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li><strong>Lavate siempre las manos:</strong> Usá jabón neutro y secate con toallas que no dejen pelusas antes de tocar tus ojos o los lentes.</li>
              <li><strong>Usá solo los líquidos recomendados:</strong> Jamás, bajo ninguna circunstancia, laves tus lentes de contacto (ni el estuche) con agua de la canilla. El agua corriente tiene microorganismos que pueden ser peligrosos para tu visión. Usá únicamente las soluciones multipropósito que te recomendemos en base a tu lente.</li>
              <li><strong>Respetá los tiempos de uso:</strong> Si tu lente es mensual, a los 30 días se desecha, aunque "lo sientas bien". La salud de tus ojos es lo primero.</li>
            </ol>

            <h2 className="text-2xl font-serif mt-10 mb-4 text-stone-800">Tu primera experiencia en Atelier Óptica</h2>
            <p>
              Sabemos que la primera vez frente al espejo tratando de ponerte un lente de contacto puede dar nervios. ¡No te preocupes! Vení a nuestro local en Córdoba con la receta de tu médico oftalmólogo. Nos vamos a sentar con vos, con paciencia, a enseñarte los movimientos correctos, la técnica de limpieza y a responderte todas las dudas.
            </p>
            <p>
              Recordá que en Atelier Óptica nuestro objetivo es cuidar tu salud visual con responsabilidad. Estamos para asesorarte con las mejores opciones en óptica y contactología, siempre de la mano de las indicaciones de tu doctor.
            </p>

            <div className="mt-12 bg-stone-100 p-8 rounded-2xl text-center">
              <h3 className="text-2xl font-serif mb-4 text-stone-800">¿Ya fuiste al oftalmólogo y tenés tu receta?</h3>
              <p className="mb-6">Te esperamos en Atelier Óptica para encontrar los lentes de contacto perfectos para vos y acompañarte en tu adaptación.</p>
              <a href="https://wa.me/5493518685644" target="_blank" rel="noopener noreferrer" className="inline-block bg-stone-900 text-white px-8 py-3 rounded-full hover:bg-stone-800 transition-colors">
                Contactanos
              </a>
            </div>
          </article>
        </div>
      </main>

      <StorefrontFooter />
    </div>
  );
}
