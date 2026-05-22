'use client';

import { useState, useEffect, useCallback } from 'react';
import { io as SocketIOClient } from 'socket.io-client';
import { UserPlus, FileText, X, ExternalLink } from 'lucide-react';

interface LeadNotification {
    id: string;
    name: string;
    phone: string;
    interest: string;
    source: string;
    hasPrescription: boolean;
    prescriptionType?: string;
    timestamp: string;
}

interface Toast {
    id: string;
    data: LeadNotification;
    exiting: boolean;
}

export function LeadToastNotifications() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((toastId: string) => {
        setToasts(prev => prev.map(t => t.id === toastId ? { ...t, exiting: true } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toastId));
        }, 300);
    }, []);

    useEffect(() => {
        const socket = SocketIOClient(process.env.NEXT_PUBLIC_WA_URL || 'http://localhost:3100');

        socket.on('lead_created', (data: LeadNotification) => {
            const toastId = `${data.id}-${Date.now()}`;
            setToasts(prev => [...prev, { id: toastId, data, exiting: false }]);

            // Auto-dismiss after 8 seconds
            setTimeout(() => removeToast(toastId), 8000);

            // Browser notification
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification(`🌟 Nuevo Lead: ${data.name}`, {
                    body: `Interés: ${data.interest}${data.hasPrescription ? ' · Envió receta ✅' : ''}`,
                    icon: "https://cdn-icons-png.flaticon.com/512/4712/4712139.png",
                });
            }
        });

        return () => { socket.disconnect(); };
    }, [removeToast]);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto w-[380px] bg-white/95 dark:bg-stone-900/95 backdrop-blur-2xl rounded-2xl border border-stone-200/50 dark:border-white/10 shadow-2xl shadow-black/10 overflow-hidden transition-all duration-300 ${
                        toast.exiting 
                            ? 'opacity-0 translate-x-[120%]' 
                            : 'opacity-100 translate-x-0 animate-in slide-in-from-right-full'
                    }`}
                >
                    {/* Barra de progreso superior */}
                    <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 animate-shrink-width" />

                    <div className="p-4">
                        <div className="flex items-start gap-3">
                            {/* Icono */}
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                                toast.data.hasPrescription
                                    ? 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/30'
                                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
                            }`}>
                                {toast.data.hasPrescription 
                                    ? <FileText className="w-5 h-5 text-white" />
                                    : <UserPlus className="w-5 h-5 text-white" />
                                }
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-black text-stone-800 dark:text-white truncate">
                                        {toast.data.name}
                                    </h4>
                                    <button 
                                        onClick={() => removeToast(toast.id)}
                                        className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors shrink-0 ml-2"
                                    >
                                        <X className="w-3.5 h-3.5 text-stone-400" />
                                    </button>
                                </div>
                                
                                <p className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-0.5">
                                    Interés: <span className="font-bold text-stone-700 dark:text-stone-200">{toast.data.interest}</span>
                                </p>

                                <div className="flex items-center gap-2 mt-2">
                                    {toast.data.hasPrescription && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-[10px] font-bold">
                                            <FileText className="w-3 h-3" /> Envió receta
                                        </span>
                                    )}
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[10px] font-bold">
                                        vía {toast.data.source}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Action */}
                        <a 
                            href={`/admin/contactos?id=${toast.data.id}`}
                            className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl text-xs font-bold text-stone-700 dark:text-stone-300 transition-all border border-stone-200/50 dark:border-stone-700"
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> Ver ficha del contacto
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
}
