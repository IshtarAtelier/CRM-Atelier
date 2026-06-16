'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Factory } from 'lucide-react';
import LabReadyPanel from './LabReadyPanel';

export function GlobalLabReady() {
    const [isOpen, setIsOpen] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [mounted, setMounted] = useState(false);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setMounted(true);
        setPortalTarget(document.body);
        fetchLabReady();
        const interval = setInterval(fetchLabReady, 60000);

        // Background auto-sync trigger
        const triggerBackgroundSync = async () => {
            try {
                await fetch('/api/smartlab-sync', { method: 'POST' });
            } catch (_e) { }
        };
        // Run immediately after 1 minute just in case, then every 15 mins
        setTimeout(triggerBackgroundSync, 60000);
        const syncInterval = setInterval(triggerBackgroundSync, 900000);

        return () => {
            clearInterval(interval);
            clearInterval(syncInterval);
        };
    }, []);

    const fetchLabReady = async () => {
        try {
            const res = await fetch('/api/lab-ready', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            }
        } catch (_error) {
            console.error('Error fetching lab-ready orders:', error);
        }
    };

    const count = orders.length;

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-2.5 md:px-4 md:py-3 rounded-full md:rounded-2xl border transition-all flex items-center gap-0 md:gap-2.5 active:scale-95 group relative ${isOpen
                        ? 'bg-stone-900 border-stone-800 text-white dark:bg-stone-800 dark:border-stone-700'
                        : count > 0
                            ? 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/20'
                            : 'bg-transparent border-transparent text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:text-stone-600 dark:hover:text-stone-100'
                        }`}
                >
                    {!isOpen && count > 0 && (
                        <span className="absolute inset-0 rounded-[2.5rem] bg-emerald-400/20 animate-ping -z-10" />
                    )}

                    <div className="relative">
                        <Factory className={`w-5 h-5 md:w-6 md:h-6 ${isOpen ? 'text-white' : count > 0 ? 'text-emerald-500' : 'text-stone-600 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-500 transition-colors'}`} />
                        {count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-emerald-500 text-white text-xs md:text-xs font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-md">
                                {count}
                            </span>
                        )}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-widest hidden md:block transition-colors ${isOpen ? 'text-white' : count > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-600'}`}>
                        Finalizados
                    </span>
                </button>
            </div>

            {isOpen && portalTarget && createPortal(
                <>
                    <LabReadyPanel
                        orders={orders}
                        onClose={() => setIsOpen(false)}
                        onRefresh={fetchLabReady}
                    />
                    <div
                        className="fixed inset-0 bg-stone-900/20 dark:bg-black/40 backdrop-blur-sm z-50 transition-opacity"
                        onClick={() => setIsOpen(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                    />
                </>,
                portalTarget
            )}
        </>
    );
}
