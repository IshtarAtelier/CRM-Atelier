'use client';

import React, { useState } from 'react';
import { 
    Calculator, Receipt, Plus, CheckCircle2, X, AlertCircle
} from 'lucide-react';
import CotizadorCart from '@/components/quotes/CotizadorCart';
import QuoteSummary from '@/components/quotes/QuoteSummary';
import { calculateQuoteTotals } from '@/lib/promo-utils';

interface OrderManagerProps {
    contactId: string;
    contactName: string;
    orders: any[];
    prescriptions: any[];
    activeSection: 'budget' | 'sales';
    currentUserRole: string;
    onRefresh: () => void;
    onConvertOrder: (orderId: string, data?: any) => void;
    onAddPayment: (orderId: string) => void;
}

export default function OrderManager({
    contactId,
    contactName,
    orders,
    prescriptions,
    activeSection,
    currentUserRole,
    onRefresh,
    onConvertOrder,
    onAddPayment
}: OrderManagerProps) {
    const [isQuoting, setIsQuoting] = useState(false);
    const [savingQuote, setSavingQuote] = useState(false);
    const [isQuoteSuccess, setIsQuoteSuccess] = useState(false);
    const [quoteItems, setQuoteItems] = useState<any[]>([]);
    const [quoteMarkup, setQuoteMarkup] = useState(0);
    const [quoteDiscountCash, setQuoteDiscountCash] = useState(20);
    const [quoteDiscountTransfer, setQuoteDiscountTransfer] = useState(15);
    const [quoteDiscountCard, setQuoteDiscountCard] = useState(0);
    const [quoteFrameSource, setQuoteFrameSource] = useState<string | null>(null);
    const [quoteUserFrame, setQuoteUserFrame] = useState({ brand: '', model: '', notes: '' });
    const [quotePrescriptionId, setQuotePrescriptionId] = useState<string | null>(null);
    const [availableProducts, setAvailableProducts] = useState<any[]>([]);
    const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    // ── Shared: ensure products are loaded ──
    const ensureProductsLoaded = async () => {
        if (availableProducts.length === 0) {
            const r = await fetch('/api/products');
            const data = await r.json();
            if (Array.isArray(data)) setAvailableProducts(data);
        }
    };

    const handleStartQuote = async () => {
        setIsQuoting(true);
        setQuoteItems([]);
        setEditingQuoteId(null);
        await ensureProductsLoaded();
    };

    const handleSaveQuote = async () => {
        setSavingQuote(true);
        try {
            const hasCrystals = quoteItems.some(i => i.product.type === 'Cristal' || i.product.category === 'LENS');
            const hasFramesInCart = quoteItems.some(i => i.product.category === 'FRAME' || i.product.category === 'ATELIER');
            
            // BUG FIX 4: Auto-detect frameSource if frames are in cart
            let effectiveFrameSource = quoteFrameSource;
            if (hasCrystals && !effectiveFrameSource && hasFramesInCart) {
                effectiveFrameSource = 'OPTICA';
            }

            const { subtotalWithMarkup, totalCash, appliedPromoName } = calculateQuoteTotals(
                quoteItems, quoteMarkup, quoteDiscountCash, availableProducts
            );

            const url = editingQuoteId ? `/api/orders/${editingQuoteId}` : '/api/orders';
            const method = editingQuoteId ? 'PATCH' : 'POST';

            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: contactId,
                    items: quoteItems.map(i => ({ productId: i.product.id, quantity: i.quantity, price: i.customPrice, eye: i.eye })),
                    markup: quoteMarkup,
                    discountCash: quoteDiscountCash,
                    discountTransfer: quoteDiscountTransfer,
                    discountCard: quoteDiscountCard,
                    subtotalWithMarkup,
                    total: totalCash,
                    appliedPromoName,
                    frameSource: hasCrystals ? effectiveFrameSource : null,
                    userFrameBrand: effectiveFrameSource === 'USUARIO' ? quoteUserFrame.brand : null,
                    userFrameModel: effectiveFrameSource === 'USUARIO' ? quoteUserFrame.model : null,
                    userFrameNotes: effectiveFrameSource === 'USUARIO' ? quoteUserFrame.notes : null,
                    prescriptionId: hasCrystals ? quotePrescriptionId : null,
                })
            });
            setIsQuoteSuccess(true);
        } catch (e) {
            console.error('Error saving quote:', e);
        } finally {
            setSavingQuote(false);
        }
    };

    const handleEditQuote = async (order: any) => {
        // Only allow editing QUOTEs, never SALEs
        if (order.orderType === 'SALE') return;

        setQuoteItems((order.items || []).map((it: any, idx: number) => ({
            product: it.product,
            quantity: it.quantity,
            customPrice: it.price,
            eye: it.eye,
            uid: Date.now() + idx
        })));
        setQuoteMarkup(order.markup || 0);
        setQuoteDiscountCash(order.discountCash ?? 20);
        setQuoteDiscountTransfer(order.discountTransfer ?? 15);
        setQuoteDiscountCard(order.discountCard ?? 0);
        setQuoteFrameSource(order.frameSource);
        setQuoteUserFrame({ brand: order.userFrameBrand || '', model: order.userFrameModel || '', notes: order.userFrameNotes || '' });
        setQuotePrescriptionId(order.prescriptionId || null);
        setEditingQuoteId(order.id);
        setIsQuoting(true);
        await ensureProductsLoaded();
    };

    const relevantOrders = orders.filter(o => activeSection === 'sales' ? o.orderType === 'SALE' : o.orderType !== 'SALE');

    if (isQuoting) {
        return (
            <div className="relative">
                {isQuoteSuccess ? (
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-200 rounded-[3rem] p-12 text-center animate-in fade-in zoom-in duration-500">
                        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
                        <h3 className="text-3xl font-black text-stone-800 mb-2 uppercase italic">¡Presupuesto Guardado!</h3>
                        <button 
                            onClick={() => { setIsQuoteSuccess(false); setIsQuoting(false); onRefresh(); }}
                            className="px-12 py-4 bg-stone-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest"
                        >
                            CONTINUAR
                        </button>
                    </div>
                ) : (
                    <CotizadorCart
                        items={quoteItems} setItems={setQuoteItems}
                        markup={quoteMarkup} setMarkup={setQuoteMarkup}
                        discountCash={quoteDiscountCash} setDiscountCash={setQuoteDiscountCash}
                        discountTransfer={quoteDiscountTransfer} setDiscountTransfer={setQuoteDiscountTransfer}
                        discountCard={quoteDiscountCard} setDiscountCard={setQuoteDiscountCard}
                        frameSource={quoteFrameSource} setFrameSource={setQuoteFrameSource}
                        userFrameData={quoteUserFrame} setUserFrameData={setQuoteUserFrame}
                        prescriptionId={quotePrescriptionId} setPrescriptionId={setQuotePrescriptionId}
                        availableProducts={availableProducts}
                        prescriptions={prescriptions}
                        onSave={handleSaveQuote}
                        isSaving={savingQuote}
                        contactName={contactName}
                        onClose={() => setIsQuoting(false)}
                        editingQuoteId={editingQuoteId}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {activeSection === 'budget' && (
                <button
                    onClick={handleStartQuote}
                    className="w-full py-6 bg-stone-900 text-white dark:bg-primary rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"
                >
                    <Plus className="w-5 h-5" /> NUEVO PRESUPUESTO
                </button>
            )}

            {relevantOrders.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-stone-200 rounded-[3rem]">
                    {activeSection === 'sales' ? <Receipt className="w-12 h-12 text-stone-200 mx-auto mb-4" /> : <Calculator className="w-12 h-12 text-stone-200 mx-auto mb-4" />}
                    <p className="text-xs font-black text-stone-300 uppercase tracking-widest">
                        {activeSection === 'sales' ? 'No hay ventas registradas' : 'No hay presupuestos registrados'}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {relevantOrders.map(order => (
                        <QuoteSummary
                            key={order.id}
                            order={order}
                            contact={{ id: contactId, name: contactName }}
                            currentUserRole={currentUserRole as any}
                            onConvert={onConvertOrder}
                            onAddPayment={onAddPayment}
                            onEdit={handleEditQuote}
                            isExpanded={expandedOrderId === order.id}
                            onToggleExpand={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
