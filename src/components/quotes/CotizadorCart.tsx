'use client';

import React, { useState, useMemo } from 'react';
import { 
    X, Search, Glasses, User, Banknote, 
    MessageCircle, Copy, Save, Loader2, 
    Gift, FileText, CheckCircle2
} from 'lucide-react';
import { 
    isMultifocal2x1, isAtelierFrame, isCrystal, 
    isMiPrimerVarilux, getCategoryKey, isFrame, safePrice
} from '@/lib/promo-utils';
import { format } from 'date-fns';

// Modular Components
import CartSearch from './CartSearch';
import CartLineItems from './CartLineItems';
import CartPricingControls from './CartPricingControls';
import CartTotals from './CartTotals';

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
    extraActions,
    editingQuoteId,
    onCancelEdit,
}: CotizadorCartProps) {

    const [fullSearch, setFullSearch] = useState('');
    const [frameSearch, setFrameSearch] = useState('');

    // Logic memoization
    const hasMultifocalPromo = useMemo(() => {
        return items.some(it => it.product && isCrystal(it.product) && isMultifocal2x1(it.product) && !isMiPrimerVarilux(it.product));
    }, [items]);

    const hasAnyMultifocal = useMemo(() => {
        return items.some(it => it.product && isMultifocal2x1(it.product));
    }, [items]);

    const atelierAvgPrice = useMemo(() => {
        const atelierFrames = availableProducts.filter(p => getCategoryKey(p.type, p.category) === 'Armazón' && isAtelierFrame(p) && safePrice(p.price) > 0);
        return atelierFrames.length > 0 ? Math.round(atelierFrames.reduce((s, f) => s + safePrice(f.price), 0) / atelierFrames.length) : 0;
    }, [availableProducts]);
    
    const flattenedFrames = items.flatMap(i => {
        if (!i.product || getCategoryKey(i.product.type, i.product.category) !== 'Armazón') return [];
        return Array.from({ length: i.quantity || 1 }).map((_, idx) => ({ ...i, virtualIdx: idx }));
    });
    const sortedFrames = [...flattenedFrames].sort((a, b) => safePrice(b.customPrice) - safePrice(a.customPrice));
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

    // Filter results
    const fullSearchResults = fullSearch ? availableProducts.filter(p => {
        const words = fullSearch.toLowerCase().split(/\s+/).filter(Boolean);
        const haystack = `${p.brand || ''} ${p.model || ''} ${p.name || ''} ${p.type || ''}`.toLowerCase();
        return words.every(w => haystack.includes(w));
    }).slice(0, 8) : [];

    const frameResults = frameSearch ? availableProducts.filter(p => {
        if (!isFrame(p)) return false;
        const words = frameSearch.toLowerCase().split(/\s+/).filter(Boolean);
        const haystack = `${p.brand || ''} ${p.model || ''} ${p.name || ''}`.toLowerCase();
        return words.every(w => haystack.includes(w));
    }).slice(0, 8) : [];

    const framesInQuote = items.filter(i => i.product && getCategoryKey(i.product.type, i.product.category) === 'Armazón');

    const handleAddItem = (product: any) => {
        if (isCrystal(product)) {
            setItems(prev => {
                const is2x1 = isMultifocal2x1(product);
                const existingPairsFiltered = prev.filter(it => it.product.id === product.id && it.eye === 'OD');
                const ts = Date.now();
                const sprice = safePrice(product.price);
                const isFree = is2x1 && existingPairsFiltered.length % 2 !== 0;
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
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h3 className="text-2xl font-black text-stone-800 dark:text-white tracking-tighter">
                        Cotizar <span className="text-primary italic">— {contactName || 'Nuevo Presupuesto'}</span>
                    </h3>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mt-1">Armado presupuesto personalizado</p>
                </div>
                {onClose && (
                    <button onClick={onClose} className="px-4 py-2 bg-stone-100 dark:bg-stone-900 text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors border border-stone-200 dark:border-stone-700">
                        CERRAR
                    </button>
                )}
            </header>

            <CartSearch searchQuery={fullSearch} setSearchQuery={setFullSearch} results={fullSearchResults} onSelect={handleAddItem} />

            <CartLineItems 
                items={items} 
                onUpdateQuantity={(idx, delta) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))}
                onRemoveItem={(idx) => setItems(prev => prev.filter((_, i) => i !== idx))}
                markup={markup}
                secondFrameUid={secondFrameUid}
                promoFrameDiscount={promoFrameDiscount}
            />

            {hasAnyMultifocal && (
                <div className={`mb-8 p-5 rounded-[2rem] border-2 flex items-center gap-4 ${hasMultifocalPromo ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${hasMultifocalPromo ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>
                        <Gift className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-black uppercase tracking-widest">{hasMultifocalPromo ? '🎁 ¡Promoción Multifocal 2x1 Activa!' : '✨ Mi Primer Varilux'}</p>
                        <p className="text-[10px] font-bold">{hasMultifocalPromo ? `Incluye armazón Atelier sin cargo` : 'Solo incluye el par de cristales'}</p>
                    </div>
                </div>
            )}

            {items.some(i => isCrystal(i.product)) && (
                <div className="p-6 bg-amber-50/50 dark:bg-amber-950/20 rounded-[2.5rem] border-2 border-amber-200/50 mb-8">
                    <div className="flex gap-3 mb-6">
                        <button onClick={() => setFrameSource('OPTICA')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase ${frameSource === 'OPTICA' ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/20' : 'bg-white text-stone-400 border-2'}`}>DE LA ÓPTICA</button>
                        <button onClick={() => setFrameSource('USUARIO')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase ${frameSource === 'USUARIO' ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/20' : 'bg-white text-stone-400 border-2'}`}>DEL USUARIO</button>
                    </div>
                    {frameSource === 'OPTICA' && framesInQuote.length < 2 && (
                        <div className="relative mb-3">
                            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
                            <input type="text" placeholder="Buscar armazón..." value={frameSearch} onChange={e => setFrameSearch(e.target.value)} className="w-full bg-white border-2 py-3 pl-11 pr-4 rounded-2xl text-xs font-bold" />
                            {frameResults.length > 0 && <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">{frameResults.map(fr => <button key={fr.id} onClick={() => { setItems(prev => [...prev, { product: fr, quantity: 1, customPrice: fr.price, uid: Date.now() }]); setFrameSearch(''); }} className="p-3 bg-white border-2 rounded-xl text-left text-[11px] font-black hover:border-amber-400">{fr.brand} {fr.model}</button>)}</div>}
                        </div>
                    )}
                    {frameSource === 'USUARIO' && (
                        <div className="grid grid-cols-2 gap-3"><input type="text" placeholder="Marca" value={userFrameData.brand} onChange={e => setUserFrameData(prev => ({ ...prev, brand: e.target.value }))} className="bg-white border-2 py-3 px-5 rounded-2xl text-xs font-bold" /><input type="text" placeholder="Modelo" value={userFrameData.model} onChange={e => setUserFrameData(prev => ({ ...prev, model: e.target.value }))} className="bg-white border-2 py-3 px-5 rounded-2xl text-xs font-bold" /></div>
                    )}
                </div>
            )}

            <CartPricingControls 
                markup={markup} setMarkup={setMarkup}
                discountCash={discountCash} setDiscountCash={setDiscountCash}
                discountTransfer={discountTransfer} setDiscountTransfer={setDiscountTransfer}
                discountCard={discountCard} setDiscountCard={setDiscountCard}
            />

            <CartTotals 
                subtotal={subtotal} markup={markup} markupAmount={markupAmount}
                priceWithMarkup={priceWithMarkup} totalCash={totalCash} totalTransfer={totalTransfer}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {extraActions}
                {onWhatsApp && <button onClick={onWhatsApp} className="py-5 bg-emerald-50 text-emerald-600 border-2 border-emerald-200 rounded-[2.2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-white transition-all"><MessageCircle className="w-5 h-5 mx-auto" /></button>}
                <button onClick={onSave} disabled={isSaving || items.length === 0} className={`py-5 text-white rounded-[2.2rem] font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${editingQuoteId ? 'bg-amber-500' : 'bg-primary'}`}>
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {editingQuoteId ? 'ACTUALIZAR' : 'GUARDAR'}
                </button>
            </div>
        </div>
    );
}
