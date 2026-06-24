'use client';

import { useState, useEffect, useCallback } from 'react';
import { io as SocketIOClient } from 'socket.io-client';
import { UserPlus, FileText, X, ExternalLink, AlertTriangle, Link2, MessageCircle } from 'lucide-react';
import { WhatsAppIcon } from '@/components/ui/icons';

interface LeadNotification {
    id: string;
    name: string;
    phone: string;
    interest: string;
    source: string;
    hasPrescription: boolean;
    prescriptionType?: string;
    timestamp: string;
    isLinked?: boolean;
}

interface BotErrorNotification {
    chatId: string;
    name: string;
    phone: string;
    error: string;
}

interface Toast {
    id: string;
    type: 'LEAD' | 'BOT_ERROR' | 'MESSAGE';
    data: any;
    exiting: boolean;
}

export function LeadToastNotifications() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [userRole, setUserRole] = useState<string | null>(null);

    const removeToast = useCallback((toastId: string) => {
        setToasts(prev => prev.map(t => t.id === toastId ? { ...t, exiting: true } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toastId));
        }, 300);
    }, []);

    // Fetch user role on mount
    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data?.role) setUserRole(data.role); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        let socket: any = null;

        fetch('/api/whatsapp/status')
            .then(res => res.json())
            .then(statusData => {
                const socketUrl = process.env.NEXT_PUBLIC_WA_URL || statusData.socketUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3100');
                socket = SocketIOClient(socketUrl);

                socket.on('lead_created', (data: LeadNotification) => {
            const toastId = `${data.id}-${Date.now()}`;
            setToasts(prev => [...prev, { id: toastId, type: 'LEAD', data, exiting: false }]);

            // Auto-dismiss after 8 seconds
            setTimeout(() => removeToast(toastId), 8000);

            // Browser notification
            if ("Notification" in window && Notification.permission === "granted") {
                const title = data.isLinked ? `🔗 Ficha Vinculada: ${data.name}` : `🌟 Nuevo Lead: ${data.name}`;
                const body = data.isLinked 
                    ? `Se vinculó la conversación a la ficha existente.` 
                    : `Interés: ${data.interest}${data.hasPrescription ? ' · Envió receta ✅' : ''}`;
                new Notification(title, {
                    body,
                    icon: data.isLinked 
                        ? "https://cdn-icons-png.flaticon.com/512/3256/3256114.png" 
                        : "https://cdn-icons-png.flaticon.com/512/4712/4712139.png",
                });
            }
        });

        socket.on('bot_error', (data: BotErrorNotification) => {
            // Solo mostrar alertas de error del bot al usuario ADMIN (ishtar)
            if (userRole !== 'ADMIN') return;

            const toastId = `bot-err-${data.chatId}-${Date.now()}`;
            setToasts(prev => [...prev, { id: toastId, type: 'BOT_ERROR', data, exiting: false }]);

            // Auto-dismiss after 15 seconds
            setTimeout(() => removeToast(toastId), 15000);

            // Browser notification
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification(`⚠️ Bot Desactivado: ${data.name}`, {
                    body: `Límite de cuota / crédito agotado en Gemini.`,
                    icon: "https://cdn-icons-png.flaticon.com/512/564/564619.png",
                });
            }
        });

        socket.on('new_message_received', (data: { chatId: string, name: string, phone: string, content: string, botEnabled: boolean }) => {
            // Don't show global notification if user is already on the WhatsApp page (page.tsx handles its own notifications)
            const isOnWhatsAppPage = window.location.pathname.includes('/whatsapp');

            if (!isOnWhatsAppPage) {
                // In-app toast notification
                const toastId = `msg-${data.chatId}-${Date.now()}`;
                setToasts(prev => [...prev, { id: toastId, type: 'MESSAGE', data, exiting: false }]);
                setTimeout(() => removeToast(toastId), 8000);
                
                // Browser notification
                if ("Notification" in window && Notification.permission === "granted") {
                    const notification = new Notification(`Mensaje de ${data.name}`, {
                        body: data.content,
                        icon: "https://cdn-icons-png.flaticon.com/512/124/124034.png",
                        tag: `chat-${data.chatId}`
                    });
                    
                    notification.onclick = () => {
                        window.focus();
                        window.location.href = `/admin/whatsapp?phone=${data.phone}`;
                    };
                }
            }
        });
        
            })
            .catch(console.error);

        return () => { if (socket) socket.disconnect(); };
    }, [removeToast, userRole]);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => {
                const isBotError = toast.type === 'BOT_ERROR';
                return (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto w-[380px] bg-white/95 dark:bg-stone-900/95 backdrop-blur-2xl rounded-2xl border border-stone-200/50 dark:border-white/10 shadow-2xl shadow-black/10 overflow-hidden transition-all duration-300 ${
                            toast.exiting 
                                ? 'opacity-0 translate-x-[120%]' 
                                : 'opacity-100 translate-x-0 animate-in slide-in-from-right-full'
                        }`}
                    >
                        {/* Barra de progreso superior */}
                        <div className={`h-1 ${toast.type === 'MESSAGE' ? 'animate-shrink-width' : 'animate-shrink-width'} ${
                            toast.type === 'MESSAGE'
                                ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                                : isBotError 
                                    ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                                    : toast.data.isLinked
                                        ? 'bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400'
                                        : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400'
                        }`} />

                        <div className="p-4">
                            <div className="flex items-start gap-3">
                                {/* Icono */}
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                                    toast.type === 'MESSAGE'
                                        ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30'
                                        : isBotError
                                            ? 'bg-gradient-to-br from-red-500 to-orange-600 shadow-red-500/30'
                                            : toast.data.isLinked
                                                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'
                                                : toast.data.hasPrescription
                                                    ? 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/30'
                                                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
                                }`}>
                                    {toast.type === 'MESSAGE'
                                        ? <WhatsAppIcon className="w-5 h-5 text-white" />
                                        : isBotError
                                            ? <AlertTriangle className="w-5 h-5 text-white" />
                                            : toast.data.isLinked
                                                ? <Link2 className="w-5 h-5 text-white" />
                                                : toast.data.hasPrescription 
                                                    ? <FileText className="w-5 h-5 text-white" />
                                                    : <UserPlus className="w-5 h-5 text-white" />
                                    }
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black text-stone-800 dark:text-white truncate">
                                            {toast.type === 'MESSAGE'
                                                ? `💬 ${toast.data.name}`
                                                : isBotError 
                                                    ? '⚠️ Bot Desactivado' 
                                                    : toast.data.isLinked
                                                        ? `🔗 ${toast.data.name}`
                                                        : toast.data.name
                                            }
                                        </h4>
                                        <button 
                                            onClick={() => removeToast(toast.id)}
                                            className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors shrink-0 ml-2"
                                        >
                                            <X className="w-3.5 h-3.5 text-stone-400" />
                                        </button>
                                    </div>
                                    
                                    {toast.type === 'MESSAGE' ? (
                                        <>
                                            <p className="text-xs text-stone-600 dark:text-stone-300 font-medium mt-1 line-clamp-2 leading-relaxed">
                                                {toast.data.content}
                                            </p>
                                            <a 
                                                href={`/admin/whatsapp?phone=${toast.data.phone}`}
                                                className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 transition-all border border-emerald-200/50 dark:border-emerald-700/50"
                                            >
                                                <MessageCircle className="w-3.5 h-3.5" /> Ir al chat
                                            </a>
                                        </>
                                    ) : (
                                        <>
                                            {isBotError ? (
                                                <>
                                                    <p className="text-xs text-stone-500 dark:text-stone-400 font-bold mt-1">
                                                        Cliente: <span className="text-stone-700 dark:text-stone-200">{toast.data.name}</span>
                                                    </p>
                                                    <p className="text-[11px] text-red-500 font-semibold mt-0.5 animate-pulse">
                                                        Motivo: {toast.data.error}
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    {toast.data.isLinked ? (
                                                        <p className="text-xs text-stone-500 dark:text-stone-400 font-bold mt-0.5">
                                                            Conversación vinculada a ficha existente.
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-0.5">
                                                            Interés: <span className="font-bold text-stone-700 dark:text-stone-200">{toast.data.interest}</span>
                                                        </p>
                                                    )}

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
                                                </>
                                            )}

                                            <a 
                                                href={isBotError ? `/admin/whatsapp?phone=${toast.data.phone}` : `/admin/contactos?id=${toast.data.id}`}
                                                className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl text-xs font-bold text-stone-700 dark:text-stone-300 transition-all border border-stone-200/50 dark:border-stone-700"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" /> {isBotError ? 'Atender conversación' : 'Ver ficha del contacto'}
                                            </a>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
