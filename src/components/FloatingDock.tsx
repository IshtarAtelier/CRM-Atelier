'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import { GlobalOpportunities } from './GlobalOpportunities';
import { GlobalBalanceReminders } from './GlobalBalanceReminders';
import { GlobalReviewRequests } from './GlobalReviewRequests';
import { GlobalTasks } from './GlobalTasks';
import { GlobalLabReady } from './GlobalLabReady';

export function FloatingDock() {
    const pathname = usePathname();
    const isWhatsApp = pathname === '/admin/whatsapp';
    const [isCollapsed, setIsCollapsed] = useState(isWhatsApp);

    useEffect(() => {
        if (isWhatsApp) setIsCollapsed(true);
    }, [isWhatsApp]);

    return (
        <div className={`fixed ${isWhatsApp ? 'top-[160px] right-4' : 'bottom-6 md:bottom-8 right-20 md:right-[104px]'} z-[40] flex items-center gap-1 p-1 bg-white/60 dark:bg-stone-900/60 backdrop-blur-xl border border-stone-200/50 dark:border-stone-800/50 rounded-full shadow-lg hover:shadow-xl hover:border-stone-300/80 dark:hover:border-stone-700/80 transition-all duration-300`}>
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
