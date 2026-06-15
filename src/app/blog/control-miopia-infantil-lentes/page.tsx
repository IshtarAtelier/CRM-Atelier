import { Metadata } from "next";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  title: "Control de Miopía Infantil: Todo sobre Stellest y MyoFix | Atelier Óptica",
  description: "Descubrí cómo los cristales Stellest y MyoFix ayudan a ralentizar el avance de la miopía en niños. Asesoramiento óptico en Córdoba basado en tu receta oftalmológica. ¡Consultá a tu oftalmopediatra y vení a visitarnos! Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "control miopia infantil lentes"],
};

export default function ControlMiopiaInfantilPage() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <StorefrontNavbar theme="light" />
      
      <main className="flex-grow container mx-auto px-4 pt-32 pb-20 max-w-4xl">
        <article className="prose prose-stone lg:prose-lg mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif text-stone-900 mb-8 leading-tight">
            Control de Miopía Infantil: Todo sobre Stellest y MyoFix
          </h1>
          
          <div className="bg-stone-200 p-6 rounded-md mb-10 border-l-4 border-[#c8a55c]">
            <p className="text-sm md:text-base text-stone-800 m-0 font-medium leading-relaxed">
              <strong>Importante:</strong> En Atelier Óptica somos ópticos, no médicos. Nuestro rol es asesorarte sobre los mejores cristales y armazones basándonos en tu receta previa. Si notás que tu hijo no ve bien, el primer paso y el más fundamental es <strong>visitar a su médico oftalmopediatra</strong>. Solo el profesional de la salud puede diagnosticar y recetar la corrección adecuada. Jamás medimos la vista ni diagnosticamos en nuestro local.
            </p>
          </div>

          <p className="text-lg text-stone-700 leading-relaxed mb-6">
            En los últimos años, seguramente escuchaste hablar cada vez más sobre la miopía en los chicos. El uso constante de pantallas y la menor cantidad de tiempo al aire libre hicieron que los casos aumenten muchísimo. Pero la buena noticia es que la tecnología óptica también avanzó a pasos agigantados. Hoy en día, contamos con cristales diseñados específicamente no solo para corregir la visión, sino para ayudar a ralentizar el avance de la miopía.
          </p>

          <h2 className="text-2xl font-serif text-stone-900 mt-10 mb-4">
            ¿Qué significa "control de miopía"?
          </h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            Es fundamental aclarar que la miopía no tiene "cura". Sin embargo, existen tratamientos y tecnologías ópticas que ayudan a frenar su progresión. Cuando el oftalmopediatra de tu hijo detecta que su miopía avanza rápido, puede recetarle cristales especiales. En nuestro local en Córdoba, trabajamos con tecnologías líderes en el mercado, como <strong>Stellest de Essilor</strong> y <strong>MyoFix</strong>.
          </p>

          <h2 className="text-2xl font-serif text-stone-900 mt-10 mb-4">
            Cristales Stellest (Essilor)
          </h2>
          <p className="text-stone-700 leading-relaxed mb-4">
            Los cristales Stellest son una verdadera revolución en la óptica pediátrica. Utilizan una tecnología llamada "H.A.L.T." (Highly Aspherical Lenslet Target), que consiste en una constelación de microlentes invisibles distribuidas en el cristal. 
          </p>
          <ul className="list-disc pl-6 text-stone-700 space-y-2 mb-6">
            <li><strong>¿Cómo funcionan?</strong> Mientras el centro del cristal corrige la miopía para que tu hijo vea nítido, las microlentes crean un volumen de señal que ayuda a frenar el alargamiento del ojo, que es la principal causa de que la miopía aumente.</li>
            <li><strong>Beneficios:</strong> Son estéticos, finos, livianos y súper fáciles de adaptar para los chicos.</li>
          </ul>

          <h2 className="text-2xl font-serif text-stone-900 mt-10 mb-4">
            Cristales MyoFix
          </h2>
          <p className="text-stone-700 leading-relaxed mb-4">
            Los cristales MyoFix representan otra excelente alternativa tecnológica para el manejo de la miopía infantil, basándose en el principio de desenfoque periférico.
          </p>
          <ul className="list-disc pl-6 text-stone-700 space-y-2 mb-6">
            <li><strong>El diseño:</strong> Presentan una zona central de visión clara que proporciona la corrección exacta que recetó el médico, rodeada de una zona de tratamiento especial.</li>
            <li><strong>El resultado:</strong> Ayudan a controlar el crecimiento del globo ocular y son muy cómodos para que los chicos jueguen, estudien y hagan su vida normal sin molestias.</li>
          </ul>

          <h2 className="text-2xl font-serif text-stone-900 mt-10 mb-4">
            El armazón ideal: Nuestro rol en Atelier Óptica
          </h2>
          <p className="text-stone-700 leading-relaxed mb-4">
            Para que estas tecnologías de vanguardia funcionen correctamente, la elección del armazón y el centrado exacto del cristal son <strong>clave</strong>. Ahí es donde entramos nosotros con nuestra experiencia óptica.
          </p>
          <p className="text-stone-700 leading-relaxed mb-4">
            Los chicos necesitan armazones que sean:
          </p>
          <ul className="list-disc pl-6 text-stone-700 space-y-2 mb-6">
            <li><strong>Duraderos y seguros:</strong> Materiales flexibles y resistentes a los golpes.</li>
            <li><strong>Estables:</strong> El cristal debe mantenerse en la posición correcta frente al ojo para que la zona de tratamiento haga su efecto.</li>
            <li><strong>Cómodos y cancheros:</strong> ¡Si a tu hijo le gustan sus anteojos, los va a usar con ganas!</li>
          </ul>

          <h2 className="text-2xl font-serif text-stone-900 mt-10 mb-4">
            Vení a visitarnos
          </h2>
          <p className="text-stone-700 leading-relaxed mb-8">
            Si el oftalmopediatra ya evaluó a tu hijo y te entregó una receta para el control de la miopía, te esperamos en <strong>Atelier Óptica</strong>. Traé la receta y juntos vamos a buscar el armazón perfecto para acompañar el tratamiento con cristales Stellest o MyoFix. ¡Te asesoramos con la calidez y el profesionalismo de siempre!
          </p>

        
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
