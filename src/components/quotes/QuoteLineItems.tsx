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
    // Logic to detect if this order has a 2x1 frame promo applied
    const isMultifocal2x1Order = appliedPromoName === 'Promoción 2x1 Multifocal';
    let foundFirstFrame = false;

    return (
        <div className="space-y-3">
            <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Plus className="w-3 h-3" /> Detalle de productos
            </h4>
            {items.map((item: any) => {
                const itemPrice = item.price * item.quantity;
                const priceWithMarkup = itemPrice * (1 + markup / 100);
                
                const isAtelier = (item.product?.brand || '').toLowerCase().includes('atelier') || 
                                 (item.product?.name || '').toLowerCase().includes('atelier');
                const isFrame = (item.product?.category === 'FRAME' || item.product?.category === 'ATELIER');
                
                let displayPrice = priceWithMarkup;
                let isFree = false;

                if (isMultifocal2x1Order && isFrame && isAtelier) {
                    if (!foundFirstFrame) {
                        foundFirstFrame = true;
                    } else {
                        isFree = true;
                        displayPrice = 0;
                    }
                }

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
                                    {item.product?.brand} {item.product?.model || item.product?.name}
                                </span>
                                <span className="text-[10px] font-bold text-stone-400">{item.product?.type || item.product?.category} x{item.quantity}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`text-sm font-black tracking-tight ${isFree ? 'text-emerald-500 italic' : 'text-stone-900 dark:text-stone-100'}`}>
                                {isFree ? 'SIN CARGO (2x1)' : `$${displayPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                            </span>
                            {isFree && (
                                <span className="block text-[8px] font-bold text-stone-400 line-through">
                                    ${priceWithMarkup.toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
