'use client';

import React from 'react';

interface CartTotalsProps {
    subtotal: number;
    markup: number;
    markupAmount: number;
    specialDiscount?: number;
    priceWithMarkup: number;
    totalCash: number;
    totalTransfer: number;
    isCard?: boolean;
}

export default function CartTotals({
    subtotal,
    markup,
    markupAmount,
    specialDiscount = 0,
    priceWithMarkup,
    totalCash,
    totalTransfer,
    isCard = true
}: CartTotalsProps) {
    return (
        <div className={isCard
            ? "flex flex-col md:flex-row items-end md:items-center justify-between gap-4 mb-6 px-2 sticky bottom-[-32px] bg-white dark:bg-stone-850 pt-6 border-t border-stone-200 dark:border-stone-700 mt-2 z-20 pb-4 shadow-[0_-20px_20px_-10px_rgba(255,255,255,1)] dark:shadow-[0_-20px_20px_-10px_rgba(28,25,23,1)] animate-in slide-in-from-bottom-2 duration-300"
            : "flex flex-col md:flex-row items-end md:items-center justify-between gap-4 py-5 border-t border-stone-200 dark:border-stone-750 mt-2 bg-transparent"
        }>
            <div className="text-left w-full md:w-auto">
                <div className="flex items-center gap-3.5 mb-1.5">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Subtotal: ${subtotal.toLocaleString()}</span>
                    {markup > 0 && <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Markup: +${Math.round(markupAmount).toLocaleString()}</span>}
                    {specialDiscount > 0 && <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Dto: -${Math.round(specialDiscount).toLocaleString()}</span>}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Precio de Lista (Cuotas)</span>
                    <span className="text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tighter leading-none">${Math.round(priceWithMarkup).toLocaleString()}</span>
                </div>
            </div>

            <div className="flex gap-5 items-center w-full md:w-auto justify-end overflow-hidden">
                <div className="text-right group/subtot">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">💵 Efectivo</span>
                    <span className="text-2xl font-extrabold text-emerald-605 tracking-tighter leading-none block">${Math.round(totalCash).toLocaleString()}</span>
                </div>
                <div className="w-px h-10 bg-stone-200 dark:bg-stone-700 hidden md:block" />
                <div className="text-right group/subtot">
                    <span className="text-[10px] font-bold text-violet-605 uppercase tracking-wider block mb-1">🏦 Transferencia</span>
                    <span className="text-xl font-extrabold text-violet-600 tracking-tighter leading-none block">${Math.round(totalTransfer).toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}
