'use client';

import { useState, useEffect } from 'react';
import { X, GripVertical, MousePointerClick, Eye, ArrowRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// PipelineOnboarding — First-time usage guide overlay
// Shows once per user (stored in localStorage)
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'atelier_pipeline_onboarding_seen';

const STEPS = [
  {
    icon: GripVertical,
    title: 'Arrastrá las tarjetas',
    description: 'Mantené presionada una tarjeta y arrastrala a otra columna para cambiar su etapa de seguimiento.',
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    icon: MousePointerClick,
    title: 'Acciones rápidas',
    description: 'Cada tarjeta tiene botones para ver la ficha, ir al chat, cotizar, marcar como ganado ✅ o desinteresado ✗.',
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    icon: Eye,
    title: 'Solo leads activos',
    description: 'Acá aparecen contactos activos que todavía no compraron. Los que ya cerraron se retiran automáticamente.',
    color: 'text-amber-500 bg-amber-500/10',
  },
  {
    icon: ArrowRight,
    title: 'Flujo del embudo',
    description: 'Las columnas van de izquierda a derecha: Primer Contacto → Nueva Receta → Cotización → Seguimiento 1 → Seguimiento 2 → Frío.',
    color: 'text-rose-500 bg-rose-500/10',
  },
];

export default function PipelineOnboarding() {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setVisible(true);
    } catch { /* SSR or privacy mode */ }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const step = STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === STEPS.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-in fade-in duration-300"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white dark:bg-stone-950 border border-stone-200/60 dark:border-stone-800/60 rounded-3xl shadow-2xl max-w-sm w-full p-6 pointer-events-auto animate-in zoom-in-95 fade-in duration-300">

          {/* Close button */}
          <div className="flex justify-between items-center mb-5">
            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">
              Guía rápida · {currentStep + 1}/{STEPS.length}
            </span>
            <button
              onClick={dismiss}
              className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-900 text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step content */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center`}>
              <Icon className="w-7 h-7" />
            </div>

            <h3 className="text-sm font-black text-stone-900 dark:text-white">
              {step.title}
            </h3>

            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Progress dots + button */}
          <div className="flex items-center justify-between mt-6">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? 'w-6 bg-primary'
                      : i < currentStep
                        ? 'w-1.5 bg-primary/40'
                        : 'w-1.5 bg-stone-200 dark:bg-stone-800'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={nextStep}
              className="px-4 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-primary/90 active:scale-95 transition-all"
            >
              {isLast ? '¡Entendido!' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
