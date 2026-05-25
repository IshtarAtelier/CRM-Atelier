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
    specialDiscount?: number;
    setSpecialDiscount?: (val: number) => void;
    currentUserRole?: string;
    isCard?: boolean;
}

export default function CartPricingControls({
    markup,
    setMarkup,
    discountCash,
    setDiscountCash,
    discountTransfer,
    setDiscountTransfer,
    discountCard,
    setDiscountCard,
    specialDiscount = 0,
    setSpecialDiscount,
    currentUserRole,
    isCard = true
}: CartPricingControlsProps) {
    const isAdmin = currentUserRole === 'ADMIN';

    return (
        <div className={`grid grid-cols-2 gap-3 mb-6 ${isAdmin ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-2xl border border-stone-250/60 dark:border-stone-800 transition-all focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-400/25 group/markup">
                 <div className="flex items-center gap-1.5 mb-1.5">
                     <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                     <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Markup</span>
                 </div>
                 <div className="flex items-center gap-1">
                    <input
                        type="number"
                        min={0}
                        value={markup || ''}
                        onChange={e => setMarkup(Math.abs(Number(e.target.value)))}
                        className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none"
                    />
                    <span className="text-xs font-bold text-blue-500">%</span>
                 </div>
            </div>
            <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-2xl border border-stone-250/60 dark:border-stone-800 transition-all focus-within:border-emerald-450 dark:focus-within:border-emerald-550 focus-within:ring-2 focus-within:ring-emerald-400/25 group/efvo">
                 <div className="flex items-center gap-1.5 mb-1.5">
                     <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                     <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Dto. Efvo</span>
                 </div>
                 <select
                    value={discountCash}
                    onChange={e => setDiscountCash(Number(e.target.value))}
                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer"
                >
                    {[0, 5, 10, 15, 20, 25, 30].map(v => <option key={v} value={v}>-{v}%</option>)}
                </select>
            </div>
            <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-2xl border border-stone-250/60 dark:border-stone-800 transition-all focus-within:border-violet-400 dark:focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-400/25 group/transf">
                 <div className="flex items-center gap-1.5 mb-1.5">
                     <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500" />
                     <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Dto. Transf</span>
                 </div>
                 <select
                    value={discountTransfer}
                    onChange={e => setDiscountTransfer(Number(e.target.value))}
                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer"
                >
                    {[0, 5, 10, 15, 20].map(v => <option key={v} value={v}>-{v}%</option>)}
                </select>
            </div>
            <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-2xl border border-stone-250/60 dark:border-stone-800 transition-all focus-within:border-orange-400 dark:focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-400/25 group/card">
                 <div className="flex items-center gap-1.5 mb-1.5">
                     <CreditCard className="w-3.5 h-3.5 text-orange-500" />
                     <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Rec. Cuotas</span>
                 </div>
                 <select
                    value={discountCard}
                    onChange={e => setDiscountCard(Number(e.target.value))}
                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer"
                >
                    {[0, 5, 10].map(v => <option key={v} value={v}>{v === 0 ? '0%' : `+${v}%`}</option>)}
                </select>
            </div>
            
            {isAdmin && setSpecialDiscount && (
                <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-2xl border border-stone-250/60 dark:border-stone-800 transition-all focus-within:border-rose-400 dark:focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-400/25 group/special">
                     <div className="flex items-center gap-1.5 mb-1.5">
                         <Banknote className="w-3.5 h-3.5 text-rose-500" />
                         <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Dto. Especial</span>
                     </div>
                     <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-rose-550">$</span>
                          <input
                            type="number"
                            min={0}
                            value={specialDiscount || ''}
                            onChange={e => setSpecialDiscount(Math.abs(Number(e.target.value)))}
                            className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none"
                            placeholder="Monto"
                        />
                     </div>
                </div>
            )}
        </div>
    );
}
