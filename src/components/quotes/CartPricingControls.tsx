'use client';

import React from 'react';
import { TrendingUp, Banknote, ArrowRightLeft, CreditCard } from 'lucide-react';

interface CartPricingControlsProps {
    markup: number;
    setMarkup: (val: number) => void;
    discountCash: number;
    setDiscountCash: (val: number) => void;
    discountTransfer: number;
    setDiscountTransfer: (val: number) => void;
    discountCard: number;
    setDiscountCard: (val: number) => void;
}

export default function CartPricingControls({
    markup,
    setMarkup,
    discountCash,
    setDiscountCash,
    discountTransfer,
    setDiscountTransfer,
    discountCard,
    setDiscountCard
}: CartPricingControlsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-3xl border-2 border-blue-100 dark:border-blue-900/30 group/markup">
                 <div className="flex items-center gap-2 mb-2">
                     <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                     <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Markup</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={0}
                        value={markup || ''}
                        onChange={e => setMarkup(Math.abs(Number(e.target.value)))}
                        className="w-full bg-white dark:bg-stone-800 border-2 border-blue-100 dark:border-blue-900/50 rounded-xl px-3 py-2 text-sm font-black outline-none focus:ring-2 focus:ring-blue-400 transition-all font-bold"
                    />
                    <span className="text-xs font-black text-blue-600">%</span>
                 </div>
            </div>
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-3xl border-2 border-emerald-100 dark:border-emerald-900/30 group/efvo">
                 <div className="flex items-center gap-2 mb-2">
                     <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                     <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Dto. Efvo</span>
                 </div>
                 <select
                    value={discountCash}
                    onChange={e => setDiscountCash(Number(e.target.value))}
                    className="w-full bg-white dark:bg-stone-800 border-2 border-emerald-100 dark:border-emerald-900/50 rounded-xl px-3 py-2 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-400 transition-all font-bold cursor-pointer"
                >
                    {[0, 5, 10, 15, 20, 25, 30].map(v => <option key={v} value={v}>-{v}%</option>)}
                </select>
            </div>
            <div className="p-4 bg-violet-50/50 dark:bg-violet-950/20 rounded-3xl border-2 border-violet-100 dark:border-violet-900/30 group/transf">
                 <div className="flex items-center gap-2 mb-2">
                     <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500" />
                     <span className="text-[9px] font-black text-violet-600 uppercase tracking-widest">Dto. Transf</span>
                 </div>
                 <select
                    value={discountTransfer}
                    onChange={e => setDiscountTransfer(Number(e.target.value))}
                    className="w-full bg-white dark:bg-stone-800 border-2 border-violet-100 dark:border-violet-900/50 rounded-xl px-3 py-2 text-sm font-black outline-none focus:ring-2 focus:ring-violet-400 transition-all font-bold cursor-pointer"
                >
                    {[0, 5, 10, 15, 20].map(v => <option key={v} value={v}>-{v}%</option>)}
                </select>
            </div>
            <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-3xl border-2 border-orange-100 dark:border-orange-900/30 group/card">
                 <div className="flex items-center gap-2 mb-2">
                     <CreditCard className="w-3.5 h-3.5 text-orange-500" />
                     <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Rec. Cuotas</span>
                 </div>
                 <select
                    value={discountCard}
                    onChange={e => setDiscountCard(Number(e.target.value))}
                    className="w-full bg-white dark:bg-stone-800 border-2 border-orange-100 dark:border-orange-900/50 rounded-xl px-3 py-2 text-sm font-black outline-none focus:ring-2 focus:ring-orange-400 transition-all font-bold cursor-pointer"
                >
                    {[0, 5, 10].map(v => <option key={v} value={v}>{v === 0 ? '0%' : `+${v}%`}</option>)}
                </select>
            </div>
        </div>
    );
}
