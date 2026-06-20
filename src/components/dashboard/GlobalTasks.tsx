'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, AlertTriangle, X } from 'lucide-react';
import TasksPanel from './TasksPanel';

export function GlobalTasks() {
    const [isOpen, setIsOpen] = useState(false);
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    const [showOverduePopup, setShowOverduePopup] = useState(false);
    const [popupDismissed, setPopupDismissed] = useState(false);

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
        } catch (error) {
            console.error('Error fetching pending tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const overdueTasks = tasks.filter(task => {
        if (!task.dueDate) return false;
        return new Date(task.dueDate) < startOfToday;
    });

    const overdueCount = overdueTasks.length;

    const hasUrgentTasks = tasks.some(task => {
        if (!task.dueDate) return true;
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

    // Show overdue popup automatically (once per session)
    useEffect(() => {
        if (loading || popupDismissed) return;
        if (overdueCount > 0 && !isOpen) {
            const sessionKey = 'overdue-popup-shown';
            const alreadyShown = sessionStorage.getItem(sessionKey);
            if (!alreadyShown) {
                const timer = setTimeout(() => {
                    setShowOverduePopup(true);
                    sessionStorage.setItem(sessionKey, 'true');
                }, 1500); // slight delay for page to settle
                return () => clearTimeout(timer);
            }
        }
    }, [loading, overdueCount, isOpen, popupDismissed]);

    // Auto-dismiss popup after 8 seconds
    useEffect(() => {
        if (!showOverduePopup) return;
        const timer = setTimeout(() => {
            setShowOverduePopup(false);
            setPopupDismissed(true);
        }, 8000);
        return () => clearTimeout(timer);
    }, [showOverduePopup]);

    const handlePopupClick = () => {
        setShowOverduePopup(false);
        setPopupDismissed(true);
        setIsOpen(true);
    };

    const handlePopupDismiss = () => {
        setShowOverduePopup(false);
        setPopupDismissed(true);
    };

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-2.5 md:px-4 md:py-3 rounded-full md:rounded-2xl border transition-all flex items-center gap-0 md:gap-2.5 active:scale-95 group relative ${isOpen
                        ? 'bg-stone-900 border-stone-800 text-white dark:bg-stone-800 dark:border-stone-700'
                        : urgentCount > 0
                            ? 'bg-red-500/10 dark:bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/20'
                            : 'bg-transparent border-transparent text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                        }`}
                >
                    {/* Pulsing glow effect when tasks exist and panel is closed */}
                    {!isOpen && urgentCount > 0 && (
                        <span className="absolute inset-0 rounded-[2.5rem] bg-primary/20 animate-ping -z-10" />
                    )}

                    <div className="relative">
                        <Bell className={`w-5 h-5 md:w-6 md:h-6 ${isOpen ? 'text-white' : urgentCount > 0 ? 'text-red-600 dark:text-red-500' : 'text-stone-400 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300 transition-colors'}`} />
                        {urgentCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-red-500 text-white text-[9px] md:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-md">
                                {urgentCount}
                            </span>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest hidden md:block transition-colors ${isOpen ? 'text-white' : urgentCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-stone-500 dark:text-stone-400'}`}>
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
                        onClick={() => setIsOpen(false)}
                    />
                </>,
                portalTarget
            )}

            {/* Overdue Tasks Popup Notification */}
            {showOverduePopup && portalTarget && createPortal(
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-8 fade-in duration-500">
                    <div className="relative bg-gradient-to-r from-red-600 via-red-500 to-rose-500 text-white rounded-2xl shadow-2xl shadow-red-500/30 border border-red-400/30 px-6 py-4 flex items-center gap-4 min-w-[320px] max-w-[480px] cursor-pointer group hover:shadow-red-500/50 hover:scale-[1.02] transition-all"
                         onClick={handlePopupClick}
                    >
                        {/* Pulse ring */}
                        <span className="absolute inset-0 rounded-2xl bg-red-400/20 animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
                        
                        <div className="relative flex items-center justify-center w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl shrink-0">
                            <AlertTriangle className="w-6 h-6 text-white animate-pulse" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-sm uppercase tracking-wide">
                                ⚠️ {overdueCount} {overdueCount === 1 ? 'Tarea Vencida' : 'Tareas Vencidas'}
                            </p>
                            <p className="text-[11px] text-red-100 font-medium mt-0.5">
                                Tocá para ver los detalles
                            </p>
                        </div>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePopupDismiss();
                            }}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Progress bar for auto-dismiss */}
                        <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-white/60 rounded-full animate-shrink-bar" />
                        </div>
                    </div>
                </div>,
                portalTarget
            )}
        </>
    );
}
