'use client';

import { useState, useEffect } from 'react';
import { Zap, X, ChevronRight, Heart, FileText, ShoppingCart, Loader2, Check } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import Link from 'next/link';

interface Opportunity {
    id: string;
    type: 'STALLED_FAVORITE' | 'PENDING_QUOTE' | 'ABANDONED_CART';
    title: string;
    clientName: string;
    clientId: string | null;
    phone: string | null;
    detail: string;
    amount: number | null;
    daysElapsed: number;
    lastActivity: string;
}

interface OpportunitiesPanelProps {
    opportunities: Opportunity[];
    onClose: () => void;
    onRefresh: () => void;
}

export default function OpportunitiesPanel({ opportunities, onClose, onRefresh }: OpportunitiesPanelProps) {
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [finalizingId, setFinalizingId] = useState<string | null>(null);
    const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);

    useEffect(() => {
        const checkWhatsAppStatus = async () => {
            try {
                const res = await fetch('/api/whatsapp/status');
                if (res.ok) {
                    const data = await res.json();
                    setIsWhatsAppConnected(!!data.connected);
                }
            } catch (err) {
                console.error('Error checking WhatsApp status:', err);
            }
        };
        checkWhatsAppStatus();
    }, []);

    const getOppIcon = (type: string) => {
        if (type === 'STALLED_FAVORITE') return <Heart className="w-5 h-5 text-red-500 fill-red-500/10" />;
        if (type === 'PENDING_QUOTE') return <FileText className="w-5 h-5 text-indigo-500" />;
        return <ShoppingCart className="w-5 h-5 text-amber-500" />;
    };

    const getOppColorClass = (type: string) => {
        if (type === 'STALLED_FAVORITE') return 'bg-red-500';
        if (type === 'PENDING_QUOTE') return 'bg-indigo-500';
        return 'bg-amber-500';
    };

    const getOppBadge = (type: string) => {
        if (type === 'STALLED_FAVORITE') return (
            <span className="text-[8px] font-black bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                Favorito Frío
            </span>
        );
        if (type === 'PENDING_QUOTE') return (
            <span className="text-[8px] font-black bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                Presupuesto
            </span>
        );
        return (
            <span className="text-[8px] font-black bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                Carrito Web
            </span>
        );
    };

    const getLinkHref = (opp: Opportunity) => {
        if (opp.type === 'STALLED_FAVORITE') return `/admin/contactos?clientId=${opp.clientId}`;
        if (opp.type === 'PENDING_QUOTE') return `/admin/ventas?id=${opp.id}`;
        return `/admin/ventas`; // Carts don't have a direct detail page but belong to storefront/orders
    };

    const handleSendWhatsApp = async (e: React.MouseEvent, opp: Opportunity) => {
        e.preventDefault();
        e.stopPropagation();

        if (!opp.phone) return;

        const rawPhone = opp.phone.replace(/\D/g, '');
        const phone = rawPhone.length >= 10 ? '549' + rawPhone.slice(-10) : rawPhone;

        // If WhatsApp service is connected, navigate directly to local chat page
        if (isWhatsAppConnected) {
            // Generate follow-up template message
            const firstName = opp.clientName.split(' ')[0];
            let message = '';

            if (opp.type === 'STALLED_FAVORITE') {
                message = `Hola ${firstName}! Espero que estés muy bien 🤍 Queríamos saber si tenés alguna duda sobre tu consulta y si te podemos ayudar en algo más. ¡Que tengas un excelente día! ✨`;
            } else if (opp.type === 'PENDING_QUOTE') {
                message = `Hola ${firstName}! Te escribimos de Atelier para ver si habías podido analizar el presupuesto que te armamos el otro día. Avisanos si querés modificar algo o coordinar la compra. ¡Saludos! 👓✨`;
            } else {
                message = `Hola ${firstName}! Vimos que dejaste algunos artículos en tu carrito en nuestra web Atelier. Queríamos ver si tuviste algún inconveniente con el pago o si tenías alguna consulta técnica con los cristales. ¡Quedamos a tu disposición! 🛒✨`;
            }

            // Copy to clipboard for easy pasting in the local WhatsApp chat
            try {
                await navigator.clipboard.writeText(message);
            } catch (err) {
                console.warn('Failed to copy to clipboard:', err);
            }

            onClose();
            window.location.href = `/admin/whatsapp?phone=${phone}`;
            return;
        }

        // Otherwise fallback to wa.me (opens WhatsApp Web)
        setSendingId(opp.id);

        let message = '';
        const firstName = opp.clientName.split(' ')[0];

        if (opp.type === 'STALLED_FAVORITE') {
            message = `Hola ${firstName}! Espero que estés muy bien 🤍 Queríamos saber si tenés alguna duda sobre tu consulta y si te podemos ayudar en algo más. ¡Que tengas un excelente día! ✨`;
        } else if (opp.type === 'PENDING_QUOTE') {
            message = `Hola ${firstName}! Te escribimos de Atelier para ver si habías podido analizar el presupuesto que te armamos el otro día. Avisanos si querés modificar algo o coordinar la compra. ¡Saludos! 👓✨`;
        } else {
            message = `Hola ${firstName}! Vimos que dejaste algunos artículos en tu carrito en nuestra web Atelier. Queríamos ver si tuviste algún inconveniente con el pago o si tenías alguna consulta técnica con los cristales. ¡Quedamos a tu disposición! 🛒✨`;
        }

        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: `${phone}@c.us`, message })
            });

            if (res.ok) {
                alert('✅ Mensaje de seguimiento enviado con éxito');
                onRefresh();
            } else {
                // Fallback to wa.me if api fails
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
            }
        } catch (err) {
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        } finally {
            setSendingId(null);
        }
    };

    const handleFinalizeOpportunity = async (e: React.MouseEvent, opp: Opportunity) => {
        e.preventDefault();
        e.stopPropagation();

        if (confirm(`¿Estás seguro de que querés finalizar el seguimiento de ${opp.clientName}?`)) {
            setFinalizingId(opp.id);
            try {
                const res = await fetch('/api/sales-opportunities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: opp.id, type: opp.type })
                });

                if (res.ok) {
                    onRefresh();
                } else {
                    alert('Error al finalizar el seguimiento');
                }
            } catch (err) {
                console.error('Error finalizing opportunity:', err);
                alert('Error al finalizar el seguimiento');
            } finally {
                setFinalizingId(null);
            }
        }
    };

    return (
        <div className="fixed top-16 right-4 bottom-20 w-[calc(100vw-2rem)] max-w-[28rem] md:top-24 md:right-8 md:bottom-24 md:max-w-[34rem] bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl z-[100] rounded-[3rem] shadow-huge border border-stone-200/50 dark:border-stone-800/50 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-500">
            <header className="p-6 md:p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-amber-50/50 dark:bg-amber-950/10">
                <div className="flex items-center gap-3 text-amber-500">
                    <Zap className="w-6 h-6 fill-amber-500 animate-pulse" />
                    <h3 className="font-black text-stone-800 dark:text-white uppercase tracking-tighter italic text-xl">
                        Oportunidades de Cierre
                    </h3>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-all hover:rotate-90">
                    <X className="w-5 h-5 text-stone-400" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4 custom-scrollbar">
                {opportunities.length > 0 ? (
                    opportunities.map(opp => (
                        <div key={opp.id} className="relative group">
                            <Link
                                href={getLinkHref(opp)}
                                onClick={onClose}
                                className="w-full flex items-center gap-4 p-4 md:p-5 bg-white dark:bg-stone-800 rounded-[2rem] md:rounded-[2.5rem] border border-stone-100 dark:border-stone-700 hover:border-amber-500/30 dark:hover:border-amber-500/20 hover:shadow-xl transition-all text-left relative overflow-hidden"
                            >
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${getOppColorClass(opp.type)} opacity-40 group-hover:opacity-100 transition-colors`} />

                                <div className="w-10 h-10 md:w-12 md:h-12 bg-stone-50 dark:bg-stone-900 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                                    {getOppIcon(opp.type)}
                                </div>

                                <div className={`flex-1 min-w-0 ${opp.phone ? 'pr-24 md:pr-36' : 'pr-16 md:pr-20'}`}>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <p className="font-black text-stone-800 dark:text-stone-200 text-sm tracking-tight uppercase truncate">
                                            {opp.clientName}
                                        </p>
                                        {getOppBadge(opp.type)}
                                    </div>
                                    <p className="text-xs font-bold text-stone-500 dark:text-stone-400 line-clamp-2 leading-tight">
                                        {opp.detail}
                                    </p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-stone-200 group-hover:text-amber-500 transition-all group-hover:translate-x-1" />
                            </Link>

                            {/* Finalizar Opportunity Action */}
                            <button
                                onClick={(e) => handleFinalizeOpportunity(e, opp)}
                                disabled={finalizingId === opp.id}
                                className={`absolute top-1/2 -translate-y-1/2 p-2.5 md:p-3 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-stone-800 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 text-stone-500 dark:text-stone-400 rounded-xl md:rounded-2xl border border-stone-200/40 dark:border-stone-700/40 shadow hover:scale-110 active:scale-95 transition-all z-10 disabled:opacity-50 ${
                                    opp.phone ? 'right-[5.5rem] md:right-[7.5rem]' : 'right-12 md:right-16'
                                }`}
                                title="Finalizar Seguimiento"
                            >
                                {finalizingId === opp.id ? (
                                    <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4 md:w-5 md:h-5" />
                                )}
                            </button>

                            {/* WhatsApp Follow-up Action */}
                            {opp.phone && (
                                <button
                                    onClick={(e) => handleSendWhatsApp(e, opp)}
                                    disabled={sendingId === opp.id}
                                    className="absolute right-12 md:right-16 top-1/2 -translate-y-1/2 p-2.5 md:p-3 bg-emerald-500 text-white rounded-xl md:rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all z-10 disabled:opacity-50"
                                    title="Enviar WhatsApp de Seguimiento"
                                >
                                    {sendingId === opp.id ? (
                                        <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                                    ) : (
                                        <WhatsAppIcon className="w-4 h-4 md:w-5 md:h-5" />
                                    )}
                                </button>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-10 py-20 bg-stone-50/50 dark:bg-stone-800/20 rounded-[3rem] border-2 border-dashed border-stone-100 dark:border-stone-800">
                        <div className="w-20 h-20 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-xl mb-6">
                            <Zap className="w-10 h-10 text-stone-200" />
                        </div>
                        <p className="text-sm font-black text-stone-400 uppercase tracking-widest leading-relaxed">No hay alertas de cierre pendientes</p>
                        <p className="text-xs text-stone-400 mt-2">¡Buen trabajo! Todo está al día.</p>
                    </div>
                )}
            </div>

            <footer className="p-6 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] text-center">Optica CRM Opportunities</p>
            </footer>
        </div>
    );
}
