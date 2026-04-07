'use client';

import React, { useState, useMemo } from 'react';
import { 
    ShoppingBag, X, Minus, Plus, Search, 
    Glasses, User, Check, TrendingUp, 
    Banknote, ArrowRightLeft, CreditCard,
    MessageCircle, Copy, BookOpen, Save,
    Loader2, Gift, FileText, CheckCircle2
} from 'lucide-react';
import { 
    isMultifocal2x1, isAtelierFrame, isCrystal, 
    isMiPrimerVarilux, getCategoryKey, isFrame, safePrice
} from '@/lib/promo-utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CotizadorCartProps {
    items: any[];
    setItems: React.Dispatch<React.SetStateAction<any[]>>;
    markup: number;
    setMarkup: (val: number) => void;
    discountCash: number;
    setDiscountCash: (val: number) => void;
    discountTransfer: number;
    setDiscountTransfer: (val: number) => void;
    discountCard: number;
    setDiscountCard: (val: number) => void;
    frameSource: 'OPTICA' | 'USUARIO' | null;
    setFrameSource: (val: 'OPTICA' | 'USUARIO' | null) => void;
    userFrameData: { brand: string; model: string; notes: string };
    setUserFrameData: React.Dispatch<React.SetStateAction<{ brand: string; model: string; notes: string }>>;
    prescriptionId: string | null;
    setPrescriptionId: (val: string | null) => void;
    availableProducts: any[];
    prescriptions?: any[];
    onSave: () => Promise<void>;
    isSaving: boolean;
    contactName?: string;
    onClose?: () => void;
    onWhatsApp?: () => void;
    onCopy?: () => void;
    showRegisterActions?: boolean;
    onSearchContact?: (query: string) => void;
    extraActions?: React.ReactNode;
    editingQuoteId?: string | null;
    onCancelEdit?: () => void;
}


export default function CotizadorCart({
    items,
    setItems,
    markup,
    setMarkup,
    discountCash,
    setDiscountCash,
    discountTransfer,
    setDiscountTransfer,
    discountCard,
    setDiscountCard,
    frameSource,
    setFrameSource,
    userFrameData,
    setUserFrameData,
    prescriptionId,
    setPrescriptionId,
    availableProducts,
    prescriptions = [],
    onSave,
    isSaving,
    contactName,
    onClose,
    onWhatsApp,
    onCopy,
    showRegisterActions = true,
    extraActions,
    editingQuoteId,
    onCancelEdit,
}: CotizadorCartProps) {


    const [frameSearch, setFrameSearch] = useState('');

    const hasMultifocalPromo = useMemo(() => {
        return items.some(it => isCrystal(it.product) && isMultifocal2x1(it.product) && !isMiPrimerVarilux(it.product));
    }, [items]);

    const hasAnyMultifocal = useMemo(() => {
        return items.some(it => isMultifocal2x1(it.product));
    }, [items]);

    const atelierAvgPrice = useMemo(() => {
        const atelierFrames = availableProducts.filter(p => getCategoryKey(p.type) === 'Armazón' && isAtelierFrame(p) && safePrice(p.price) > 0);
        return atelierFrames.length > 0 ? Math.round(atelierFrames.reduce((s, f) => s + safePrice(f.price), 0) / atelierFrames.length) : 0;
    }, [availableProducts]);
    
    // Check frames in quote for the promo (flattened by quantity for calculation)
    const framesInQuote = items.filter(i => getCategoryKey(i.product.type) === 'Armazón');
    const flattenedFrames = items.flatMap(i => {
        if (getCategoryKey(i.product.type) !== 'Armazón') return [];
        return Array.from({ length: i.quantity || 1 }).map((_, idx) => ({
            ...i,
            virtualIdx: idx
        }));
    });
    const sortedFrames = [...flattenedFrames].sort((a, b) => b.customPrice - a.customPrice);
    
    // We target the second frame in the sorted list (either a second item or the second unit of the first item)
    const secondFrameVirtual = sortedFrames.length >= 2 ? sortedFrames[1] : null;
    const secondFrameUid = secondFrameVirtual?.uid || null;
    
    const promoFrameDiscount = useMemo(() => {
        if (!hasMultifocalPromo || !secondFrameVirtual) return 0;
        const sPrice = safePrice(secondFrameVirtual.customPrice);
        if (isAtelierFrame(secondFrameVirtual.product)) return sPrice;
        return Math.min(sPrice, safePrice(atelierAvgPrice));
    }, [hasMultifocalPromo, secondFrameVirtual, atelierAvgPrice]);

    const subtotal = Math.max(0, items.reduce((s, i) => s + (safePrice(i.customPrice) * (i.quantity || 1)), 0) - promoFrameDiscount);

    const markupAmount = subtotal * (safePrice(markup) / 100);
    const priceWithMarkup = subtotal + markupAmount;
    const totalCash = priceWithMarkup * (1 - safePrice(discountCash) / 100);
    const totalTransfer = priceWithMarkup * (1 - safePrice(discountTransfer) / 100);
    const totalCard = priceWithMarkup * (1 - safePrice(discountCard) / 100);

    const frameResults = frameSearch ? availableProducts.filter(p => {
        if (!isFrame(p)) return false;

        const q = frameSearch.toLowerCase();
        return (
            (p.brand?.toLowerCase().includes(q)) || 
            (p.model?.toLowerCase().includes(q)) || 
            (p.name?.toLowerCase().includes(q))
        );
    }).slice(0, 8) : [];

    const handleUpdateQuantity = (idx: number, delta: number) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const newQty = Math.max(1, item.quantity + delta);
            return { ...item, quantity: newQty };
        }));
    };

    const handleRemoveItem = (idx: number) => {
        setItems(prev => prev.filter((_, i) => i !== idx));
    };

    const hasCrystals = items.some(i => isCrystal(i.product));

    const [fullSearch, setFullSearch] = useState('');
    const fullSearchResults = fullSearch ? availableProducts.filter(p => {
        const q = fullSearch.toLowerCase();
        return (
            (p.brand?.toLowerCase().includes(q)) || 
            (p.model?.toLowerCase().includes(q)) || 
            (p.name?.toLowerCase().includes(q)) ||
            (p.type?.toLowerCase().includes(q))
        );
    }).slice(0, 5) : [];

    const handleAddItem = (product: any) => {
        if (isCrystal(product)) {
            setItems(prev => {
                const is2x1 = isMultifocal2x1(product);
                const existingPairsFiltered = prev.filter(it => it.product.id === product.id && it.eye === 'OD');
                const existingCount = existingPairsFiltered.length;

                // Si NO es 2x1, evitar duplicados
                if (!is2x1 && existingCount > 0) return prev;

                const ts = Date.now();
                const sprice = safePrice(product.price);
                // Si es el 2do par de un 2x1, es gratis
                const isFree = is2x1 && existingCount % 2 !== 0;
                const currentPrice = isFree ? 0 : Math.round(sprice / 2);

                return [
                    ...prev,
                    { product, quantity: 1, customPrice: currentPrice, eye: 'OD', isPromo: isFree, uid: ts },
                    { product, quantity: 1, customPrice: currentPrice, eye: 'OI', isPromo: isFree, uid: ts + 1 }
                ];
            });
        } else {
            setItems(prev => [...prev, { product, quantity: 1, customPrice: safePrice(product.price), uid: Date.now() }]);
        }
        setFullSearch('');
    };

    return (
        <div className="bg-white dark:bg-stone-800 border-2 border-primary/20 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h3 className="text-2xl font-black text-stone-800 dark:text-white tracking-tighter">
                        Cotizar <span className="text-primary italic">— {contactName || 'Nuevo Presupuesto'}</span>
                    </h3>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mt-1">Armando presupuesto personalizado</p>
                </div>
                {onClose && (
                    <button onClick={onClose} className="px-4 py-2 bg-stone-100 dark:bg-stone-900 text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors border border-stone-200 dark:border-stone-700">
                        CERRAR
                    </button>
                )}
            </div>

            {/* General Product Search (New) */}
            <div className="mb-8 relative group/search">
                <div className="relative">
                    <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 group-hover/search:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Agregar cualquier producto (Cristal, Armazón, etc.)..."
                        value={fullSearch}
                        onChange={e => setFullSearch(e.target.value)}
                        className="w-full bg-stone-50 dark:bg-stone-900/50 border-2 border-stone-100 dark:border-stone-800 py-4 px-14 rounded-3xl text-sm font-black outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-stone-300"
                    />
                </div>
                {fullSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-stone-900 border-2 border-primary/20 rounded-3xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {fullSearchResults.map(p => (
                            <button
                                key={p.id}
                                onClick={() => handleAddItem(p)}
                                className="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-colors text-left group/item border-b border-stone-50 dark:border-stone-800 last:border-0"
                            >
                                <div className="flex-1">
                                    <p className="text-xs font-black text-stone-800 dark:text-white uppercase">
                                        {p.brand} {p.model || p.name}
                                    </p>
                                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">
                                        {p.type || p.category} {p.lensIndex ? `· ${p.lensIndex}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black text-primary">${safePrice(p.price).toLocaleString()}</span>
                                    <div className="w-7 h-7 bg-primary text-white rounded-lg flex items-center justify-center scale-0 group-hover/item:scale-100 transition-all">
                                        <Plus className="w-4 h-4" />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Cart Items */}
            <div className="space-y-4 mb-8">
                {items.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-[2.5rem] bg-stone-50/50 dark:bg-stone-900/20">
                        <ShoppingBag className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-4" />
                        <p className="text-xs font-black text-stone-300 uppercase tracking-widest">El presupuesto está vacío</p>
                        <p className="text-[10px] font-bold text-stone-400 mt-2">Usá el buscador de arriba para agregar ítems</p>
                    </div>
                ) : (
                    items.map((item, idx) => (
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
                                    {item.product.type || item.product.category}
                                    {item.isPromo && <span className="text-emerald-500 ml-2">† SIN CARGO 2x1</span>}
                                </p>
                            </div>
                            {(!item.isPromo && !isCrystal(item.product)) && (
                                <div className="flex items-center gap-2 bg-white dark:bg-stone-800 p-1 rounded-xl border border-stone-100 dark:border-stone-700">
                                    <button onClick={() => handleUpdateQuantity(idx, -1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-50 hover:text-stone-800 transition-colors"><Minus className="w-4 h-4" /></button>
                                    <span className="text-xs font-black w-6 text-center">{item.quantity}</span>
                                    <button onClick={() => handleUpdateQuantity(idx, 1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-50 hover:text-stone-800 transition-colors"><Plus className="w-4 h-4" /></button>
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
                            <button onClick={() => handleRemoveItem(idx)} className="text-stone-200 hover:text-red-500 transition-colors p-1"><X className="w-5 h-5" /></button>
                        </div>
                    ))
                )}
            </div>

            {/* Promo Banner */}
            {hasAnyMultifocal && (
                <div className={`mb-8 p-5 rounded-[2rem] border-2 flex items-center gap-4 animate-in slide-in-from-top-2 duration-300 ${hasMultifocalPromo
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800'
                    : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                }`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${hasMultifocalPromo ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>
                        <Gift className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <p className={`text-sm font-black uppercase tracking-widest ${hasMultifocalPromo ? 'text-emerald-800 dark:text-emerald-300' : 'text-blue-800 dark:text-blue-300'}`}>
                            {hasMultifocalPromo ? '🎁 ¡Promoción Multifocal 2x1 Activa!' : '✨ Mi Primer Varilux'}
                        </p>
                        <p className={`text-[10px] font-bold ${hasMultifocalPromo ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {hasMultifocalPromo
                                ? `Incluye armazón Atelier sin cargo (comprando el primer armazón de la óptica el segundo es sin cargo)${atelierAvgPrice > 0 ? ` — Ref: ~$${atelierAvgPrice.toLocaleString()}` : ''}`
                                : 'Solo incluye el par de cristales de última tecnología'
                            }
                        </p>
                    </div>
                </div>
            )}

            {/* Frame Section */}
            {hasCrystals && (
                <div className="p-6 bg-amber-50/50 dark:bg-amber-950/20 rounded-[2.5rem] border-2 border-amber-200/50 dark:border-amber-900/50 mb-8 overflow-hidden group/frame">
                    <div className="flex items-center gap-2 mb-6">
                        <Glasses className="w-5 h-5 text-amber-600" />
                        <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Selección de Armazón</span>
                        {hasMultifocalPromo && (
                            <span className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full text-[8px] font-black uppercase tracking-[0.2em] ml-auto animate-pulse">
                                BONIFICADO
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3 mb-6">
                        <button
                            onClick={() => { setFrameSource('OPTICA'); setFrameSearch(''); }}
                            className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${frameSource === 'OPTICA'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-xl shadow-amber-500/20'
                                : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 hover:border-amber-300'
                                }`}
                        >
                            DE LA ÓPTICA
                        </button>
                        <button
                            onClick={() => setFrameSource('USUARIO')}
                            className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-2 ${frameSource === 'USUARIO'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-xl shadow-amber-500/20'
                                : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 hover:border-amber-300'
                                }`}
                        >
                            <User className="w-4 h-4" /> DEL USUARIO
                        </button>
                    </div>

                    {frameSource === 'OPTICA' && framesInQuote.length < 2 && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                            <div className="relative mb-3">
                                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
                                <input
                                    type="text"
                                    placeholder="Buscar armazón por marca o modelo..."
                                    value={frameSearch}
                                    onChange={e => setFrameSearch(e.target.value)}
                                    className="w-full bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 py-3 pl-11 pr-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all placeholder:text-stone-300"
                                />
                            </div>
                            {frameResults.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {frameResults.map(fr => (
                                        <button
                                            key={fr.id}
                                            onClick={() => { 
                                                setItems(prev => [...prev, { product: fr, quantity: 1, customPrice: fr.price, uid: Date.now() }]); 
                                                setFrameSearch(''); 
                                            }}
                                            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left group/btn ${hasMultifocalPromo && isAtelierFrame(fr)
                                                ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400'
                                                : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 hover:border-amber-300'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-[11px] font-black text-stone-800 dark:text-white truncate uppercase tracking-tight group-hover/btn:text-primary">{fr.brand} {fr.model || ''}</p>
                                                    {fr.stock <= 0 && <span className="px-1 py-0.5 bg-red-100 text-red-600 text-[7px] font-black rounded uppercase">SIN STOCK</span>}
                                                </div>
                                                {hasMultifocalPromo && isAtelierFrame(fr) ? (
                                                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">✨ BONIFICADO</p>
                                                ) : (
                                                    <p className="text-[9px] text-stone-400 font-bold">${fr.price.toLocaleString()}</p>
                                                )}
                                            </div>
                                            <Plus className="w-4 h-4 text-amber-500 shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {frameSource === 'OPTICA' && framesInQuote.length > 0 && (
                        <div className="space-y-3 mb-6">
                            {framesInQuote.map((fi: any, fidx: number) => {
                                const isPromoFrame = fi.uid === secondFrameUid && promoFrameDiscount > 0;
                                return (
                                    <div key={fi.uid || fidx} className="bg-white dark:bg-stone-800 p-4 rounded-3xl border-2 border-amber-200 shadow-sm flex items-center gap-3 animate-in fade-in duration-300">
                                        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-black text-stone-800 dark:text-stone-200 uppercase tracking-tight">
                                                {fi.product.brand} {fi.product.model || ''}
                                            </p>
                                            <p className="text-[10px] font-bold text-amber-600">
                                                {isPromoFrame ? 'Armazón de promoción' : 'Armazón seleccionado'}
                                            </p>
                                        </div>
                                        {isPromoFrame && (
                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                                {isAtelierFrame(fi.product) ? '✨ SIN CARGO' : `✨ -$${promoFrameDiscount.toLocaleString()}`}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {frameSource === 'USUARIO' && (
                        <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-300">
                            <input
                                type="text"
                                placeholder="Marca del armazón"
                                value={userFrameData.brand}
                                onChange={e => setUserFrameData(prev => ({ ...prev, brand: e.target.value }))}
                                className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 py-3 px-5 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all placeholder:text-stone-300"
                            />
                            <input
                                type="text"
                                placeholder="Modelo del armazón"
                                value={userFrameData.model}
                                onChange={e => setUserFrameData(prev => ({ ...prev, model: e.target.value }))}
                                className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 py-3 px-5 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all placeholder:text-stone-300"
                            />
                            <input
                                type="text"
                                placeholder="Observaciones (color, estado, etc.)"
                                value={userFrameData.notes}
                                onChange={e => setUserFrameData(prev => ({ ...prev, notes: e.target.value }))}
                                className="col-span-2 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 py-3 px-5 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all placeholder:text-stone-300"
                            />
                        </div>
                    )}

                    {!frameSource && (
                        <div className="mt-4 p-4 bg-amber-100/50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800 text-center">
                             <p className="text-[10px] font-black text-amber-600 animate-pulse tracking-widest uppercase">⚠️ Por favor, seleccioná un armazón para continuar</p>
                        </div>
                    )}
                </div>
            )}

            {/* Prescription Section */}
            {hasCrystals && prescriptions.length > 0 && (
                <div className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-[2.5rem] border-2 border-emerald-200/50 dark:border-emerald-900/50 mb-8 overflow-hidden group/presc">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Receta Médica</span>
                    </div>
                    <select
                        value={prescriptionId || ''}
                        onChange={e => setPrescriptionId(e.target.value || null)}
                        className="w-full bg-white dark:bg-stone-800 border-2 border-emerald-100 dark:border-emerald-800 py-3 px-5 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all shadow-sm"
                    >
                        <option value="">Seleccionar receta guardada...</option>
                        {prescriptions.map((p: any) => (
                            <option key={p.id} value={p.id}>
                                {format(new Date(p.date), 'dd/MM/yyyy')} — OD: {p.sphereOD > 0 ? '+' : ''}{p.sphereOD || 0} / OI: {p.sphereOI > 0 ? '+' : ''}{p.sphereOI || 0}
                            </option>
                        ))}
                    </select>
                    {!prescriptionId && (
                        <p className="mt-3 text-[9px] font-black text-emerald-600 animate-pulse tracking-widest uppercase text-center">⚠️ Seleccioná una receta para el presupuesto</p>
                    )}
                </div>
            )}

            {/* Pricing Controls & Totals - Sticky Footer */}
            <div className="sticky bottom-[-32px] bg-white dark:bg-stone-800 pt-8 border-t-2 border-stone-100 dark:border-stone-700 mt-2 z-20 pb-4 shadow-[0_-20px_20px_-10px_rgba(255,255,255,1)] dark:shadow-[0_-20px_20px_-10px_rgba(28,25,23,1)]">
                {/* Markup + Discounts */}
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
                                className="w-full bg-white dark:bg-stone-800 border-2 border-blue-100 dark:border-blue-900/50 rounded-xl px-3 py-2 text-sm font-black outline-none focus:ring-2 focus:ring-blue-400 transition-all"
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
                            className="w-full bg-white dark:bg-stone-800 border-2 border-emerald-100 dark:border-emerald-900/50 rounded-xl px-3 py-2 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
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
                            className="w-full bg-white dark:bg-stone-800 border-2 border-violet-100 dark:border-violet-900/50 rounded-xl px-3 py-2 text-sm font-black outline-none focus:ring-2 focus:ring-violet-400 transition-all"
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
                            className="w-full bg-white dark:bg-stone-800 border-2 border-orange-100 dark:border-orange-900/50 rounded-xl px-3 py-2 text-sm font-black outline-none focus:ring-2 focus:ring-orange-400 transition-all"
                        >
                            {[0, 5, 10].map(v => <option key={v} value={v}>{v === 0 ? '0%' : `+${v}%`}</option>)}
                        </select>
                    </div>
                </div>

                {/* Totals Summary */}
                <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-6 mb-8 px-2">
                    <div className="text-left w-full md:w-auto">
                        <div className="flex items-center gap-4 mb-1">
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Subtotal: ${subtotal.toLocaleString()}</span>
                            {markup > 0 && <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Markup: +${Math.round(markupAmount).toLocaleString()}</span>}
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

                {/* Main Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {extraActions}
                    {onWhatsApp && (

                        <button
                            onClick={onWhatsApp}
                            className="py-5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-2 border-emerald-200 dark:border-emerald-800 rounded-[2.2rem] font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/5 hover:bg-emerald-500 hover:text-white hover:border-emerald-500"
                        >
                            <MessageCircle className="w-5 h-5" /> ENVIAR WHATSAPP
                        </button>
                    )}
                    {onCopy && (
                        <button
                            onClick={onCopy}
                            className="py-5 bg-stone-50 dark:bg-stone-900 text-stone-600 border-2 border-stone-200 dark:border-stone-700 rounded-[2.2rem] font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg shadow-stone-500/5 hover:bg-stone-900 hover:text-white"
                        >
                            <Copy className="w-5 h-5" /> COPIAR DETALLE
                        </button>
                    )}
                    <div className={`${editingQuoteId ? 'md:col-span-1' : 'md:col-span-1'} flex flex-col gap-2`}>
                        <button
                            onClick={onSave}
                            disabled={isSaving || items.length === 0}
                            className={`py-5 text-primary-foreground rounded-[2.2rem] font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-2xl disabled:opacity-50 disabled:hover:scale-100 w-full ${
                                editingQuoteId ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-orange-500/30' : 'bg-gradient-to-r from-primary to-primary/80 shadow-primary/30'
                            }`}
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {isSaving ? 'GUARDANDO...' : editingQuoteId ? 'ACTUALIZAR PRESUPUESTO' : 'GUARDAR PRESUPUESTO'}
                        </button>
                        {editingQuoteId && onCancelEdit && (
                            <button
                                onClick={onCancelEdit}
                                className="text-[10px] font-black text-stone-400 uppercase tracking-widest hover:text-stone-800 transition-colors flex items-center justify-center gap-2 mt-1"
                            >
                                <X className="w-3 h-3" /> Cancelar Corrección
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
