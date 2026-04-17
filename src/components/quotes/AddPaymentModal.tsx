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
    { id: 'TRANSFERENCIA_ISHTAR', label: 'Transf. Ishtar', icon: ArrowRightLeft, color: 'violet' },
    { id: 'TRANSFERENCIA_LUCIA', label: 'Transf. Lucía', icon: ArrowRightLeft, color: 'violet' },
    { id: 'PAY_WAY_3_ISH', label: 'Pay Way 3 Ish', icon: CreditCard, color: 'blue' },
    { id: 'PAY_WAY_3_YANI', label: 'Pay Way 3 Yani', icon: CreditCard, color: 'indigo' },
    { id: 'PAY_WAY_6_ISH', label: 'Pay Way 6 Ish', icon: CreditCard, color: 'blue' },
    { id: 'PAY_WAY_6_YANI', label: 'Pay Way 6 Yani', icon: CreditCard, color: 'indigo' },
    { id: 'NARANJA_Z_ISH', label: 'Naranja Z Ish', icon: CreditCard, color: 'orange' },
    { id: 'NARANJA_Z_YANI', label: 'Naranja Z Yani', icon: CreditCard, color: 'orange' },
    { id: 'GO_CUOTAS_ISH', label: 'Go Cuotas Ish', icon: CreditCard, color: 'purple' },
];

export default function AddPaymentModal({
    orderId,
    totalAmount,
    paidAmount,
    onClose,
    onSuccess
}: AddPaymentModalProps) {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('EFECTIVO');
    const [reference, setReference] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

    // Obtener los financieros para las sugerencias de saldo
    const [financials, setFinancials] = useState<any>(null);

    React.useEffect(() => {
        const fetchOrder = async () => {
            const res = await fetch(`/api/orders/${orderId}`);
            if (res.ok) {
                const order = await res.json();
                const fins = PricingService.calculateOrderFinancials(order);
                setFinancials(fins);
            }
        };
        fetchOrder();
    }, [orderId]);

    const isCashMethod = method === 'CASH' || method === 'EFECTIVO';
    const requiresReceipt = !isCashMethod;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            setError('Por favor ingrese un monto válido');
            return;
        }

        if (!isCashMethod && !reference.trim()) {
            setError('Es obligatorio ingresar el Nro. de Comprobante / Referencia para métodos electrónicos');
            return;
        }

        if (requiresReceipt && !receiptFile) {
            setError('Es obligatorio cargar la foto del comprobante para métodos electrónicos (transferencia, tarjeta, etc.)');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let receiptUrl = null;

            // 1. Subir comprobante si existe
            if (receiptFile) {
                const formData = new FormData();
                formData.append('file', receiptFile);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    receiptUrl = uploadData.url;
                }
            }

            // 2. Registrar el pago
            const res = await fetch(`/api/orders/${orderId}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: Number(amount),
                    method,
                    notes: reference.trim() || undefined,
                    date: new Date(date).toISOString(),
                    receiptUrl
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al registrar el pago');
            }

            const payment = await res.json();
            onSuccess(payment);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-stone-800 w-full max-w-lg max-h-[95vh] flex flex-col rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-stone-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h2 className="text-xl font-black text-stone-900 dark:text-white tracking-tight">Registrar Pago</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-stone-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Monto con sugerencias */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest block pl-1">
                            Monto a Pagar
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-stone-400">$</span>
                            <input
                                autoFocus
                                type="number"
                                step="any"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full pl-8 pr-4 py-4 bg-stone-50 dark:bg-stone-900/50 border-2 border-transparent focus:border-emerald-500 rounded-2xl text-2xl font-black text-stone-900 dark:text-white transition-all outline-none"
                                placeholder="0.00"
                                required
                            />
                        </div>

                        {/* Sugerencia de Botones de Saldo */}
                        {financials && financials.hasBalance && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAmount(financials.remainingCash.toString())}
                                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 transition-colors"
                                >
                                    <Banknote className="w-3 h-3" /> Saldo Efvo (${financials.remainingCash.toLocaleString()})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAmount(financials.remainingTransfer.toString())}
                                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-violet-100 dark:border-violet-900/30 hover:bg-violet-100 transition-colors"
                                >
                                    <ArrowRightLeft className="w-3 h-3" /> Saldo Transf (${financials.remainingTransfer.toLocaleString()})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAmount(financials.remainingCard.toString())}
                                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-orange-100 dark:border-orange-900/30 hover:bg-orange-100 transition-colors"
                                >
                                    <CreditCard className="w-3 h-3" /> Saldo Tarjeta (${financials.remainingCard.toLocaleString()})
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Método de Pago */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest block pl-1">
                            Método de Pago
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {PAYMENT_METHODS.map((m) => {
                                const Icon = m.icon;
                                const isSelected = method === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setMethod(m.id)}
                                        className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all gap-2 ${
                                            isSelected
                                                ? `bg-${m.color}-500 border-${m.color}-500 text-white shadow-lg scale-105`
                                                : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 text-stone-400 hover:border-stone-200'
                                        }`}
                                    >
                                        <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-stone-400'}`} />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-center">{m.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Fecha y Referencia */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest block pl-1">Fecha</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-700 rounded-xl text-sm font-bold text-stone-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest block pl-1">Referencia {method !== 'CASH' && <span className="text-red-400">*</span>}</label>
                            <input
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder={method !== 'CASH' ? "Obligatorio: N° Comprobante" : "N° Comprobante, etc"}
                                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-700 rounded-xl text-sm font-bold text-stone-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"
                            />
                        </div>
                    </div>

                    {/* Comprobante */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest block pl-1">
                            Comprobante {requiresReceipt ? <span className="text-red-500">(Obligatorio)</span> : '(Opcional)'}
                        </label>
                        <FileDropZone
                            onFile={(file) => {
                                setReceiptFile(file);
                                setReceiptPreview(URL.createObjectURL(file));
                            }}
                            preview={receiptPreview}
                            onClearPreview={() => {
                                setReceiptFile(null);
                                setReceiptPreview(null);
                            }}
                            label="Subir foto del pago"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl text-xs font-bold animate-in slide-in-from-top-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-4 text-xs font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !amount || (requiresReceipt && !receiptFile)}
                            className="flex-[2] py-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-xl flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Confirmar Pago
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
