'use client';

import React from 'react';
import { ShoppingBag, X, Minus, Plus } from 'lucide-react';
import { isMultifocal2x1, isCrystal, isFrame, getCategoryKey, safePrice } from '@/lib/promo-utils';

interface CartLineItemsProps {
    items: any[];
    onUpdateQuantity: (idx: number, delta: number) => void;
    onRemoveItem: (idx: number) => void;
    markup: number;
    secondFrameUid: number | null;
    promoFrameDiscount: number;
}

export default function CartLineItems({
    items,
    onUpdateQuantity,
    onRemoveItem,
    markup,
    secondFrameUid,
    promoFrameDiscount
}: CartLineItemsProps) {
    if (items.length === 0) {
        return (
            <div className="py-12 text-center border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-[2.5rem] bg-stone-50/50 dark:bg-stone-900/20">
                <ShoppingBag className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-4" />
                <p className="text-xs font-black text-stone-300 uppercase tracking-widest">El presupuesto está vacío</p>
                <p className="text-[10px] font-bold text-stone-400 mt-2">Usá el buscador de arriba para agregar ítems</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 mb-8">
            {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 bg-stone-50 dark:bg-stone-900 p-4 rounded-3xl border border-stone-100 dark:border-stone-800 group hover:border-primary/30 transition-all">
                    {item.eye && (
                        <span className={`w-10 h-10 flex items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-widest italic shrink-0 ${item.eye === 'OD' ? 'bg-stone-900 text-white dark:bg-stone-700' : 'bg-stone-200 text-stone-600 dark:bg-stone-800'}`}>
                            {item.eye}
                        </span>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-stone-800 dark:text-white truncate group-hover:text-primary transition-colors flex items-center gap-2">
                            {item.product.brand} {item.product.model || item.product.name}
                            {safePrice(item.customPrice) === 0 && isMultifocal2x1(item.product) && (
                                <span className="bg-emerald-500 text-white text-[7px] px-1.5 py-0.5 rounded-lg font-black uppercase tracking-widest animate-pulse">
                                    BONIFICADO 2x1
                                </span>
                            )}
                        </p>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                            {getCategoryKey(item.product.type, item.product.category)}
                            {item.isPromo && <span className="text-emerald-500 ml-2">† SIN CARGO 2x1</span>}
                        </p>
                    </div>
                    {(!item.isPromo && !isCrystal(item.product)) && (
                        <div className="flex items-center gap-2 bg-white dark:bg-stone-800 p-1 rounded-xl border border-stone-100 dark:border-stone-700">
                            <button onClick={() => onUpdateQuantity(idx, -1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-50 hover:text-stone-800 transition-colors"><Minus className="w-4 h-4" /></button>
                            <span className="text-xs font-black w-6 text-center">{item.quantity}</span>
                            <button onClick={() => onUpdateQuantity(idx, 1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-50 hover:text-stone-800 transition-colors"><Plus className="w-4 h-4" /></button>
                        </div>
                    )}
                    {isCrystal(item.product) && (
                        <div className="flex items-center gap-2 bg-stone-100/50 dark:bg-stone-800/20 px-3 py-2 rounded-xl border border-stone-100 dark:border-stone-800 opacity-60">
                            <span className="text-[9px] font-black uppercase text-stone-400">Qty: {item.quantity}</span>
                        </div>
                    )}
                    <div className="w-28 text-right pr-2">
                        {item.uid === secondFrameUid && promoFrameDiscount > 0 ? (
                            <div className="flex flex-col">
                                <span className="text-[10px] line-through text-stone-400 font-bold">${item.customPrice.toLocaleString()}</span>
                                <span className="text-sm font-black text-emerald-500">${Math.max(0, item.customPrice - promoFrameDiscount).toLocaleString()}</span>
                            </div>
                        ) : item.isPromo ? (
                            <span className="text-sm font-black text-emerald-500">SIN CARGO</span>
                        ) : (
                            <span className="text-sm font-black text-stone-500">
                                ${(item.customPrice * (1 + markup / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                        )}
                    </div>
                    <button onClick={() => onRemoveItem(idx)} className="text-stone-200 hover:text-red-500 transition-colors p-1"><X className="w-5 h-5" /></button>
                </div>
            ))}
        </div>
    );
}
