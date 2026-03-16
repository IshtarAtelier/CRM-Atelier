"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, X, Trash2, FileText, Loader2 } from "lucide-react";

interface Notification {
    id: string;
    type: string;
    status: string;
    message: string;
    orderId: string | null;
    requestedBy: string;
    resolvedBy: string | null;
    createdAt: string;
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            const res = await fetch("/api/notifications");
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.filter((n: Notification) => n.status === "PENDING"));
            }
        } catch { }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000); // Poll every 15s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAction = async (id: string, action: "APPROVED" | "REJECTED") => {
        setProcessingId(id);
        try {
            const res = await fetch(`/api/notifications/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (res.ok) {
                setNotifications(prev => prev.filter(n => n.id !== id));
            } else {
                const data = await res.json();
                alert(data.error || "Error al procesar solicitud");
            }
        } catch {
            alert("Error de conexión");
        }
        setProcessingId(null);
    };

    const pendingCount = notifications.length;

    const getTypeIcon = (type: string) => {
        if (type === "DELETE_REQUEST") return <Trash2 className="w-4 h-4 text-red-500" />;
        if (type === "INVOICE_REQUEST") return <FileText className="w-4 h-4 text-indigo-500" />;
        return <Bell className="w-4 h-4" />;
    };

    const getTypeLabel = (type: string) => {
        if (type === "DELETE_REQUEST") return "Solicitud de Eliminación";
        if (type === "INVOICE_REQUEST") return "Solicitud de Factura";
        return "Notificación";
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications(); }}
                className="relative p-2.5 rounded-xl hover:bg-foreground/5 transition-all group"
            >
                <Bell className={`w-5 h-5 transition-colors ${pendingCount > 0 ? 'text-amber-500' : 'text-foreground/40 group-hover:text-foreground/70'}`} />
                {pendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-red-500/30">
                        {pendingCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                    <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-widest text-stone-500">Solicitudes Pendientes</h3>
                        <span className="text-[9px] font-black text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-lg">{pendingCount}</span>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center">
                                <Bell className="w-8 h-8 text-stone-200 dark:text-stone-700 mx-auto mb-2" />
                                <p className="text-[10px] font-black text-stone-300 dark:text-stone-600 uppercase tracking-widest">Sin solicitudes</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div key={n.id} className="px-4 py-3 border-b border-stone-50 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 p-2 rounded-xl bg-stone-100 dark:bg-stone-800 flex-shrink-0">
                                            {getTypeIcon(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{getTypeLabel(n.type)}</p>
                                            <p className="text-xs font-bold text-stone-700 dark:text-stone-300 mt-0.5 break-words">{n.message}</p>
                                            <p className="text-[9px] text-stone-400 mt-1">
                                                Solicitado por <span className="font-bold text-stone-500">{n.requestedBy}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-2 ml-11">
                                        <button
                                            onClick={() => handleAction(n.id, "APPROVED")}
                                            disabled={processingId === n.id}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            {processingId === n.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                            Aprobar
                                        </button>
                                        <button
                                            onClick={() => handleAction(n.id, "REJECTED")}
                                            disabled={processingId === n.id}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-stone-300 active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            <X className="w-3 h-3" />
                                            Rechazar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
