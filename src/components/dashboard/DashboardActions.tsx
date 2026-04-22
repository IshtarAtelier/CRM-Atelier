'use client';

import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import QuickQuote from '@/components/QuickQuote';

interface DashboardActionsProps {
    onPeriodChange?: (from: string, to: string, label: string) => void;
}

export default function DashboardActions({ onPeriodChange }: DashboardActionsProps) {
    const [isQuoteOpen, setIsQuoteOpen] = useState(false);
    const [showPeriodMenu, setShowPeriodMenu] = useState(false);
    const [activeLabel, setActiveLabel] = useState('Este Mes');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const presets = [
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
            label: 'Últ. 3 Meses', getRange: () => {
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
        { label: 'Todo', getRange: () => ({ from: '', to: '' }) },
    ];

    function fmt(d: Date) {
        return d.toISOString().split('T')[0];
    }

    const applyPreset = (preset: typeof presets[0]) => {
        const { from, to } = preset.getRange();
        setActiveLabel(preset.label);
        setShowPeriodMenu(false);
        onPeriodChange?.(from, to, preset.label);
    };

    const applyCustom = () => {
        if (customFrom && customTo) {
            setActiveLabel(`${customFrom} → ${customTo}`);
            setShowPeriodMenu(false);
            onPeriodChange?.(customFrom, customTo, 'Personalizado');
        }
    };

    return (
        <div className="flex flex-wrap gap-2 items-center">
            {/* Period Filter */}
            <div className="relative">
                <button
                    onClick={() => setShowPeriodMenu(!showPeriodMenu)}
                    className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${showPeriodMenu
                        ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 border-stone-900 dark:border-white'
                        : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 uppercase tracking-tight'
                        }`}
                >
                    <Calendar className="w-3.5 h-3.5" />
                    {activeLabel}
                </button>

                {showPeriodMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowPeriodMenu(false)} />
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-3">Filtrar Período</p>

                            <div className="space-y-1.5 mb-4">
                                {presets.map(p => (
                                    <button
                                        key={p.label}
                                        onClick={() => applyPreset(p)}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeLabel === p.label
                                            ? 'bg-primary text-primary-foreground'
                                            : 'hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'
                                            }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            <div className="border-t border-stone-100 dark:border-stone-700 pt-3">
                                <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2">Rango Personalizado</p>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="date"
                                        value={customFrom}
                                        onChange={e => setCustomFrom(e.target.value)}
                                        className="flex-1 px-2 py-1.5 border border-stone-200 dark:border-stone-600 rounded-lg text-[11px] font-bold bg-white dark:bg-stone-900 outline-none focus:border-primary"
                                    />
                                    <input
                                        type="date"
                                        value={customTo}
                                        onChange={e => setCustomTo(e.target.value)}
                                        className="flex-1 px-2 py-1.5 border border-stone-200 dark:border-stone-600 rounded-lg text-[11px] font-bold bg-white dark:bg-stone-900 outline-none focus:border-primary"
                                    />
                                </div>
                                <button
                                    onClick={applyCustom}
                                    className="w-full py-2 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                                >
                                    Aplicar
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* New Sale */}
            <button
                onClick={() => setIsQuoteOpen(true)}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all uppercase tracking-tight"
            >
                Nueva Venta
            </button>

            {isQuoteOpen && (
                <QuickQuote onClose={() => setIsQuoteOpen(false)} />
            )}
        </div>
    );
}
