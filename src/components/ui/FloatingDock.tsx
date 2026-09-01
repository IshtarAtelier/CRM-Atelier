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

/**
 * La barra de accesos: un DOCK fijo abajo, siempre desplegado — como el dock
 * de macOS (pedido de Ishtar, 1/9/2026: "los vendedores lo olvidan y no lo
 * abren"). Antes era un pill chico escondido en la esquina inferior derecha,
 * plegado por default en cada página: WhatsApp y Copilot quedaban a la vista,
 * pero Oportunidades/Saldos/Laboratorio/Reseñas/Tareas necesitaban un click
 * extra para aparecer — ese click extra era justo lo que nadie hacía. Ahora no
 * hay nada que abrir: los siete accesos están siempre ahí, centrados abajo.
 *
 * En `/admin/whatsapp` se mantiene el pill chico de antes, arriba a la derecha:
 * esa pantalla ya tiene su propio Composer fijo abajo (el cuadro de escribir
 * el mensaje) y un dock centrado abajo se lo taparía.
 */
export function FloatingDock() {
    const pathname = usePathname();
    const isWhatsApp = pathname === '/admin/whatsapp';
    const [isCollapsed, setIsCollapsed] = useState(isWhatsApp);
    const { unreadTotal } = useWhatsAppDatos();
    const noLeidos = unreadTotal || 0;

    useEffect(() => {
        setIsCollapsed(isWhatsApp);
    }, [isWhatsApp]);

    // El cotizador tiene su propia barra fija abajo en mobile (el carrito,
    // z-[50]) — el dock se corre arriba de esa barra para no quedar tapado.
    const enCotizador = pathname === '/admin/cotizador';

    const contenedorClase = isWhatsApp
        ? 'fixed top-[160px] right-4 z-[40] flex items-center gap-1 p-1 bg-white/60 dark:bg-stone-900/60 backdrop-blur-xl border border-stone-200/50 dark:border-stone-800/50 rounded-full shadow-lg hover:shadow-xl hover:border-stone-300/80 dark:hover:border-stone-700/80 transition-all duration-300'
        : `fixed ${enCotizador ? 'bottom-20 lg:bottom-5' : 'bottom-4 md:bottom-5'} left-1/2 -translate-x-1/2 z-[40] flex items-center gap-1 p-1.5 bg-white/75 dark:bg-stone-900/75 backdrop-blur-xl border border-stone-200/60 dark:border-stone-800/60 rounded-full shadow-2xl transition-all duration-300`;

    return (
        <div className={contenedorClase}>
            {/* WhatsApp y Copilot viven ACÁ, en la misma píldora que los accesos
                (pedido de Ishtar 31/8: "que esté todo bien junto"). Son los dos
                accesos que más se usan y tienen que estar a un click siempre. */}
            {!isWhatsApp && (
                <button
                    type="button"
                    onClick={() => pedirAbrirPanel('whatsapp')}
                    className="relative p-2.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:scale-110 text-emerald-700 dark:text-emerald-400 transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
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
                className="p-2.5 rounded-full hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:scale-110 text-violet-600 dark:text-violet-400 transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                title="Abrir Copilot"
                aria-label="Abrir Copilot"
            >
                <Sparkles className="w-5 h-5" />
            </button>

            {isWhatsApp ? (
                <>
                    <span aria-hidden="true" className="w-px h-6 bg-stone-200 dark:bg-stone-700 mx-0.5" />

                    {/* En /admin/whatsapp el resto sigue plegado por default: acá
                        el espacio es angosto (al lado del buzón) y ya se está
                        mirando WhatsApp, así que no hace falta que se olviden de
                        abrirlo — el problema que resuelve el dock fijo es en el
                        resto del panel. */}
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-2.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors flex items-center justify-center"
                        title={isCollapsed ? 'Mostrar accesos rápidos' : 'Contraer accesos rápidos'}
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
                    <div
                        className="flex items-center gap-1 transition-all duration-300 overflow-hidden"
                        style={{
                            maxWidth: isCollapsed ? '0px' : '600px',
                            opacity: isCollapsed ? 0 : 1,
                            pointerEvents: isCollapsed ? 'none' : 'auto',
                            paddingRight: isCollapsed ? '0px' : '4px',
                        }}
                    >
                        <GlobalOpportunities />
                        <GlobalBalanceReminders />
                        <GlobalLabReady />
                        <GlobalReviewRequests />
                        <GlobalTasks />
                    </div>
                </>
            ) : (
                <>
                    <span aria-hidden="true" className="w-px h-6 bg-stone-200 dark:bg-stone-700 mx-0.5" />
                    {/* Dock: SIEMPRE desplegado, nada para abrir ni recordar. */}
                    <div className="flex items-center gap-1 [&_button]:hover:scale-110 [&_button]:transition-transform">
                        <GlobalOpportunities />
                        <GlobalBalanceReminders />
                        <GlobalLabReady />
                        <GlobalReviewRequests />
                        <GlobalTasks />
                    </div>
                </>
            )}
        </div>
    );
}
