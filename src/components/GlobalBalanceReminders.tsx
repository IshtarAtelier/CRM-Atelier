'use client';

import { useState, useEffect } from 'react';
import { Banknote } from 'lucide-react';
import BalancePanel from './BalancePanel';

export function GlobalBalanceReminders() {
    const [isOpen, setIsOpen] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBalances();
        const interval = setInterval(fetchBalances, 60000); // Actualizar cada minuto
        return () => clearInterval(interval);
    }, []);

    const fetchBalances = async () => {
        try {
            const res = await fetch('/api/orders/with-balance', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            }
        } catch (error) {
            console.error('Error fetching orders with balance:', error);
        } finally {
            setLoading(false);
        }
    };

    const count = orders.length;

    return (
        <>
            {/* Botón flotante de Saldos (Banknote) */}
            {/* Ubicado a la izquierda del de tareas en desktop, apilado arriba en mobile */}
            <div className="fixed bottom-20 right-4 md:bottom-8 md:right-52 z-[60] flex items-center gap-4">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-3 md:p-5 rounded-full md:rounded-[2.5rem] border-2 transition-all shadow-huge flex items-center gap-0 md:gap-3 active:scale-95 group relative ${isOpen
                        ? 'bg-stone-900 border-stone-800 text-white dark:bg-emerald-600 dark:border-emerald-600'
                        : count > 0
                            ? 'bg-white dark:bg-stone-900 border-emerald-500 text-stone-900 dark:text-white shadow-emerald-500/20 ring-4 ring-emerald-500/10'
                            : 'bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-stone-100 dark:border-stone-800 text-stone-900 dark:text-white hover:border-emerald-500/50'
                        }`}
                >
                    {/* Pulsing glow effect when balances exist and panel is closed */}
                    {!isOpen && count > 0 && (
                        <span className="absolute inset-0 rounded-[2.5rem] bg-emerald-500/20 animate-ping -z-10" />
                    )}

                    <div className="relative">
                        <Banknote className={`w-5 h-5 md:w-7 md:h-7 ${isOpen ? 'animate-none' : count > 0 ? 'animate-bounce text-emerald-600' : 'group-hover:rotate-12'}`} />
                        {count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 md:-top-1 md:-right-1 w-4 h-4 md:w-6 md:h-6 bg-emerald-600 text-white text-[9px] md:text-[11px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-xl animate-pulse">
                                {count}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden md:block">
                        {count > 0 ? '¡Saldos!' : 'Saldos'}
                    </span>
                </button>
            </div>

            {/* Panel de Saldos */}
            {isOpen && (
                <BalancePanel
                    orders={orders}
                    onClose={() => setIsOpen(false)}
                />
            )}

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-stone-900/20 dark:bg-black/40 backdrop-blur-sm z-50 transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
