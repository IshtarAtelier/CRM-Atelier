'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import OpportunitiesPanel from './OpportunitiesPanel';

export function GlobalOpportunities() {
    const [isOpen, setIsOpen] = useState(false);
    const [opportunities, setOpportunities] = useState<any[]>([]);

    useEffect(() => {
        fetchOpportunities();
        const interval = setInterval(fetchOpportunities, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    const fetchOpportunities = async () => {
        try {
            const res = await fetch('/api/sales-opportunities', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setOpportunities(data);
            }
        } catch (error) {
            console.error('Error fetching sales opportunities:', error);
        }
    };

    const count = opportunities.length;

    return (
        <>
            {/* Botón flotante al lado de Saldos */}
            {/* Ubicación: a la izquierda del de Saldos (Saldos está en right-[192px] / right-[392px]) */}
            {/* Posición Mobile: right-[248px], Posición Desktop: right-[536px] */}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-2.5 md:px-4 md:py-3 rounded-full md:rounded-2xl border transition-all flex items-center gap-0 md:gap-2.5 active:scale-95 group relative ${isOpen
                        ? 'bg-stone-900 border-stone-800 text-white dark:bg-stone-800 dark:border-stone-700'
                        : count > 0
                            ? 'bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 dark:hover:bg-amber-500/20'
                            : 'bg-transparent border-transparent text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                        }`}
                >
                    {!isOpen && count > 0 && (
                        <span className="absolute inset-0 rounded-[2.5rem] bg-amber-400/20 animate-ping -z-10" />
                    )}

                    <div className="relative">
                        <Zap className={`w-5 h-5 md:w-6 md:h-6 ${isOpen ? 'animate-none' : count > 0 ? 'text-amber-500 fill-amber-500' : 'text-stone-400 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300 transition-colors'}`} />
                        {count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-amber-500 text-white text-[9px] md:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-md">
                                {count}
                            </span>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest hidden md:block transition-colors ${count > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-stone-500 dark:text-stone-400'}`}>
                        Cierres
                    </span>
                </button>
            </div>

            {isOpen && (
                <OpportunitiesPanel
                    opportunities={opportunities}
                    onClose={() => setIsOpen(false)}
                    onRefresh={fetchOpportunities}
                />
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 bg-stone-900/20 dark:bg-black/40 backdrop-blur-sm z-50 transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
