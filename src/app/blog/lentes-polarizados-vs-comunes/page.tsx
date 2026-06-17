import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/lentes-polarizados-vs-comunes' },
  title: "Lentes Polarizados vs Comunes al Manejar",
  description: "Descubrí la diferencia entre lentes polarizados y de sol comunes. Evitá el deslumbramiento, mejorá tu seguridad vial y descansá tu vista en la ruta. Encontrá tus próximos anteojos de sol en Atelier Óptica, Córdoba. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "lentes polarizados vs comunes"],
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
              Por Atelier Óptica - Córdoba, Argentina
            </p>
          </header>

          <div className="prose prose-slate md:prose-lg max-w-none text-slate-700 space-y-6">
            <p>
              ¿Te pasó alguna vez de ir manejando por las sierras de Córdoba al atardecer, o incluso en plena ciudad, y sentir que el reflejo del asfalto o del parabrisas de otros autos te ciega por completo? Ese <strong>deslumbramiento</strong> no solo es muy molesto, sino que representa un peligro real para la seguridad vial.
            </p>
            
            <p>
              A la hora de elegir un buen par de anteojos de sol, muchos de nuestros clientes en Atelier Óptica nos preguntan: <em>"¿Vale la pena invertir en lentes polarizados, o con unos de sol comunes alcanza?"</em> Hoy te contamos exactamente por qué los cristales polarizados marcan un antes y un después al volante.
            </p>

            <h2 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">
              ¿Qué hacen los lentes de sol comunes?
            </h2>
            <p>
              Los anteojos de sol tradicionales o "comunes" (siempre hablando de aquellos que tienen filtro UV 100%, algo que jamás deberías negociar) reducen la cantidad general de luz que llega a tus ojos. Es decir, oscurecen tu entorno. 
            </p>
            <p>
              Esto te ayuda a sentir menos fatiga visual en días muy soleados, pero <strong>no eliminan el resplandor</strong> que rebota en superficies planas. Si el sol pega contra el asfalto mojado, la nieve o el capó de otro auto, la luz se concentra y rebota directamente hacia tus ojos, causándote ese encandilamiento insoportable. Un lente común solo oscurecerá ese reflejo, pero te seguirá molestando y dificultando la visión.
            </p>

            <h2 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">
              La magia del filtro polarizado contra el deslumbramiento
            </h2>
            <p>
              Acá es donde entra la tecnología óptica avanzada. La luz del sol viaja en todas direcciones, pero cuando rebota en una superficie horizontal (como la ruta o el agua), se "polariza" y se vuelve horizontal, creando un brillo muy intenso.
            </p>
            <p>
              Los <strong>cristales polarizados</strong> tienen un filtro especial que bloquea esa luz horizontal y solo deja pasar la luz vertical, que es útil para ver. El resultado es mágico: el reflejo deslumbrante desaparece casi por completo. 
            </p>

            <div className="bg-[#faf8f5] border-l-4 border-black/10 p-6 my-8 rounded-r-lg">
              <h3 className="text-xl font-medium tracking-tight text-[#111] mb-2">Beneficios directos para tu seguridad vial</h3>
              <ul className="list-disc list-inside space-y-2 text-[#111]">
                <li><strong>Tiempo de reacción más rápido:</strong> A 100 km/h, estar encandilado por un segundo significa avanzar casi 28 metros a ciegas. Eliminar el reflejo te permite ver obstáculos a tiempo.</li>
                <li><strong>Mejor percepción de colores:</strong> A diferencia de los lentes comunes, los polarizados mejoran el contraste. Vas a ver los semáforos, señales de tránsito y luces de freno de los otros autos con colores mucho más definidos.</li>
                <li><strong>Menor fatiga visual:</strong> Tus ojos no van a tener que estar haciendo un esfuerzo extra ni entrecerrándose para combatir el brillo durante viajes largos.</li>
              </ul>
            </div>

            <h2 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">
              ¿Se pueden hacer polarizados con aumento?
            </h2>
            <p>
              ¡Absolutamente! Si usás anteojos recetados para ver de lejos, no tenés por qué elegir entre ver nítido o estar protegido del sol. 
            </p>
            <p>
              Es fundamental remarcar que en Atelier Óptica <strong>no realizamos mediciones de la vista ni diagnosticamos afecciones oculares</strong>. Nuestro consejo como ópticos profesionales es que <strong>siempre visites a tu médico oftalmólogo</strong> al menos una vez al año para el cuidado integral de tu salud visual.
            </p>
            <p>
              Una vez que tu médico oftalmólogo te evalúe y te entregue tu receta, traela a nuestro local. Nosotros nos encargaremos de brindarte un asesoramiento personalizado y armar tus lentes polarizados a medida, incorporando tu graduación exacta en un armazón que se adapte perfecto a tu estilo.
            </p>

            <h2 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">
              En resumen
            </h2>
            <p>
              Si manejás habitualmente, hacés viajes largos o trabajás al volante, la inversión en cristales polarizados se traduce directamente en <strong>seguridad vial y confort</strong>. Vení a visitarnos a Atelier Óptica con la receta de tu médico y dejá que te mostremos la diferencia. ¡Te aseguramos que tus viajes en ruta van a cambiar por completo!
            </p>
          </div>
        
          {/* CTA WHATSAPP AUTOMÁTICO */}
          <div className="mt-16 bg-black/5 p-8 md:p-12 rounded-2xl text-center border border-black/10">
            <h3 className="text-2xl font-medium tracking-tight mb-4">¿Necesitás asesoramiento personalizado?</h3>
            <p className="text-black/70 mb-8 max-w-xl mx-auto">
              Comunicate directamente con nuestro equipo de ópticos por WhatsApp. Estamos para ayudarte a encontrar el cristal y armazón perfecto según tu receta oftalmológica.
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
