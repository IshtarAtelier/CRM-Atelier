'use client';

import { ShoppingCart, Megaphone, Target, ArrowRight, Wrench, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function DesarrolloPage() {
  const features = [
    {
      title: "Carritos Abandonados",
      description: "Gestión de ventas pendientes y recuperación.",
      icon: ShoppingCart,
      href: "/admin/desarrollo/carritos",
      bgLight: "bg-amber-500/10",
      textLight: "text-amber-500",
      bgGlow: "bg-amber-500/5",
      bgGlowHover: "group-hover:bg-amber-500/10"
    },
    {
      title: "Social Media Studio",
      description: "Generación de campañas y contenido con IA.",
      icon: Megaphone,
      href: "/admin/desarrollo/social",
      bgLight: "bg-pink-500/10",
      textLight: "text-pink-500",
      bgGlow: "bg-pink-500/5",
      bgGlowHover: "group-hover:bg-pink-500/10"
    },
    {
      title: "Campañas Ads",
      description: "Gestión de campañas publicitarias en Meta.",
      icon: Target,
      href: "/admin/desarrollo/campanas",
      bgLight: "bg-indigo-500/10",
      textLight: "text-indigo-500",
      bgGlow: "bg-indigo-500/5",
      bgGlowHover: "group-hover:bg-indigo-500/10"
    },
    {
      title: "Control de Post Venta",
      description: "Historial de garantías, cambios, fallas y costos.",
      icon: ShieldAlert,
      href: "/admin/desarrollo/postventa",
      bgLight: "bg-emerald-500/10",
      textLight: "text-emerald-500",
      bgGlow: "bg-emerald-500/5",
      bgGlowHover: "group-hover:bg-emerald-500/10"
    }
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="mb-8 flex items-start gap-4">
        <div className="bg-primary/10 p-3 rounded-2xl text-primary">
          <Wrench className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-4xl font-extrabold tracking-tight text-stone-800 dark:text-stone-100 italic">
            Zona de <span className="text-primary not-italic">Desarrollo</span>
          </h1>
          <p className="text-stone-500 dark:text-stone-400 mt-2 text-sm max-w-2xl font-medium">
            Estas secciones se encuentran en etapa de desarrollo, diseño o pruebas y no están listas para producción. 
            Están agrupadas aquí temporalmente para no ensuciar el menú principal.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feat) => {
          const Icon = feat.icon;
          return (
            <Link key={feat.href} href={feat.href} className="group block">
              <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all h-full relative overflow-hidden hover:border-primary/20">
                <div className={`absolute top-0 right-0 w-32 h-32 ${feat.bgGlow} rounded-full -mr-16 -mt-16 blur-2xl ${feat.bgGlowHover} transition-colors duration-500`} />
                <div className="relative z-10">
                  <div className={`${feat.bgLight} w-12 h-12 rounded-2xl flex items-center justify-center ${feat.textLight} mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-stone-800 dark:text-white mb-2 group-hover:text-primary transition-colors">{feat.title}</h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400 mb-8 line-clamp-2 leading-relaxed">{feat.description}</p>
                  
                  <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-primary gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                    Ingresar <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
