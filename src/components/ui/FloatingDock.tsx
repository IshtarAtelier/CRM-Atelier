'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight, LayoutGrid, Sparkles } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { pedirAbrirPanel } from '@/lib/paneles-flotantes';
import { useWhatsAppDatos } from '@/components/whatsapp/WhatsAppProvider';
import { GlobalOpportunities } from '../dashboard/GlobalOpportunities';
import { GlobalBalanceReminders } from '../dashboard/GlobalBalanceReminders';
import { GlobalReviewRequests } from '../dashboard/GlobalReviewRequests';
import { GlobalTasks } from '../dashboard/GlobalTasks';
import { GlobalLabReady } from '../dashboard/GlobalLabReady';

export function FloatingDock() {
    const pathname = usePathname();
    const isWhatsApp = pathname === '/admin/whatsapp';
    const [isCollapsed, setIsCollapsed] = useState(isWhatsApp);
    const { unreadTotal } = useWhatsAppDatos();
    const noLeidos = unreadTotal || 0;

    useEffect(() => {
        if (isWhatsApp) setIsCollapsed(true);
    }, [isWhatsApp]);

    return (
        <div className={`fixed ${isWhatsApp ? 'top-[160px] right-4' : 'bottom-6 md:bottom-8 right-6'} z-[40] flex items-center gap-1 p-1 bg-white/60 dark:bg-stone-900/60 backdrop-blur-xl border border-stone-200/50 dark:border-stone-800/50 rounded-full shadow-lg hover:shadow-xl hover:border-stone-300/80 dark:hover:border-stone-700/80 transition-all duration-300`}>
            {/* WhatsApp y Copilot viven ACÁ, en la misma píldora que los accesos
                (pedido de Ishtar 31/8: "que esté todo bien junto"). Antes eran
                dos botones redondos sueltos flotando aparte, apilados sobre esta
                barra. No entran en la parte plegable: son los dos accesos que
                más se usan y tienen que estar a un click siempre. */}
            {!isWhatsApp && (
                <button
                    type="button"
                    onClick={() => pedirAbrirPanel('whatsapp')}
                    className="relative p-2.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                    title="Abrir WhatsApp"
                    aria-label={noLeidos > 0 ? `Abrir WhatsApp, ${noLeidos} sin leer` : 'Abrir WhatsApp'}
                >
                    <WhatsAppIcon className="w-5 h-5" />
                    {noLeidos > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-stone-900">
                            {noLeidos > 99 ? '99+' : noLeidos}
                        </span>
                    )}
                </button>
            )}
            <button
                type="button"
                onClick={() => pedirAbrirPanel('copilot')}
                className="p-2.5 rounded-full hover:bg-violet-50 dark:hover:bg-violet-950/40 text-violet-600 dark:text-violet-400 transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                title="Abrir Copilot"
                aria-label="Abrir Copilot"
            >
                <Sparkles className="w-5 h-5" />
            </button>

            <span aria-hidden="true" className="w-px h-6 bg-stone-200 dark:bg-stone-700 mx-0.5" />

            {/* Collapse toggle button */}
            <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors flex items-center justify-center"
                title={isCollapsed ? "Mostrar accesos rápidos" : "Contraer accesos rápidos"}
            >
                {isCollapsed ? (
                    <div className="flex items-center gap-1">
                        <LayoutGrid className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400 px-1 hidden md:inline">Accesos</span>
                    </div>
                ) : (
                    <ChevronRight className="w-5 h-5 text-stone-400" />
                )}
            </button>

            {/* Dock items */}
            <div 
                className="flex items-center gap-1 transition-all duration-300 overflow-hidden"
                style={{
                    maxWidth: isCollapsed ? '0px' : '600px',
                    opacity: isCollapsed ? 0 : 1,
                    pointerEvents: isCollapsed ? 'none' : 'auto',
                    paddingRight: isCollapsed ? '0px' : '4px'
                }}
            >
                <GlobalOpportunities />
                <GlobalBalanceReminders />
                <GlobalLabReady />
                <GlobalReviewRequests />
                <GlobalTasks />
            </div>
        </div>
    );
}
