'use client';

// A qué par (armazón) va un CRISTAL, elegido en su renglón — en el presupuesto
// y en la venta, sin abrir el editor.
//
// Desde el 19/10/2026 una venta de dos pares no se convierte ni se envía a
// fábrica si un cristal no dice a qué armazón va; hasta el 22/10 el selector
// existía solo en armazones y teñidos, y con cuatro cristales no había dónde
// elegirlo (presupuesto de Mariel Miguel). Al elegir uno, su compañero del
// otro ojo y —si queda un solo par libre— los demás se acomodan solos
// (asignarParAlCristal, lib/armazon-por-par).

import React, { useState } from 'react';
import { Glasses } from 'lucide-react';
import { asignarParAlCristal } from '@/lib/armazon-por-par';
import { esCristalDePar } from '@/lib/laboratorios/identidad';

interface Props {
    orderId: string;
    item: any;
    items: any[];
    totalArmazones: number;
    editable: boolean;
    onSaved?: () => void | Promise<void>;
}

export default function LineaParCristal({ orderId, item, items, totalArmazones, editable, onSaved }: Props) {
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Solo cuando FALTA el par (lo que frena convertir y enviar a fábrica): elegido, el renglón queda como siempre
    // y se cambia desde "Editar detalles" (Ishtar, 22/10/2026: "no agregues cosas de más").
    if (totalArmazones < 2 || !esCristalDePar(item) || item.framePosition || !editable) return null;

    const asignar = async (par: number) => {
        setGuardando(true);
        setError(null);
        try {
            const idx = items.findIndex(x => x.id === item.id);
            for (const c of asignarParAlCristal(items, idx, par, totalArmazones)) {
                const linea = items[c.idx];
                // Mismo endpoint de línea que el color y el armazón: se reenvía el color de ESA línea para no pisarlo.
                const res = await fetch(`/api/orders/${orderId}/items/${linea.id}/color`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        crystalColor: linea.crystalColor ?? null,
                        crystalColorType: linea.crystalColorType ?? null,
                        crystalColorNote: linea.crystalColorNote ?? null,
                        framePosition: c.framePosition,
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    setError(err.error || 'No se pudo guardar a qué par va');
                    return;
                }
            }
            await onSaved?.();
        } catch (e: any) {
            setError(e.message || 'Error de red');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="mt-2 flex flex-wrap items-center gap-2">
            <Glasses className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider shrink-0">
                ¿De cuál par es? {editable ? '*' : ''}
            </span>
            {Array.from({ length: totalArmazones }, (_, i) => i + 1).map(par => {
                const elegido = item.framePosition === par;
                return (
                    <button
                        key={par}
                        type="button"
                        disabled={!editable || guardando}
                        onClick={() => asignar(par)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                            elegido
                                ? 'bg-amber-500 text-white border-amber-600'
                                : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-amber-300'
                        } ${!editable ? 'opacity-60 cursor-default' : ''}`}
                    >
                        {par}º par
                    </button>
                );
            })}
            {!item.framePosition && editable && <span className="text-[10px] font-bold text-rose-600">← elegí uno</span>}
            {error && <span className="text-[10px] font-bold text-rose-600">{error}</span>}
        </div>
    );
}
