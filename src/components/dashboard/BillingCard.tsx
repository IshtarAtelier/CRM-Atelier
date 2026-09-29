'use client';

import { DollarSign } from 'lucide-react';

interface BillingCardProps {
  todaySold: number;
  weekSold: number;
  monthSold: number;
  isLoading?: boolean;
}

export function BillingCard({ todaySold, weekSold, monthSold, isLoading }: BillingCardProps) {
  // Números formateados en argentino (con separadores de mil)
  const formatPeso = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={`bg-white dark:bg-stone-900 rounded-3xl p-6 lg:p-8 shadow-md border border-stone-200/60 dark:border-stone-800/60 hover:shadow-lg transition-all ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
      {/* Header con icono */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-stone-100 dark:bg-stone-800 p-3 rounded-2xl text-amber-600 dark:text-amber-500 shadow-sm">
          <DollarSign className="w-6 h-6 stroke-[2.5]" />
        </div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
          Facturación del Día
        </h3>
      </div>

      {/* Número principal: HOY — GRANDE Y CLARO */}
      <div className="mb-10 pb-8 border-b border-stone-200/50 dark:border-stone-800/50">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-2">
          💰 HOY
        </p>
        <p className="text-5xl lg:text-6xl font-black tracking-tighter text-amber-600 dark:text-amber-500 break-words">
          {formatPeso(todaySold)}
        </p>
        <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest mt-3">
          Facturación de hoy
        </p>
      </div>

      {/* Semana y Mes — SECUNDARIOS */}
      <div className="grid grid-cols-2 gap-6 lg:gap-8">
        {/* SEMANA */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
            📅 Esta Semana
          </p>
          <p className="text-2xl lg:text-3xl font-black tracking-tighter text-stone-800 dark:text-stone-100">
            {formatPeso(weekSold)}
          </p>
          <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">
            Últimos 7 días
          </p>
        </div>

        {/* MES */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
            📊 Este Mes
          </p>
          <p className="text-2xl lg:text-3xl font-black tracking-tighter text-stone-800 dark:text-stone-100">
            {formatPeso(monthSold)}
          </p>
          <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">
            Desde el 1° del mes
          </p>
        </div>
      </div>
    </div>
  );
}
