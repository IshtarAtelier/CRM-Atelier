'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import TasksPanel from './TasksPanel';

export function GlobalTasks() {
    const [isOpen, setIsOpen] = useState(false);
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setMounted(true);
        setPortalTarget(document.body);
        fetchTasks();
        
        const handleTasksUpdated = () => fetchTasks();
        if (typeof window !== 'undefined') {
            window.addEventListener('tasks-updated', handleTasksUpdated);
        }
        
        const interval = setInterval(fetchTasks, 60000); // Actualizar cada minuto
        return () => {
            clearInterval(interval);
            if (typeof window !== 'undefined') {
                window.removeEventListener('tasks-updated', handleTasksUpdated);
            }
        };
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await fetch('/api/tasks/pending', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (_error) {
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
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-2.5 md:px-4 md:py-3 rounded-full md:rounded-2xl border transition-all flex items-center gap-0 md:gap-2.5 active:scale-95 group relative ${isOpen
                        ? 'bg-stone-900 border-stone-800 text-white dark:bg-stone-800 dark:border-stone-700'
                        : urgentCount > 0
                            ? 'bg-red-500/10 dark:bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/20'
                            : 'bg-transparent border-transparent text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:text-stone-600 dark:hover:text-stone-100'
                        }`}
                >
                    {/* Pulsing glow effect when tasks exist and panel is closed */}
                    {!isOpen && urgentCount > 0 && (
                        <span className="absolute inset-0 rounded-[2.5rem] bg-primary/20 animate-ping -z-10" />
                    )}

                    <div className="relative">
                        <Bell className={`w-5 h-5 md:w-6 md:h-6 ${isOpen ? 'text-white' : urgentCount > 0 ? 'text-red-600 dark:text-red-500' : 'text-stone-600 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-500 transition-colors'}`} />
                        {urgentCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-red-500 text-white text-xs md:text-xs font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-md">
                                {urgentCount}
                            </span>
                        )}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-widest hidden md:block transition-colors ${isOpen ? 'text-white' : urgentCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-stone-500 dark:text-stone-600'}`}>
                        Tareas
                    </span>
                </button>
            </div>

            {isOpen && portalTarget && createPortal(
                <>
                    <TasksPanel
                        tasks={tasks}
                        onClose={() => setIsOpen(false)}
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
