'use client';

import { Star, X, User, ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';

import { WhatsAppIcon } from '@/components/ui/icons';

import { useState } from 'react';

interface ReviewRequestsPanelProps {
    requests: any[];
    onClose: () => void;
}

export default function ReviewRequestsPanel({ requests, onClose }: ReviewRequestsPanelProps) {
    const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
    const [isCompleting, setIsCompleting] = useState<string | null>(null);

    const displayedRequests = requests.filter(req => !completedTasks.has(req.id));
    return (
        <div className="fixed top-16 right-4 bottom-20 w-[calc(100vw-2rem)] max-w-[28rem] md:top-24 md:right-8 md:bottom-24 md:max-w-[34rem] bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl z-[100] rounded-[3rem] shadow-huge border border-stone-200/50 dark:border-stone-800/50 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-500">
            <header className="p-6 md:p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-yellow-50/50 dark:bg-yellow-900/10">
                <div className="flex items-center gap-3 text-yellow-500">
                    <Star className="w-6 h-6 fill-yellow-500 animate-pulse" />
                    <h3 className="font-black text-stone-800 dark:text-white uppercase tracking-tighter italic text-xl">
                        Reseñas Pendientes
                    </h3>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-all hover:rotate-90">
                    <X className="w-5 h-5 text-stone-400" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4 custom-scrollbar">
                {displayedRequests.length > 0 ? (
                    displayedRequests.map(task => (
                        <div key={task.id} className="relative group">
                            <Link
                                href={`/admin/contactos?clientId=${task.clientId}`}
                                onClick={onClose}
                                className="w-full flex items-center gap-4 p-4 md:p-5 bg-white dark:bg-stone-800 rounded-[2rem] md:rounded-[2.5rem] border border-stone-100 dark:border-stone-700 hover:border-yellow-500/30 dark:hover:border-yellow-500/20 hover:shadow-xl transition-all text-left relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-500/20 group-hover:bg-yellow-500 transition-colors" />

                                <div className="w-10 h-10 md:w-12 md:h-12 bg-stone-50 dark:bg-stone-900 rounded-xl md:rounded-2xl flex items-center justify-center text-stone-400 group-hover:text-yellow-500 group-hover:bg-yellow-500/5 transition-all shrink-0">
                                    <User className="w-5 h-5 md:w-6 md:h-6" />
                                </div>

                                <div className="flex-1 min-w-0 pr-16 md:pr-20">
                                    <p className="font-black text-stone-800 dark:text-stone-200 text-sm tracking-tight uppercase mb-1">
                                        {task.client?.name || 'Cliente'}
                                        {task.client?.phone && (
                                            <span 
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                className="text-xs font-bold text-stone-400 dark:text-stone-500 normal-case ml-2 select-all cursor-text"
                                                title="Hacé click para seleccionar y copiar"
                                            >
                                                ({task.client.phone})
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs font-bold text-stone-500 dark:text-stone-400 line-clamp-2 leading-tight lowercase">
                                        {task.description}
                                    </p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-stone-200 group-hover:text-yellow-500 transition-all group-hover:translate-x-1" />
                            </Link>

                            {/* WhatsApp Action */}
                            {task.client?.phone && (
                                <button
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        
                                        const btn = e.currentTarget;
                                        const originalHTML = btn.innerHTML;
                                        btn.innerHTML = '<span class="w-4 h-4 md:w-5 md:h-5 block rounded-full border-2 border-white border-t-transparent animate-spin"></span>';
                                        btn.disabled = true;

                                        let productNames = 'anteojos o cristales (por ejemplo: multifocales, lentes de sol, cristales Crizal, etc.)';
                                        try {
                                            const res = await fetch(`/api/contacts/${task.clientId}`);
                                            if (res.ok) {
                                                const clientData = await res.json();
                                                const lastSale = clientData.orders?.find((o: any) => o.orderType === 'SALE' && !o.isDeleted);
                                                if (lastSale && lastSale.items && lastSale.items.length > 0) {
                                                    productNames = lastSale.items.map((it: any) => it.product?.name || it.productNameSnapshot).filter(Boolean).join(', ');
                                                }
                                            }
                                        } catch (err) {
                                            console.error('Error fetching orders for review task', err);
                                        }
                                        
                                        const finalMessage = `Hola ${task.client.name.split(' ')[0]}, Te escribo para pedirte un favor enorme 🙏\n\nMe dejarias una reseña en Google? me ayuda muchísimo, si podés compartir cómo fue tu experiencia y qué fue lo que más te gustó de nuestra atención.\n\nSi podés, contá en la reseña qué te parecieron tus ${productNames}, ¡nos ayuda un montón! 🙌\n\n👉 https://g.page/r/CcVls8v7ic_NEBM/review\n\n\nMe suma muchísimo para seguir creciendo! Espero tu comentario 🤍✨🫶`;

                                        let phone = task.client.phone.replace(/\D/g, '');
                                        if (phone.length === 10) phone = '549' + phone;
                                        
                                        window.location.href = `/admin/whatsapp?phone=${phone}&text=${encodeURIComponent(finalMessage)}`;
                                        onClose();
                                    }}
                                    className="absolute right-12 md:right-16 top-1/2 -translate-y-1/2 p-2.5 md:p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl md:rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Ir al chat de WhatsApp en el CRM con el mensaje prearmado"
                                >
                                    <WhatsAppIcon className="w-4 h-4 md:w-5 md:h-5" />
                                </button>
                            )}

                            {/* Mark Complete Action */}
                            <button
                                onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (isCompleting === task.id) return;
                                    setIsCompleting(task.id);
                                    try {
                                        const res = await fetch(`/api/contacts/${task.clientId}/tasks`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ taskId: task.id, status: 'COMPLETED' })
                                        });
                                        if (res.ok) {
                                            setCompletedTasks(prev => new Set(prev).add(task.id));
                                        } else {
                                            alert('❌ Error al completar la tarea.');
                                        }
                                    } catch (err) {
                                        alert('❌ Error de red.');
                                    } finally {
                                        setIsCompleting(null);
                                    }
                                }}
                                disabled={isCompleting === task.id}
                                className={`absolute right-2 md:right-3 top-1/2 -translate-y-1/2 p-2 md:p-2.5 rounded-xl md:rounded-2xl transition-all z-10 
                                    ${isCompleting === task.id ? 'bg-stone-100 text-stone-400' : 'bg-white hover:bg-yellow-50 dark:bg-stone-800 dark:hover:bg-yellow-900/30 text-stone-300 hover:text-yellow-500 shadow-sm hover:shadow-md'}
                                `}
                                title="Finalizar tarea de reseña"
                            >
                                {isCompleting === task.id ? (
                                    <span className="w-4 h-4 md:w-5 md:h-5 block rounded-full border-2 border-stone-400 border-t-transparent animate-spin"></span>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                )}
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-10 py-20 bg-stone-50/50 dark:bg-stone-800/20 rounded-[3rem] border-2 border-dashed border-stone-100 dark:border-stone-800">
                        <div className="w-20 h-20 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-xl mb-6">
                            <Star className="w-10 h-10 text-stone-200" />
                        </div>
                        <p className="text-sm font-black text-stone-400 uppercase tracking-widest leading-relaxed">No hay solicitudes pendientes</p>
                    </div>
                )}
            </div>

            <footer className="p-6 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800 space-y-4">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] text-center">Optica CRM v2.0</p>
            </footer>
        </div>
    );
}
