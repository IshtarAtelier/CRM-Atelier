'use client';

import React from 'react';
import { ShoppingBag, X, Minus, Plus, Palette, ChevronDown } from 'lucide-react';
import { isMultifocal2x1, isCrystal, isFrame, getCategoryKey, safePrice } from '@/lib/promo-utils';
import { needsColorSelection, COLOR_CATEGORIES } from '@/lib/crystal-color-utils';

interface CrystalColorOption {
    id: string;
    name: string;
    category: string;
    hexColor?: string | null;
}

interface CartLineItemsProps {
    items: any[];
    onUpdateQuantity: (idx: number, delta: number) => void;
    onRemoveItem: (idx: number) => void;
    onUpdateItemColor?: (idx: number, color: string, colorType: string) => void;
    markup: number;
    secondFrameUid: number | null;
    promoFrameDiscount: number;
    crystalColors?: CrystalColorOption[];
}

export default function CartLineItems({
    items,
    onUpdateQuantity,
    onRemoveItem,
    onUpdateItemColor,
    markup,
    secondFrameUid,
    promoFrameDiscount,
    crystalColors = []
}: CartLineItemsProps) {
    const [expandedColorIdx, setExpandedColorIdx] = React.useState<number | null>(null);

    if (items.length === 0) {
        return (
            <div className="py-12 text-center border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-[2.5rem] bg-stone-50/50 dark:bg-stone-900/20">
                <ShoppingBag className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-4" />
                <p className="text-xs font-black text-stone-300 uppercase tracking-widest">El presupuesto está vacío</p>
                <p className="text-[10px] font-bold text-stone-400 mt-2">Usá el buscador de arriba para agregar ítems</p>
            </div>
        );
    }

    // Group colors by category
    const colorsByCategory = COLOR_CATEGORIES.map(cat => ({
        ...cat,
        colors: crystalColors.filter(c => c.category === cat.key),
    })).filter(cat => cat.colors.length > 0);

    return (
        <div className="space-y-4 mb-8">
            {items.map((item, idx) => {
                const showColorSelector = needsColorSelection(item.product);
                const isColorExpanded = expandedColorIdx === idx;
                const hasColor = !!item.crystalColor;

                return (
                    <div key={idx} className="space-y-0">
                        {/* Main item row */}
                        <div className={`flex items-center gap-4 bg-stone-50 dark:bg-stone-900 p-4 ${showColorSelector ? 'rounded-t-3xl' : 'rounded-3xl'} border border-stone-100 dark:border-stone-800 group hover:border-primary/30 transition-all`}>
                            {item.eye && (
                                <span className={`w-10 h-10 flex items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-widest italic shrink-0 ${item.eye === 'OD' ? 'bg-stone-900 text-white dark:bg-stone-700' : 'bg-stone-200 text-stone-600 dark:bg-stone-800'}`}>
                                    {item.eye}
                                </span>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-stone-800 dark:text-white truncate group-hover:text-primary transition-colors flex items-center gap-2">
                                    {item.product.brand} · {item.product.name}
                                    {safePrice(item.customPrice) === 0 && isMultifocal2x1(item.product) && (
                                        <span className="bg-emerald-500 text-white text-[7px] px-1.5 py-0.5 rounded-lg font-black uppercase tracking-widest animate-pulse">
                                            BONIFICADO 2x1
                                        </span>
                                    )}
                                </p>
                                <div className="flex items-center gap-2">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                        {getCategoryKey(item.product.type, item.product.category)}
                                        {item.isPromo && <span className="text-emerald-500 ml-2">† SIN CARGO 2x1</span>}
                                    </p>
                                    {hasColor && (
                                        <span className="inline-flex items-center gap-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                            <Palette className="w-3 h-3" />
                                            {item.crystalColorType === 'DEGRADE' ? 'Degradé' : item.crystalColorType === 'MUESTRA' ? 'Muestra' : 'Compacto'} · {item.crystalColor}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Color toggle button for crystals needing color */}
                            {showColorSelector && crystalColors.length > 0 && (
                                <button
                                    onClick={() => setExpandedColorIdx(isColorExpanded ? null : idx)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                                        hasColor
                                            ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800 hover:bg-violet-100'
                                            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 animate-pulse'
                                    }`}
                                >
                                    <Palette className="w-3.5 h-3.5" />
                                    {hasColor ? 'Cambiar' : 'Color'}
                                    <ChevronDown className={`w-3 h-3 transition-transform ${isColorExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            )}

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

                        {/* Inline Color Selector */}
                        {showColorSelector && isColorExpanded && crystalColors.length > 0 && (
                            <div className="bg-violet-50/50 dark:bg-violet-950/20 border-x border-b border-violet-200/50 dark:border-violet-800/50 rounded-b-3xl p-5 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2 mb-4">
                                    <Palette className="w-4 h-4 text-violet-500" />
                                    <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-[0.2em]">
                                        Seleccionar Color — Teñido
                                    </span>
                                </div>

                                {colorsByCategory.map(cat => (
                                    <div key={cat.key} className="mb-4 last:mb-0">
                                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1">{cat.label}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {cat.colors.map(color => {
                                                const isSelected = item.crystalColor === color.name && item.crystalColorType === cat.key;
                                                return (
                                                    <button
                                                        key={color.id}
                                                        onClick={() => {
                                                            onUpdateItemColor?.(idx, color.name, cat.key);
                                                            setExpandedColorIdx(null);
                                                        }}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 border ${
                                                            isSelected
                                                                ? 'bg-violet-600 text-white border-violet-700 shadow-lg shadow-violet-500/20'
                                                                : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                                                        }`}
                                                    >
                                                        {color.hexColor && (
                                                            <span
                                                                className="w-4 h-4 rounded-full border border-white/30 shadow-sm flex-shrink-0"
                                                                style={{ backgroundColor: color.hexColor }}
                                                            />
                                                        )}
                                                        {color.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
