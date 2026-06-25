import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { User, Square, Heart, Info, Glasses } from "lucide-react";
import Link from 'next/link';
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/guia-armazones-segun-rostro' },
  title: "Guía para Elegir Armazones Según tu Rostro | Atelier Óptica Córdoba",
  description: "Descubrí qué anteojos de receta van perfecto con tu rostro. Asesoramiento estético y técnico en Atelier Óptica, Córdoba (zona Cerro de las Rosas y Nueva Córdoba). Envíos a toda Argentina.",
  keywords: ["óptica en Córdoba", "anteojos de receta Córdoba", "lentes según rostro", "armazones de diseño", "Atelier Óptica Cerro de las Rosas", "óptica Nueva Córdoba", "envíos a toda Argentina", "asesoramiento estético anteojos", "guía armazones según rostro", "anteojos de moda", "lentes de receta"],
};

export default function GlassesFrameGuidePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Guía Definitiva para Elegir Armazones Según tu Tipo de Rostro",
    "description": "Descubrí qué anteojos de receta te quedan mejor según la forma de tu rostro. Asesoramiento estético profesional y técnico en Atelier Óptica, Córdoba.",
    "author": {
      "@type": "Organization",
      "name": "Atelier Óptica"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Atelier Óptica",
      "logo": {
        "@type": "ImageObject",
        "url": "https://atelieroptica.com/logo.png"
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col font-sans selection:bg-black selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <StorefrontNavbar />

      <main className="flex-grow">
        {/* HERO SECTION */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-white">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400 mb-4 block">
              Asesoramiento Estético Exclusivo
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6 text-[#111]">
              Guía Definitiva para Elegir Armazones Según tu Tipo de Rostro
            </h1>
            <p className="text-lg text-[#444] leading-relaxed max-w-2xl mx-auto">
              Elegir el armazón perfecto no es solo una cuestión de moda; es un verdadero arte. Encontrar los anteojos de receta que armonicen con tus facciones puede resaltar lo mejor de tu mirada y potenciar tu confianza diaria. Descubrí qué estilo es el ideal para tu tipo de rostro con el asesoramiento de los especialistas de Atelier Óptica.
            </p>
          </div>
        </section>

        {/* CONTENT */}
        <section className="py-12 md:py-20 bg-[#faf8f5]">
          <div className="max-w-3xl mx-auto px-6">
            
            <div className="prose prose-lg prose-neutral max-w-none">
              <p className="text-neutral-700 mb-8">
                Como ópticos especializados en <strong>Atelier Óptica</strong>, todos los días recibimos pacientes en nuestro exclusivo local en <strong>Córdoba</strong> —asesorando a quienes nos visitan desde el <strong>Cerro de las Rosas</strong> hasta <strong>Nueva Córdoba</strong> y zonas aledañas— que nos hacen exactamente la misma pregunta: <em>&quot;¿Qué anteojos me quedan bien?&quot;</em>. Sabemos que la elección de tus próximos <strong>armazones de diseño</strong> es una decisión fundamental. Al final del día, es el accesorio que te acompaña en cada momento, enmarcando tu mirada y definiendo tu estilo personal.
              </p>

              {/* MEDICAL REMINDER */}
              <div className="bg-neutral-100 p-6 rounded-lg border border-black/10 mb-10 flex gap-4 items-start">
                <Info className="w-6 h-6 text-[#444] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-medium text-[#111] m-0 mb-2">Un paso previo y fundamental</h3>
                  <p className="text-neutral-700 m-0 text-sm">
                    Antes de pensar en cuál es tu marco ideal, es vital <strong>visitar a tu médico oftalmólogo</strong>. En nuestra óptica en Córdoba no diagnosticamos ni recetamos. Nuestra vocación es técnica y estética: armar tus <strong>anteojos de receta</strong> con precisión milimétrica basándonos exclusivamente en tu prescripción médica. Una vez que tengas tu receta oftalmológica actualizada, ¡ahí sí empezamos con la magia de la elección estética!
                  </p>
                </div>
              </div>

              <h2 className="text-3xl font-light text-[#111] mt-12 mb-6">El arte de encontrar el equilibrio visual</h2>
              <p className="text-neutral-700 mb-10">
                La regla de oro en el mundo de la óptica para elegir los armazones correctos es buscar el <strong>contraste</strong>. Queremos aportarle a tu rostro exactamente aquello de lo que carece para lograr una armonía perfecta. Si tus facciones tienen líneas muy redondeadas, buscaremos agregar ángulos estructurados; si tus rasgos son fuertes y marcados, apuntaremos a suavizarlos con marcos de líneas más orgánicas.
              </p>

              {/* ROSTRO REDONDO */}
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center text-white">
                    <User className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-medium text-[#111] m-0">Rostro Redondo</h3>
                </div>
                <p className="text-neutral-700 mb-4">
                  Se caracteriza por tener proporciones similares tanto a lo ancho como a lo largo, con mejillas plenas y una línea de mandíbula suave, sin ángulos marcados.
                </p>
                <ul className="list-disc pl-6 text-neutral-700 mb-4 space-y-2">
                  <li><strong>Nuestro objetivo:</strong> Afinar y alargar visualmente el rostro, aportando una estructura que realce tus facciones.</li>
                  <li><strong>Tus armazones ideales:</strong> Formas geométricas definidas, monturas rectangulares o cuadradas. Los armazones de diseño que son ligeramente más anchos que altos te ayudarán a lograr un efecto estilizado y sofisticado.</li>
                  <li><strong>Qué evitar:</strong> Marcos completamente redondos o anteojos demasiado pequeños, ya que acentuarán la redondez natural de tu cara.</li>
                </ul>
              </div>

              {/* ROSTRO CUADRADO */}
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center text-white">
                    <Square className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-medium text-[#111] m-0">Rostro Cuadrado</h3>
                </div>
                <p className="text-neutral-700 mb-4">
                  Este tipo de rostro presenta una frente amplia, con los pómulos y la línea de la mandíbula fuertemente alineados y ángulos bien definidos.
                </p>
                <ul className="list-disc pl-6 text-neutral-700 mb-4 space-y-2">
                  <li><strong>Nuestro objetivo:</strong> Suavizar las líneas angulares de la mandíbula y aportar mayor longitud visual a tu rostro.</li>
                  <li><strong>Tus armazones ideales:</strong> Marcos redondos, diseños ovalados o el clásico e infalible estilo aviador. Los anteojos que superan ligeramente el ancho de tus pómulos lograrán un equilibrio magistral. Las monturas delgadas o de metal aportarán una elegancia sutil.</li>
                  <li><strong>Qué evitar:</strong> Formas demasiado geométricas o cuadradas con bordes duros, ya que endurecerán tu expresión natural.</li>
                </ul>
              </div>

              {/* ROSTRO CORAZÓN */}
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center text-white">
                    <Heart className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-medium text-[#111] m-0">Rostro Corazón</h3>
                </div>
                <p className="text-neutral-700 mb-4">
                  Fácil de identificar por una frente más amplia, pómulos altos y definidos, y una barbilla que se estrecha sutilmente.
                </p>
                <ul className="list-disc pl-6 text-neutral-700 mb-4 space-y-2">
                  <li><strong>Nuestro objetivo:</strong> Minimizar el peso visual en la parte superior del rostro y balancearlo armoniosamente con la delicadeza de la zona inferior.</li>
                  <li><strong>Tus armazones ideales:</strong> Monturas más amplias en la base, las siempre seductoras formas <em>cat-eye</em> (ojo de gato), armazones al aire (ranurados) o diseños en acetatos traslúcidos. El estilo retro es espectacular para estos casos.</li>
                  <li><strong>Qué evitar:</strong> Armazones excesivamente gruesos en la parte superior o con apliques llamativos en la línea de las cejas, ya que concentrarán toda la atención en la zona más ancha de tu rostro.</li>
                </ul>
              </div>

              <hr className="border-black/10 my-10" />

              <h2 className="text-2xl font-medium text-[#111] mb-4">La importancia del confort visual y el ajuste perfecto</h2>
              <p className="text-neutral-700 mb-6">
                Más allá de la estética y las últimas tendencias, el armazón de diseño que elijas debe permitir que tus <strong>cristales oftálmicos</strong> recetados queden centrados con absoluta precisión óptica. Como especialistas en nuestra sucursal de <strong>Atelier Óptica</strong> en Córdoba, garantizamos que la montura se adapte ergonómicamente a tu tabique nasal, que las patillas tengan el largo exacto y que el peso total sea tan ligero y confortable que olvides que los llevás puestos durante todo el día.
              </p>
              
              <div className="bg-black text-white p-8 rounded-xl text-center mt-12">
                <Glasses className="w-10 h-10 mx-auto mb-4 opacity-80" />
                <h3 className="text-2xl font-light mb-4">¿Ya tenés tu receta oftalmológica lista?</h3>
                <p className="text-white/80 mb-6 max-w-lg mx-auto">
                  Acercate con tu prescripción médica a nuestra óptica en <strong>Córdoba</strong> (a minutos de Nueva Córdoba y el Cerro). Te brindaremos un asesoramiento de imagen personalizado para que descubras ese armazón que potencie tu estilo al máximo nivel. Si no estás en la ciudad, ¡no te preocupes! Realizamos <strong>envíos seguros a toda la Argentina</strong>.
                </p>
                <Link 
                  href="/turnos" 
                  className="inline-block bg-[#faf8f5] text-black px-8 py-3 font-medium rounded-full hover:bg-neutral-200 transition-colors"
                >
                  Agendar un Turno Exclusivo
                </Link>
              </div>

            </div>
          </div>
        </section>
      
        {/* CTA WHATSAPP AUTOMÁTICO */}
        <div className="max-w-4xl mx-auto px-6 mb-16">
          <div className="bg-black/5 p-8 md:p-12 rounded-2xl text-center border border-black/10">
            <h3 className="text-2xl font-medium tracking-tight mb-4">¿Necesitás asesoramiento online personalizado?</h3>
            <p className="text-black/70 mb-8 max-w-xl mx-auto">
              Escribinos directamente por WhatsApp. Nuestro equipo de profesionales ópticos está listo para ayudarte a elegir los cristales y el armazón ideal según tu receta, ya sea que te encuentres en Córdoba capital, el Gran Córdoba o en cualquier rincón del país.
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
        </div>

      </main>

      
      <StorefrontFooter />
    </div>
  );
}
