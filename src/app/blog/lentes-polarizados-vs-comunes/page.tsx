import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: 'https://atelieroptica.com.ar/blog/lentes-polarizados-vs-comunes' },
  title: { absolute: "Lentes Polarizados vs Comunes: La Mejor Opción para Manejar | Atelier Óptica" },
  description: "Descubrí la diferencia exacta entre anteojos polarizados y de sol comunes. Evitá el deslumbramiento, mejorá tu seguridad vial y descansá la vista. Conseguí tus próximos lentes en Atelier Óptica, Cerro de las Rosas, Córdoba.",
  keywords: ["lentes polarizados vs comunes", "anteojos polarizados Córdoba", "gafas para manejar", "óptica Cerro de las Rosas", "óptica Nueva Córdoba", "cristales polarizados con aumento", "seguridad vial lentes", "comprar anteojos polarizados", "deslumbramiento asfalto"],
};

export default function LentesPolarizadosVsComunes() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <StorefrontNavbar />
      
      <main className="flex-grow container mx-auto px-4 py-12 max-w-4xl">
        <article className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-8 md:p-12">
          <header className="mb-10 text-center">
            <h1 className="text-3xl md:text-5xl font-medium tracking-tight text-slate-900 mb-4">
              Lentes Polarizados vs Comunes: La gran diferencia al manejar
            </h1>
            <p className="text-lg text-slate-600">
              Por Atelier Óptica - Cerro de las Rosas, Córdoba
            </p>
          </header>

          <div className="blog-article w-full max-w-none">
            <p>
              ¿Te pasó alguna vez de ir manejando hacia las sierras de Córdoba al atardecer, o atravesando el bullicio de Nueva Córdoba, y sentir que el reflejo del asfalto o del parabrisas de otros autos te ciega por completo? Ese <strong>deslumbramiento</strong> no solo es extremadamente molesto, sino que representa un peligro real y latente para tu seguridad vial.
            </p>
            
            <p>
              A la hora de elegir un buen par de anteojos de sol, muchos de nuestros clientes en Atelier Óptica nos plantean una duda muy frecuente: <em>&quot;¿Vale la pena invertir en lentes polarizados, o con unos de sol comunes alcanza?&quot;</em> Hoy te contamos exactamente por qué los cristales polarizados marcan un antes y un después definitivo al volante.
            </p>

            <h2 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">
              ¿Qué hacen realmente los lentes de sol comunes?
            </h2>
            <p>
              Los anteojos de sol tradicionales o &quot;comunes&quot; (siempre asumiendo que cuentan con filtro UV 100%, un requisito innegociable para tu salud ocular) simplemente reducen la cantidad general de luz que llega a tus ojos. En otras palabras, oscurecen el entorno de forma pareja. 
            </p>
            <p>
              Esto te ayuda a sentir menos fatiga visual en días muy soleados, pero <strong>no eliminan el resplandor focalizado</strong> que rebota en superficies planas. Si el sol impacta contra el asfalto mojado, la nieve o el capó de un auto en plena avenida, la luz se concentra y rebota directamente hacia tus ojos, causándote ese encandilamiento insoportable. Un lente común solo oscurecerá levemente ese reflejo, pero la molestia aguda y la dificultad en la visión seguirán ahí.
            </p>

            <h2 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">
              La magia del filtro polarizado contra el deslumbramiento
            </h2>
            <p>
              Acá es donde entra la verdadera tecnología óptica avanzada. La luz del sol viaja dispersa en todas direcciones, pero cuando rebota en una superficie horizontal (como la ruta, el pavimento de la ciudad o el agua de un lago), se &quot;polariza&quot;. Esto significa que se concentra en un plano horizontal, creando un brillo cegador muy intenso.
            </p>
            <p>
              Los <strong>cristales polarizados</strong> poseen un filtro especial integrado que funciona como una persiana microscópica: bloquea esa luz horizontal dañina y solo deja pasar la luz vertical, que es la útil para ver el entorno con claridad. El resultado es casi mágico: el reflejo deslumbrante desaparece por completo, revelando una imagen nítida. 
            </p>

            <div className="bg-[#faf8f5] border-l-4 border-black/10 p-6 my-8 rounded-r-lg">
              <h3 className="text-xl font-medium tracking-tight text-[#111] mb-2">Beneficios directos para tu seguridad vial</h3>
              <ul className="list-disc list-inside space-y-2 text-[#111]">
                <li><strong>Tiempo de reacción más rápido:</strong> A 100 km/h en ruta, estar encandilado por un segundo significa avanzar casi 28 metros a ciegas. Eliminar el reflejo te permite anticipar obstáculos a tiempo real.</li>
                <li><strong>Mejor percepción de los colores:</strong> A diferencia de los lentes comunes, los polarizados potencian el contraste natural. Vas a distinguir semáforos, señales de tránsito y luces de freno con colores vibrantes y definidos.</li>
                <li><strong>Reducción drástica de la fatiga visual:</strong> Tus ojos ya no tendrán que hacer un esfuerzo extra ni entrecerrarse para combatir el brillo durante viajes largos o en el tráfico intenso.</li>
              </ul>
            </div>

            <h2 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">
              ¿Se pueden hacer lentes polarizados con aumento?
            </h2>
            <p>
              ¡Absolutamente! Si usás anteojos recetados para ver de lejos (miopía, astigmatismo, etc.), no tenés por qué elegir entre ver nítido o estar protegido del sol. Podés tener ambas soluciones en un solo cristal.
            </p>
            <p>
              Es fundamental remarcar que en Atelier Óptica <strong>no realizamos mediciones de la vista ni diagnosticamos afecciones oculares</strong>. Nuestro consejo ético como ópticos profesionales es que <strong>siempre visites a tu médico oftalmólogo de confianza</strong> al menos una vez al año para un chequeo integral de tu salud visual.
            </p>
            <p>
              Una vez que tu especialista te evalúe y te entregue la receta actualizada, te esperamos en nuestro local ubicado en la zona norte de Córdoba (Cerro de las Rosas). Nosotros nos encargaremos de brindarte un asesoramiento estético y técnico personalizado, armando tus anteojos polarizados a medida, incorporando tu graduación exacta en un armazón de diseño que se adapte perfecto a tu estilo personal.
            </p>

            <h2 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">
              En resumen: Una inversión inteligente
            </h2>
            <p>
              Si manejás habitualmente, hacés viajes largos o simplemente querés disfrutar del aire libre sin molestias, la inversión en cristales polarizados se traduce directamente en <strong>seguridad vial, confort y calidad de vida</strong>. ¡Vení a visitarnos a Atelier Óptica con la receta de tu oftalmólogo y dejá que te mostremos la diferencia! ¡Te aseguramos que tu forma de ver el camino va a cambiar para siempre!
            </p>
          </div>
        
          {/* CTA WHATSAPP AUTOMÁTICO */}
          <div className="mt-16 bg-black/5 p-8 md:p-12 rounded-2xl text-center border border-black/10">
            <h3 className="text-2xl font-medium tracking-tight mb-4">¿Necesitás asesoramiento personalizado?</h3>
            <p className="text-black/70 mb-8 max-w-xl mx-auto">
              Comunicate directamente con nuestro equipo de ópticos por WhatsApp. Estamos listos para ayudarte a encontrar el cristal polarizado y el armazón perfecto para tu receta oftalmológica.
            </p>
            <a 
              href={`https://wa.me/${WHATSAPP_PHONE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-[#25D366] text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-[#1ebe57] transition-all hover:scale-105"
            >
              Consultar por WhatsApp
            </a>
          </div>

        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}