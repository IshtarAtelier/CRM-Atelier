'use client';

import { useState, useEffect } from 'react';
import {
    Wallet, DollarSign, CreditCard, Banknote, Calendar,
    Loader2, RefreshCw, Filter, Hash, TrendingUp,
    ChevronDown, Search, Receipt, Eye, Plus, X, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Types ─────────────────────────────────────

interface PaymentRecord {
    id: string;
    date: string;
    amount: number;
    method: string;
    notes: string | null;
    receiptUrl: string | null;
    clientName: string;
    clientPhone: string;
    orderId: string;
    orderTotal: number;
}

interface CashData {
    total: number;
    paymentsTotal: number;
    manualBalance: number;
    movements: {
        id: string;
        type: 'IN' | 'OUT';
        amount: number;
        reason: string;
        createdAt: string;
        user: { name: string };
    }[];
}

interface PaymentsData {
    payments: PaymentRecord[];
    summary: {
        grandTotal: number;
        totalCount: number;
        averagePayment: number;
    };
    methodBreakdown: { method: string; total: number; count: number }[];
}

const PAYMENT_METHODS = [
    { key: 'PAY_WAY_6_ISH', label: 'Pay Way 6 Ish', icon: CreditCard, color: 'bg-blue-500', lightBg: 'bg-blue-50 dark:bg-blue-950', textColor: 'text-blue-500' },
    { key: 'PAY_WAY_3_ISH', label: 'Pay Way 3 Ish', icon: CreditCard, color: 'bg-blue-400', lightBg: 'bg-blue-50 dark:bg-blue-950', textColor: 'text-blue-400' },
    { key: 'NARANJA_Z_ISH', label: 'Naranja Z Ish', icon: CreditCard, color: 'bg-orange-500', lightBg: 'bg-orange-50 dark:bg-orange-950', textColor: 'text-orange-500' },
    { key: 'PAY_WAY_6_YANI', label: 'Pay Way 6 Yani', icon: CreditCard, color: 'bg-indigo-500', lightBg: 'bg-indigo-50 dark:bg-indigo-950', textColor: 'text-indigo-500' },
    { key: 'PAY_WAY_3_YANI', label: 'Pay Way 3 Yani', icon: CreditCard, color: 'bg-indigo-400', lightBg: 'bg-indigo-50 dark:bg-indigo-950', textColor: 'text-indigo-400' },
    { key: 'NARANJA_Z_YANI', label: 'Naranja Z Yani', icon: CreditCard, color: 'bg-orange-400', lightBg: 'bg-orange-50 dark:bg-orange-950', textColor: 'text-orange-400' },
    { key: 'EFECTIVO', label: 'Efectivo', icon: Banknote, color: 'bg-emerald-500', lightBg: 'bg-emerald-50 dark:bg-emerald-950', textColor: 'text-emerald-500' },
];

const getMethodInfo = (key: string) => PAYMENT_METHODS.find(m => m.key === key) || {
    key, label: key, icon: CreditCard, color: 'bg-stone-400', lightBg: 'bg-stone-50 dark:bg-stone-800', textColor: 'text-stone-500'
};

// ── Helpers ────────────────────────────────────

function getPresetDates(preset: string): { from: string; to: string } {
    const now = new Date();
    const to = format(now, 'yyyy-MM-dd');

    switch (preset) {
        case 'month': {
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            return { from: format(first, 'yyyy-MM-dd'), to };
        }
        case 'last_month': {
            const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const last = new Date(now.getFullYear(), now.getMonth(), 0);
            return { from: format(first, 'yyyy-MM-dd'), to: format(last, 'yyyy-MM-dd') };
        }
        case 'quarter': {
            const first = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            return { from: format(first, 'yyyy-MM-dd'), to };
        }
        case 'year': {
            const first = new Date(now.getFullYear(), 0, 1);
            return { from: format(first, 'yyyy-MM-dd'), to };
        }
        default:
            return { from: '', to: '' };
    }
}

// ── Page ──────────────────────────────────

export default function AdministracionPage() {
    const [data, setData] = useState<PaymentsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activePreset, setActivePreset] = useState('month');
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
    const [cashData, setCashData] = useState<CashData | null>(null);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [movementAmount, setMovementAmount] = useState('');
    const [movementReason, setMovementReason] = useState('');
    const [isSavingMovement, setIsSavingMovement] = useState(false);

    useEffect(() => {
        const preset = getPresetDates('month');
        setDateFrom(preset.from);
        setDateTo(preset.to);
        fetchPayments(preset.from, preset.to);
        fetchCashData();
    }, []);

    const fetchCashData = async () => {
        try {
            const res = await fetch('/api/cash');
            const json = await res.json();
            setCashData(json);
        } catch (error) {
            console.error('Error fetching cash data:', error);
        }
    };

    const fetchPayments = async (from?: string, to?: string, method?: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            if (method) params.set('method', method);
            const res = await fetch(`/api/payments?${params.toString()}`);
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error('Error fetching payments:', error);
        }
        setLoading(false);
    };

    const applyPreset = (preset: string) => {
        setActivePreset(preset);
        if (preset === 'all') {
            setDateFrom('');
            setDateTo('');
            fetchPayments(undefined, undefined, selectedMethod || undefined);
        } else {
            const { from, to } = getPresetDates(preset);
            setDateFrom(from);
            setDateTo(to);
            fetchPayments(from, to, selectedMethod || undefined);
        }
    };

    const applyCustomDates = () => {
        setActivePreset('custom');
        fetchPayments(dateFrom, dateTo, selectedMethod || undefined);
    };

    const handleMethodFilter = (method: string) => {
        const newMethod = method === selectedMethod ? '' : method;
        setSelectedMethod(newMethod);
        fetchPayments(dateFrom || undefined, dateTo || undefined, newMethod || undefined);
    };

    const clearFilters = () => {
        setSelectedMethod('');
        setSearchQuery('');
        const preset = getPresetDates('month');
        setDateFrom(preset.from);
        setDateTo(preset.to);
        setActivePreset('month');
        fetchPayments(preset.from, preset.to);
        fetchCashData();
    };

    const handleSaveMovement = async () => {
        if (!movementAmount || !movementReason) return;
        setIsSavingMovement(true);
        try {
            const userRes = await fetch('/api/auth/me');
            const userData = await userRes.json();
            
            const res = await fetch('/api/cash/movement', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': userData.id 
                },
                body: JSON.stringify({
                    type: 'OUT',
                    amount: parseFloat(movementAmount),
                    reason: movementReason
                })
            });

            if (res.ok) {
                setShowMovementModal(false);
                setMovementAmount('');
                setMovementReason('');
                fetchCashData();
                fetchPayments(dateFrom || undefined, dateTo || undefined, selectedMethod || undefined);
            }
        } catch (error) {
            console.error('Error saving movement:', error);
        } finally {
            setIsSavingMovement(false);
        }
    };

    const filteredPayments = data?.payments?.filter(p =>
        !searchQuery || p.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    if (loading && !data) {
        return (
            <main className="p-4 lg:p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-sm font-bold text-stone-400">Cargando pagos...</p>
                </div>
            </main>
        );
    }

    const s = data?.summary;

    return (
        <main className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-3">
                        <Wallet className="w-9 h-9 text-primary" /> Caja / Pagos
                    </h1>
                    <p className="text-stone-400 text-sm mt-1 font-medium">
                        Control y seguimiento de todos los pagos registrados
                    </p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="bg-emerald-500/10 border-2 border-emerald-500/20 px-6 py-3 rounded-2xl animate-in zoom-in duration-300">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-0.5">Efectivo en Caja</span>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-emerald-600 tracking-tighter">
                                ${cashData?.total.toLocaleString('es-AR') || '0'}
                            </span>
                            <button 
                                onClick={() => setShowMovementModal(true)}
                                className="ml-2 bg-emerald-600 text-white p-1.5 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                                title="Registrar Salida"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                fetchPayments(dateFrom || undefined, dateTo || undefined, selectedMethod || undefined);
                                fetchCashData();
                            }}
                            className="p-3 bg-stone-100 dark:bg-stone-800 rounded-xl text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all hover:scale-105"
                            title="Actualizar"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={clearFilters}
                            className="px-5 py-3 bg-stone-100 dark:bg-stone-800 text-stone-500 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
                        >
                            <Filter className="w-4 h-4" /> Limpiar
                        </button>
                    </div>
                </div>
            </div>

            {/* Date Filters */}
            <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest mr-2">Período:</span>
                    {[
                        { key: 'all', label: 'Todo' },
                        { key: 'month', label: 'Este Mes' },
                        { key: 'last_month', label: 'Mes Anterior' },
                        { key: 'quarter', label: 'Último Trimestre' },
                        { key: 'year', label: 'Este Año' },
                    ].map(p => (
                        <button
                            key={p.key}
                            onClick={() => applyPreset(p.key)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activePreset === p.key
                                ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-lg'
                                : 'bg-stone-50 dark:bg-stone-700 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-600'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}

                    <div className="h-6 w-px bg-stone-200 dark:bg-stone-600 mx-2" />

                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="px-3 py-2 border-2 border-stone-100 dark:border-stone-600 rounded-xl text-xs font-bold bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none focus:border-primary"
                        />
                        <span className="text-stone-400 text-xs font-bold">a</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="px-3 py-2 border-2 border-stone-100 dark:border-stone-600 rounded-xl text-xs font-bold bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none focus:border-primary"
                        />
                        <button
                            onClick={applyCustomDates}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                        >
                            Aplicar
                        </button>
                    </div>
                </div>
            </div>

            {/* Method Filter Chips */}
            <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest mr-2">Filtrar por Caja:</span>
                    {PAYMENT_METHODS.map(pm => (
                        <button
                            key={pm.key}
                            onClick={() => handleMethodFilter(pm.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedMethod === pm.key
                                ? `${pm.color} text-white shadow-lg scale-105`
                                : 'bg-stone-50 dark:bg-stone-700 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-600'
                                }`}
                        >
                            <pm.icon className="w-3.5 h-3.5" />
                            {pm.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            {s && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white dark:bg-stone-800 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 ring-2 ring-emerald-100 dark:ring-emerald-900 transition-all hover:shadow-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-500">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Total Recaudado</span>
                        </div>
                        <p className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                            ${s.grandTotal.toLocaleString('es-AR')}
                        </p>
                        <p className="text-[10px] font-bold text-stone-400 mt-1">
                            {selectedMethod ? getMethodInfo(selectedMethod).label : 'Todos los métodos'}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6 transition-all hover:shadow-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-500">
                                <Hash className="w-5 h-5" />
                            </div>
                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Cantidad de Pagos</span>
                        </div>
                        <p className="text-2xl font-black tracking-tight text-stone-800 dark:text-white">
                            {s.totalCount}
                        </p>
                        <p className="text-[10px] font-bold text-stone-400 mt-1">operaciones registradas</p>
                    </div>

                    <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6 transition-all hover:shadow-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-500">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Promedio por Pago</span>
                        </div>
                        <p className="text-2xl font-black tracking-tight text-stone-800 dark:text-white">
                            ${s.averagePayment.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[10px] font-bold text-stone-400 mt-1">ticket promedio</p>
                    </div>
                </div>
            )}

            {/* Method Breakdown Cards */}
            {data?.methodBreakdown && data.methodBreakdown.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> Desglose por Caja
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {data.methodBreakdown.map(mb => {
                            const info = getMethodInfo(mb.method);
                            const Icon = info.icon;
                            const isSelected = selectedMethod === mb.method;
                            return (
                                <button
                                    key={mb.method}
                                    onClick={() => handleMethodFilter(mb.method)}
                                    className={`p-5 rounded-2xl border-2 transition-all hover:shadow-lg text-left group ${isSelected
                                        ? `border-stone-900 dark:border-white shadow-lg`
                                        : 'border-stone-100 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500'
                                        } bg-white dark:bg-stone-800`}
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`p-1.5 rounded-lg ${info.color}`}>
                                            <Icon className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest group-hover:text-stone-600 dark:group-hover:text-stone-300">
                                            {info.label}
                                        </span>
                                    </div>
                                    <p className="text-xl font-black text-stone-800 dark:text-white tracking-tight">
                                        ${mb.total.toLocaleString('es-AR')}
                                    </p>
                                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mt-1">
                                        {mb.count} pago{mb.count !== 1 ? 's' : ''}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="mb-4">
                <div className="relative">
                    <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre de cliente..."
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl text-sm font-bold outline-none focus:border-primary transition-all"
                    />
                </div>
            </div>

            {/* Payments Table */}
            <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-700 flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                        <Receipt className="w-4 h-4" /> Detalle de Pagos
                    </h2>
                    <span className="text-[10px] font-bold text-stone-400">
                        {filteredPayments.length} resultado{filteredPayments.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {filteredPayments.length > 0 ? (
                    <div className="divide-y divide-stone-50 dark:divide-stone-700/50">
                        {filteredPayments.map((payment) => {
                            const info = getMethodInfo(payment.method);
                            const Icon = info.icon;
                            return (
                                <div key={payment.id} className="flex items-center justify-between px-6 py-4 hover:bg-stone-50 dark:hover:bg-stone-900/50 transition-all group">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className={`p-2 rounded-xl ${info.lightBg} ${info.textColor} shrink-0`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-stone-800 dark:text-white truncate">
                                                    {payment.clientName}
                                                </p>
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${info.color} text-white`}>
                                                    {info.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[10px] font-bold text-stone-400">
                                                    {format(new Date(payment.date), "d 'de' MMM yyyy, HH:mm", { locale: es })}
                                                </span>
                                                {payment.notes && (
                                                    <>
                                                        <span className="text-stone-300">·</span>
                                                        <span className="text-[10px] font-medium text-stone-400 italic truncate max-w-[200px]">
                                                            {payment.notes}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                        {payment.receiptUrl && (
                                            <button
                                                onClick={() => setViewingReceipt(payment.receiptUrl)}
                                                className="p-2 text-stone-300 hover:text-primary rounded-xl hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100"
                                                title="Ver comprobante"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                        <p className="text-lg font-black text-stone-800 dark:text-white tracking-tight">
                                            ${payment.amount.toLocaleString('es-AR')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16 text-stone-300 dark:text-stone-600">
                        <Wallet className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-xs font-black uppercase tracking-widest">Sin pagos registrados</p>
                        <p className="text-[10px] font-medium text-stone-400 mt-1">Ajusta los filtros o registra pagos en las ventas</p>
                    </div>
                )}

                {/* Total bar at bottom */}
                {filteredPayments.length > 0 && (
                    <div className="px-6 py-4 border-t-2 border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-stone-400">
                            Total {selectedMethod ? getMethodInfo(selectedMethod).label : ''}
                        </span>
                        <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                            ${filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('es-AR')}
                        </span>
                    </div>
                )}
            </div>

            {/* Receipt Viewer Modal */}
            {viewingReceipt && (
                <div
                    className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm z-[70] flex items-center justify-center animate-in fade-in duration-200"
                    onClick={() => setViewingReceipt(null)}
                >
                    <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-2xl max-w-lg max-h-[80vh] overflow-auto p-2" onClick={e => e.stopPropagation()}>
                        <img src={viewingReceipt} alt="Comprobante" className="rounded-2xl w-full" />
                        <button
                            onClick={() => setViewingReceipt(null)}
                            className="w-full mt-2 py-3 bg-stone-100 dark:bg-stone-700 text-stone-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-stone-200 dark:hover:bg-stone-600 transition-all"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Cash Movement Modal */}
            {showMovementModal && (
                <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-stone-800 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500">
                                        <TrendingUp className="rotate-180" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-stone-800 dark:text-white tracking-tight">Registrar Salida</h3>
                                        <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest italic">Egreso de Efectivo</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowMovementModal(false)} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Monto a retirar</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-stone-300">$</span>
                                        <input 
                                            type="number" 
                                            value={movementAmount}
                                            onChange={e => setMovementAmount(e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-stone-50 dark:bg-stone-900 border-none rounded-2xl py-5 pl-10 pr-6 text-2xl font-black outline-none focus:ring-4 focus:ring-red-500/10 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Motivo / Descripción</label>
                                    <textarea 
                                        value={movementReason}
                                        onChange={e => setMovementReason(e.target.value)}
                                        placeholder="Ej: Pago a proveedores, Gastos diarios..."
                                        rows={3}
                                        className="w-full bg-stone-50 dark:bg-stone-900 border-none rounded-2xl p-5 text-sm font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all resize-none"
                                    />
                                </div>

                                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl flex gap-3 border border-amber-100 dark:border-amber-900/30">
                                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                                    <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed italic">
                                        Se enviará una notificación y un correo a la administración con los detalles de este movimiento.
                                    </p>
                                </div>

                                <button 
                                    onClick={handleSaveMovement}
                                    disabled={!movementAmount || !movementReason || isSavingMovement}
                                    className="w-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:scale-100"
                                >
                                    {isSavingMovement ? <Loader2 className="animate-spin" /> : 'Confirmar Salida'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
