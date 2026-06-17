import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { Award, BookOpen, Target, Microscope, Star } from "lucide-react";
import { WHATSAPP_PHONE } from '@/lib/constants';
import Image from "next/image";

export const metadata: Metadata = {
  alternates: { canonical: '/blog/matias-turchi' },
  title: "Matías Turchi | Especialista en Multifocales Essilor Expert",
  description: "Conocé a Matías Turchi, nuestro especialista en multifocales certificado como Essilor Expert. Precisión visual y última tecnología a tu disposición. Envíos a toda Argentina. Cuotas sin interés. Atención personalizada y asesoramiento estético.",
  keywords: ["óptica Argentina", "envíos a toda Argentina", "cuotas", "atención personalizada", "anteojos de receta", "matias turchi"],
};

export default function MatiasTurchiPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Matías Turchi",
    "jobTitle": "Especialista en Lentes Multifocales (Essilor Expert)",
    "worksFor": {
      "@type": "Optician",
      "name": "Atelier Óptica",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Córdoba",
        "addressRegion": "Córdoba",
        "addressCountry": "AR"
      }
    },
    "description": "Profesional óptico especialista en adaptación de lentes de alta tecnología, multifocales y cristales Essilor Varilux.",
    "image": "https://atelieroptica.com/images/blog/matias-turchi.png",
    "url": "https://atelieroptica.com/blog/matias-turchi"
  };

  return (
    <div className="bg-stone-50 min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StorefrontNavbar theme="light" />

      {/* ── HERO ── */}
      <div className="pt-24 pb-16 border-b border-stone-200 bg-white">
        <div className="max-w-[1000px] mx-auto px-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-4">Nuestro Equipo</p>
          <h1 className=" font-serif">
            Matías Turchi
          </h1>
          <p className="text-xl md:text-2xl text-stone-500 font-light max-w-2xl mx-auto">
            Especialista en Multifocales & <strong className="font-medium text-stone-800">Essilor Expert</strong>
          </p>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto px-5 py-20 pb-24">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-20">
          
          {/* IMAGEN / COLUMNA IZQUIERDA */}
          <div className="md:col-span-5">
            <div className="aspect-[3/4] relative overflow-hidden bg-stone-200 rounded-3xl sticky top-24 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent z-10" />
              { }
              <Image src="/images/blog/matias-turchi.png" alt="Matías Turchi - Especialista en Multifocales" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute bottom-6 left-6 z-20 text-white">
                <p className="text-xs uppercase tracking-widest font-medium tracking-tight mb-1 drop-shadow-[0_2px_10px_rgba(0,0,0,0.02)]">Certificación</p>
                <p className="text-lg font-serif">Essilor Expert</p>
              </div>
            </div>
          </div>

          {/* CONTENIDO / COLUMNA DERECHA */}
          <div className="md:col-span-7 space-y-12">
            
            <section>
              <h2 className=" font-serif">
                El Arte de la Precisión Visual
              </h2>
              <div className="space-y-5 text-stone-600 text-lg leading-relaxed font-light">
                <p>
                  Adaptarse a lentes multifocales solía ser un desafío. Hoy, con la combinación de la última tecnología óptica y un especialista capacitado, la transición es natural, inmediata y precisa.
                </p>
                <p>
                  <strong>Matías Turchi</strong> es el principal referente de Atelier Óptica en la adaptación de lentes de alta complejidad. Con su prestigiosa certificación <strong>Essilor Expert</strong>, Matías asegura que cada paciente obtenga el máximo rendimiento visual de sus lentes progresivos, adaptados milimétricamente a su postura, fisonomía y estilo de vida.
                </p>
              </div>
            </section>

            <div className="h-px w-full bg-stone-200" />

            <section>
              <h3 className="text-xs font-black tracking-widest mb-8 uppercase text-stone-400">
                Experiencia & Capacitación
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5 text-stone-800" />
                  </div>
                  <div>
                    <h4 className="text-base font-medium tracking-tight text-stone-900 mb-1">Essilor Expert</h4>
                    <p className="text-sm text-stone-500 font-light leading-relaxed">Profesional certificado por la marca líder mundial en lentes multifocales.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5 text-stone-800" />
                  </div>
                  <div>
                    <h4 className="text-base font-medium tracking-tight text-stone-900 mb-1">Precisión Extrema</h4>
                    <p className="text-sm text-stone-500 font-light leading-relaxed">Especialista en toma de medidas personalizadas (distancia naso-pupilar, altura, ángulo pantoscópico).</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-stone-800" />
                  </div>
                  <div>
                    <h4 className="text-base font-medium tracking-tight text-stone-900 mb-1">Formación Continua</h4>
                    <p className="text-sm text-stone-500 font-light leading-relaxed">Muchísimos cursos y actualizaciones constantes sobre los últimos avances en tecnología multifocal.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                    <Microscope className="w-5 h-5 text-stone-800" />
                  </div>
                  <div>
                    <h4 className="text-base font-medium tracking-tight text-stone-900 mb-1">Tecnología de Punta</h4>
                    <p className="text-sm text-stone-500 font-light leading-relaxed">Dominio de instrumentos de medición digitales para diseños de lentes personalizados (Varilux, Zeiss).</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="h-px w-full bg-stone-200" />

            <section>
              <h3 className="text-xs font-black tracking-widest mb-8 uppercase text-stone-400">
                Lo que dicen de su trabajo
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-stone-100">
                  <div className="flex text-yellow-400 mb-4">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                  </div>
                  <p className="text-stone-600 font-light text-sm leading-relaxed mb-4">
                    &quot;Fui con mucho miedo por comentarios de mareos con multifocales. Me atendió Matías, se tomó todo el tiempo para medirme con equipos digitales y explicarme. Me los puse y salí caminando perfecto. Un nivel de precisión excelente.&quot;
                  </p>
                  <p className="text-[10px] font-medium tracking-tight text-stone-800 uppercase tracking-widest">— Reseña en Google Maps</p>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-stone-100">
                  <div className="flex text-yellow-400 mb-4">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                  </div>
                  <p className="text-stone-600 font-light text-sm leading-relaxed mb-4">
                    &quot;La tecnología que usan para medir es impresionante. Matías me asesoró no solo con los cristales Essilor sino con el armazón ideal para que el lente no quede grueso. Hace años no veía tan bien.&quot;
                  </p>
                  <p className="text-[10px] font-medium tracking-tight text-stone-800 uppercase tracking-widest">— Reseña en Google Maps</p>
                </div>
              </div>
            </section>

            <div className="bg-stone-900 text-white p-8 md:p-10 rounded-3xl">
              <h3 className=" font-serif">
                ¿Necesitás asesoramiento para tus multifocales?
              </h3>
              <p className="text-stone-300 font-light mb-8">
                Agendá una consulta presencial con Matías en nuestro local para asegurar el mejor rendimiento de tu visión.
              </p>
              <a 
                href={`https://wa.me/${WHATSAPP_PHONE}?text=Hola%2C%20quiero%20agendar%20un%20turno%20con%20Matias%20Turchi%20para%20multifocales`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-[#faf8f5] text-black text-xs font-black uppercase tracking-widest hover:bg-stone-200 transition-colors rounded-full"
              >
                Agendar Consulta
              </a>
            </div>

          </div>
        </div>

      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
