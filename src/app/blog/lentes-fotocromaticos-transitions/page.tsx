import { Metadata } from 'next';
import Image from 'next/image';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/lentes-fotocromaticos-transitions' },
  title: "Lentes Fotocromáticos Transitions: ¿Valen la Pena? | Óptica en Córdoba",
  description: "Descubrí cómo los cristales fotocromáticos Transitions protegen tu visión y se adaptan a la luz. Asesoramiento experto en Atelier Óptica, zona Cerro de las Rosas y Nueva Córdoba. ¡Envíos a toda Argentina!",
  keywords: ["lentes fotocromáticos transitions", "cristales transitions", "anteojos inteligentes", "óptica Cerro de las Rosas", "óptica Nueva Córdoba", "Atelier Óptica Córdoba", "protección UV", "anteojos de receta", "envíos a toda Argentina"],
};

export default function LentesTransitionsPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#111] font-sans selection:bg-black selection:text-white flex flex-col">
      <StorefrontNavbar theme="light" />

      <main className="flex-1 flex flex-col pt-24 lg:pt-32 pb-20">
        <article className="max-w-4xl mx-auto px-6">
          {/* Header */}
          <div className="mb-12 lg:mb-16 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#666] mb-4">Tecnología Óptica y Confort Visual</p>
            <h1 className="text-3xl lg:text-5xl font-light tracking-tight mb-6 lg:mb-8 text-[#111]">
              Cristales Transitions: ¿Realmente valen la pena para tu uso diario?
            </h1>
            <p className="text-[15px] lg:text-[17px] text-[#444] leading-relaxed max-w-2xl mx-auto">
              Pasar del interior de una oficina al resplandor del sol sin tener que cambiar de anteojos es una comodidad absoluta. Pero, ¿cómo funciona exactamente la tecnología fotocromática y qué beneficios reales le aporta a tu visión diaria en una ciudad tan dinámica como Córdoba?
            </p>
          </div>

          {/* Hero Image */}
          <div className="w-full h-[300px] md:h-[500px] relative mb-12 lg:mb-16 bg-neutral-200 overflow-hidden rounded-lg">
            <Image
              src="/images/blog/vidriera-atelier.webp" 
              alt="Anteojos con cristales Transitions en Atelier Óptica" 
              fill
              sizes="(max-width: 768px) 100vw, 800px"
              className="object-cover" 
            />
          </div>

          {/* Content */}
          <div className="blog-article w-full max-w-none">
            
            <section>
              <h2 className="text-2xl font-medium mb-6 text-[#111]">¿Qué son exactamente los lentes fotocromáticos?</h2>
              <div className="bg-white p-8 rounded-lg shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/5">
                <p className="mb-4 text-neutral-700 leading-relaxed">
                  Los cristales fotocromáticos, reconocidos mundialmente por su marca líder <strong>Transitions&reg;</strong>, son lentes inteligentes diseñados para adaptarse a las variaciones de iluminación de tu entorno. En ambientes interiores permanecen completamente transparentes, igual que un cristal graduado tradicional. Sin embargo, al recibir los rayos ultravioleta (UV) del sol, se oscurecen en cuestión de segundos, transformándose en auténticos anteojos de sol.
                </p>
                <p className="text-neutral-700 leading-relaxed">
                  Esta transición imperceptible permite que un solo armazón cumpla una doble función esencial, garantizando un confort visual superior tanto si estás trabajando en Nueva Córdoba como si paseás por el Cerro de las Rosas.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-6 text-[#111]">La innovación detrás del cambio</h2>
              <p className="mb-6 text-neutral-700 leading-relaxed">
                El secreto de estos cristales radica en millones de moléculas fotocromáticas invisibles, calibradas para reaccionar exclusivamente ante la luz ultravioleta. Cuando los rayos UV impactan la superficie, estas moléculas modifican su estructura al instante, absorbiendo la luz y oscureciendo el cristal con precisión óptica.
              </p>
              <p className="mb-6 text-neutral-700 leading-relaxed">
                Al regresar a un espacio cerrado, libre de radiación UV directa, las moléculas recuperan su estado original y los lentes vuelven a ser cristalinos. La última generación de tecnología Transitions agiliza este proceso a un ritmo asombroso, ofreciendo una respuesta inmediata ante los cambios climáticos típicos de nuestra región.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-6 text-[#111]">4 beneficios clave de elegir lentes Transitions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-neutral-100 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-[#111]">1. Protección UV 100% Garantizada</h3>
                  <p className="text-neutral-700 text-sm leading-relaxed">
                    Bloquean totalmente los nocivos rayos UVA y UVB. Así como protegemos nuestra piel con protector solar, es indispensable cuidar nuestra salud ocular. Estos cristales funcionan como un escudo protector automático y permanente.
                  </p>
                </div>
                <div className="bg-neutral-100 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-[#111]">2. Prevención de la Fatiga Visual</h3>
                  <p className="text-neutral-700 text-sm leading-relaxed">
                    Al regular continuamente la intensidad de luz que ingresa al ojo, evitan que entrecerremos los párpados y minimizan el desgaste visual crónico al enfrentarnos al sol brillante.
                  </p>
                </div>
                <div className="bg-neutral-100 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-[#111]">3. Bloqueo de Luz Azul-Violeta</h3>
                  <p className="text-neutral-700 text-sm leading-relaxed">
                    Las versiones más vanguardistas de Transitions también filtran la luz azul emitida tanto por el sol como por las pantallas digitales (celulares, computadoras) y las luces LED de interiores.
                  </p>
                </div>
                <div className="bg-neutral-100 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-[#111]">4. Practicidad Absoluta en un Solo Armazón</h3>
                  <p className="text-neutral-700 text-sm leading-relaxed">
                    Olvidate de alternar constantemente entre tus anteojos de lectura y tus gafas de sol. Tenés la graduación y la protección solar integradas en un diseño perfecto para tu estilo de vida activo.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-6 text-[#111]">El veredicto: ¿Son la mejor inversión para tus ojos?</h2>
              <p className="mb-4 text-neutral-700 leading-relaxed">
                Si tu día a día exige moverte sin pausa &mdash;de la oficina a la calle, o a un café al aire libre&mdash; y siempre terminás olvidando tus lentes de sol, los cristales fotocromáticos son una decisión sumamente inteligente. Te garantizan protección continua, un cuidado ocular preventivo y una calidad visual premium sin interrupciones.
              </p>
              <p className="mb-6 text-neutral-700 leading-relaxed">
                Un detalle importante: como el parabrisas de la mayoría de los vehículos ya bloquea los rayos UV, los lentes Transitions clásicos no se oscurecen del todo al manejar. Pero no te preocupes, en <strong>Atelier Óptica</strong> contamos con opciones avanzadas, como <em>Transitions XTRActive</em>, diseñadas específicamente para activarse incluso dentro del auto, ideal para quienes recorren Córdoba al volante.
              </p>
            </section>

            <section className="mt-12 bg-black text-white p-8 lg:p-12 rounded-lg text-center">
              <h3 className="text-xl font-medium mb-4">¿Listo para elevar tu experiencia visual?</h3>
              <p className="text-sm text-neutral-300 mb-8 max-w-xl mx-auto leading-relaxed">
                Recordá que para confeccionar tus nuevos anteojos inteligentes requerimos una receta al día. <strong>Te sugerimos agendar un control con tu médico oftalmólogo</strong> para obtener tu prescripción exacta. Después, el equipo de <strong>Atelier Óptica</strong> se encargará de asesorarte personalmente para fusionar la mejor tecnología Transitions con un armazón que potencie tu estilo.
              </p>
              <a 
                href={`https://wa.me/${WHATSAPP_PHONE}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-block bg-[#faf8f5] text-black px-8 py-4 text-[12px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-colors rounded-sm"
              >
                Asesorate por WhatsApp
              </a>
            </section>

          </div>
        </article>
      </main>

      <StorefrontFooter />
    </div>
  );
}