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
            {/* Ubicado a la izquierda del de tareas en desktop, apilado en fila en mobile */}
            <div className="fixed bottom-6 right-[136px] md:bottom-8 md:right-[248px] z-[60] flex items-center gap-4">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-3 md:p-4 rounded-full md:rounded-2xl border transition-all shadow-lg flex items-center gap-0 md:gap-3 active:scale-95 group relative ${isOpen
                        ? 'bg-stone-900 border-stone-800 text-white dark:bg-stone-800 dark:border-stone-700'
                        : count > 0
                            ? 'bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl border-emerald-500/30 text-stone-900 dark:text-white shadow-emerald-500/10 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                            : 'bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-stone-200 dark:border-stone-800 text-stone-900 dark:text-white hover:border-stone-300 dark:hover:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                        }`}
                >
                    {/* Pulsing glow effect when balances exist and panel is closed */}
                    {!isOpen && count > 0 && (
                        <span className="absolute inset-0 rounded-[2.5rem] bg-emerald-500/20 animate-ping -z-10" />
                    )}

                    <div className="relative">
                        <Banknote className={`w-5 h-5 md:w-6 md:h-6 ${isOpen ? 'animate-none' : count > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-stone-400 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300 transition-colors'}`} />
                        {count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-emerald-500 text-white text-[9px] md:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-md">
                                {count}
                            </span>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest hidden md:block transition-colors ${count > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-400'}`}>
                        Saldos
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
