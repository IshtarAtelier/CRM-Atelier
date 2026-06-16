'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Star } from 'lucide-react';
import ReviewRequestsPanel from './ReviewRequestsPanel';

export function GlobalReviewRequests() {
    const [isOpen, setIsOpen] = useState(false);
    const [requests, setRequests] = useState<any[]>([]);
    const [mounted, setMounted] = useState(false);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setMounted(true);
        setPortalTarget(document.body);
        fetchRequests();
        
        const handleTasksUpdated = () => fetchRequests();
        if (typeof window !== 'undefined') {
            window.addEventListener('tasks-updated', handleTasksUpdated);
        }
        
        const interval = setInterval(fetchRequests, 60000);
        return () => {
            clearInterval(interval);
            if (typeof window !== 'undefined') {
                window.removeEventListener('tasks-updated', handleTasksUpdated);
            }
        };
    }, []);

    const fetchRequests = async () => {
        try {
            const res = await fetch('/api/review-requests/pending', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (_error) {
            console.error('Error fetching pending review requests:', error);
        }
    };

    const count = requests.length;

    return (
        <>
            {/* Botón flotante al lado de Tareas */}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-2.5 md:px-4 md:py-3 rounded-full md:rounded-2xl border transition-all flex items-center gap-0 md:gap-2.5 active:scale-95 group relative ${isOpen
                        ? 'bg-stone-900 border-stone-800 text-white dark:bg-stone-800 dark:border-stone-700'
                        : count > 0
                            ? 'bg-yellow-500/10 dark:bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20 dark:hover:bg-yellow-500/20'
                            : 'bg-transparent border-transparent text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:text-stone-600 dark:hover:text-stone-100'
                        }`}
                >
                    {!isOpen && count > 0 && (
                        <span className="absolute inset-0 rounded-[2.5rem] bg-yellow-400/20 animate-ping -z-10" />
                    )}

                    <div className="relative">
                        <Star className={`w-5 h-5 md:w-6 md:h-6 ${isOpen ? 'text-white' : count > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-stone-600 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-500 transition-colors'}`} />
                        {count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-yellow-500 text-white text-xs md:text-xs font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-md">
                                {count}
                            </span>
                        )}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-widest hidden md:block transition-colors ${isOpen ? 'text-white' : count > 0 ? 'text-yellow-700 dark:text-yellow-400' : 'text-stone-500 dark:text-stone-600'}`}>
                        Reseñas
                    </span>
                </button>
            </div>

            {isOpen && portalTarget && createPortal(
                <>
                    <ReviewRequestsPanel
                        requests={requests}
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
