'use client';

import React, { useState } from 'react';
import { 
    X, Banknote, ArrowRightLeft, CreditCard, 
    Save, Loader2, Upload, AlertCircle, 
    CheckCircle2, DollarSign, Image as ImageIcon
} from 'lucide-react';
import { PricingService } from '@/services/PricingService';
import FileDropZone from '@/components/FileDropZone';

interface AddPaymentModalProps {
    orderId: string;
    totalAmount: number;
    paidAmount: number;
    onClose: () => void;
    onSuccess: (payment: any) => void;
}

const PAYMENT_METHODS = [
    { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote, color: 'emerald' },
    { id: 'TRANSFERENCIA_ISHTAR', label: 'Transf. Ishtar', icon: ArrowRightLeft, color: 'blue' },
    { id: 'TRANSFERENCIA_LUCIA', label: 'Transf. Lucía', icon: ArrowRightLeft, color: 'blue' },
    { id: 'PAY_WAY_3_ISH', label: 'Pay Way 3 Ish', icon: CreditCard, color: 'orange' },
    { id: 'PAY_WAY_3_YANI', label: 'Pay Way 3 Yani', icon: CreditCard, color: 'amber' },
    { id: 'PAY_WAY_6_ISH', label: 'Pay Way 6 Ish', icon: CreditCard, color: 'orange' },
    { id: 'PAY_WAY_6_YANI', label: 'Pay Way 6 Yani', icon: CreditCard, color: 'amber' },
    { id: 'NARANJA_Z_ISH', label: 'Naranja Z Ish', icon: CreditCard, color: 'orange' },
    { id: 'NARANJA_Z_YANI', label: 'Naranja Z Yani', icon: CreditCard, color: 'amber' },
    { id: 'GO_CUOTAS_ISH', label: 'Go Cuotas Ish', icon: CreditCard, color: 'purple' },
];

export default function AddPaymentModal({
    orderId,
    totalAmount,
    paidAmount,
    onClose,
    onSuccess
}: AddPaymentModalProps) {
    const [amount, setAmount] = useState<string>(Math.max(0, totalAmount - paidAmount).toString());
    const [method, setMethod] = useState<string>('EFECTIVO');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

    const handleMethodSelect = (methodId: string) => {
        setMethod(methodId);
        setError(null);
    };

    const handleFileSelect = (file: File) => {
        setReceiptFile(file);
        setReceiptPreview(URL.createObjectURL(file));
    };
    const handleSubmit = async () => {
        setIsSaving(true);
        setError(null);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

        try {
            // Advanced cleaning for currency formats (supports: 785000, 785.000, 785,000.00, 785.000,00)
            let sAmount = amount.toString().trim().replace(/\$/g, '').replace(/\s/g, '');
            let parsedAmount: number;

            const lastComma = sAmount.lastIndexOf(',');
            const lastDot = sAmount.lastIndexOf('.');

            if (lastComma > lastDot) {
                // Format: 1.234,56
                parsedAmount = parseFloat(sAmount.replace(/\./g, '').replace(',', '.'));
            } else if (lastDot > lastComma) {
                // Format: 1,234.56 or 1234.56 (standard float)
                const firstDot = sAmount.indexOf('.');
                if (firstDot !== lastDot) {
                    // It has multiple dots like 1.234.567 -> treat all as thousands
                     parsedAmount = parseFloat(sAmount.replace(/\./g, ''));
                } else {
                     parsedAmount = parseFloat(sAmount.replace(/,/g, ''));
                }
            } else {
                // Just numbers or just one type of separator
                parsedAmount = parseFloat(sAmount.replace(',', '.'));
            }

            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                throw new Error('Monto no válido. Ingresa solo números.');
            }

            let receiptUrl = null;

            if (receiptFile) {
                const formData = new FormData();
                formData.append('file', receiptFile);
                const uploadRes = await fetch('/api/upload', { 
                    method: 'POST', 
                    body: formData,
                    signal: controller.signal 
                });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    receiptUrl = uploadData.url;
                }
            }

            const res = await fetch(`/api/orders/${orderId}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parsedAmount,
                    method,
                    notes,
                    receiptUrl
                }),
                signal: controller.signal
            });

            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Error al registrar el pago');
            }

            const payment = await res.json();
            onSuccess(payment);
        } catch (err: any) {
            console.error('Submit Error:', err);
            if (err.name === 'AbortError') {
                setError('La conexión tardó demasiado. Por favor, reintentá.');
            } else {
                setError(err.message);
            }
        } finally {
            clearTimeout(timeoutId);
            setIsSaving(false);
        }
    };

    const pendingAmount = Math.max(0, totalAmount - paidAmount);

    const financials = PricingService.calculateOrderFinancials({ 
        subtotalWithMarkup: totalAmount, 
        discountCash: 20,
        discountTransfer: 15,
        payments: [{ amount: paidAmount, method: 'CASH' }]
    });

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            <div className="bg-stone-900 text-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div>
                        <h2 className="text-2xl font-black tracking-tighter uppercase italic">Registrar Pago / Seña</h2>
                        <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-1">El saldo se recalcula según el método elegido</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                        <X className="w-6 h-6 text-stone-400" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 animate-in slide-in-from-top duration-200">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-xs font-bold">{error}</p>
                        </div>
                    )}

                    {/* Amount Input */}
                    <div className="space-y-4 text-center">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Monto a abonar</label>
                        <div className="relative max-w-xs mx-auto group">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-stone-600 group-focus-within:text-primary transition-colors">$</span>
                            <input 
                                type="text" 
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-white/5 border-2 border-white/10 focus:border-primary/50 rounded-[2rem] py-6 pl-12 pr-8 text-4xl font-black outline-none transition-all text-center tracking-tighter"
                                placeholder="0"
                            />
                        </div>
                        
                        <div className="space-y-2">
                             <p className="text-[9px] font-black text-stone-600 uppercase tracking-widest">Sugerencias de Saldo Pendiente</p>
                             <div className="flex flex-wrap justify-center gap-2">
                                <button 
                                    onClick={() => setAmount(financials.remainingCash.toString())}
                                    className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-emerald-500 flex items-center gap-2"
                                >
                                    <Banknote className="w-3 h-3" /> Saldo Efvo (${financials.remainingCash.toLocaleString()})
                                </button>
                                <button 
                                    onClick={() => setAmount(financials.remainingTransfer.toString())}
                                    className="px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-violet-400 flex items-center gap-2"
                                >
                                    <ArrowRightLeft className="w-3 h-3" /> Saldo Transf (${financials.remainingTransfer.toLocaleString()})
                                </button>
                                <button 
                                    onClick={() => setAmount(financials.remainingCard.toString())}
                                    className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-orange-400 flex items-center gap-2"
                                >
                                    <CreditCard className="w-3 h-3" /> Saldo Tarjeta (${financials.remainingCard.toLocaleString()})
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Payment Methods Grid */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Método de Pago</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {PAYMENT_METHODS.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => handleMethodSelect(m.id)}
                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group ${
                                        method === m.id 
                                        ? `bg-primary border-primary shadow-lg shadow-primary/20` 
                                        : 'bg-white/5 border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <m.icon className={`w-6 h-6 ${method === m.id ? 'text-white' : 'text-stone-400 group-hover:text-stone-200'}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-tight text-center ${method === m.id ? 'text-white' : 'text-stone-400 group-hover:text-stone-200'}`}>
                                        {m.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Receipt Upload */}
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Comprobante (Opcional)</label>
                            {receiptFile && (
                                <button 
                                    onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                                    className="text-[9px] font-black text-red-400 uppercase tracking-widest hover:text-red-300"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>
                        <FileDropZone 
                            onFile={handleFileSelect}
                            preview={receiptPreview}
                            label="Saca una foto o arrastra el comprobante"
                            className="bg-white/[0.02] border-white/10"
                            compact
                        />
                    </div>

                    {/* Notes */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Notas / Observaciones</label>
                        <textarea 
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-white/5 border-2 border-white/10 focus:border-primary/50 rounded-2xl p-4 text-sm font-medium outline-none transition-all resize-none h-24"
                            placeholder="Detalles adicionales del pago..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 bg-white/[0.02] border-t border-white/5 grid grid-cols-1 gap-4">
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving || !amount || parseFloat(amount) <= 0}
                        className="w-full py-5 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        REGISTRAR Y CONTINUAR AL REPASO
                    </button>
                </div>
            </div>
        </div>
    );
}
