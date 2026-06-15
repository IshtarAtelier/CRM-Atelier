import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Cristales Transitions: ¿Valen la pena para el uso diario? | Atelier Óptica',
  description: "Descubrí cómo la tecnología de lentes fotocromáticos Transitions adapta tus anteojos a cualquier condición de luz. Conocé sus ventajas para el uso diario y protección UV en Atelier Óptica, Córdoba. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "lentes fotocromaticos transitions"],
};

export default function LentesTransitionsPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#111] font-sans selection:bg-black selection:text-white flex flex-col">
      <StorefrontNavbar theme="light" />

      <main className="flex-1 flex flex-col pt-24 lg:pt-32 pb-20">
        <article className="max-w-4xl mx-auto px-6">
          {/* Header */}
          <div className="mb-12 lg:mb-16 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#666] mb-4">Tecnología Óptica</p>
            <h1 className="text-3xl lg:text-5xl font-light tracking-tight mb-6 lg:mb-8 text-[#111]">
              Cristales Transitions: ¿Valen la pena para el uso diario?
            </h1>
            <p className="text-[15px] lg:text-[17px] text-[#444] leading-relaxed max-w-2xl mx-auto">
              Pasar del interior de una oficina al brillo del sol sin cambiar de anteojos es una comodidad innegable. Pero, ¿cómo funciona exactamente la tecnología fotocromática y qué beneficios reales aporta a tu día a día?
            </p>
          </div>

          {/* Hero Image */}
          <div className="w-full h-[300px] md:h-[500px] relative mb-12 lg:mb-16 bg-neutral-200 overflow-hidden rounded-lg">
            <Image 
              src="/images/blog/vidriera-atelier.webp" 
              alt="Anteojos con cristales transitions en Atelier Óptica" 
              fill
              className="object-cover" 
            />
          </div>

          {/* Content */}
          <div className="prose prose-lg prose-neutral max-w-none space-y-12">
            
            <section>
              <h2 className="text-2xl font-medium mb-6 text-[#111]">¿Qué son los cristales fotocromáticos?</h2>
              <div className="bg-white p-8 rounded-lg shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/5">
                <p className="mb-4 text-neutral-700 leading-relaxed">
                  Los cristales fotocromáticos, popularmente conocidos por su marca líder <strong>Transitions®</strong>, son lentes inteligentes que se adaptan a las condiciones de iluminación del entorno. En interiores se mantienen completamente transparentes, como cualquier cristal tradicional. Sin embargo, al entrar en contacto con los rayos ultravioleta (UV) del sol, se oscurecen en cuestión de segundos, convirtiéndose en anteojos de sol.
                </p>
                <p className="text-neutral-700 leading-relaxed">
                  Esta transición fluida permite que un solo par de anteojos cumpla una doble función, brindando confort visual constante sin importar a dónde vayas.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-6 text-[#111]">La tecnología detrás de la magia</h2>
              <p className="mb-6 text-neutral-700 leading-relaxed">
                La magia de estos cristales reside en millones de moléculas fotocromáticas invisibles integradas en el lente. Estas moléculas reaccionan específicamente a la luz ultravioleta. Cuando los rayos UV golpean el cristal, las moléculas cambian de estructura, absorbiendo la luz y oscureciendo el lente.
              </p>
              <p className="mb-6 text-neutral-700 leading-relaxed">
                Cuando volvés a un espacio interior donde no hay luz UV directa, las moléculas regresan a su forma original y los cristales recuperan su claridad. Las generaciones más recientes de Transitions logran este proceso con una velocidad sorprendente, oscureciéndose más rápido al sol y aclarándose velozmente al volver a la sombra.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-6 text-[#111]">Ventajas clave para el uso diario</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-neutral-100 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-[#111]">1. Protección UV Total</h3>
                  <p className="text-neutral-700 text-sm leading-relaxed">
                    Bloquean el 100% de los rayos UVA y UVB nocivos. Al igual que cuidamos nuestra piel del sol, es fundamental proteger nuestros ojos. Estos cristales actúan como un escudo automático.
                  </p>
                </div>
                <div className="bg-neutral-100 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-[#111]">2. Reducción de Fatiga Visual</h3>
                  <p className="text-neutral-700 text-sm leading-relaxed">
                    Al ajustar constantemente la cantidad de luz que llega a tus ojos, reducen el entrecerrar los ojos y el esfuerzo visual excesivo al salir al aire libre.
                  </p>
                </div>
                <div className="bg-neutral-100 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-[#111]">3. Filtro de Luz Azul</h3>
                  <p className="text-neutral-700 text-sm leading-relaxed">
                    La mayoría de los cristales Transitions modernos también filtran la luz azul-violeta, tanto la emitida por el sol en exteriores como la de las pantallas digitales y luces LED en interiores.
                  </p>
                </div>
                <div className="bg-neutral-100 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-[#111]">4. Comodidad y Practicidad</h3>
                  <p className="text-neutral-700 text-sm leading-relaxed">
                    Ya no necesitás estar cambiando entre tus anteojos de receta transparentes y tus anteojos de sol. Tenés todo en un solo armazón, ideal para un estilo de vida dinámico.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-6 text-[#111]">Entonces, ¿valen la pena?</h2>
              <p className="mb-4 text-neutral-700 leading-relaxed">
                Si tu rutina implica entrar y salir constantemente, trabajar en interiores pero almorzar al sol, o si simplemente solés olvidarte los anteojos de sol en casa, los cristales fotocromáticos son una inversión excelente. Te ofrecen protección ininterrumpida y una comodidad inigualable.
              </p>
              <p className="mb-6 text-neutral-700 leading-relaxed">
                Cabe destacar que, debido a que el parabrisas de la mayoría de los autos bloquea los rayos UV, los cristales Transitions tradicionales no se oscurecen al máximo dentro del vehículo. Sin embargo, existen versiones específicas (como Transitions XTRActive) diseñadas para reaccionar incluso detrás del parabrisas.
              </p>
            </section>

            <section className="mt-12 bg-black text-white p-8 lg:p-12 rounded-lg text-center">
              <h3 className="text-xl font-medium mb-4">¿Querés actualizar tus anteojos?</h3>
              <p className="text-sm text-neutral-300 mb-8 max-w-xl mx-auto leading-relaxed">
                Recordá que para armar tus nuevos anteojos fotocromáticos necesitás una receta actualizada. <strong>Te recomendamos visitar a tu médico oftalmólogo de confianza</strong> para un chequeo y obtener tu prescripción. Luego, en Atelier Óptica nos encargamos de asesorarte sobre el mejor cristal Transitions y el armazón ideal para tu graduación.
              </p>
              <a 
                href={`https://wa.me/${WHATSAPP_PHONE}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-block bg-[#faf8f5] text-black px-8 py-4 text-[12px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-colors rounded-sm"
              >
                Escribinos por WhatsApp
              </a>
            </section>

          </div>
        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}
