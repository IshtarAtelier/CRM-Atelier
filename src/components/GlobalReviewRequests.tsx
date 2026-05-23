'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import ReviewRequestsPanel from './ReviewRequestsPanel';

export function GlobalReviewRequests() {
    const [isOpen, setIsOpen] = useState(false);
    const [requests, setRequests] = useState<any[]>([]);

    useEffect(() => {
        fetchRequests();
        const interval = setInterval(fetchRequests, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchRequests = async () => {
        try {
            const res = await fetch('/api/review-requests/pending', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (error) {
            console.error('Error fetching pending review requests:', error);
        }
    };

    const count = requests.length;

    return (
        <>
            {/* Botón flotante al lado de Tareas */}
            {/* The right offset is increased to 136px on mobile and 248px on desktop to sit next to the tasks bell */}
            <div className="fixed bottom-6 right-[136px] md:bottom-8 md:right-[248px] z-[60] flex items-center gap-4">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-3 md:p-4 rounded-full md:rounded-2xl border transition-all shadow-lg flex items-center gap-0 md:gap-3 active:scale-95 group relative ${isOpen
                        ? 'bg-stone-900 border-stone-800 text-white dark:bg-stone-800 dark:border-stone-700'
                        : count > 0
                            ? 'bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl border-yellow-500/30 text-stone-900 dark:text-white shadow-yellow-500/10 hover:border-yellow-500/50 hover:bg-yellow-50 dark:hover:bg-yellow-950/20'
                            : 'bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-stone-200 dark:border-stone-800 text-stone-900 dark:text-white hover:border-stone-300 dark:hover:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                        }`}
                >
                    {!isOpen && count > 0 && (
                        <span className="absolute inset-0 rounded-[2.5rem] bg-yellow-400/20 animate-ping -z-10" />
                    )}

                    <div className="relative">
                        <Star className={`w-5 h-5 md:w-6 md:h-6 ${isOpen ? 'animate-none' : count > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-stone-400 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300 transition-colors'}`} />
                        {count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-yellow-500 text-white text-[9px] md:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-md">
                                {count}
                            </span>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest hidden md:block transition-colors ${count > 0 ? 'text-yellow-700 dark:text-yellow-400' : 'text-stone-500 dark:text-stone-400'}`}>
                        Reseñas
                    </span>
                </button>
            </div>

            {isOpen && (
                <ReviewRequestsPanel
                    requests={requests}
                    onClose={() => setIsOpen(false)}
                />
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 bg-stone-900/20 dark:bg-black/40 backdrop-blur-sm z-50 transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
