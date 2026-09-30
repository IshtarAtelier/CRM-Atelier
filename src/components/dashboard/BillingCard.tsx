'use client';

import { useState } from 'react';
import { DollarSign, Eye, EyeOff } from 'lucide-react';

interface BillingCardProps {
  todaySold: number;
  weekSold: number;
  monthSold: number;
  isLoading?: boolean;
}

export function BillingCard({ todaySold, weekSold, monthSold, isLoading }: BillingCardProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Números formateados en argentino (con separadores de mil)
  const formatPeso = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!isVisible) {
    return (
      <div className="flex justify-center py-4">
        <button
          onClick={() => setIsVisible(true)}
          className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-400 hover:text-amber-600 dark:hover:text-amber-500 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
          title="Mostrar facturación"
        >
          <EyeOff className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative p-7 rounded-[2rem] overflow-hidden transition-all duration-500 border group bg-white dark:bg-stone-900/60 backdrop-blur-xl border-stone-200/60 dark:border-stone-800/60 shadow-md hover:shadow-xl dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:border-[#a38067]/40 dark:hover:border-[#a38067]/40 hover:scale-[1.02] ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
      {/* Decorative blurred background aura */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl transition-all duration-700 bg-[#a38067]/10 dark:bg-[#a38067]/5 group-hover:scale-125 group-hover:bg-[#a38067]/20 dark:group-hover:bg-[#a38067]/10" />

      {/* Dynamic light reflection effect */}
      <div className="absolute -inset-px rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-tr from-[#a38067]/5 via-transparent to-[#a38067]/15" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4 justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 group-hover:text-[#a38067] transition-colors">
            💰 Facturación del Día
          </p>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-400 hover:text-amber-600 dark:hover:text-amber-500 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
            title="Ocultar facturación"
          >
            <Eye className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Tres tarjetas: HOY, SEMANA, MES */}
        <div className="grid grid-cols-3 gap-3">
          {/* HOY — DESTACADO */}
          <div className="bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/60 rounded-2xl p-4 space-y-2 hover:shadow-md transition-all">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400">
              Hoy
            </p>
            <p className="text-2xl md:text-3xl font-black tracking-tight text-amber-600 dark:text-amber-500 truncate">
              {formatPeso(todaySold)}
            </p>
          </div>

          {/* SEMANA */}
          <div className="bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/60 rounded-2xl p-4 space-y-2 hover:shadow-md transition-all">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400">
              Semana
            </p>
            <p className="text-xl md:text-2xl font-black tracking-tight text-stone-900 dark:text-white truncate">
              {formatPeso(weekSold)}
            </p>
          </div>

          {/* MES */}
          <div className="bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/60 rounded-2xl p-4 space-y-2 hover:shadow-md transition-all">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400">
              Mes
            </p>
            <p className="text-xl md:text-2xl font-black tracking-tight text-stone-900 dark:text-white truncate">
              {formatPeso(monthSold)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
