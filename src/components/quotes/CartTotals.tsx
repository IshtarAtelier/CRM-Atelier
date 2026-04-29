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
}

export default function CartTotals({
    subtotal,
    markup,
    markupAmount,
    specialDiscount = 0,
    priceWithMarkup,
    totalCash,
    totalTransfer
}: CartTotalsProps) {
    return (
        <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-6 mb-8 px-2 sticky bottom-[-32px] bg-white dark:bg-stone-800 pt-8 border-t-2 border-stone-100 dark:border-stone-700 mt-2 z-20 pb-4 shadow-[0_-20px_20px_-10px_rgba(255,255,255,1)] dark:shadow-[0_-20px_20px_-10px_rgba(28,25,23,1)]">
            <div className="text-left w-full md:w-auto">
                <div className="flex items-center gap-4 mb-1">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Subtotal: ${subtotal.toLocaleString()}</span>
                    {markup > 0 && <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Markup: +${Math.round(markupAmount).toLocaleString()}</span>}
                    {specialDiscount > 0 && <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Dto: -${Math.round(specialDiscount).toLocaleString()}</span>}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Precio de Lista (Cuotas)</span>
                    <span className="text-4xl font-black text-stone-900 dark:text-stone-100 tracking-tighter leading-none">${Math.round(priceWithMarkup).toLocaleString()}</span>
                </div>
            </div>

            <div className="flex gap-6 items-center w-full md:w-auto justify-end overflow-hidden">
                <div className="text-right group/subtot">
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-1">💵 Efectivo</span>
                    <span className="text-3xl font-black text-emerald-600 tracking-tighter leading-none block">${Math.round(totalCash).toLocaleString()}</span>
                </div>
                <div className="w-px h-12 bg-stone-100 dark:bg-stone-700 hidden md:block" />
                <div className="text-right group/subtot">
                    <span className="text-[9px] font-black text-violet-600 uppercase tracking-widest block mb-1">🏦 Transferencia</span>
                    <span className="text-2xl font-black text-violet-600 tracking-tighter leading-none block">${Math.round(totalTransfer).toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}
