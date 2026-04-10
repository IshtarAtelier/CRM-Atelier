'use client';

import { useState, useEffect } from 'react';
import { 
    Calculator, X, Save, Search, 
    ChevronRight, Info, Plus, Gift,
    RotateCcw, History, CheckCircle2, User
} from 'lucide-react';
import CotizadorCart from './quotes/CotizadorCart';
import QuoteSummary from './quotes/QuoteSummary';
import { calculateQuoteTotals } from '@/lib/promo-utils';

interface Product {
    id: string;
    brand: string | null;
    model: string | null;
    name: string | null;
    type: string | null;
    category: string;
    price: number;
    stock: number;
    cost?: number;
}

interface CotizadorPopupProps {
    clientName: string;
    clientId: string;
    onClose: () => void;
}

export default function CotizadorPopup({ clientName, clientId, onClose }: CotizadorPopupProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Unified Cart States
    const [quoteItems, setQuoteItems] = useState<any[]>([]);
    const [markup, setMarkup] = useState(0);
    const [discountCash, setDiscountCash] = useState(15);
    const [discountTransfer, setDiscountTransfer] = useState(10);
    const [discountCard, setDiscountCard] = useState(0);
    const [frameSource, setFrameSource] = useState<'OPTICA' | 'USUARIO' | null>(null);
    const [userFrameData, setUserFrameData] = useState({ brand: '', model: '', notes: '' });
    const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [previousQuotes, setPreviousQuotes] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);


    useEffect(() => {
        const fetchData = async () => {
            try {
                const [prodRes, contactRes] = await Promise.all([
                    fetch('/api/products'),
                    fetch(`/api/contacts/${clientId}`)
                ]);
                const prodData = await prodRes.json();
                const contactData = await contactRes.json();
                
                setProducts(prodData);
                setPrescriptions(contactData.prescriptions || []);
                setPreviousQuotes((contactData.orders || []).filter((o: any) => o.orderType === 'QUOTE' && !o.isDeleted));
            } catch (err) {
                console.error('Error fetching data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [clientId]);

    const handleEditQuote = (order: any) => {
        setQuoteItems((order.items || []).map((it: any, idx: number) => ({
            product: it.product,
            quantity: it.quantity,
            customPrice: it.price,  // API returns `price`, map to `customPrice` for CotizadorCart
            eye: it.eye,
            uid: Date.now() + idx
        })));
        setMarkup(order.markup || 0);
        setDiscountCash(order.discountCash ?? (order.discount || 20));
        setDiscountTransfer(order.discountTransfer ?? 15);
        setDiscountCard(order.discountCard ?? 0);
        setFrameSource(order.frameSource);
        setUserFrameData({
            brand: order.userFrameBrand || '',
            model: order.userFrameModel || '',
            notes: order.userFrameNotes || ''
        });
        setPrescriptionId(order.prescriptionId || null);
        setEditingQuoteId(order.id);
        setShowHistory(false);
    };

    const handleCancelEditQuote = () => {
        setEditingQuoteId(null);
        setQuoteItems([]);
        setFrameSource(null);
        setUserFrameData({ brand: '', model: '', notes: '' });
        setPrescriptionId(null);
    };

    const [isSuccess, setIsSuccess] = useState(false);

    const handleSaveQuote = async () => {
        if (quoteItems.length === 0) return;
        setSaving(true);
        try {
            const url = editingQuoteId ? `/api/orders/${editingQuoteId}` : '/api/orders';
            const method = editingQuoteId ? 'PATCH' : 'POST';

            // Calculate totals including 2x1 promo frame discount
            const { subtotalWithMarkup, totalCash } = calculateQuoteTotals(
                quoteItems, markup, discountCash, products
            );

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId,
                    items: quoteItems.map(i => ({
                        productId: i.product.id,
                        quantity: i.quantity,
                        price: i.customPrice,  // API expects `price` in OrderItem
                        eye: i.eye || null,
                        sphereVal: i.sphereVal ?? null,
                        cylinderVal: i.cylinderVal ?? null,
                        axisVal: i.axisVal ?? null,
                        additionVal: i.additionVal ?? null,
                    })),
                    markup,
                    discountCash,
                    discountTransfer,
                    discountCard,
                    subtotalWithMarkup,
                    total: totalCash,
                    frameSource: quoteItems.some(i => i.product.type === 'Cristal' || i.product.category === 'LENS') ? frameSource : null,
                    userFrameBrand: frameSource === 'USUARIO' ? userFrameData.brand : null,
                    userFrameModel: frameSource === 'USUARIO' ? userFrameData.model : null,
                    userFrameNotes: frameSource === 'USUARIO' ? userFrameData.notes : null,
                    prescriptionId: prescriptionId || null,
                })
            });

            if (res.ok) {
                setIsSuccess(true);
            }
        } catch (e) {
            console.error('Error saving quote:', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-lg z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-stone-900 w-full max-w-6xl h-[90vh] rounded-[2.5rem] shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-400">

                {/* Header */}
                <header className="px-8 py-5 border-b border-stone-100 dark:border-stone-800 flex items-center gap-4 flex-shrink-0 bg-stone-50/50 dark:bg-stone-800/20">
                    <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center">
                        <Calculator className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-black text-stone-800 dark:text-white uppercase tracking-tighter italic leading-tight">
                            Cotizador
                            <span className="text-primary not-italic ml-2 text-base font-black">— {clientName}</span>
                        </h2>
                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mt-0.5">Presupuesto rápido para el contacto</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {previousQuotes.length > 0 && (
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showHistory 
                                    ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-lg' 
                                    : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:bg-stone-200'}`}
                            >
                                <History className="w-3.5 h-3.5" />
                                {showHistory ? 'Ocultar Historial' : `Historial (${previousQuotes.length})`}
                            </button>
                        )}

                        {quoteItems.length > 0 && (
                            <button
                                onClick={() => { 
                                    setQuoteItems([]); 
                                    setFrameSource(null); 
                                    setUserFrameData({ brand: '', model: '', notes: '' }); 
                                    setEditingQuoteId(null);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-stone-400 hover:text-red-500 bg-stone-50 dark:bg-stone-800 rounded-lg border border-stone-100 dark:border-stone-700 transition-all hover:border-red-200 uppercase tracking-wider"
                            >
                                <RotateCcw className="w-3 h-3" /> {editingQuoteId ? 'Cancelar Edición' : 'Limpiar'}
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="p-3 bg-white dark:bg-stone-800 hover:rotate-90 transition-all rounded-2xl border border-stone-100 dark:border-stone-700 shadow-sm"
                        >
                            <X className="w-5 h-5 text-stone-400" />
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 overflow-hidden flex relative min-h-0">
                    {isSuccess ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-emerald-50/30 dark:bg-emerald-950/20 animate-in fade-in zoom-in duration-500">
                            <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center mb-8 shadow-huge shadow-emerald-500/20 animate-bounce">
                                <CheckCircle2 className="w-12 h-12" strokeWidth={3} />
                            </div>
                            <h3 className="text-4xl font-black text-stone-800 dark:text-white mb-2 tracking-tighter uppercase italic">¡Guardado con Éxito!</h3>
                            <p className="text-stone-500 dark:text-stone-400 font-bold text-center max-w-md mb-12">El presupuesto para <span className="text-emerald-600 font-black">{clientName}</span> ha sido registrado correctamente en su historial.</p>
                            
                            <div className="flex gap-4 w-full max-w-md">
                                <button 
                                    onClick={() => {
                                        // On "Go to Profile", we just close the popup. 
                                        // If the user was in the list, the list usually updates via useEffect or parent refresh.
                                        onClose();
                                    }}
                                    className="flex-1 py-5 bg-stone-900 text-white dark:bg-emerald-500 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <User className="w-4 h-4" /> VER PERFIL DEL CLIENTE
                                </button>
                                <button 
                                    onClick={onClose}
                                    className="px-10 py-5 bg-white dark:bg-stone-800 text-stone-400 border-2 border-stone-100 dark:border-stone-700 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-stone-50 transition-all font-black"
                                >
                                    CERRAR
                                </button>
                            </div>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center w-full h-full">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                <p className="text-xs font-black text-stone-400 uppercase tracking-widest animate-pulse">Cargando...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className={`flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 transition-all duration-500 ${showHistory ? 'w-2/3' : 'w-full'}`} style={{ scrollbarWidth: 'thin' }}>
                                <CotizadorCart
                                    items={quoteItems}
                                    setItems={setQuoteItems}
                                    markup={markup}
                                    setMarkup={setMarkup}
                                    discountCash={discountCash}
                                    setDiscountCash={setDiscountCash}
                                    discountTransfer={discountTransfer}
                                    setDiscountTransfer={setDiscountTransfer}
                                    discountCard={discountCard}
                                    setDiscountCard={setDiscountCard}
                                    frameSource={frameSource}
                                    setFrameSource={setFrameSource}
                                    userFrameData={userFrameData}
                                    setUserFrameData={setUserFrameData}
                                    prescriptionId={prescriptionId}
                                    setPrescriptionId={setPrescriptionId}
                                    availableProducts={products}
                                    prescriptions={prescriptions}
                                    onSave={handleSaveQuote}
                                    isSaving={saving}
                                    contactName={clientName}
                                    onClose={onClose}
                                    showRegisterActions={false}
                                    editingQuoteId={editingQuoteId}
                                    onCancelEdit={handleCancelEditQuote}
                                />
                            </div>

                            {showHistory && (
                                <div className="w-1/3 border-l border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-900/50 overflow-y-auto p-6 animate-in slide-in-from-right duration-500">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-2 mb-2">
                                            <History className="w-4 h-4 text-stone-400" />
                                            <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest">Presupuestos Anteriores</h3>
                                        </div>
                                        {previousQuotes.map(quote => (
                                            <QuoteSummary 
                                                key={quote.id} 
                                                order={quote} 
                                                contact={{ id: clientId, name: clientName }} 
                                                compact={true}
                                                onEdit={handleEditQuote}
                                                onRefreshContact={async () => {}}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
