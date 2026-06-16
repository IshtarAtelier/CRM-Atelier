'use client';

import React from 'react';
import { ShoppingBag, X, Minus, Plus, Palette, ChevronDown } from 'lucide-react';
import { isMultifocal2x1, isCrystal, getCategoryKey, safePrice } from '@/lib/promo-utils';
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
    const [selectedStyle, setSelectedStyle] = React.useState<string | null>(null);

    if (items.length === 0) {
        return (
            <div className="py-12 text-center border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-[2.5rem] bg-stone-50/50 dark:bg-stone-900/20">
                <ShoppingBag className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-4" />
                <p className="text-xs font-black text-stone-300 uppercase tracking-widest">El presupuesto está vacío</p>
                <p className="text-[10px] font-bold text-stone-400 mt-2">Usá el buscador de arriba para agregar ítems</p>
            </div>
        );
    }

    // Get unique colors for the selected style
    const colorsForStyle = selectedStyle
        ? crystalColors.filter(c => c.category === selectedStyle)
        : [];

    return (
        <div className="space-y-3 mb-6">
            {items.map((item, idx) => {
                const showColorSelector = needsColorSelection(item.product);
                const isColorExpanded = expandedColorIdx === idx;
                const hasColor = !!item.crystalColor;

                return (
                    <div key={idx} className="space-y-0">
                        {/* Main item row */}
                        <div className={`flex items-center gap-3 bg-stone-50 dark:bg-stone-900 p-3 sm:p-4 ${showColorSelector && isColorExpanded ? 'rounded-t-2xl border-b-0' : 'rounded-2xl'} border border-stone-200/60 dark:border-stone-800 group hover:border-primary/30 transition-all`}>
                            {item.eye && (
                                <span className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-bold uppercase shrink-0 ${item.eye === 'OD' ? 'bg-stone-900 text-white dark:bg-stone-750' : 'bg-stone-200 text-stone-600 dark:bg-stone-805'}`}>
                                    {item.eye}
                                </span>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-stone-800 dark:text-stone-150 truncate group-hover:text-primary transition-colors flex items-center gap-2">
                                    {item.product.brand} · {item.product.name}
                                    {safePrice(item.customPrice) === 0 && isMultifocal2x1(item.product) && (
                                        <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                                            BONIFICADO 2x1
                                        </span>
                                    )}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                                        {getCategoryKey(item.product.type, item.product.category)}
                                        {item.isPromo && <span className="text-emerald-500 ml-2">† SIN CARGO 2x1</span>}
                                    </p>
                                    {hasColor && (
                                        <span className="inline-flex items-center gap-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                            <Palette className="w-3 h-3" />
                                            {item.crystalColorType === 'DEGRADE' ? 'Degradé' : item.crystalColorType === 'MUESTRA' ? 'Muestra' : 'Compacto'} · {item.crystalColor}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Color toggle button for crystals needing color */}
                            {showColorSelector && crystalColors.length > 0 && (
                                <button
                                    onClick={() => { setExpandedColorIdx(isColorExpanded ? null : idx); setSelectedStyle(null); }}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                                        hasColor
                                            ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800 hover:bg-violet-100'
                                            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 animate-pulse'
                                    }`}
                                >
                                    <Palette className="w-3 h-3" />
                                    {hasColor ? 'Cambiar' : 'Color'}
                                    <ChevronDown className={`w-3 h-3 transition-transform ${isColorExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            )}

                            {(!item.isPromo && !isCrystal(item.product)) && (
                                <div className="flex items-center gap-1 bg-white dark:bg-stone-800 p-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
                                    <button onClick={() => onUpdateQuantity(idx, -1)} className="w-7 h-7 rounded flex items-center justify-center text-stone-400 hover:bg-stone-50 hover:text-stone-800 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                                    <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                                    <button onClick={() => onUpdateQuantity(idx, 1)} className="w-7 h-7 rounded flex items-center justify-center text-stone-400 hover:bg-stone-50 hover:text-stone-800 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                                </div>
                            )}
                            {isCrystal(item.product) && (
                                <div className="flex items-center gap-1 bg-stone-100/50 dark:bg-stone-800/20 px-2 py-1 rounded-lg border border-stone-200/50 dark:border-stone-800 opacity-60">
                                    <span className="text-[9px] font-bold uppercase text-stone-400">Cant: {item.quantity}</span>
                                </div>
                            )}
                            <div className="w-24 text-right pr-1">
                                {item.uid === secondFrameUid && promoFrameDiscount > 0 ? (
                                    <div className="flex flex-col">
                                        <span className="text-[10px] line-through text-stone-400 font-semibold">${item.customPrice.toLocaleString()}</span>
                                        <span className="text-xs font-extrabold text-emerald-500">${Math.max(0, item.customPrice - promoFrameDiscount).toLocaleString()}</span>
                                    </div>
                                ) : item.isPromo ? (
                                    <span className="text-[10px] font-bold text-emerald-500">SIN CARGO</span>
                                ) : (
                                    <span className="text-xs font-bold text-stone-700 dark:text-stone-200">
                                        ${(item.customPrice * (1 + markup / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                )}
                            </div>
                            <button onClick={() => onRemoveItem(idx)} className="text-stone-300 hover:text-red-500 transition-colors p-1"><X className="w-4 h-4" /></button>
                        </div>

                        {/* Inline Color Selector — Two-step: Style → Color */}
                        {showColorSelector && isColorExpanded && crystalColors.length > 0 && (
                            <div className="bg-violet-50/50 dark:bg-violet-950/20 border-x border-b border-stone-200/60 dark:border-stone-800 rounded-b-2xl p-4 animate-in slide-in-from-top-1 duration-300">
                                {/* Step 1: Select Style */}
                                <div className="flex items-center gap-2 mb-3">
                                    <Palette className="w-3.5 h-3.5 text-violet-500" />
                                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                                        {selectedStyle ? '← Estilo' : '1. Elegí el estilo de teñido'}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-3">
                                    {COLOR_CATEGORIES.map(cat => {
                                        const isActive = selectedStyle === cat.key;
                                        const hasColorsInCat = crystalColors.some(c => c.category === cat.key);
                                        if (!hasColorsInCat) return null;
                                        return (
                                            <button
                                                key={cat.key}
                                                onClick={() => setSelectedStyle(isActive ? null : cat.key)}
                                                className={`px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all border ${
                                                    isActive
                                                        ? 'bg-violet-600 text-white border-violet-700 shadow-md shadow-violet-500/20 scale-105'
                                                        : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-violet-300 hover:bg-violet-50'
                                                }`}
                                            >
                                                {cat.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Step 2: Select Color (only shown after style is picked) */}
                                {selectedStyle && colorsForStyle.length > 0 && (
                                    <div className="animate-in slide-in-from-top-1 duration-200">
                                        <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">
                                            2. Elegí el color
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {colorsForStyle.map(color => {
                                                const isSelected = item.crystalColor === color.name && item.crystalColorType === selectedStyle;
                                                return (
                                                    <button
                                                        key={color.id}
                                                        onClick={() => {
                                                            onUpdateItemColor?.(idx, color.name, selectedStyle);
                                                            setExpandedColorIdx(null);
                                                            setSelectedStyle(null);
                                                        }}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all hover:scale-105 active:scale-95 border ${
                                                            isSelected
                                                                ? 'bg-violet-600 text-white border-violet-700 shadow-md shadow-violet-500/20'
                                                                : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-violet-300 hover:bg-violet-50'
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
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
