"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { Sun, BatteryCharging, Shield, Smartphone, ArrowRight } from "lucide-react";

export default function WicueLandingPage() {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black font-sans">
      <StorefrontNavbar theme="dark" />
      <main>
        {/* HERO SECTION */}
        <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
          {/* Fondo de Video / Imagen Cinemática */}
          <div className="absolute inset-0 z-0 bg-stone-900">
            <img 
              src="/images/landing/ray_ban_meta.png" 
              alt="Ray-Ban Meta Smart Glasses" 
              className="w-full h-full object-cover opacity-40 mix-blend-luminosity"
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
              <Link href="/tienda" className="bg-white text-black px-8 py-4 rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-2">
                Comprar Ahora <ArrowRight className="w-4 h-4" />
              </Link>
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
           <img 
              src="/images/landing/wicue_glasses.png" 
              alt="Lifestyle Wicue" 
              className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-overlay"
            />
            <div className="relative z-10 text-center max-w-3xl px-6">
              <h2 className="text-4xl md:text-6xl font-serif italic mb-6">El Futuro de la Óptica</h2>
              <p className="text-stone-300 text-lg leading-relaxed mb-10">La tecnología patentada de Wicue permite alterar la transmisión de luz visible en tiempo real. Olvidate de cambiar entre anteojos de receta y de sol.</p>
              <Link href="/tienda" className="inline-block bg-transparent border border-white text-white px-8 py-4 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors">
                Descubrir Colección
              </Link>
            </div>
        </section>
      </main>

      <StorefrontFooter />
    </div>
  );
}
