'use client';

// ────────────────────────────────────────────────────────────────────────────
// Recordatorios livianos al abrir el panel — ver src/lib/constants/recordatorios.ts
// para qué son (y en qué se diferencian de NovedadesGuiadas / BriefingDiario,
// que son obligatorios y no encajan para un simple "no te olvides de X").
//
// Se cierra con un clic y no vuelve a molestar hasta el día siguiente. La
// marca de "ya lo vi hoy" vive en localStorage, no en el server: para un
// recordatorio de tarea diaria (no una métrica ni un anuncio con audiencia)
// alcanza, y evita una tabla nueva solo para esto.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { RECORDATORIOS_DIARIOS } from '@/lib/constants/recordatorios';

const CLAVE = (id: string) => `recordatorio-visto:${id}`;

export function RecordatorioDiario() {
  const [pendiente, setPendiente] = useState<{ id: string; texto: string } | null>(null);

  useEffect(() => {
    const hoy = new Date().toDateString();
    // El primero de la lista que no se haya cerrado hoy. Mostrar más de uno a
    // la vez sería ruido; si algún día hace falta, se apila por separado.
    const proximo = RECORDATORIOS_DIARIOS.find((r) => {
      if (!r.activo) return false;
      try {
        return localStorage.getItem(CLAVE(r.id)) !== hoy;
      } catch {
        // Sin localStorage (modo privado, etc.): se muestra igual, sin recordar.
        return true;
      }
    });
    if (proximo) setPendiente({ id: proximo.id, texto: proximo.texto });
  }, []);

  if (!pendiente) return null;

  const cerrar = () => {
    try {
      localStorage.setItem(CLAVE(pendiente.id), new Date().toDateString());
    } catch {
      // Si no se pudo guardar, vuelve a aparecer más tarde — no es grave.
    }
    setPendiente(null);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[190] w-[min(92vw,26rem)]">
      <div className="flex items-start gap-3 rounded-2xl border-2 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-lg p-4">
        <Bell className="w-5 h-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p className="flex-1 min-w-0 text-sm leading-relaxed text-stone-700 dark:text-stone-200">
          {pendiente.texto}
        </p>
        <button
          onClick={cerrar}
          aria-label="Ya lo hice, no mostrar hoy"
          className="shrink-0 p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 dark:hover:text-stone-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
