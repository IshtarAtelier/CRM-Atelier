'use client';

import FileDropZone from '@/components/FileDropZone';
import { resolveStorageUrl } from '@/lib/utils/storage';

import { useState, useEffect, useRef } from 'react';
import {
    Stethoscope, ChevronDown, DollarSign, TrendingUp, Wallet,
    Loader2, Plus, Trash2, Banknote, ArrowRightLeft, Upload,
    X, Save, Receipt, AlertCircle, Calendar, User, Image as ImageIcon,
    CreditCard, CheckCircle2
} from 'lucide-react';

interface Doctor {
    id: string;
    name: string;
}

interface Operation {
    orderId: string;
    clientName: string;
    clientId: string;
    orderTotal: number;
    platformFee: number;
    netAmount: number;
    commission: number;
    date: string;
    paymentMethods: string[];
}

interface DoctorPayment {
    id: string;
    doctorName: string;
    amount: number;
    method: string;
    receiptUrl: string | null;
    notes: string | null;
    date: string;
}

interface CommissionData {
    operations: Operation[];
    totalCommission: number;
    totalPaidToDoctor: number;
    balance: number;
    doctorPayments: DoctorPayment[];
}

const METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    DEBIT: 'Débito',
    CREDIT: 'Crédito',
    CREDIT_3: '3 Cuotas',
    CREDIT_6: '6 Cuotas',
    PLAN_Z: 'Plan Z',
    TRANSFER: 'Transferencia',
};

export default function DoctorCommissions() {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [data, setData] = useState<CommissionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPaymentForm, setShowPaymentForm] = useState(false);

    // Payment form state
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState('CASH');
    const [payNotes, setPayNotes] = useState('');
    const [payReceipt, setPayReceipt] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch('/api/doctors')
            .then(r => r.json())
            .then(d => { if (Array.isArray(d)) setDoctors(d); })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (message) {
            const t = setTimeout(() => setMessage(null), 4000);
            return () => clearTimeout(t);
        }
    }, [message]);

    const fetchCommissions = async (doctorName: string) => {
        if (!doctorName) { setData(null); return; }
        setLoading(true);
        try {
            const res = await fetch(`/api/doctors/commissions?doctor=${encodeURIComponent(doctorName)}`);
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error('Error fetching commissions:', err);
        }
        setLoading(false);
    };

    const handleDoctorChange = (name: string) => {
        setSelectedDoctor(name);
        setShowPaymentForm(false);
        fetchCommissions(name);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPayReceipt(file);
            setReceiptPreview(URL.createObjectURL(file));
        }
    };

    const handleAddPayment = async () => {
        if (!payAmount || Number(payAmount) <= 0) {
            setMessage({ type: 'error', text: 'Ingresá un monto válido' });
            return;
        }
        setSaving(true);
        try {
            let receiptUrl = null;

            // Upload receipt if exists
            if (payReceipt) {
                const formData = new FormData();
                formData.append('file', payReceipt);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    receiptUrl = uploadData.url;
                }
            }

            const res = await fetch('/api/doctors/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doctorName: selectedDoctor,
                    amount: Number(payAmount),
                    method: payMethod,
                    notes: payNotes || null,
                    receiptUrl,
                })
            });

            if (!res.ok) {
                const d = await res.json();
                setMessage({ type: 'error', text: d.error || 'Error al registrar pago' });
            } else {
                setMessage({ type: 'success', text: `Pago de $${Number(payAmount).toLocaleString()} registrado` });
                setShowPaymentForm(false);
                setPayAmount('');
                setPayMethod('CASH');
                setPayNotes('');
                setPayReceipt(null);
                setReceiptPreview(null);
                await fetchCommissions(selectedDoctor);
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
        setSaving(false);
    };

    const handleDeletePayment = async (id: string) => {
        if (!confirm('¿Eliminar este pago?')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/doctors/payments?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Pago eliminado' });
                await fetchCommissions(selectedDoctor);
            }
        } catch {
            setMessage({ type: 'error', text: 'Error al eliminar' });
        }
        setDeletingId(null);
    };

    const formatDate = (d: string) => {
        try {
            return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return d; }
    };

    return (
        <section className="mt-8 print:mt-4">
            {/* Header */}
            <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                <div className="p-6 border-b-2 border-stone-100 dark:border-stone-700 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-teal-50 dark:bg-teal-950 rounded-xl">
                            <Stethoscope className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Comisiones Médicos</h2>
                            <p className="text-[10px] text-stone-300 mt-0.5">15% sobre ventas netas de clientes derivados</p>
                        </div>
                    </div>

                    {/* Doctor Selector */}
                    <div className="relative group">
                        <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-teal-500 transition-colors z-10" />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                        <select
                            className="pl-10 pr-9 py-2.5 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-teal-500 transition-all appearance-none cursor-pointer min-w-[220px]"
                            value={selectedDoctor}
                            onChange={e => handleDoctorChange(e.target.value)}
                        >
                            <option value="">Seleccionar médico...</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Content */}
                {!selectedDoctor ? (
                    <div className="p-16 text-center">
                        <Stethoscope className="w-16 h-16 text-stone-200 dark:text-stone-700 mx-auto mb-4" />
                        <p className="text-sm font-bold text-stone-300 dark:text-stone-600">Seleccioná un médico para ver sus comisiones</p>
                    </div>
                ) : loading ? (
                    <div className="p-16 text-center">
                        <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-3" />
                        <p className="text-xs font-bold text-stone-400">Calculando comisiones...</p>
                    </div>
                ) : data ? (
                    <div className="p-6 space-y-6">
                        {/* Toast */}
                        {message && (
                            <div className={`p-3 rounded-xl flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top duration-200 ${message.type === 'success'
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-red-50 dark:bg-red-950 text-red-600 border border-red-200 dark:border-red-800'
                                }`}>
                                {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                {message.text}
                            </div>
                        )}

                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-teal-50 dark:bg-teal-950 border-2 border-teal-100 dark:border-teal-900 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="w-4 h-4 text-teal-500" />
                                    <span className="text-[9px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest">Comisiones Generadas</span>
                                </div>
                                <p className="text-2xl font-black text-teal-700 dark:text-teal-300">${data.totalCommission.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-teal-500 mt-0.5">{data.operations.length} operación{data.operations.length !== 1 ? 'es' : ''}</p>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-100 dark:border-blue-900 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Wallet className="w-4 h-4 text-blue-500" />
                                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Pagado al Médico</span>
                                </div>
                                <p className="text-2xl font-black text-blue-700 dark:text-blue-300">${data.totalPaidToDoctor.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-blue-500 mt-0.5">{data.doctorPayments.length} pago{data.doctorPayments.length !== 1 ? 's' : ''}</p>
                            </div>

                            <div className={`border-2 rounded-2xl p-5 ${data.balance > 0
                                ? 'bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900'
                                : 'bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900'
                                }`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className={`w-4 h-4 ${data.balance > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${data.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        Balance Pendiente
                                    </span>
                                </div>
                                <p className={`text-2xl font-black ${data.balance > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                                    ${data.balance.toLocaleString()}
                                </p>
                                <p className={`text-[10px] font-bold mt-0.5 ${data.balance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {data.balance > 0 ? 'Se debe al médico' : 'Saldo al día ✓'}
                                </p>
                            </div>
                        </div>

                        {/* Operations List */}
                        {data.operations.length > 0 && (
                            <div>
                                <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Receipt className="w-4 h-4" />
                                    Operaciones ({data.operations.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {data.operations.map(op => (
                                        <div key={op.orderId} className="bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-700 rounded-xl p-4 hover:border-teal-200 dark:hover:border-teal-800 transition-all group">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-teal-500" />
                                                    <span className="text-sm font-black text-stone-800 dark:text-white">{op.clientName}</span>
                                                </div>
                                                <span className="text-[9px] font-bold text-stone-400">{formatDate(op.date)}</span>
                                            </div>

                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-stone-400 font-medium">Total operación</span>
                                                    <span className="font-bold text-stone-700 dark:text-stone-200">${op.orderTotal.toLocaleString()}</span>
                                                </div>
                                                {op.platformFee > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-purple-400 font-medium">Comisión plataforma</span>
                                                        <span className="font-bold text-purple-500">-${op.platformFee.toLocaleString()}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-stone-400 font-medium">Neto</span>
                                                    <span className="font-bold text-stone-700 dark:text-stone-200">${op.netAmount.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between border-t border-stone-200 dark:border-stone-700 pt-1.5 mt-1.5">
                                                    <span className="text-teal-600 dark:text-teal-400 font-black">Comisión 15%</span>
                                                    <span className="font-black text-teal-600 dark:text-teal-400">${op.commission.toLocaleString()}</span>
                                                </div>
                                            </div>

                                            {/* Payment method pills */}
                                            <div className="flex gap-1 mt-2 flex-wrap">
                                                {[...new Set(op.paymentMethods)].map((m, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-stone-200 dark:bg-stone-700 rounded text-[8px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                                                        {METHOD_LABELS[m] || m}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.operations.length === 0 && (
                            <div className="text-center py-8">
                                <Receipt className="w-10 h-10 text-stone-200 dark:text-stone-700 mx-auto mb-2" />
                                <p className="text-xs font-black text-stone-300 dark:text-stone-600 uppercase tracking-widest">
                                    Sin ventas de clientes derivados por este médico
                                </p>
                            </div>
                        )}

                        {/* Payments Section */}
                        <div className="border-t-2 border-stone-100 dark:border-stone-700 pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                    <Wallet className="w-4 h-4" />
                                    Pagos realizados al médico
                                </h3>
                                <button
                                    onClick={() => setShowPaymentForm(!showPaymentForm)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 hover:scale-105 ${showPaymentForm
                                        ? 'bg-stone-200 dark:bg-stone-600 text-stone-500'
                                        : 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                                        }`}
                                >
                                    {showPaymentForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" strokeWidth={3} />}
                                    {showPaymentForm ? 'Cancelar' : 'Registrar Pago'}
                                </button>
                            </div>

                            {/* Payment Form */}
                            {showPaymentForm && (
                                <div className="bg-teal-50/50 dark:bg-teal-950/30 border-2 border-teal-100 dark:border-teal-900 rounded-2xl p-5 mb-5 animate-in slide-in-from-top duration-200">
                                    <h4 className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-4">
                                        Nuevo pago a {selectedDoctor}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Amount */}
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Monto *</label>
                                            <div className="relative group">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-teal-500 transition-colors" />
                                                <input
                                                    type="number"
                                                    value={payAmount}
                                                    onChange={e => setPayAmount(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full pl-9 pr-3 py-3 bg-white dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-teal-500 transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Method */}
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Método *</label>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPayMethod('CASH')}
                                                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${payMethod === 'CASH'
                                                        ? 'bg-emerald-500 text-white shadow-lg'
                                                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:bg-stone-200'
                                                        }`}
                                                >
                                                    <Banknote className="w-4 h-4" />
                                                    Efectivo
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPayMethod('TRANSFER')}
                                                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${payMethod === 'TRANSFER'
                                                        ? 'bg-blue-500 text-white shadow-lg'
                                                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:bg-stone-200'
                                                        }`}
                                                >
                                                    <ArrowRightLeft className="w-4 h-4" />
                                                    Transferencia
                                                </button>
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Notas</label>
                                            <input
                                                type="text"
                                                value={payNotes}
                                                onChange={e => setPayNotes(e.target.value)}
                                                placeholder="Descripción..."
                                                className="w-full px-3 py-3 bg-white dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-teal-500 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Receipt upload for transfer */}
                                    {payMethod === 'TRANSFER' && (
                                        <div className="mt-4 space-y-1.5">
                                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Comprobante</label>
                                            <FileDropZone
                                                accept="image/*"
                                                maxSizeMB={10}
                                                label="Arrastrá el comprobante aquí"
                                                preview={receiptPreview}
                                                onClearPreview={() => { setPayReceipt(null); setReceiptPreview(null); }}
                                                onFile={(file) => {
                                                    setPayReceipt(file);
                                                    setReceiptPreview(URL.createObjectURL(file));
                                                }}
                                                compact
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-end mt-4">
                                        <button
                                            onClick={handleAddPayment}
                                            disabled={saving || !payAmount}
                                            className="px-6 py-3 bg-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-teal-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Guardar Pago
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Payments List */}
                            {data.doctorPayments.length > 0 ? (
                                <div className="space-y-2">
                                    {data.doctorPayments.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-900 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-xl ${p.method === 'CASH'
                                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-500'
                                                    : 'bg-blue-100 dark:bg-blue-950 text-blue-500'
                                                    }`}>
                                                    {p.method === 'CASH' ? <Banknote className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-stone-800 dark:text-white">
                                                            ${p.amount.toLocaleString()}
                                                        </span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${p.method === 'CASH'
                                                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                                                            : 'bg-blue-100 dark:bg-blue-950 text-blue-600'
                                                            }`}>
                                                            {p.method === 'CASH' ? 'Efectivo' : 'Transferencia'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-stone-400 font-medium">{formatDate(p.date)}</span>
                                                        {p.notes && <span className="text-[10px] text-stone-400">· {p.notes}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {p.receiptUrl && (
                                                    <a
                                                        href={resolveStorageUrl(p.receiptUrl)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-500 rounded-lg hover:scale-110 transition-all"
                                                        title="Ver comprobante"
                                                    >
                                                        <ImageIcon className="w-4 h-4" />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => handleDeletePayment(p.id)}
                                                    disabled={deletingId === p.id}
                                                    className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                                    title="Eliminar pago"
                                                >
                                                    {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <Wallet className="w-8 h-8 text-stone-200 dark:text-stone-700 mx-auto mb-2" />
                                    <p className="text-[10px] font-black text-stone-300 dark:text-stone-600 uppercase tracking-widest">Sin pagos registrados</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
