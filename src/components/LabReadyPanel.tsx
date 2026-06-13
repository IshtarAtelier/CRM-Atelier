'use client';

import { Factory, X, User, ChevronRight, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface LabReadyPanelProps {
    orders: any[];
    onClose: () => void;
    onRefresh: () => void;
}

export default function LabReadyPanel({ orders, onClose, onRefresh }: LabReadyPanelProps) {
    const [advancingId, setAdvancingId] = useState<string | null>(null);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    const displayedOrders = orders.filter(o => !dismissedIds.has(o.id));

    const advanceToReady = async (orderId: string) => {
        setAdvancingId(orderId);
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ labStatus: 'READY' }),
            });
            if (res.ok) {
                setDismissedIds(prev => new Set(prev).add(orderId));
                onRefresh();
            } else {
                const data = await res.json();
                alert(`⚠️ ${data.error || 'Error al avanzar estado'}`);
            }
        } catch {
            alert('❌ Error de red al actualizar el pedido.');
        } finally {
            setAdvancingId(null);
        }
    };

    return (
        <div className="fixed top-16 right-4 bottom-20 w-[calc(100vw-2rem)] max-w-[28rem] md:top-24 md:right-8 md:bottom-24 md:max-w-[34rem] bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl z-[100] rounded-[3rem] shadow-huge border border-stone-200/50 dark:border-stone-800/50 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-500">
            <header className="p-6 md:p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/10">
                <div className="flex items-center gap-3 text-emerald-500">
                    <Factory className="w-6 h-6 animate-pulse" />
                    <div>
                        <h3 className="font-black text-stone-800 dark:text-white uppercase tracking-tighter italic text-xl">
                            Finalizados
                        </h3>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                            Listos en laboratorio · Pendientes de retirar
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-all hover:rotate-90">
                    <X className="w-5 h-5 text-stone-400" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4 custom-scrollbar">
                {displayedOrders.length > 0 ? (
                    displayedOrders.map(order => {
                        const crystalItems = order.items?.filter((i: any) => 
                            i.product?.category === 'Cristal' || i.productCategorySnapshot === 'Cristal'
                        ) || [];
                        const crystalDesc = crystalItems.map((i: any) => 
                            `${i.product?.brand || i.productBrandSnapshot || ''} ${i.product?.name || i.productNameSnapshot || ''}`.trim()
                        ).filter(Boolean).join(', ') || 'Cristales';

                        const daysInLab = order.labSentAt 
                            ? Math.floor((Date.now() - new Date(order.labSentAt).getTime()) / (1000 * 60 * 60 * 24))
                            : null;

                        return (
                            <div key={order.id} className="relative group">
                                <div className="w-full flex items-center gap-4 p-4 md:p-5 bg-white dark:bg-stone-800 rounded-[2rem] md:rounded-[2.5rem] border border-stone-100 dark:border-stone-700 hover:border-emerald-500/30 dark:hover:border-emerald-500/20 hover:shadow-xl transition-all text-left relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 transition-colors" />

                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl md:rounded-2xl flex items-center justify-center text-emerald-500 shrink-0">
                                        <Factory className="w-5 h-5 md:w-6 md:h-6" />
                                    </div>

                                    <div className="flex-1 min-w-0 pr-24 md:pr-40">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Link 
                                                href={`/admin/contactos?id=${order.client?.id}`}
                                                onClick={onClose}
                                                className="font-black text-stone-800 dark:text-stone-200 text-sm tracking-tight uppercase truncate hover:text-emerald-500 hover:underline transition-colors cursor-pointer"
                                            >
                                                {order.client?.name || 'Cliente'}
                                            </Link>
                                            {order.labOrderNumber && (
                                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-black rounded-lg shrink-0">
                                                    #{order.labOrderNumber}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400 line-clamp-1 leading-tight mb-1">
                                            {crystalDesc}
                                        </p>
                                        
                                        {order.labStatus === 'IN_PROGRESS' && (
                                            <div className="mb-2 mt-1 inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-amber-200/50 dark:border-amber-800/50">
                                                <span>⚠️ Terminado Parcial</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3 text-[10px] font-bold text-stone-400">
                                            {order.smartLabSector && (
                                                <span className="text-emerald-600 dark:text-emerald-400">
                                                    📍 {order.smartLabSector}
                                                </span>
                                            )}
                                            {daysInLab !== null && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {daysInLab} días
                                                </span>
                                            )}
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mt-2 w-full h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, order.smartLabProgress || 0)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Mark as READY button */}
                                    <button
                                        onClick={() => advanceToReady(order.id)}
                                        disabled={advancingId === order.id || order.labStatus === 'IN_PROGRESS'}
                                        className={`absolute right-3 md:right-4 top-1/2 -translate-y-1/2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl shadow-lg transition-all z-10 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                                            order.labStatus === 'IN_PROGRESS' 
                                                ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed'
                                                : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-105 active:scale-95 disabled:opacity-50'
                                        }`}
                                        title={order.labStatus === 'IN_PROGRESS' ? 'No se puede avisar aún. Faltan cristales en el laboratorio.' : 'Avisar que llegó al local'}
                                    >
                                        {advancingId === order.id ? (
                                            <>
                                                <span className="w-4 h-4 md:w-5 md:h-5 block rounded-full border-2 border-current border-t-transparent animate-spin" />
                                                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest hidden md:inline">Avisando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                                                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-center leading-[1.2] whitespace-nowrap">
                                                    Avisar que<br className="md:hidden" /> llegó al local
                                                </span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-10 py-20 bg-stone-50/50 dark:bg-stone-800/20 rounded-[3rem] border-2 border-dashed border-stone-100 dark:border-stone-800">
                        <div className="w-20 h-20 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-xl mb-6">
                            <Factory className="w-10 h-10 text-stone-200" />
                        </div>
                        <p className="text-sm font-black text-stone-400 uppercase tracking-widest leading-relaxed">No hay pedidos finalizados pendientes</p>
                        <p className="text-xs text-stone-300 mt-2">Los pedidos completados en SmartLab aparecerán acá</p>
                    </div>
                )}
            </div>

            <footer className="p-4 md:p-6 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">
                    {displayedOrders.length > 0 ? `${displayedOrders.length} pedido${displayedOrders.length !== 1 ? 's' : ''} finalizado${displayedOrders.length !== 1 ? 's' : ''}` : ''}
                </p>
                <button
                    onClick={onRefresh}
                    className="p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-emerald-500 transition-all"
                    title="Actualizar lista"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </footer>
        </div>
    );
}
