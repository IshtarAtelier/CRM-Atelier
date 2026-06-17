import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { User, Square, Heart, Info, Glasses } from "lucide-react";
import Link from 'next/link';
import { WHATSAPP_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: '/blog/guia-armazones-segun-rostro' },
  title: "Guía Definitiva para Elegir Armazones Según tu Rostro",
  description: "Descubrí qué anteojos te quedan mejor según la forma de tu rostro (redondo, cuadrado, corazón). Asesoramiento estético profesional en Atelier Óptica, Córdoba. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "guia armazones segun rostro"],
};

export default function GlassesFrameGuidePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Guía definitiva para elegir armazones según la forma de tu rostro",
    "description": "Descubrí qué anteojos te quedan mejor según la forma de tu rostro (redondo, cuadrado, corazón). Asesoramiento estético profesional en Atelier Óptica.",
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
              Asesoramiento Estético
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-[#555]xl font-light tracking-tight mb-6 text-[#111]">
              Guía definitiva para elegir armazones según tu rostro
            </h1>
            <p className="text-lg text-[#444] leading-relaxed max-w-2xl mx-auto">
              Elegir el armazón perfecto no es solo una cuestión de moda, es un arte. Encontrar los anteojos que armonicen con tus facciones puede resaltar lo mejor de vos. Descubrí qué estilo es el ideal para tu tipo de rostro.
            </p>
          </div>
        </section>

        {/* CONTENT */}
        <section className="py-12 md:py-20 bg-[#faf8f5]">
          <div className="max-w-3xl mx-auto px-6">
            
            <div className="prose prose-lg prose-neutral max-w-none">
              <p className="text-neutral-700 mb-8">
                Como ópticos en <strong>Atelier Óptica</strong>, todos los días recibimos pacientes en nuestro local de Córdoba que nos hacen la misma pregunta: <em>"¿Qué anteojos me quedan bien?"</em>. Sabemos que la elección del armazón es súper importante para tu día a día, ya que es un accesorio que te acompaña siempre y define gran parte de tu estilo personal.
              </p>

              {/* MEDICAL REMINDER */}
              <div className="bg-neutral-100 p-6 rounded-lg border border-black/10 mb-10 flex gap-4 items-start">
                <Info className="w-6 h-6 text-[#444] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-medium text-[#111] m-0 mb-2">Un paso previo fundamental</h3>
                  <p className="text-neutral-700 m-0 text-sm">
                    Antes de pensar en el armazón ideal, es vital <strong>visitar al médico oftalmólogo</strong>. En nuestra óptica no diagnosticamos, no damos tratamiento para patologías (como cataratas o glaucoma) ni recetamos. Nuestro trabajo es técnico y estético: armar los anteojos con precisión milimétrica basándonos en tu receta oftalmológica. Una vez que tengas tu receta al día, ¡ahí sí empezamos con la elección estética!
                  </p>
                </div>
              </div>

              <h2 className="text-3xl font-light text-[#111] mt-12 mb-6">Encontrando el equilibrio</h2>
              <p className="text-neutral-700 mb-10">
                La regla de oro para elegir armazones es buscar el <strong>contraste</strong>. Queremos aportar a tu rostro aquello de lo que carece. Si tenés líneas muy redondeadas, buscaremos ángulos; si tus facciones son muy marcadas, buscaremos suavizarlas.
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
                  Se caracteriza por tener proporciones similares tanto a lo ancho como a lo largo, con mejillas plenas y una mandíbula suave, sin ángulos marcados.
                </p>
                <ul className="list-disc pl-6 text-neutral-700 mb-4 space-y-2">
                  <li><strong>Lo que buscamos:</strong> Afinar y alargar visualmente el rostro. Aportar estructura.</li>
                  <li><strong>Tus armazones ideales:</strong> Formas geométricas, rectangulares o cuadradas. Los armazones que son más anchos que altos ayudan a que el rostro parezca más delgado.</li>
                  <li><strong>A evitar:</strong> Marcos redondos o muy pequeños, que solo acentuarán la redondez de tus facciones.</li>
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
                  Este tipo de rostro tiene una frente ancha, y tanto los pómulos como la línea de la mandíbula están alineados y son angulares y fuertes.
                </p>
                <ul className="list-disc pl-6 text-neutral-700 mb-4 space-y-2">
                  <li><strong>Lo que buscamos:</strong> Suavizar los ángulos de la mandíbula y aportar longitud.</li>
                  <li><strong>Tus armazones ideales:</strong> Marcos redondos, ovalados o estilo aviador. Los anteojos que son más anchos que la parte más ancha de tu rostro ayudan a equilibrar su forma. Los marcos delgados y de colores neutros también son excelentes.</li>
                  <li><strong>A evitar:</strong> Formas demasiado geométricas, rectangulares o cuadradas con bordes muy filosos, ya que endurecerán aún más tus rasgos.</li>
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
                  Se identifica por una frente más ancha, pómulos altos y marcados, y una barbilla estrecha o puntiaguda.
                </p>
                <ul className="list-disc pl-6 text-neutral-700 mb-4 space-y-2">
                  <li><strong>Lo que buscamos:</strong> Minimizar la anchura de la parte superior del rostro y equilibrarla con la parte inferior.</li>
                  <li><strong>Tus armazones ideales:</strong> Marcos más anchos en la parte inferior, formas de gato (cat-eye) sutiles, armazones al aire (sin montura) o en tonos claros. El estilo aviador también suele quedar espectacular.</li>
                  <li><strong>A evitar:</strong> Marcos muy pesados en la parte superior o con muchos detalles en la ceja, ya que centrarán la atención en la zona más ancha de tu cara.</li>
                </ul>
              </div>

              <hr className="border-black/10 my-10" />

              <h2 className="text-2xl font-medium text-[#111] mb-4">La importancia del confort visual</h2>
              <p className="text-neutral-700 mb-6">
                Más allá de la estética, el armazón que elijas debe permitir que los cristales recetados por tu médico oftalmólogo queden centrados correctamente. Como ópticos, en <strong>Atelier Óptica</strong> evaluamos que el marco se ajuste bien a tu tabique nasal, que las patillas tengan el largo adecuado y que el peso sea confortable para acompañarte todo el día.
              </p>
              
              <div className="bg-black text-white p-8 rounded-xl text-center mt-12">
                <Glasses className="w-10 h-10 mx-auto mb-4 opacity-80" />
                <h3 className="text-2xl font-light mb-4">¿Ya tenés tu receta lista?</h3>
                <p className="text-white/80 mb-6 max-w-lg mx-auto">
                  Vení con tu receta oftalmológica actualizada a nuestro local en Córdoba y te asesoramos personalmente para encontrar ese armazón que resalte lo mejor de vos.
                </p>
                <Link 
                  href="/turnos" 
                  className="inline-block bg-[#faf8f5] text-black px-8 py-3 font-medium rounded-full hover:bg-neutral-200 transition-colors"
                >
                  Agendar un Turno
                </Link>
              </div>

            </div>
          </div>
        </section>
      
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

      </main>

      <FloatingWhatsApp />
      <StorefrontFooter />
    </div>
  );
}
