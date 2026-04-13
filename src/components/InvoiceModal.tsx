'use client';

import { useState, useEffect } from 'react';
import { X, FileText, CheckCircle2, AlertCircle, Loader2, Plus, Trash2, Split, Save, Info } from 'lucide-react';
import { PricingService } from '@/services/PricingService';

interface InvoiceItem {
// ... (rest of interface remains same)
    id: string;
    description: string;
    quantity: number;
    price: number;
}

interface InvoiceModalProps {
    order: {
        id: string;
        total: number;
        client: {
            name: string;
            dni?: string | null;
            phone?: string | null;
        };
        items?: any[];
        payments?: { method: string }[];
    };
    initialAccount?: 'ISH' | 'YANI' | 'LUCIA';
    initialAmount?: number; // Target amount to invoice
    onClose: () => void;
    onSuccess: () => void;
}

const DOC_TYPES = [
    { value: 99, label: 'Sin identificar' },
    { value: 96, label: 'DNI' },
    { value: 80, label: 'CUIT' },
];

const MONOTRIBUTO_LIMIT = 499000;

export default function InvoiceModal({ order, initialAccount, initialAmount, onClose, onSuccess }: InvoiceModalProps) {
    const [docTipo, setDocTipo] = useState(order.client.dni ? 96 : 99);
    const [docNro, setDocNro] = useState(order.client.dni || '');
    const [account, setAccount] = useState<'ISH' | 'YANI'>(initialAccount === 'YANI' ? 'YANI' : 'ISH');
    const [loading, setLoading] = useState(false);
    const [emittingStep, setEmittingStep] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState<{
        cae: string;
        caeExpiration: string;
        voucherNumber: number;
        pointOfSale: number;
        voucherLabel: string;
    } | null>(null);

    // Dynamic Item Management
    const financials = PricingService.calculateOrderFinancials(order as any);
    const paidReal = financials.paidReal;
    
    const [targetAmount, setTargetAmount] = useState(initialAmount || Math.min(order.total, paidReal));
    const [items, setItems] = useState<InvoiceItem[]>([]);

    useEffect(() => {
        // Initialize items from order if not already set
        const baseItems = (order.items || []).map((it, idx) => ({
            id: `init-${idx}`,
            description: `${it.product?.brand || ''} ${it.product?.model || it.product?.name || 'Producto'}`.trim(),
            quantity: it.quantity || 1,
            price: it.price || 0
        }));
        
        // If we have a custom initialAmount that differs from order total, we might need a "Rounding/Adjustment" item
        const itemsTotal = baseItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
        if (initialAmount && Math.abs(itemsTotal - initialAmount) > 1) {
            // Add an adjustment item or scale items? 
            // Better: just let the user edit them to match.
        }
        
        setItems(baseItems);
    }, [order, initialAmount]);

    const totalInvoiced = items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    const diff = targetAmount - totalInvoiced;
    const isTotalMatching = Math.abs(diff) < 1; // Tolerance for decimals

    const addItem = () => {
        setItems([...items, { id: Date.now().toString(), description: 'Nuevo Concepto', quantity: 1, price: 0 }]);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(it => it.id !== id));
    };

    const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
        setItems(items.map(it => it.id === id ? { ...it, [field]: value } : it));
    };

    const splitItem = (id: string) => {
        const item = items.find(it => it.id === id);
        if (!item) return;

        const p1 = Math.min(item.price, MONOTRIBUTO_LIMIT);
        const p2 = item.price - p1;

        const newItems = items.flatMap(it => {
            if (it.id === id) {
                return [
                    { ...it, id: `${it.id}-p1`, description: `${it.description} (Cristal)`, price: p1 },
                    { ...it, id: `${it.id}-p2`, description: `${it.description} (Tratamientos)`, price: p2 }
                ];
            }
            return it;
        });
        setItems(newItems);
    };

    const handleEmit = async () => {
        if (!isTotalMatching) {
            setError(`El total de los ítems ($${totalInvoiced.toLocaleString()}) debe coincidir con el monto a facturar ($${targetAmount.toLocaleString()}). Diferencia: $${diff.toLocaleString()}`);
            return;
        }

        if (targetAmount > paidReal) {
            setError(`No podés facturar $${targetAmount.toLocaleString()} porque el cliente solo pagó $${paidReal.toLocaleString()} hasta ahora.`);
            return;
        }

        const expensiveItem = items.find(it => it.price > MONOTRIBUTO_LIMIT);
        if (expensiveItem) {
            setError(`El ítem "${expensiveItem.description}" supera el límite de $${MONOTRIBUTO_LIMIT.toLocaleString()} por unidad.`);
            return;
        }

        setEmittingStep('Preparando comprobante...');
        setError('');
        await new Promise(r => setTimeout(r, 600));

        try {
            setEmittingStep('Conectando con ARCA (AFIP)...');
            const res = await fetch('/api/billing/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order.id,
                    account: selectedAccount,
                    docTipo: docTipo,
                    docNro: docTipo === 99 ? '0' : docNro.replace(/\D/g, ''),
                    amount: targetAmount,
                    items: items.map(({ description, quantity, price }) => ({ description, quantity, price }))
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al emitir la factura');

            setEmittingStep('Finalizando registro...');
            await new Promise(r => setTimeout(r, 800));

            setSuccess({
                cae: data.cae,
                caeExpiration: data.caeExpiration,
                voucherNumber: data.voucherNumber,
                pointOfSale: data.pointOfSale,
                voucherLabel: data.voucherLabel,
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error inesperado');
            setEmittingStep(null);
        } finally {
            setEmittingStep(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <div
                className="bg-white dark:bg-stone-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 text-white relative">
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black tracking-tight">Emitir Factura Electrónica</h2>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Monotributo - Factura C</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X className="w-6 h-6" /></button>
                    </div>
                </div>

                <div className="p-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    {success ? (
                        <div className="text-center py-10 animate-in fade-in slide-in-from-bottom-4">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-black text-stone-800 dark:text-white mb-2">¡Comprobante Generado!</h3>
                            <div className="bg-stone-50 dark:bg-stone-800 rounded-3xl p-6 space-y-4 text-left mt-8 border-2 border-dashed border-emerald-500/20">
                                <div className="flex justify-between items-center"><span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">N° Comprobante</span><span className="text-base font-black text-stone-900 dark:text-white">{success.voucherLabel}</span></div>
                                <div className="flex justify-between items-center"><span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">CAE</span><span className="text-base font-mono font-bold text-blue-600">{success.cae}</span></div>
                                <div className="flex justify-between items-center"><span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Monto</span><span className="text-base font-black text-emerald-600">${targetAmount.toLocaleString('es-AR')}</span></div>
                            </div>
                            <button onClick={onClose} className="mt-10 w-full py-4 bg-stone-900 text-white rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-stone-900/10">FINALIZAR Y CERRAR</button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Target Amount Header */}
                            <div className={`p-6 rounded-[2rem] shadow-xl transition-all duration-300 ${targetAmount > paidReal ? 'bg-red-600 text-white' : 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Monto del Comprobante</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-3xl font-black tracking-tighter">$</span>
                                            <input 
                                                type="number" 
                                                value={targetAmount}
                                                onChange={(e) => setTargetAmount(Number(e.target.value))}
                                                className="bg-transparent text-3xl font-black tracking-tighter w-48 outline-none border-b-2 border-white/20 focus:border-white transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Tope según pago</p>
                                        <p className="text-lg font-black mt-1">${paidReal.toLocaleString('es-AR')}</p>
                                    </div>
                                </div>
                                {targetAmount > paidReal && (
                                    <div className="mt-3 flex items-center gap-2 text-[10px] font-bold bg-white/20 p-2 rounded-xl animate-pulse">
                                        <AlertCircle size={14} /> NO PODÉS FACTURAR MÁS DE LO PAGADO
                                    </div>
                                )}
                            </div>

                            {/* Item Editor */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                        <Info className="w-3.5 h-3.5" /> Detalle de los ítems
                                    </h4>
                                    <button onClick={addItem} className="flex items-center gap-2 text-[10px] font-black text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-widest">
                                        <Plus className="w-3.5 h-3.5" /> Agregar ítem
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {items.map((it) => (
                                        <div key={it.id} className={`group bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl border-2 transition-all ${it.price > MONOTRIBUTO_LIMIT ? 'border-orange-500/30' : 'border-transparent hover:border-stone-200 dark:hover:border-stone-701'}`}>
                                            <div className="flex gap-4 items-start">
                                                <div className="flex-1 space-y-3">
                                                    <input 
                                                        type="text" 
                                                        value={it.description}
                                                        onChange={(e) => updateItem(it.id, 'description', e.target.value)}
                                                        className="w-full bg-transparent font-bold text-sm text-stone-800 dark:text-white outline-none placeholder:text-stone-300"
                                                        placeholder="Descripción del concepto..."
                                                    />
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-2 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-xl text-xs shadow-sm">
                                                            <span className="text-stone-400 font-bold">Cant:</span>
                                                            <input 
                                                                type="number" 
                                                                value={it.quantity}
                                                                onChange={(e) => updateItem(it.id, 'quantity', Number(e.target.value))}
                                                                className="w-8 bg-transparent font-black outline-none"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-xl text-xs shadow-sm">
                                                            <span className="text-stone-400 font-bold">Precio: $</span>
                                                            <input 
                                                                type="number" 
                                                                value={it.price}
                                                                onChange={(e) => updateItem(it.id, 'price', Number(e.target.value))}
                                                                className="w-24 bg-transparent font-black outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {it.price > MONOTRIBUTO_LIMIT && (
                                                        <button onClick={() => splitItem(it.id)} className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors shadow-sm" title="Dividir por límite de Monotributo">
                                                            <Split className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => removeItem(it.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors shadow-sm">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className={`mt-4 p-4 rounded-2xl flex items-center justify-between text-xs font-black transition-all ${isTotalMatching ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                    <span className="uppercase tracking-widest">Suma de ítems: ${totalInvoiced.toLocaleString('es-AR')}</span>
                                    {isTotalMatching ? (
                                        <span className="flex items-center gap-2 italic"><CheckCircle2 className="w-4 h-4" /> Coincide con el total</span>
                                    ) : (
                                        <span className="italic">Faltan ${diff.toLocaleString('es-AR')}</span>
                                    )}
                                </div>
                            </div>

                            {/* Config Panels */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest">Cuenta Emisora</label>
                                    <div className="flex gap-2 p-1.5 bg-stone-100 dark:bg-stone-800 rounded-2xl">
                                        {['ISH', 'YANI'].map(acc => (
                                            <button 
                                                key={acc}
                                                onClick={() => setAccount(acc as any)}
                                                className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${account === acc ? 'bg-white dark:bg-stone-700 text-blue-600 shadow-md' : 'text-stone-400'}`}
                                            >
                                                {acc === 'ISH' ? 'ISH' : 'YANI'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest">Receptor (Comprobante)</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {DOC_TYPES.map(dt => (
                                            <button 
                                                key={dt.value}
                                                onClick={() => {
                                                    setDocTipo(dt.value);
                                                    if (dt.value === 99) setDocNro('0');
                                                    else if (dt.value === 96 && order.client.dni) setDocNro(order.client.dni);
                                                }}
                                                className={`py-3 rounded-xl text-[10px] font-black transition-all ${docTipo === dt.value ? 'bg-indigo-600 text-white shadow-lg' : 'bg-stone-100 dark:bg-stone-800 text-stone-400'}`}
                                            >
                                                {dt.label}
                                            </button>
                                        ))}
                                    </div>
                                    {docTipo !== 99 && (
                                        <input 
                                            type="text" 
                                            value={docNro}
                                            onChange={e => setDocNro(e.target.value)}
                                            className="w-full px-5 py-3 bg-stone-50 dark:bg-stone-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl text-xs font-black tracking-widest outline-none transition-all"
                                            placeholder="Nro de Documento..."
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Error & Action */}
                            {error && (
                                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-pulse">
                                    <AlertCircle className="w-5 h-5" /> {error}
                                </div>
                            )}

                            <button
                                onClick={handleEmit}
                                disabled={!!emittingStep || !isTotalMatching || targetAmount > paidReal}
                                className="w-full py-5 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:scale-100 flex items-center justify-center gap-3"
                            >
                                {emittingStep ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {emittingStep ? emittingStep.toUpperCase() : 'GENERAR COMPROBANTE ELECTRÓNICO'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
