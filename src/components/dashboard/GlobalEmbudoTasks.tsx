'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Filter } from 'lucide-react';
import EmbudoTasksPanel from './EmbudoTasksPanel';

/**
 * El acceso del dock a las TAREAS DE EMBUDO. Hermano de `GlobalTasks`, y a
 * propósito más callado que él: sin pop-up de vencidas, sin badge rojo, sin
 * pulso. El embudo propone; la campanita de Tareas es la que reclama.
 */
export function GlobalEmbudoTasks() {
    const [isOpen, setIsOpen] = useState(false);
    const [tasks, setTasks] = useState<any[]>([]);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setPortalTarget(document.body);

        const traer = async () => {
            try {
                const res = await fetch('/api/tasks/embudo', { cache: 'no-store' });
                if (res.ok) setTasks(await res.json());
            } catch (error) {
                console.error('Error fetching embudo tasks:', error);
            }
        };

        traer();
        const interval = setInterval(traer, 60000);
        if (typeof window !== 'undefined') {
            window.addEventListener('tasks-updated', traer);
        }
        return () => {
            clearInterval(interval);
            if (typeof window !== 'undefined') {
                window.removeEventListener('tasks-updated', traer);
            }
        };
    }, []);

    // Escape cierra el panel: el fondo oscuro se cierra con el mouse, y sin
    // esto quien navega con teclado quedaba encerrado adentro.
    useEffect(() => {
        if (!isOpen) return;
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [isOpen]);

    const cantidad = tasks.length;

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2.5 md:px-4 md:py-3 rounded-full md:rounded-2xl border transition-all flex items-center gap-0 md:gap-2.5 active:scale-95 group relative ${isOpen
                    ? 'bg-stone-900 border-stone-800 text-white dark:bg-stone-800 dark:border-stone-700'
                    : 'bg-transparent border-transparent text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                    }`}
                title="Tareas de embudo — lo que propone el sistema"
                aria-label={cantidad > 0 ? `Tareas de embudo, ${cantidad} pendientes` : 'Tareas de embudo'}
            >
                <div className="relative">
                    <Filter className={`w-5 h-5 md:w-6 md:h-6 ${isOpen ? 'text-white' : 'text-stone-400 group-hover:text-sky-600 dark:text-stone-500 dark:group-hover:text-sky-400 transition-colors'}`} />
                    {cantidad > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 md:min-w-[20px] md:h-5 px-1 bg-sky-600 text-white text-[9px] md:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-md">
                            {cantidad > 99 ? '99+' : cantidad}
                        </span>
                    )}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest hidden md:block transition-colors ${isOpen ? 'text-white' : 'text-stone-500 dark:text-stone-400'}`}>
                    Embudo
                </span>
            </button>

            {isOpen && portalTarget && createPortal(
                <>
                    <EmbudoTasksPanel tasks={tasks} onClose={() => setIsOpen(false)} />
                    <div
                        aria-hidden="true"
                        className="fixed inset-0 bg-stone-900/20 dark:bg-black/40 backdrop-blur-sm z-50 transition-opacity"
                        onClick={() => setIsOpen(false)}
                    />
                </>,
                portalTarget
            )}
        </>
    );
}
