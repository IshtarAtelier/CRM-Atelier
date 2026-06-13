"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Truck, CreditCard, Sparkles } from "lucide-react";

export function HomeWhyChooseUs() {
  const features = [
    {
      icon: <ShieldCheck className="w-8 h-8 text-[#b08f4c]" strokeWidth={1.2} />,
      title: "Garantía de Adaptación",
      desc: "100% de cobertura en multifocales Varilux y lentes de diseño para tu total tranquilidad."
    },
    {
      icon: <Truck className="w-8 h-8 text-[#b08f4c]" strokeWidth={1.2} />,
      title: "Envío Sin Cargo",
      desc: "Envío gratis a todo el país o retiro inmediato en nuestro local en Cerro de las Rosas."
    },
    {
      icon: <CreditCard className="w-8 h-8 text-[#b08f4c]" strokeWidth={1.2} />,
      title: "6 Cuotas Sin Interés",
      desc: "Financiá tu compra con todas las tarjetas de crédito de cualquier banco emisor."
    },
    {
      icon: <Sparkles className="w-8 h-8 text-[#b08f4c]" strokeWidth={1.2} />,
      title: "Asesoramiento Exclusivo",
      desc: "Asesoramiento estético (visagismo) y técnico especializado para encontrar tu marco ideal."
    }
  ];

  return (
    <section className="w-full bg-[#faf8f5] py-24 border-t border-[#e8e2db]/35">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-16">
        <div className="text-center mb-16">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#b08f4c] mb-3">Nuestros Pilares</p>
          <h2 
            className="text-3xl md:text-4xl font-light tracking-tight text-stone-900 leading-tight"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            ¿Por qué elegir Atelier Óptica?
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
          {features.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="flex flex-col items-center text-center p-6 bg-white border border-[#e8e2db]/30 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 group"
            >
              <div className="mb-5 p-4 bg-[#faf8f5] rounded-full group-hover:scale-105 transition-transform duration-300">
                {feat.icon}
              </div>
              <h3 className="text-[13px] font-bold uppercase tracking-widest text-stone-900 mb-3">{feat.title}</h3>
              <p className="text-xs text-stone-500 leading-relaxed font-light">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
