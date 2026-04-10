'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface QuoteLineItemsProps {
    items: any[];
    markup: number;
    appliedPromoName?: string;
}

export default function QuoteLineItems({
    items,
    markup,
    appliedPromoName
}: QuoteLineItemsProps) {
    // Detect if this order has a 2x1 promo applied (either multifocal or generic)
    const hasPromo = appliedPromoName && (appliedPromoName.includes('2x1') || appliedPromoName.includes('Bonificado'));

    return (
        <div className="space-y-3">
            <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Plus className="w-3 h-3" /> Detalle de productos
            </h4>
            {items.map((item: any) => {
                const itemPrice = item.price * item.quantity;
                const priceWithMarkup = itemPrice * (1 + markup / 100);
                
                return (
                    <div key={item.id} className="flex justify-between items-center bg-stone-50/50 dark:bg-stone-900/30 px-5 py-3 rounded-2xl border border-stone-100 dark:border-stone-800 backdrop-blur-sm group/item hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-3">
                            {item.eye && (
                                <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-[10px] font-black uppercase tracking-widest italic leading-none ${item.eye === 'OD' ? 'bg-stone-900 text-white dark:bg-stone-700' : 'bg-stone-200 text-stone-600 dark:bg-stone-800'}`}>
                                    {item.eye}
                                </span>
                            )}
                            <div>
                                <span className="text-sm font-black text-stone-800 dark:text-stone-200 block group-hover/item:text-primary transition-colors">
                                    {(item.product?.brand || '').toUpperCase()} {item.product?.model || item.product?.name}
                                </span>
                                <span className="text-[10px] font-bold text-stone-400">{item.product?.type || item.product?.category} x{item.quantity}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-black tracking-tight text-stone-900 dark:text-stone-100">
                                ${priceWithMarkup.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>
                );
            })}

            {hasPromo && (
                <div className="flex justify-between items-center bg-emerald-500/5 dark:bg-emerald-500/10 px-5 py-4 rounded-2xl border-2 border-dashed border-emerald-500/20 animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center">
                            <Plus className="w-4 h-4 rotate-45" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Bonificación Aplicada</span>
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{appliedPromoName}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 italic">DESCONTADO AL CIERRE</span>
                    </div>
                </div>
            )}
        </div>
    );
}
