import { Metadata } from "next";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/control-miopia-infantil-lentes' },
  title: "Control de Miopía Infantil en Córdoba: Lentes Stellest y MyoFix",
  description: "Descubrí cómo los cristales Stellest y MyoFix frenan la miopía infantil. Asesoramiento óptico experto en Córdoba (Cerro de las Rosas, Nueva Córdoba). Envíos a todo el país y cuotas.",
  keywords: ["control miopía infantil", "lentes Stellest Córdoba", "cristales MyoFix", "óptica infantil Córdoba", "Cerro de las Rosas", "Nueva Córdoba", "anteojos para niños", "frenar miopía", "oftalmopediatría", "Atelier Óptica"],
};

export default function ControlMiopiaInfantilPage() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <StorefrontNavbar theme="light" />
      
      <main className="flex-grow container mx-auto px-4 pt-32 pb-20 max-w-4xl">
        <article className="prose prose-stone lg:prose-lg mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif text-stone-900 mb-8 leading-tight">
            Control de Miopía Infantil en Córdoba: Todo sobre Lentes Stellest y MyoFix
          </h1>
          
          <div className="bg-stone-200 p-6 rounded-md mb-10 border-l-4 border-[#c8a55c]">
            <p className="text-sm md:text-base text-stone-800 m-0 font-medium leading-relaxed">
              <strong>Aviso importante:</strong> En Atelier Óptica somos ópticos especialistas, no médicos. Nuestro rol es brindarte el mejor asesoramiento en cristales y armazones basándonos en tu receta previa. Si notás que tu hijo entrecierra los ojos o se acerca mucho a las pantallas, el paso fundamental es <strong>visitar a su oftalmopediatra de confianza</strong>. Solo un profesional de la salud visual puede diagnosticar y recetar la corrección adecuada. No realizamos medición de vista ni diagnósticos en nuestras sucursales.
            </p>
          </div>

          <p className="text-lg text-stone-700 leading-relaxed mb-6">
            ¿Sabías que los casos de miopía en niños han aumentado drásticamente? El uso intensivo de pantallas y la falta de actividades al aire libre son los principales responsables. Sin embargo, la tecnología óptica avanzó a pasos agigantados. Hoy en día, no solo buscamos que los chicos vean bien, sino que contamos con cristales inteligentes diseñados para ralentizar la progresión de este defecto visual.
          </p>

          <h2 className="text-2xl font-serif text-stone-900 mt-10 mb-4">
            ¿Qué significa realmente &quot;control de miopía&quot;?
          </h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            Es crucial entender que la miopía no tiene cura, pero sí se puede frenar su avance. Cuando el oftalmopediatra detecta que la graduación de tu hijo aumenta rápidamente, suele indicar tratamientos ópticos específicos. En <strong>Atelier Óptica</strong>, ubicados estratégicamente para atender a familias de <strong>Cerro de las Rosas, Nueva Córdoba</strong> y toda la <strong>Ciudad de Córdoba</strong>, trabajamos con los laboratorios líderes a nivel mundial: <strong>Stellest de Essilor</strong> y <strong>MyoFix</strong>.
          </p>

          <h2 className="text-2xl font-serif text-stone-900 mt-10 mb-4">
            Cristales Stellest de Essilor: La revolución visual
          </h2>
          <p className="text-stone-700 leading-relaxed mb-4">
            Los lentes <strong>Stellest</strong> representan el mayor avance en óptica pediátrica de los últimos tiempos. Incorporan la tecnología H.A.L.T. (Highly Aspherical Lenslet Target), una innovadora &quot;constelación&quot; de microlentes invisibles distribuidas estratégicamente.
          </p>
          <ul className="list-disc pl-6 text-stone-700 space-y-2 mb-6">
            <li><strong>¿Cómo funcionan?</strong> Mientras el centro del lente corrige la visión para lograr nitidez perfecta, la corona de microlentes genera una señal volumétrica que frena el alargamiento excesivo del ojo, la causa principal del aumento de la miopía.</li>
            <li><strong>Beneficios clave:</strong> Son cristales estéticos, ultradelgados, súper livianos y con una tasa de adaptación inmediata en los más chicos.</li>
          </ul>

          <h2 className="text-2xl font-serif text-stone-900 mt-10 mb-4">
            Cristales MyoFix: Precisión y confort
          </h2>
          <p className="text-stone-700 leading-relaxed mb-4">
            Otra alternativa tecnológica de excelencia es <strong>MyoFix</strong>. Estos cristales actúan mediante el principio de desenfoque periférico, una técnica clínicamente comprobada para el cuidado de la salud visual infantil.
          </p>
          <ul className="list-disc pl-6 text-stone-700 space-y-2 mb-6">
            <li><strong>Diseño inteligente:</strong> Cuentan con una zona central de visión clara, que proporciona la graduación exacta recetada, rodeada por un área de tratamiento periférico.</li>
            <li><strong>Resultados efectivos:</strong> Ayudan a controlar el crecimiento del globo ocular, permitiendo que los chicos estudien, jueguen y disfruten de su día a día sin ningún tipo de molestia.</li>
          </ul>

          <h2 className="text-2xl font-serif text-stone-900 mt-10 mb-4">
            El armazón ideal: Nuestro rol en Atelier Óptica
          </h2>
          <p className="text-stone-700 leading-relaxed mb-4">
            Para que estas tecnologías de vanguardia funcionen al 100%, el centrado exacto del cristal y la elección del marco son <strong>factores críticos</strong>. Es aquí donde nuestra experiencia marca la diferencia.
          </p>
          <p className="text-stone-700 leading-relaxed mb-4">
            A la hora de elegir anteojos para niños, priorizamos armazones que sean:
          </p>
          <ul className="list-disc pl-6 text-stone-700 space-y-2 mb-6">
            <li><strong>Duraderos y seguros:</strong> Materiales flexibles, hipoalergénicos y resistentes a los impactos.</li>
            <li><strong>Estables y ergonómicos:</strong> El cristal debe mantenerse perfectamente posicionado frente al ojo para que la zona terapéutica actúe correctamente.</li>
            <li><strong>Cómodos y con estilo:</strong> ¡Si a tu hijo le encanta su diseño, usará los anteojos todos los días con alegría!</li>
          </ul>

          <h2 className="text-2xl font-serif text-stone-900 mt-10 mb-4">
            ¡Vení a visitarnos en Córdoba Capital!
          </h2>
          <p className="text-stone-700 leading-relaxed mb-8">
            Si el oftalmopediatra ya evaluó a tu pequeño y te entregó la receta para iniciar el tratamiento de control de miopía, te esperamos en <strong>Atelier Óptica</strong>. Ya seas de zona norte, zona sur o del centro, acercáte con tu receta y juntos encontraremos el armazón perfecto para acompañar tu tratamiento. ¡Te brindamos un asesoramiento cálido, estético y sumamente profesional! Además, realizamos envíos a toda Argentina y ofrecemos excelentes planes de financiación.
          </p>

        
          {/* CTA WHATSAPP AUTOMÁTICO */}
          <div className="mt-16 bg-black/5 p-8 md:p-12 rounded-2xl text-center border border-black/10">
            <h3 className="text-2xl font-medium tracking-tight mb-4">¿Necesitás asesoramiento personalizado?</h3>
            <p className="text-black/70 mb-8 max-w-xl mx-auto">
              Comunicate directamente con nuestro equipo de ópticos por WhatsApp. Estamos para ayudarte a encontrar el cristal y armazón perfectos para tu receta oftalmológica, desde Córdoba hacia todo el país.
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