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
    <div className={`bg-white dark:bg-stone-900 rounded-3xl p-4 lg:p-6 shadow-md border border-stone-200/60 dark:border-stone-800/60 hover:shadow-lg transition-all ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
      {/* Header con icono y botón ocultar */}
      <div className="flex items-center gap-2 mb-4 justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-stone-100 dark:bg-stone-800 p-2 rounded-xl text-amber-600 dark:text-amber-500 shadow-sm">
            <DollarSign className="w-4 h-4 stroke-[2.5]" />
          </div>
          <h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400">
            Facturación
          </h3>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-400 hover:text-amber-600 dark:hover:text-amber-500 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
          title="Ocultar facturación"
        >
          <Eye className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* Tres columnas: HOY, SEMANA, MES — TODO EN UNA LÍNEA */}
      <div className="grid grid-cols-3 gap-4 lg:gap-6">
        {/* HOY */}
        <div className="space-y-1">
          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-stone-400">
            💰 Hoy
          </p>
          <p className="text-2xl lg:text-3xl font-black tracking-tighter text-amber-600 dark:text-amber-500 truncate">
            {formatPeso(todaySold)}
          </p>
        </div>

        {/* SEMANA */}
        <div className="space-y-1">
          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-stone-400">
            📅 Semana
          </p>
          <p className="text-xl lg:text-2xl font-black tracking-tighter text-stone-800 dark:text-stone-100 truncate">
            {formatPeso(weekSold)}
          </p>
        </div>

        {/* MES */}
        <div className="space-y-1">
          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-stone-400">
            📊 Mes
          </p>
          <p className="text-xl lg:text-2xl font-black tracking-tighter text-stone-800 dark:text-stone-100 truncate">
            {formatPeso(monthSold)}
          </p>
        </div>
      </div>
    </div>
  );
}
