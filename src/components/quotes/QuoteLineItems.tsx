'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface QuoteLineItemsProps {
    items: any[];
    markup: number;
    appliedPromoName?: string;
    specialDiscount?: number;
}

export default function QuoteLineItems({
    items,
    markup,
    appliedPromoName,
    specialDiscount = 0
}: QuoteLineItemsProps) {
    // Detect if this order has a 2x1 promo applied (either multifocal or generic)
    const hasPromo = appliedPromoName && (appliedPromoName.includes('2x1') || appliedPromoName.includes('Bonificado'));

    // Identify the bonified frame (aesthetic only)
    const bonifiedItemId = React.useMemo(() => {
        if (!hasPromo || !items || items.length < 2) return null;
        
        // Filter frames
        const frames = items.filter(it => {
            const cat = (it.product?.category || '').toLowerCase();
            const type = (it.product?.type || '').toLowerCase();
            return cat === 'FRAME' || cat === 'ATELIER' || cat === 'SUNGLASS' || type.includes('armazon') || type.includes('marco');
        });

        if (frames.length < 2) return null;

        // Sort by price descending (same logic as PricingService)
        const sorted = [...frames].sort((a, b) => b.price - a.price);
        
        // The second frame is the one bonified
        return sorted[1]?.id;
    }, [items, hasPromo]);

    return (
        <div className="space-y-3">
            <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Plus className="w-3 h-3" /> Detalle de productos
            </h4>
            {items.map((item: any) => {
                const itemPrice = item.price * item.quantity;
                const priceWithMarkup = itemPrice * (1 + markup / 100);
                const isBonified = item.id === bonifiedItemId;
                
                return (
                    <div key={item.id} className={`flex justify-between items-center bg-stone-50/50 dark:bg-stone-900/30 px-5 py-3 rounded-2xl border ${isBonified ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/30' : 'border-stone-100 dark:border-stone-800'} backdrop-blur-sm group/item hover:border-primary/30 transition-all`}>
                        <div className="flex items-center gap-3">
                            {item.eye && (
                                <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-[10px] font-black uppercase tracking-widest italic leading-none ${item.eye === 'OD' ? 'bg-stone-900 text-white dark:bg-stone-700' : 'bg-stone-200 text-stone-600 dark:bg-stone-800'}`}>
                                    {item.eye}
                                </span>
                            )}
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-stone-800 dark:text-stone-200 block group-hover/item:text-primary transition-colors">
                                        {(item.product?.brand || '').toUpperCase()} · {item.product?.name}
                                    </span>
                                    {isBonified && (
                                        <span className="bg-emerald-500 text-white text-[7px] px-1.5 py-0.5 rounded-lg font-black uppercase tracking-widest animate-pulse">
                                            BONIFICADO 2x1
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold text-stone-400">{item.product?.type || item.product?.category} x{item.quantity}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            {isBonified ? (
                                <div className="flex flex-col">
                                    <span className="text-[10px] line-through text-stone-400 font-bold">
                                        ${priceWithMarkup.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-sm font-black text-emerald-500">
                                        SIN CARGO
                                    </span>
                                </div>
                            ) : (
                                <span className="text-sm font-black tracking-tight text-stone-900 dark:text-stone-100">
                                    ${priceWithMarkup.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}

            {hasPromo && (
                <div className="flex justify-between items-center bg-emerald-500/5 dark:bg-emerald-500/10 px-5 py-4 rounded-2xl border-2 border-dashed border-emerald-500/20">
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
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 italic font-serif">DESCONTADO</span>
                    </div>
                </div>
            )}

            {specialDiscount > 0 && (
                <div className="flex justify-between items-center bg-rose-500/5 dark:bg-rose-500/10 px-5 py-4 rounded-2xl border-2 border-dashed border-rose-500/20 mt-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-rose-500 text-white rounded-lg flex items-center justify-center">
                            <Plus className="w-4 h-4 rotate-45" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest block">Descuento Especial</span>
                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">Aplicado por administración</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400 italic font-serif">-${Math.round(specialDiscount).toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
