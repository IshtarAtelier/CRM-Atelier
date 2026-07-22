"use client";

// Vitrina de la pestaña "Cristales" de /tienda.
//
// Los cristales no son productos de vitrina (el catálogo web los excluye a
// propósito: category 'Cristal' no tiene WebProduct), así que la pestaña
// mostraba "No encontramos resultados". En su lugar mostramos LAS MISMAS
// opciones que ofrece el configurador de /arma-tus-lentes (LensConfigurator),
// con los precios en vivo de /api/web/pricing, y cada card lleva al
// configurador para armar el pedido completo.

import { useState, useEffect } from "react";
import Link from "next/link";

type Pricing = {
  MONOFOCAL: {
    ORGANICO_BLANCO: number;
    ORGANICO_AR: number;
    ORGANICO_BLUE: number;
    POLI_BLUE: number;
    ORGANICO_FOTOCROMATICO: number;
  };
  BIFOCAL: { ORGANICO_BLANCO: number };
  MULTIFOCAL: { SMART_FREE: number; VARILUX: number; FOTOCROMATICO: number };
};

// Mismos títulos, badges y features que las OptionCard de LensConfigurator.
const GRUPOS: {
  tipo: string;
  desc: string;
  opciones: { titulo: string; badge?: string; features: string[]; precio: (p: Pricing) => number }[];
}[] = [
  {
    tipo: "Monofocal",
    desc: "Diseñado para ver a una sola distancia (Lejos o Cerca).",
    opciones: [
      { titulo: "Básico (Sin Protección)", features: ["Visión estándar", "Sin Antirreflex", "Grosor normal"], precio: p => p.MONOFOCAL.ORGANICO_BLANCO },
      { titulo: "Antirreflex (Evita Brillos)", features: ["Visión más nítida", "Sin reflejos molestos", "Mayor estética"], precio: p => p.MONOFOCAL.ORGANICO_AR },
      { titulo: "Super Blue", badge: "MÁS ELEGIDO ⭐", features: ["Antirreflex Premium", "Filtro luz azul (Pantallas)", "20% más delgado"], precio: p => p.MONOFOCAL.ORGANICO_BLUE },
      { titulo: "Extra Fino y Resistente", badge: "PREMIUM 👑", features: ["Policarbonato irrompible", "Filtro luz azul", "Ultra liviano"], precio: p => p.MONOFOCAL.POLI_BLUE },
      { titulo: "Fotocromático", features: ["Se oscurece al sol", "Protección UV 100%", "Uso interior/exterior"], precio: p => p.MONOFOCAL.ORGANICO_FOTOCROMATICO },
    ],
  },
  {
    tipo: "Multifocal",
    desc: "Para ver a todas las distancias sin cambiar de anteojos.",
    opciones: [
      { titulo: "Diseño Digital ONE", features: ["Campo visual amplio", "Transición natural"], precio: p => p.MULTIFOCAL.SMART_FREE },
      { titulo: "Varilux Premium", badge: "PREMIUM 👑", features: ["La experiencia visual definitiva", "2x1 en cristales y armazones"], precio: p => p.MULTIFOCAL.VARILUX },
      { titulo: "Multi Fotocromático", features: ["Tecnología digital", "Se oscurece al sol"], precio: p => p.MULTIFOCAL.FOTOCROMATICO },
    ],
  },
  {
    tipo: "Bifocal",
    desc: "Visión dividida para lejos y cerca de forma tradicional.",
    opciones: [
      { titulo: "Bifocal Estándar", features: ["Cristal tradicional", "Línea divisoria"], precio: p => p.BIFOCAL.ORGANICO_BLANCO },
    ],
  },
];

export function CristalesShowcase() {
  const [pricing, setPricing] = useState<Pricing | null>(null);

  useEffect(() => {
    fetch("/api/web/pricing")
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data && !data.error) setPricing(data); })
      .catch(() => {});
  }, []);

  return (
    <div className="col-span-full">
      <div className="mb-10 text-center max-w-xl mx-auto">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-3">Cristales a medida</p>
        <p className="text-2xl font-serif text-stone-900 mb-2">Elegí tu tratamiento ideal</p>
        <p className="text-sm text-stone-500">
          Todos nuestros cristales se calibran con tu receta. Elegí una opción y armá tus lentes completos con el armazón que quieras.
        </p>
      </div>

      <div className="space-y-14">
        {GRUPOS.map(grupo => (
          <section key={grupo.tipo}>
            <div className="mb-5">
              <h3 className="text-lg font-serif text-stone-900">{grupo.tipo}</h3>
              <p className="text-xs text-stone-500 italic">{grupo.desc}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {grupo.opciones.map(op => (
                <Link
                  key={op.titulo}
                  href="/arma-tus-lentes"
                  className="group relative border border-stone-200 rounded-2xl p-6 bg-white hover:border-black hover:shadow-lg transition-all duration-300 flex flex-col"
                >
                  {op.badge && (
                    <span className="absolute -top-2.5 right-4 bg-black text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                      {op.badge}
                    </span>
                  )}
                  <p className="text-sm font-bold text-stone-900 mb-3">{op.titulo}</p>
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {op.features.map(f => (
                      <li key={f} className="text-xs text-stone-500 flex items-start gap-2">
                        <span className="text-emerald-600 mt-px">✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Desde</p>
                      {pricing ? (
                        <p className="text-lg font-serif text-stone-900">${op.precio(pricing).toLocaleString("es-AR")}</p>
                      ) : (
                        <div className="h-6 w-20 bg-stone-100 rounded animate-pulse mt-1" />
                      )}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 group-hover:text-black transition-colors whitespace-nowrap">
                      Armar mis lentes →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-14 text-center">
        <Link
          href="/arma-tus-lentes"
          className="inline-block bg-black text-white px-10 py-4 text-[11px] font-black uppercase tracking-widest hover:bg-stone-800 transition-colors rounded-full"
        >
          Armá tus lentes completos
        </Link>
      </div>
    </div>
  );
}
