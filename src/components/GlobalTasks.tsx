'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import TasksPanel from './TasksPanel';

export function GlobalTasks() {
    const [isOpen, setIsOpen] = useState(false);
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 60000); // Actualizar cada minuto
        return () => clearInterval(interval);
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await fetch('/api/tasks/pending', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (error) {
            console.error('Error fetching pending tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const hasUrgentTasks = tasks.some(task => {
        if (!task.dueDate) return true; // Tasks without date are considered urgent/pending now
        const dueDate = new Date(task.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return dueDate <= today;
    });

    const urgentCount = tasks.filter(task => {
        if (!task.dueDate) return true;
        const dueDate = new Date(task.dueDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return dueDate <= today;
    }).length;

    return (
        <>
            {/* Botón flotante de Tareas (Bell) */}
            <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-[60] flex items-center gap-4">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-3 md:p-5 rounded-full md:rounded-[2.5rem] border-2 transition-all shadow-huge flex items-center gap-0 md:gap-3 active:scale-95 group relative ${isOpen
                        ? 'bg-stone-900 border-stone-800 text-white dark:bg-primary dark:border-primary'
                        : urgentCount > 0
                            ? 'bg-white dark:bg-stone-900 border-primary text-stone-900 dark:text-white shadow-primary/20 ring-4 ring-primary/10'
                            : 'bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-stone-100 dark:border-stone-800 text-stone-900 dark:text-white hover:border-primary/50'
                        }`}
                >
                    {/* Pulsing glow effect when tasks exist and panel is closed */}
                    {!isOpen && urgentCount > 0 && (
                        <span className="absolute inset-0 rounded-[2.5rem] bg-primary/20 animate-ping -z-10" />
                    )}

                    <div className="relative">
                        <Bell className={`w-5 h-5 md:w-7 md:h-7 ${isOpen ? 'animate-none' : urgentCount > 0 ? 'animate-bounce text-primary' : 'group-hover:rotate-12'}`} />
                        {urgentCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 md:-top-1 md:-right-1 w-4 h-4 md:w-6 md:h-6 bg-red-600 text-white text-[9px] md:text-[11px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-xl animate-pulse">
                                {urgentCount}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden md:block">
                        {urgentCount > 0 ? '¡Tareas!' : 'Tareas'}
                    </span>
                </button>
            </div>

            {/* Panel de Tareas */}
            {isOpen && (
                <TasksPanel
                    tasks={tasks}
                    onClose={() => setIsOpen(false)}
                />
            )}

            {/* Backdrop para cerrar al hacer clic afuera (Opcional, pero recomendado) */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-stone-900/20 dark:bg-black/40 backdrop-blur-sm z-50 transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
