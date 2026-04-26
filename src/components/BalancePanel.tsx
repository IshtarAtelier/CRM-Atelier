'use client';

import { Bell, X, User, ChevronRight, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface BalancePanelProps {
    orders: any[];
    onClose: () => void;
}

export default function BalancePanel({ orders, onClose }: BalancePanelProps) {
    const getBusinessDays = (start: Date, end: Date) => {
        let count = 0;
        const curDate = new Date(start.getTime());
        // Normalizamos a medianoche para que el cálculo sea por días calendario
        curDate.setHours(0, 0, 0, 0);
        const endDate = new Date(end.getTime());
        endDate.setHours(0, 0, 0, 0);

        while (curDate < endDate) {
            curDate.setDate(curDate.getDate() + 1);
            const dayOfWeek = curDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
        }
        return count;
    };

    const today = new Date();

    return (
        <div className="fixed top-24 right-8 bottom-24 w-96 bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl z-[100] rounded-[3rem] shadow-huge border border-stone-200/50 dark:border-stone-800/50 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-500">
            <header className="p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/30">
                <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                    <Banknote className="w-6 h-6 animate-pulse" />
                    <h3 className="font-black text-stone-800 dark:text-white uppercase tracking-tighter italic text-xl">
                        Facturas con Saldo
                    </h3>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-all hover:rotate-90">
                    <X className="w-5 h-5 text-stone-400" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {orders.length > 0 ? (
                    orders.map(order => {
                        const balance = order.balance || (order.total - order.paid);
                        const bizDays = getBusinessDays(new Date(order.createdAt), today);
                        
                        // Lógica de alerta: Multifocales 15, Monofocales 4
                        const limit = order.isMultifocal ? 15 : 4;
                        const isOverdue = bizDays > limit;

                        return (
                            <Link
                                key={order.id}
                                href={`/admin/contactos?clientId=${order.clientId}`}
                                onClick={onClose}
                                className="w-full flex items-center gap-4 p-5 bg-white dark:bg-stone-800 rounded-[2.5rem] border border-stone-100 dark:border-stone-700 hover:border-emerald-500/30 dark:hover:border-emerald-400/20 hover:shadow-xl transition-all text-left group relative overflow-hidden"
                            >
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${isOverdue ? 'bg-red-500' : 'bg-emerald-500/20 group-hover:bg-emerald-500'} transition-colors`} />

                                <div className={`w-12 h-12 ${isOverdue ? 'bg-red-50 dark:bg-red-950/30 text-red-600' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600'} rounded-2xl flex items-center justify-center group-hover:bg-opacity-100 group-hover:scale-110 transition-all shrink-0`}>
                                    <User className="w-6 h-6" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-stone-800 dark:text-stone-200 text-sm truncate tracking-tight uppercase mb-1">
                                        {order.client?.name || 'Cliente'}
                                    </p>
                                    <div className="flex items-baseline gap-2">
                                        <p className={`text-lg font-black ${isOverdue ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'} tracking-tighter`}>
                                            ${balance.toLocaleString('es-AR')}
                                        </p>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                            de Saldo
                                        </p>
                                    </div>
                                    <p className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${isOverdue ? 'text-red-500' : 'text-stone-500'}`}>
                                        Pedido del {format(new Date(order.createdAt), "d 'de' MMM", { locale: es })} ({bizDays} {bizDays === 1 ? 'día' : 'días'} hábiles)
                                    </p>
                                </div>
                                <ChevronRight className={`w-5 h-5 ${isOverdue ? 'text-red-200 group-hover:text-red-500' : 'text-stone-200 group-hover:text-emerald-500'} transition-all group-hover:translate-x-1`} />
                            </Link>
                        );
                    })
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-10 py-20 bg-stone-50/50 dark:bg-stone-800/20 rounded-[3rem] border-2 border-dashed border-stone-100 dark:border-stone-800">
                        <div className="w-20 h-20 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-xl mb-6">
                            <Banknote className="w-10 h-10 text-stone-100" />
                        </div>
                        <p className="text-sm font-black text-stone-300 uppercase tracking-widest leading-relaxed">No hay saldos pendientes mayores a $1.000</p>
                    </div>
                )}
            </div>

            <footer className="p-6 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] text-center italic">
                    Recordatorio automático de cobranza
                </p>
            </footer>
        </div>
    );
}
