'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';

interface DashboardActionsProps {
    onPeriodChange?: (from: string, to: string, label: string) => void;
}

export default function DashboardActions({ onPeriodChange }: DashboardActionsProps) {
    const [activeLabel, setActiveLabel] = useState('Este Mes');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    function fmt(d: Date) {
        const Y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        return `${Y}-${M}-${D}`;
    }

    const presets = [
        { label: 'Todo', getRange: () => ({ from: 'all', to: 'all' }) },
        {
            label: 'Este Mes', getRange: () => {
                const now = new Date();
                const from = new Date(now.getFullYear(), now.getMonth(), 1);
                return { from: fmt(from), to: fmt(now) };
            }
        },
        {
            label: 'Mes Anterior', getRange: () => {
                const now = new Date();
                const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const to = new Date(now.getFullYear(), now.getMonth(), 0);
                return { from: fmt(from), to: fmt(to) };
            }
        },
        {
            label: 'Último Trimestre', getRange: () => {
                const now = new Date();
                const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                return { from: fmt(from), to: fmt(now) };
            }
        },
        {
            label: 'Este Año', getRange: () => {
                const now = new Date();
                const from = new Date(now.getFullYear(), 0, 1);
                return { from: fmt(from), to: fmt(now) };
            }
        },
    ];

    const applyPreset = (preset: typeof presets[0]) => {
        const { from, to } = preset.getRange();
        setActiveLabel(preset.label);
        onPeriodChange?.(from, to, preset.label);
    };

    const applyCustom = () => {
        if (customFrom && customTo) {
            setActiveLabel(`${customFrom} → ${customTo}`);
            onPeriodChange?.(customFrom, customTo, 'Personalizado');
        }
    };

    return (
        <div className="w-full flex flex-col md:flex-row gap-3 items-start md:items-center justify-between bg-stone-50/50 dark:bg-stone-900/40 border border-stone-200/80 dark:border-stone-800 rounded-2xl p-2.5 shadow-sm transition-all">
            {/* Left: Period Presets and Inputs */}
            <div className="flex flex-wrap items-center gap-2.5 w-full">
                <span className="text-[9px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mr-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" /> Período:
                </span>
                
                <div className="flex flex-wrap gap-1.5">
                    {presets.map(p => (
                        <button
                            key={p.label}
                            onClick={() => applyPreset(p)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                activeLabel === p.label
                                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10 scale-105'
                                    : 'bg-white dark:bg-stone-800 text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-750 hover:text-stone-700'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="h-5 w-px bg-stone-200 dark:bg-stone-800 mx-0.5 hidden md:block" />

                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={customFrom}
                        onChange={e => setCustomFrom(e.target.value)}
                        className="px-2 py-1 border border-stone-200 dark:border-stone-700 rounded-lg text-[10px] font-bold bg-white dark:bg-stone-950 text-stone-700 dark:text-stone-300 focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary"
                    />
                    <span className="text-stone-400 text-[10px] font-bold">a</span>
                    <input
                        type="date"
                        value={customTo}
                        onChange={e => setCustomTo(e.target.value)}
                        className="px-2 py-1 border border-stone-200 dark:border-stone-700 rounded-lg text-[10px] font-bold bg-white dark:bg-stone-950 text-stone-700 dark:text-stone-300 focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary"
                    />
                    <button
                        onClick={applyCustom}
                        className="px-3 py-1 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-sm"
                    >
                        Filtrar
                    </button>
                </div>
            </div>
        </div>
    );
}
