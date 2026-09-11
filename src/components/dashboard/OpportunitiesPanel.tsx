'use client';

import { useState } from 'react';
import { Zap, X, ChevronRight, Heart, FileText, ShoppingCart, Loader2, Check, UserPlus, MessageCircle } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { buildFollowUpMessage } from '@/lib/whatsapp-followup';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';
import TelefonoCopiable from '@/components/ui/TelefonoCopiable';
import type { Oportunidad } from '@/lib/cierres/armado';
import Link from 'next/link';

// El shape lo define el armado del panel (una sola definición, servidor y pantalla).
type Opportunity = Oportunidad;

/** "hoy", "ayer", "hace 3 días". */
function haceCuanto(iso: string): string {
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
    return dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
}

interface OpportunitiesPanelProps {
    opportunities: Opportunity[];
    onClose: () => void;
    onRefresh: () => void;
}

export default function OpportunitiesPanel({ opportunities, onClose, onRefresh }: OpportunitiesPanelProps) {
    const [finalizingId, setFinalizingId] = useState<string | null>(null);

    const getOppIcon = (type: string) => {
        if (type === 'STALLED_FAVORITE') return <Heart className="w-5 h-5 text-red-500 fill-red-500/10" />;
        if (type === 'PENDING_QUOTE') return <FileText className="w-5 h-5 text-indigo-500" />;
        if (type === 'SIN_PRESUPUESTO') return <UserPlus className="w-5 h-5 text-sky-600" />;
        return <ShoppingCart className="w-5 h-5 text-amber-500" />;
    };

    const getOppColorClass = (type: string) => {
        if (type === 'STALLED_FAVORITE') return 'bg-red-500';
        if (type === 'PENDING_QUOTE') return 'bg-indigo-500';
        if (type === 'SIN_PRESUPUESTO') return 'bg-sky-500';
        return 'bg-amber-500';
    };

    const getOppBadge = (type: string) => {
        if (type === 'STALLED_FAVORITE') return (
            <span className="text-[8px] font-black bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                Favorito Frío
            </span>
        );
        if (type === 'PENDING_QUOTE') return (
            <span className="text-[8px] font-black bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                Presupuesto
            </span>
        );
        if (type === 'SIN_PRESUPUESTO') return (
            <span className="text-[8px] font-black bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                Sin presupuesto
            </span>
        );
        return (
            <span className="text-[8px] font-black bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                {/* "Carrito abandonado" con todas las letras (Ishtar, 10/9/2026):
                    "Carrito Web" no decía qué pasó — el cliente armó la compra en
                    la tienda y no la pagó. */}
                Carrito abandonado
            </span>
        );
    };

    const getLinkHref = (opp: Opportunity) => {
        if (opp.type === 'STALLED_FAVORITE' || opp.type === 'SIN_PRESUPUESTO') return `/admin/contactos?clientId=${opp.clientId}`;
        if (opp.type === 'PENDING_QUOTE') return `/admin/ventas?id=${opp.id}`;
        // Los carritos que califican tienen ficha creada automáticamente
        // (etiqueta "Carrito Web") — el click va directo a esa ficha.
        if (opp.clientId) return `/admin/contactos?clientId=${opp.clientId}`;
        return `/admin/ventas`;
    };

    const handleSendWhatsApp = (e: React.MouseEvent, opp: Opportunity) => {
        e.preventDefault();
        e.stopPropagation();

        if (!opp.phone) return;

        // Normalización completa (0 de área, "15" intercalado, +54 9): el
        // recorte ingenuo de últimos 10 dígitos convertía "0351 15 6998877" en
        // un número de Buenos Aires y abría el chat de un desconocido.
        const phone = formatPhoneForWhatsApp(opp.phone);
        if (!phone || phone.length <= 3) return;

        const { message } = buildFollowUpMessage({
            clientName: opp.clientName,
            type: opp.type,
            daysElapsed: opp.daysElapsed,
            seed: opp.clientId || opp.id,
        });

        // Copy to clipboard for easy pasting in the local WhatsApp chat
        try {
            navigator.clipboard.writeText(message);
        } catch (err) {
            console.warn('Failed to copy to clipboard:', err);
        }

        // Registrar el seguimiento en la ficha del cliente (fire-and-forget:
        // no bloquea la navegación al chat).
        fetch('/api/sales-opportunities/followup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: opp.id, type: opp.type, message, via: 'whatsapp' }),
        }).catch(() => { });

        onClose();
        window.location.href = `/admin/whatsapp?phone=${phone}&text=${encodeURIComponent(message)}`;
    };

    /**
     * "Ya le escribí" (Ishtar, 10/9/2026): la tarjeta común se esconde 5 días y
     * vuelve sola si no compró; la importante queda abajo, atenuada. Copiar el
     * número cuenta igual —es para escribirle desde el WhatsApp propio— pero no
     * refresca al instante: la tarjeta no se puede ir de abajo del dedo justo
     * cuando el vendedor va a pegar. Se va en el próximo refresco.
     */
    const [marcandoId, setMarcandoId] = useState<string | null>(null);
    const registrarEscrito = async (opp: Opportunity, via: 'copia' | 'manual') => {
        if (via === 'manual') setMarcandoId(opp.id);
        try {
            await fetch('/api/sales-opportunities/followup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: opp.id, type: opp.type, via }),
            });
            if (via === 'manual') onRefresh();
        } catch {
            if (via === 'manual') alert('No se pudo registrar. Probá de nuevo.');
        } finally {
            if (via === 'manual') setMarcandoId(null);
        }
    };

    const tituloDeGrupo = (opp: Opportunity, i: number) => {
        const grupo = (o: Opportunity) => (o.yaEscrito ? 'escritos' : o.importante ? 'importantes' : 'resto');
        if (i > 0 && grupo(opportunities[i - 1]) === grupo(opp)) return null;
        const g = grupo(opp);
        if (g === 'importantes') return 'Importantes del mes';
        if (g === 'escritos') return 'Importantes — ya les escribieron';
        return 'Para escribir';
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
                    opportunities.map((opp, i) => (
                        <div key={opp.id}>
                        {tituloDeGrupo(opp, i) && (
                            <p className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 ${i === 0 ? 'pb-2' : 'pt-4 pb-2'} ${opp.importante && !opp.yaEscrito ? 'text-amber-700 dark:text-amber-400' : 'text-stone-600 dark:text-stone-400'}`}>
                                {tituloDeGrupo(opp, i)}
                            </p>
                        )}
                        {/* Sin opacidad: la regla de baja visión del equipo (piso 4,5:1)
                            prohíbe bajar el contraste del texto. "Ya le escribieron" se
                            distingue con fondo gris y borde punteado. */}
                        <div className="relative group">
                            <Link
                                href={getLinkHref(opp)}
                                onClick={onClose}
                                className={`w-full flex items-center gap-4 p-4 md:p-5 rounded-[2rem] md:rounded-[2.5rem] border hover:shadow-xl transition-all text-left relative overflow-hidden ${
                                    opp.yaEscrito
                                        ? 'bg-stone-100 dark:bg-stone-900 border-dashed border-stone-300 dark:border-stone-700'
                                        : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 hover:border-amber-500/30 dark:hover:border-amber-500/20'
                                }`}
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
                                    <p className="text-xs font-bold text-stone-600 dark:text-stone-400 line-clamp-2 leading-tight">
                                        {opp.detail}
                                    </p>
                                    {/* El número a la vista y copiable: el cierre lo
                                        sigue un vendedor de verdad desde SU WhatsApp,
                                        y así no se gasta una plantilla de la API
                                        oficial (Ishtar, 10/9/2026). */}
                                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1.5">
                                        {opp.phone && (
                                            <TelefonoCopiable
                                                phone={opp.phone}
                                                className="text-xs"
                                                onCopiado={() => { if (!opp.yaEscrito) registrarEscrito(opp, 'copia'); }}
                                            />
                                        )}
                                        {opp.yaEscrito ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-600 dark:text-stone-300">
                                                <MessageCircle className="w-3 h-3" />
                                                {opp.yaEscrito.quien ? `Le escribió ${opp.yaEscrito.quien.split(' ')[0]}` : 'Ya le escribieron'} {haceCuanto(opp.yaEscrito.cuando)}
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); registrarEscrito(opp, 'manual'); }}
                                                disabled={marcandoId === opp.id}
                                                className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 -mx-1 text-[11px] font-bold text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-stone-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                                title={opp.importante ? 'Queda a la vista, abajo, con la fecha' : 'Se esconde 5 días y vuelve si no compró'}
                                            >
                                                {marcandoId === opp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                Ya le escribí
                                            </button>
                                        )}
                                    </div>
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
                                    className="absolute right-12 md:right-16 top-1/2 -translate-y-1/2 p-2.5 md:p-3 bg-emerald-500 text-white rounded-xl md:rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all z-10"
                                    title="Enviar WhatsApp de Seguimiento"
                                >
                                    <WhatsAppIcon className="w-4 h-4 md:w-5 md:h-5" />
                                </button>
                            )}
                        </div>
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
