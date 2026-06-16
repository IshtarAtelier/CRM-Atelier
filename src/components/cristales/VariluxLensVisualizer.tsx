"use client";

import { motion } from "framer-motion";

type LensType = "xr" | "physio" | "comfort" | "liberty";

interface LensProps {
  type: LensType;
}

const LENS_CONFIG = {
  xr: {
    gradient: "from-blue-500/20 via-purple-500/10 to-transparent",
    glow: "shadow-[0_0_30px_rgba(139,92,246,0.3)]",
    border: "border-purple-200/40",
    name: "Reflejo Zafiro + Inteligencia Artificial",
    description: "Tonalidad violácea sutil (Crizal Sapphire) con trama digital predictiva.",
    pattern: (
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="url(#xr-grad)" strokeWidth="0.5" />
          </pattern>
          <linearGradient id="xr-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    )
  },
  physio: {
    gradient: "from-emerald-400/20 via-teal-400/10 to-transparent",
    glow: "shadow-[0_0_30px_rgba(16,185,129,0.3)]",
    border: "border-emerald-200/40",
    name: "Reflejo Esmeralda + Mapeo Pupilar",
    description: "Tonalidad verdosa intensa con optimización de contraste W.A.V.E. 2.0.",
    pattern: (
      <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="waves" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="10" fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.5" />
            <circle cx="20" cy="20" r="15" fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.3" />
            <circle cx="20" cy="20" r="20" fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#waves)" />
      </svg>
    )
  },
  comfort: {
    gradient: "from-blue-600/20 via-blue-400/10 to-transparent",
    glow: "shadow-[0_0_30px_rgba(59,130,246,0.3)]",
    border: "border-blue-200/40",
    name: "Reflejo Blue UV + Flexibilidad",
    description: "Tonalidad azulada profunda que filtra la luz azul nociva de las pantallas.",
    pattern: (
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-blue-300/5" />
    )
  },
  liberty: {
    gradient: "from-green-400/15 via-green-300/5 to-transparent",
    glow: "shadow-[0_0_20px_rgba(34,197,94,0.15)]",
    border: "border-green-200/30",
    name: "Reflejo Verde Clásico",
    description: "Antirreflejo tradicional limpio para visión balanceada.",
    pattern: (
      <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent" />
    )
  }
};

export function VariluxLensVisualizer({ type }: LensProps) {
  const config = LENS_CONFIG[type];

  return (
    <div className="mt-6 p-6 bg-white rounded-2xl border border-[#e8e2db] flex flex-col md:flex-row items-center gap-8 group">
      {/* Visual Lens */}
      <div className="relative w-40 h-28 shrink-0">
        <motion.div 
          className={`absolute inset-0 rounded-[40%] bg-gradient-to-tr ${config.gradient} border ${config.border} backdrop-blur-sm overflow-hidden transition-all duration-500 group-hover:${config.glow}`}
          style={{
            boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.8), inset 0 -2px 10px rgba(0,0,0,0.05)'
          }}
          whileHover={{ scale: 1.05, rotate: 2 }}
        >
          {/* Base Reflection Sweep */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_ease-in-out_infinite]" />
          
          {/* Lens Specific Pattern */}
          {config.pattern}
          
          {/* Subtle Glare */}
          <div className="absolute top-2 left-4 w-12 h-4 bg-white/30 rounded-full blur-[2px] rotate-12" />
        </motion.div>
      </div>

      {/* Description Info */}
      <div className="text-center md:text-left">
        <h4 className="font-semibold text-[#111] mb-1">{config.name}</h4>
        <p className="text-sm text-black/60">{config.description}</p>
      </div>

      {/* Styles for Shimmer */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
