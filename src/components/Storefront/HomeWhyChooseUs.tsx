"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Truck, CreditCard, Sparkles } from "lucide-react";
import { GARANTIA_ADAPTACION } from "@/lib/garantia";

export function HomeWhyChooseUs() {
  const features = [
    {
      icon: <ShieldCheck className="w-8 h-8 text-[#b08f4c]" strokeWidth={1.2} />,
      title: GARANTIA_ADAPTACION.TITULO,
      // Decía "100% de cobertura en multifocales Varilux y lentes de diseño":
      // los "lentes de diseño" (armazones) nunca tuvieron garantía de adaptación
      // y el alcance real está en /politicas-de-cambio.
      desc: GARANTIA_ADAPTACION.RESUMEN
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

  // A-18 (auditoría 2/9/26): esta sección medía 1.474 px en celular para decir
  // cuatro beneficios — más de una pantalla y media de alto para cuatro
  // frases. El aire en una óptica de autor va alrededor del PRODUCTO, no entre
  // bloques de texto. En celular pasa a dos columnas y se recorta el padding;
  // de sm para arriba queda como estaba.
  return (
    <section className="w-full bg-[#1c1917] py-12 md:py-24 border-t border-stone-800">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-16">
        <div className="text-center mb-8 md:mb-16">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#b08f4c] mb-3">Nuestros Pilares</p>
          <h2 className="text-3xl sm:text-4xl font-serif text-white tracking-tight">
            ¿Por qué elegir Atelier Óptica?
          </h2>
        </div>

        {/* En celular NO es una grilla de dos columnas: es una lista de filas con el
            icono a la izquierda. Con dos columnas cada card medía ~168 px de ancho,
            la descripción se partía en ocho renglones y la sección llegaba a 1.002 px.
            En fila, el texto usa todo el ancho, entra en dos o tres renglones y se
            lee de un vistazo. De `sm` para arriba vuelve la grilla. */}
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-x-8 sm:gap-y-8 md:gap-y-12">
          {features.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="flex flex-row items-center text-left gap-4 p-4 sm:flex-col sm:items-center sm:text-center sm:gap-0 sm:p-6 bg-white/5 border border-white/10 rounded-2xl shadow-xl hover:bg-white/10 transition-colors duration-300 group"
            >
              <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 rounded-full bg-black/30 flex items-center justify-center sm:mb-3 md:mb-6 shadow-inner border border-white/5 group-hover:scale-110 transition-transform duration-300">
                {feat.icon}
              </div>
              {/* Título y texto van juntos en un bloque: en la fila de celular el
                  icono queda a la izquierda y estos dos apilados a su derecha.
                  Sueltos como hermanos del icono, el flex-row los ponía en tres
                  columnas y "Garantía de adaptación" se partía en tres renglones. */}
              <div className="min-w-0 sm:contents">
                <h3 className="text-[13px] font-black uppercase tracking-widest text-white mb-1 sm:mb-1.5 md:mb-3">
                  {feat.title}
                </h3>
                <p className="text-sm text-stone-400 font-medium leading-relaxed sm:max-w-[250px]">
                  {feat.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
