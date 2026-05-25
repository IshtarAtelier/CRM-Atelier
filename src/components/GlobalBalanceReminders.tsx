'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Banknote } from 'lucide-react';
import BalancePanel from './BalancePanel';

export function GlobalBalanceReminders() {
    const [isOpen, setIsOpen] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
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
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-2.5 md:px-4 md:py-3 rounded-full md:rounded-2xl border transition-all flex items-center gap-0 md:gap-2.5 active:scale-95 group relative ${isOpen
                        ? 'bg-stone-900 border-stone-800 text-white dark:bg-stone-800 dark:border-stone-700'
                        : count > 0
                            ? 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/20'
                            : 'bg-transparent border-transparent text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                        }`}
                >
                    {/* Pulsing glow effect when balances exist and panel is closed */}
                    {!isOpen && count > 0 && (
                        <span className="absolute inset-0 rounded-[2.5rem] bg-emerald-500/20 animate-ping -z-10" />
                    )}

                    <div className="relative">
                        <Banknote className={`w-5 h-5 md:w-6 md:h-6 ${isOpen ? 'text-white' : count > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-stone-400 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300 transition-colors'}`} />
                        {count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-emerald-500 text-white text-[9px] md:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-md">
                                {count}
                            </span>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest hidden md:block transition-colors ${isOpen ? 'text-white' : count > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-400'}`}>
                        Saldos
                    </span>
                </button>
            </div>

            {isOpen && mounted && createPortal(
                <>
                    <BalancePanel
                        orders={orders}
                        onClose={() => setIsOpen(false)}
                    />
                    <div
                        className="fixed inset-0 bg-stone-900/20 dark:bg-black/40 backdrop-blur-sm z-50 transition-opacity"
                        onClick={() => setIsOpen(false)}
                    />
                </>,
                document.body
            )}
        </>
    );
}
