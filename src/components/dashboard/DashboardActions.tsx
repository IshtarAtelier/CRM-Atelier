'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';
import QuickQuote from '@/components/QuickQuote';

interface DashboardActionsProps {
    onPeriodChange?: (from: string, to: string, label: string) => void;
}

export default function DashboardActions({ onPeriodChange }: DashboardActionsProps) {
    const [isQuoteOpen, setIsQuoteOpen] = useState(false);
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
        <div className="w-full flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between bg-white dark:bg-stone-900 border-2 border-stone-100 dark:border-stone-800 rounded-3xl p-5 shadow-xl transition-all">
            {/* Left: Period Presets and Inputs */}
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mr-1 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary" /> Período:
                </span>
                
                <div className="flex flex-wrap gap-2">
                    {presets.map(p => (
                        <button
                            key={p.label}
                            onClick={() => applyPreset(p)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeLabel === p.label
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                                    : 'bg-stone-50 dark:bg-stone-800/80 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-300'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="h-6 w-px bg-stone-200 dark:bg-stone-850 mx-1 hidden md:block" />

                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={customFrom}
                        onChange={e => setCustomFrom(e.target.value)}
                        className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold bg-white dark:bg-stone-950 text-stone-700 dark:text-stone-300 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    <span className="text-stone-400 text-xs font-bold">a</span>
                    <input
                        type="date"
                        value={customTo}
                        onChange={e => setCustomTo(e.target.value)}
                        className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold bg-white dark:bg-stone-950 text-stone-700 dark:text-stone-300 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    <button
                        onClick={applyCustom}
                        className="px-4 py-2 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md"
                    >
                        Aplicar
                    </button>
                </div>
            </div>

            {/* Right: Actions */}
            <button
                onClick={() => setIsQuoteOpen(true)}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-105 active:scale-95 text-center xl:self-auto self-start"
            >
                Nueva Venta
            </button>

            {isQuoteOpen && (
                <QuickQuote onClose={() => setIsQuoteOpen(false)} />
            )}
        </div>
    );
}
