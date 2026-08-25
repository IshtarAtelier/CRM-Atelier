'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Save, Loader2, 
    Gift, Glasses, Plus, Pencil, X
} from 'lucide-react';
import { 
    isMultifocal2x1, isCrystal, isFrame, safePrice,
    hasActive2x1Promo, pick2x1FrameDiscount,
    armarParesDeCristal, recalculateCrystalPrices, applyTeñidoPromoDiscount,
    AVISO_TENIDO_2X1
} from '@/lib/promo-utils';
import { aplicarCambioDeLinea } from '@/lib/tenido-sync';
import { calculateQuoteTotals } from '@/services/PricingService';
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
    /** El pedido guardado que se está editando + cómo refrescarlo: habilitan
     *  la carga inline de foto/medidas del armazón dentro del carrito. */
    editingOrderData?: any;
    onRefreshOrderData?: () => void | Promise<void>;
    /** Ya es una venta (aunque esté reabierta): no repricear cristales contra
     *  el catálogo en vivo — el server la protege, esto evita mostrar/mandar
     *  un número inflado antes de guardar. */
    isSale?: boolean;
    onCancelEdit?: () => void;
    crystalColors?: any[];
    tintStylePrices?: Record<string, number>;
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
    editingOrderData = null,
    onRefreshOrderData,
    isSale = false,
    onCancelEdit,
    crystalColors = [],
    tintStylePrices = {},
    isCard = true,
}: CotizadorCartProps) {

    const [fullSearch, setFullSearch] = useState('');
    // El formulario del armazón del usuario está abierto (agregando o editando).
    const [editandoArmazonUsuario, setEditandoArmazonUsuario] = useState(false);

    // Re-precio de cristales en cada cambio del carrito, con la MISMA función
    // que usa el server al guardar (recalculateCrystalPrices): así una mezcla
    // de variantes 2x1 (Transitions + Orma blanco) o el borrado del par gratis
    // siempre cobran el par más caro y regalan el más barato — acá y al guardar.
    // La función devuelve false cuando no cambió nada, así que no cicla.
    useEffect(() => {
        if (isSale) return;
        const copia = items.map(it => ({ ...it }));
        // El teñido también se reprecia acá (bonificación de UN solo teñido en
        // el 2x1, precio por estilo en el resto): antes solo lo hacía la página
        // del cotizador y en la ficha el precio quedaba viejo hasta guardar.
        const cristales = recalculateCrystalPrices(copia);
        const tenido = applyTeñidoPromoDiscount(copia, tintStylePrices);
        if (cristales || tenido) setItems(copia);
    }, [items, setItems, isSale, tintStylePrices]);

    // Logic memoization
    const hasMultifocalPromo = useMemo(() => {
        return hasActive2x1Promo(items);
    }, [items]);

    const hasAnyMultifocal = useMemo(() => {
        return items.some(it => it.product && isMultifocal2x1(it.product));
    }, [items]);

    // El armazón bonificado y su descuento salen del módulo canónico de la
    // promo (promo-utils). Acá vivía una copia con la regla vieja del
    // "promedio Atelier": el total ya daba bien pero la línea seguía mostrando
    // el tachado viejo — dos números distintos en la misma pantalla.
    const { discount: promoFrameDiscount, item: promoFrameItem, itemName: promoFrameName } = useMemo(
        () => pick2x1FrameDiscount(items),
        [items]
    );
    const secondFrameUid = promoFrameItem?.uid || null;

    const { subtotal, subtotalWithMarkup: priceWithMarkup, totalCash } = useMemo(() => {
        return calculateQuoteTotals(items, markup, discountCash, availableProducts, specialDiscount);
    }, [items, markup, discountCash, availableProducts, specialDiscount]);

    const totalTransfer = priceWithMarkup * (1 - safePrice(discountTransfer) / 100);

    // Filter results
    const fullSearchResults = useMemo(() => {
        if (!fullSearch) return [];
        const normalizeText = (str: string) => {
            let text = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            text = text.replace(/\barmazones\b/g, 'armazon');
            text = text.replace(/\bcristales\b/g, 'cristal');
            text = text.replace(/\blentes\b/g, 'lente');
            text = text.replace(/\bmarcos\b/g, 'marco');
            text = text.replace(/\blapiceros\b/g, 'lapicero');
            text = text.replace(/\bestuches\b/g, 'estuche');
            text = text.replace(/\bliquidos\b/g, 'liquido');
            return text;
        };
        const words = normalizeText(fullSearch).split(/\s+/).filter(Boolean);
        // Relevancia: los términos que matchean la MARCA pesan más que los que solo
        // matchean el modelo/nombre (ej: buscar "atelier" prioriza marca Atelier por
        // sobre un KAZWINI cuyo modelo contiene "atelier").
        const relevance = (p: any) => {
            const brand = normalizeText(p.brand || '');
            return words.reduce((score, w) => score + (brand.includes(w) ? 1 : 0), 0);
        };
        return availableProducts
            .filter(p => {
                const haystack = normalizeText(`${p.brand || ''} ${p.model || ''} ${p.name || ''} ${p.type || ''} ${p.category || ''} ${p.lensIndex || ''}`);
                return words.every(w => haystack.includes(w));
            })
            .sort((a, b) => (relevance(b) - relevance(a)) || (safePrice(a.price) - safePrice(b.price)))
            .slice(0, 30);
    }, [fullSearch, availableProducts]);


    const framesInQuote = items.filter(i => i.product && isFrame(i.product));
    const hayArmazonUsuario = frameSource === 'USUARIO' && !!(userFrameData.brand?.trim() || userFrameData.model?.trim());

    const quitarArmazonUsuario = () => {
        setUserFrameData({ brand: '', model: '', notes: '' });
        setFrameSource(framesInQuote.length > 0 ? 'OPTICA' : null);
        setEditandoArmazonUsuario(false);
    };
    // Cancelar sin haber llegado a agregar: se limpia lo tipeado a medias.
    const cancelarEdicionArmazonUsuario = () => {
        if (!hayArmazonUsuario) setUserFrameData({ brand: '', model: '', notes: '' });
        setEditandoArmazonUsuario(false);
    };

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

            // El par (y el segundo par gratis si el cristal es 2x1) se arma en
            // promo-utils — mismo helper que la página del cotizador.
            setItems(prev => [...prev, ...armarParesDeCristal(product, prev)]);
        } else {
            setItems(prev => [...prev, { product, quantity: 1, customPrice: safePrice(product.price), uid: Date.now() }]);
            if (isFrame(product) && frameSource !== 'USUARIO') {
                // Si el cliente además trae el suyo, esa marca manda: pisarla acá
                // borraba el armazón del usuario que ya se había cargado.
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

            <CartSearch searchQuery={fullSearch} setSearchQuery={setFullSearch} results={fullSearchResults} onSelect={handleAddItem} promo2x1Activa={hasMultifocalPromo} />

            <CartLineItems 
                items={items} 
                onUpdateQuantity={(idx, delta) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))}
                onRemoveItem={(idx) => setItems(prev => prev.filter((_, i) => i !== idx))}
                onUpdateItemColor={(idx, color, colorType) => setItems(prev => aplicarCambioDeLinea(prev, idx, { crystalColor: color, crystalColorType: colorType }))}
                onUpdateItemStyle={(idx, style) => setItems(prev => aplicarCambioDeLinea(prev, idx, { crystalColorType: style }))}
                onUpdateItemNote={(idx, note) => setItems(prev => aplicarCambioDeLinea(prev, idx, { crystalColorNote: note }))}
                onUpdateItemFrame={(idx, framePosition) => setItems(prev => aplicarCambioDeLinea(prev, idx, { framePosition }))}
                orderId={editingQuoteId || null}
                orderData={editingOrderData}
                onRefreshOrderData={onRefreshOrderData}
                markup={markup}
                secondFrameUid={secondFrameUid}
                promoFrameDiscount={promoFrameDiscount}
                crystalColors={crystalColors}
                tintStylePrices={tintStylePrices}
            />

            {/* El armazón que trae el cliente, JUNTO a la lista de renglones —
                no perdido más abajo, después del cartel de la promo. Antes
                quedaba lejos del pedido y pasaba desapercibido. */}
            {hayArmazonUsuario && !editandoArmazonUsuario && (
                <div className="flex items-center justify-between gap-3 p-3.5 mb-3 rounded-2xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10">
                    <div className="flex items-center gap-3 min-w-0">
                        <Glasses className="w-5 h-5 text-amber-500 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-stone-800 dark:text-stone-150 truncate">
                                {[userFrameData.brand, userFrameData.model].filter(Boolean).join(' · ') || 'Armazón del cliente'}
                            </p>
                            <p className="text-[10px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest">
                                Armazón del cliente{userFrameData.notes?.trim() ? ` · ${userFrameData.notes}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-500 mr-1">Sin cargo</span>
                        <button onClick={() => setEditandoArmazonUsuario(true)} title="Editar" className="p-1.5 text-stone-400 hover:text-amber-600 transition-colors">
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={quitarArmazonUsuario} title="Quitar" className="p-1.5 text-stone-300 hover:text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* El armazón de la ÓPTICA se elige arriba, con el buscador de productos.
                Este recuadro es solo para el armazón que trae el cliente. */}
            {items.some(i => isCrystal(i.product)) && (
                editandoArmazonUsuario ? (
                    <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border-2 border-amber-300 dark:border-amber-800 mb-6 space-y-3">
                        <p className="text-[10px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2">
                            <Glasses className="w-4 h-4" /> Armazón que trae el cliente
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <input autoFocus type="text" placeholder="Marca" value={userFrameData.brand} onChange={e => setUserFrameData(prev => ({ ...prev, brand: e.target.value }))} className="bg-white dark:bg-stone-800 border dark:border-stone-700 dark:text-stone-100 py-2.5 px-4 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" />
                            <input type="text" placeholder="Modelo" value={userFrameData.model} onChange={e => setUserFrameData(prev => ({ ...prev, model: e.target.value }))} className="bg-white dark:bg-stone-800 border dark:border-stone-700 dark:text-stone-100 py-2.5 px-4 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" />
                        </div>
                        <input type="text" placeholder="Detalle (color, estado, aclaraciones para el taller)" value={userFrameData.notes || ''} onChange={e => setUserFrameData(prev => ({ ...prev, notes: e.target.value }))} className="w-full bg-white dark:bg-stone-800 border dark:border-stone-700 dark:text-stone-100 py-2.5 px-4 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setFrameSource('USUARIO'); setEditandoArmazonUsuario(false); }}
                                disabled={!userFrameData.brand?.trim() && !userFrameData.model?.trim()}
                                className="px-5 py-2.5 bg-amber-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                {hayArmazonUsuario ? 'Guardar' : 'Agregar'}
                            </button>
                            <button onClick={cancelarEdicionArmazonUsuario} className="px-4 py-2.5 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-bold text-[10px] uppercase tracking-widest transition-colors">
                                Cancelar
                            </button>
                            {!userFrameData.brand?.trim() && !userFrameData.model?.trim() && (
                                <span className="text-[10px] font-semibold text-stone-400">Poné al menos la marca o el modelo</span>
                            )}
                        </div>
                        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-500">
                            La foto y las medidas se cargan al confirmar la venta, igual que un armazón de la óptica.
                        </p>
                    </div>
                ) : !hayArmazonUsuario ? (
                    <button
                        onClick={() => setEditandoArmazonUsuario(true)}
                        className="w-full mb-6 p-4 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10 text-left flex items-center gap-3 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all group/uf"
                    >
                        <span className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 group-hover/uf:scale-105 transition-transform">
                            <Plus className="w-5 h-5" />
                        </span>
                        <span>
                            <span className="block text-[11px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest">Agregar armazón del usuario</span>
                            <span className="block text-[10px] font-semibold text-stone-500 dark:text-stone-400 mt-0.5">Si el cliente trae el suyo. Va sin cargo.</span>
                        </span>
                    </button>
                ) : null
            )}

            {hasAnyMultifocal && (
                <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-4 ${hasMultifocalPromo ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200' : 'bg-blue-50 dark:bg-blue-950/10 border-blue-205'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${hasMultifocalPromo ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>
                        <Gift className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider">{hasMultifocalPromo ? '🎁 ¡Promoción Multifocal 2x1 Activa!' : '✨ Mi Primer Varilux'}</p>
                        <p className="text-[10px] font-bold text-stone-550 dark:text-stone-400">{hasMultifocalPromo
                            ? (promoFrameDiscount > 0
                                ? `Bonifica: ${promoFrameName}`
                                : 'Bonifica armazones tildados en la promo (2º sin cargo; uno solo: 50%)')
                            : 'Solo incluye el par de cristales'}</p>
                        {hasMultifocalPromo && (
                            <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                                🎨 {AVISO_TENIDO_2X1}
                            </p>
                        )}
                    </div>
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
                promoFrameDiscount={promoFrameDiscount} promoFrameName={promoFrameName}
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
