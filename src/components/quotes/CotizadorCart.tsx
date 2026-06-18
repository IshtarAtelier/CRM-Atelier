'use client';

import React, { useState, useMemo } from 'react';
import { Search, Save, Loader2, 
    Gift, CheckCircle2
} from 'lucide-react';
import { 
    isMultifocal2x1, isAtelierFrame, isCrystal, 
    isMiPrimerVarilux, getCategoryKey, isFrame, safePrice,
    calculateQuoteTotals
} from '@/lib/promo-utils';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';

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
    specialDiscount?: number;
    setSpecialDiscount?: (val: number) => void;
    currentUserRole?: string;
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
    crystalColors?: any[];
    isCard?: boolean;
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
    specialDiscount = 0,
    setSpecialDiscount,
    currentUserRole,
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
    crystalColors = [],
    isCard = true,
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
        if (!i.product || !isFrame(i.product)) return [];
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

    const { subtotal, subtotalWithMarkup: priceWithMarkup, totalCash } = useMemo(() => {
        return calculateQuoteTotals(items, markup, discountCash, availableProducts, specialDiscount);
    }, [items, markup, discountCash, availableProducts, specialDiscount]);

    const totalTransfer = priceWithMarkup * (1 - safePrice(discountTransfer) / 100);

    // Filter results
    const fullSearchResults = useMemo(() => {
        if (!fullSearch) return [];
        const normalizeText = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const words = normalizeText(fullSearch).split(/\s+/).filter(Boolean);
        return availableProducts
            .filter(p => {
                const haystack = normalizeText(`${p.brand || ''} ${p.model || ''} ${p.name || ''} ${p.type || ''} ${p.category || ''} ${p.lensIndex || ''}`);
                return words.every(w => haystack.includes(w));
            })
            .sort((a, b) => safePrice(a.price) - safePrice(b.price))
            .slice(0, 15);
    }, [fullSearch, availableProducts]);

    const frameResults = useMemo(() => {
        if (!frameSearch) return [];
        const normalizeText = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const words = normalizeText(frameSearch).split(/\s+/).filter(Boolean);
        return availableProducts
            .filter(p => {
                if (!isFrame(p)) return false;
                const haystack = normalizeText(`${p.brand || ''} ${p.model || ''} ${p.name || ''} ${p.type || ''} ${p.category || ''}`);
                return words.every(w => haystack.includes(w));
            })
            .sort((a, b) => safePrice(a.price) - safePrice(b.price))
            .slice(0, 15);
    }, [frameSearch, availableProducts]);

    const framesInQuote = items.filter(i => i.product && isFrame(i.product));

    const handleAddItem = (product: any) => {
        if (isCrystal(product)) {
            const selectedRx = prescriptionId ? prescriptions.find(r => r.id === prescriptionId) : null;
            if (selectedRx) {
                const sphMax = product.sphereMax ?? Infinity;
                const sphMin = product.sphereMin ?? -Infinity;
                const cylMax = product.cylinderMax ?? Infinity;
                const cylMin = product.cylinderMin ?? -Infinity;
                
                let outOfBounds = false;
                
                const checkEye = (sph: number | null | undefined, cyl: number | null | undefined) => {
                    const s = sph ?? 0;
                    const c = cyl ?? 0;
                    if (sph != null && (s > sphMax || s < sphMin)) outOfBounds = true;
                    if (cyl != null && (c > cylMax || c < cylMin)) outOfBounds = true;
                };
                
                if (selectedRx.sphereOD != null || selectedRx.cylinderOD != null) checkEye(selectedRx.sphereOD, selectedRx.cylinderOD);
                if (selectedRx.sphereOI != null || selectedRx.cylinderOI != null) checkEye(selectedRx.sphereOI, selectedRx.cylinderOI);

                if (selectedRx.prescriptionType === 'NEAR') {
                     if (selectedRx.nearSphereOD != null || selectedRx.nearCylinderOD != null) checkEye(selectedRx.nearSphereOD, selectedRx.nearCylinderOD);
                     if (selectedRx.nearSphereOI != null || selectedRx.nearCylinderOI != null) checkEye(selectedRx.nearSphereOI, selectedRx.nearCylinderOI);
                }
                
                if (outOfBounds) {
                    if (!window.confirm('⚠️ ALERTA DE LABORATORIO:\n\nLa receta del paciente está FUERA DE RANGO para los límites de fabricación de este cristal.\n\n¿Deseas agregarlo al presupuesto de todos modos?')) {
                        setFullSearch('');
                        return;
                    }
                }
            }

            setItems(prev => {
                const is2x1 = isMultifocal2x1(product);
                const existingPairsFiltered = prev.filter(it => it.product?.id === product.id && it.eye === 'OD');
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
            if (isFrame(product)) {
                setFrameSource('OPTICA');
            }
        }
        setFullSearch('');
    };

    return (
        <div className={isCard 
            ? "bg-white dark:bg-stone-800 border border-primary/20 rounded-[2rem] p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-300"
            : "flex flex-col space-y-6"
        }>
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-stone-850 dark:text-white tracking-tighter">
                        Cotizar <span className="text-primary italic">— {contactName || 'Nuevo Presupuesto'}</span>
                    </h3>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mt-1">Armado presupuesto personalizado</p>
                </div>
                {onClose && (
                    <button onClick={onClose} className="px-4 py-2 bg-stone-100 dark:bg-stone-900 text-stone-500 hover:text-stone-800 dark:hover:text-stone-100 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-colors border border-stone-250/60 dark:border-stone-750">
                        CERRAR
                    </button>
                )}
            </header>

            <CartSearch searchQuery={fullSearch} setSearchQuery={setFullSearch} results={fullSearchResults} onSelect={handleAddItem} />

            <CartLineItems 
                items={items} 
                onUpdateQuantity={(idx, delta) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))}
                onRemoveItem={(idx) => setItems(prev => prev.filter((_, i) => i !== idx))}
                onUpdateItemColor={(idx, color, colorType) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, crystalColor: color, crystalColorType: colorType } : item))}
                markup={markup}
                secondFrameUid={secondFrameUid}
                promoFrameDiscount={promoFrameDiscount}
                crystalColors={crystalColors}
            />

            {hasAnyMultifocal && (
                <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-4 ${hasMultifocalPromo ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200' : 'bg-blue-50 dark:bg-blue-950/10 border-blue-205'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${hasMultifocalPromo ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>
                        <Gift className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider">{hasMultifocalPromo ? '🎁 ¡Promoción Multifocal 2x1 Activa!' : '✨ Mi Primer Varilux'}</p>
                        <p className="text-[10px] font-bold text-stone-550 dark:text-stone-400">{hasMultifocalPromo ? `Incluye armazón Atelier sin cargo` : 'Solo incluye el par de cristales'}</p>
                    </div>
                </div>
            )}

            {items.some(i => isCrystal(i.product)) && (
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/50 mb-6">
                    {framesInQuote.length === 0 ? (
                        <div className="flex gap-3 mb-4">
                            <button onClick={() => setFrameSource('OPTICA')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${frameSource === 'OPTICA' ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-white dark:bg-stone-850 text-stone-500 border-stone-200 dark:border-stone-750'}`}>DE LA ÓPTICA</button>
                            <button onClick={() => setFrameSource('USUARIO')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${frameSource === 'USUARIO' ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-white dark:bg-stone-850 text-stone-500 border-stone-200 dark:border-stone-750'}`}>DEL USUARIO</button>
                        </div>
                    ) : (
                        <div className="mb-4">
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Armazón de óptica seleccionado
                            </p>
                            {frameSource !== 'USUARIO' && (
                                <button onClick={() => setFrameSource('USUARIO')} className="mt-2 text-[10px] font-bold text-stone-500 hover:text-amber-600 underline text-left block">
                                    ¿Agregar también armazón del usuario?
                                </button>
                            )}
                            {frameSource === 'USUARIO' && (
                                <button onClick={() => setFrameSource('OPTICA')} className="mt-2 text-[10px] font-bold text-stone-500 hover:text-amber-600 underline text-left block">
                                    Cancelar armazón del usuario adicional
                                </button>
                            )}
                        </div>
                    )}
                    {frameSource === 'OPTICA' && framesInQuote.length < 2 && (
                        <div className="relative mb-1">
                            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <input type="text" placeholder="Buscar armazón..." value={frameSearch} onChange={e => setFrameSearch(e.target.value)} className="w-full bg-white dark:bg-stone-800 border dark:border-stone-700 dark:text-stone-100 py-2.5 pl-11 pr-4 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
                            {frameResults.length > 0 && <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">{frameResults.map(fr => <button key={fr.id} onClick={() => { setItems(prev => [...prev, { product: fr, quantity: 1, customPrice: fr.price, uid: Date.now() }]); setFrameSearch(''); }} className="p-2.5 bg-white dark:bg-stone-800 border dark:border-stone-700 dark:text-stone-100 rounded-lg text-left text-xs font-semibold hover:border-amber-400 dark:hover:border-amber-500 transition-colors">{fr.brand} · {fr.name}</button>)}</div>}
                        </div>
                    )}
                    {frameSource === 'USUARIO' && (
                        <div className="grid grid-cols-2 gap-3">
                            <input type="text" placeholder="Marca" value={userFrameData.brand} onChange={e => setUserFrameData(prev => ({ ...prev, brand: e.target.value }))} className="bg-white dark:bg-stone-800 border dark:border-stone-700 dark:text-stone-100 py-2.5 px-4 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
                            <input type="text" placeholder="Modelo" value={userFrameData.model} onChange={e => setUserFrameData(prev => ({ ...prev, model: e.target.value }))} className="bg-white dark:bg-stone-800 border dark:border-stone-700 dark:text-stone-100 py-2.5 px-4 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
                        </div>
                    )}
                </div>
            )}

            <CartPricingControls 
                markup={markup} setMarkup={setMarkup}
                discountCash={discountCash} setDiscountCash={setDiscountCash}
                discountTransfer={discountTransfer} setDiscountTransfer={setDiscountTransfer}
                discountCard={discountCard} setDiscountCard={setDiscountCard}
                specialDiscount={specialDiscount} setSpecialDiscount={setSpecialDiscount}
                currentUserRole={currentUserRole}
                isCard={isCard}
            />

            <CartTotals 
                subtotal={subtotal} markup={markup} markupAmount={subtotal * (safePrice(markup) / 100)}
                specialDiscount={specialDiscount}
                priceWithMarkup={priceWithMarkup} totalCash={totalCash} totalTransfer={totalTransfer}
                isCard={isCard}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {extraActions}
                {onWhatsApp && <button onClick={onWhatsApp} className="py-4 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2"><WhatsAppIcon className="w-4 h-4" /> WhatsApp</button>}
                <button onClick={onSave} disabled={isSaving || items.length === 0} className={`py-4 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${editingQuoteId ? 'bg-amber-500' : 'bg-primary'}`}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingQuoteId ? 'ACTUALIZAR' : 'GUARDAR'}
                </button>
            </div>
        </div>
    );
}
