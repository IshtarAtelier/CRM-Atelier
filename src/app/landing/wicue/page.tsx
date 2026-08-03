"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Sun, BatteryCharging, Shield, Smartphone, ArrowRight } from "lucide-react";
import Image from "next/image";
import { buildWhatsAppUrl } from "@/lib/whatsapp-link";
import { LandingFooter } from "@/components/landing/LandingFooter";

/**
 * Landing de campaña: un solo objetivo, generar el contacto por WhatsApp.
 *
 * Sin navbar, sin footer del sitio y sin links a /tienda: todo eso desviaba al
 * visitante del aviso hacia el catálogo, donde el recorrido se diluye. La página
 * tenía DOS botones a /tienda y ningún botón de WhatsApp propio — el anuncio que
 * la alimenta traía 1.439 clics y sólo 6 conversaciones.
 *
 * El tracking del clic y la frase de origen ("Los vi en Meta.") los agrega solo
 * WhatsAppAttribution, que intercepta todo link a wa.me del sitio.
 */
const WA_URL = buildWhatsAppUrl(
  "Hola Atelier! 👋 Vi los anteojos Wicue de tinte electrónico y quiero información y precio.",
);

export default function WicueLandingPage() {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black font-sans">
      {/* Marca sin link: identifica sin ofrecer una salida al resto del sitio. */}
      <header className="absolute top-0 inset-x-0 z-30 py-6 px-6 lg:px-12 flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/70">
          Atelier Óptica
        </span>
        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">
          Córdoba · Arg
        </span>
      </header>
      <main>
        {/* HERO SECTION */}
        <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
          {/* Fondo de Video / Imagen Cinemática */}
          <div className="absolute inset-0 z-0 bg-stone-900">
            {/* Es la imagen más grande arriba de todo: sin `priority` compite
                con el resto de la carga y sin `sizes` Next pide la variante de
                3840 px hasta en un celular. */}
            <Image
              src="/images/landing/ray_ban_meta.png"
              alt="Ray-Ban Meta Smart Glasses"
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-40 mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          </div>

          <motion.div 
            style={{ opacity, scale }}
            className="relative z-10 text-center max-w-4xl px-6 flex flex-col items-center"
          >
            <motion.span 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="px-4 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-stone-300 mb-8 inline-flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Nueva Tecnología Exclusiva
            </motion.span>
            
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 1 }}
              className="text-5xl md:text-7xl lg:text-8xl font-serif italic tracking-tight mb-6"
            >
              Controlá la <span className="not-italic font-sans font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">Luz.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="text-lg md:text-xl text-stone-400 font-light max-w-2xl leading-relaxed mb-10"
            >
              Descubrí los primeros anteojos inteligentes con atenuación electrocrómica instantánea. Un toque, y tu visión se adapta a cualquier entorno.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-black px-8 py-4 rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-2"
              >
                Consultar por WhatsApp <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>
          </motion.div>
        </section>

        {/* FEATURES GRID */}
        <section className="py-32 px-6 lg:px-12 max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Sun, title: "Atenuación Instantánea", desc: "Oscurecimiento en 0.1 segundos con tecnología de cristal líquido electrocrómico." },
              { icon: Shield, title: "Protección UV 99%", desc: "Filtro absoluto contra rayos UVA/UVB, protegiendo tus ojos en cualquier nivel de tinte." },
              { icon: BatteryCharging, title: "Batería Solar", desc: "No requieren cables. Se cargan automáticamente con la luz solar mientras los usás." },
              { icon: Smartphone, title: "Diseño Inteligente", desc: "Ajuste manual o automático integrado en un armazón ligero de titanio aeroespacial." },
            ].map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.6 }}
                  className="bg-stone-900/50 border border-stone-800 p-8 rounded-3xl hover:bg-stone-800 transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest mb-3">{feat.title}</h3>
                  <p className="text-stone-400 text-sm leading-relaxed">{feat.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* FULL WIDTH IMAGE / VIDEO BANNER */}
        <section className="relative py-40 flex items-center justify-center bg-stone-900 overflow-hidden">
           <Image
              src="/images/landing/wicue_glasses.png"
              alt="Lifestyle Wicue"
              fill
              className="object-cover opacity-50 mix-blend-overlay"
            />
            <div className="relative z-10 text-center max-w-3xl px-6">
              <h2 className="text-4xl md:text-6xl font-serif italic mb-6">El Futuro de la Óptica</h2>
              <p className="text-stone-300 text-lg leading-relaxed mb-10">La tecnología patentada de Wicue permite alterar la transmisión de luz visible en tiempo real. Olvidate de cambiar entre anteojos de receta y de sol.</p>
              <a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-transparent border border-white text-white px-8 py-4 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
              >
                Pedir precio por WhatsApp
              </a>
            </div>
        </section>

        {/* Cierre: última oportunidad de contacto, sin ninguna otra salida. */}
        <section className="py-28 px-6 text-center border-t border-white/10">
          <h2 className="text-3xl md:text-5xl font-serif italic mb-5">
            ¿Te los mostramos?
          </h2>
          <p className="text-stone-400 text-base leading-relaxed max-w-xl mx-auto mb-10">
            Escribinos y te contamos disponibilidad, precio y formas de pago. Sin compromiso.
          </p>
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-white text-black px-10 py-5 rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform"
          >
            Hablar con un asesor <ArrowRight className="w-4 h-4" />
          </a>
        </section>
      </main>

      <LandingFooter theme="dark" />
    </div>
  );
}
