'use client';

import { useState, useEffect } from 'react';
import {
    Wallet, DollarSign, CreditCard, Banknote, Calendar,
    Loader2, RefreshCw, Filter, Hash, TrendingUp,
    ChevronDown, Search, Receipt, Eye, Plus, X, AlertCircle,
    ArrowUpRight, ArrowDownRight, ImageIcon, Trash2, History
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

interface CashMovement {
    id: string;
    type: 'IN' | 'OUT';
    amount: number;
    reason: string;
    category?: string;
    laboratory?: string | null;
    receiptUrl?: string | null;
    createdAt: string;
    user: { name: string };
}

interface CashData {
    total: number;
    paymentsTotal: number;
    manualBalance: number;
    movements: CashMovement[];
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
    { key: 'GO_CUOTAS_ISH', label: 'Go Cuotas Ish', icon: CreditCard, color: 'bg-violet-600', lightBg: 'bg-violet-50 dark:bg-violet-950', textColor: 'text-violet-600' },
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
    const [movementReceiptUrl, setMovementReceiptUrl] = useState('');
    const [isSavingMovement, setIsSavingMovement] = useState(false);
    const [activeTab, setActiveTab] = useState<'payments' | 'history'>('payments');

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
            
            if (json.error) {
                console.error('API Error fetching cash data:', json.error);
                setCashData(null);
            } else {
                setCashData(json);
            }
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
            
            if (json.error) {
                console.error('API Error fetching payments:', json.error);
                setData(null);
            } else {
                setData(json);
            }
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

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 1200;
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
        });
    };

    const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const base64 = await compressImage(file);
        setMovementReceiptUrl(base64);
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
                    reason: movementReason,
                    receiptUrl: movementReceiptUrl || undefined
                })
            });

            if (res.ok) {
                setShowMovementModal(false);
                setMovementAmount('');
                setMovementReason('');
                setMovementReceiptUrl('');
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
                    <p className="text-sm font-bold text-stone-400">Cargando datos...</p>
                </div>
            </main>
        );
    }

    const s = data?.summary;

    return (
        <main className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-20">
            {/* Header / Premium Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 shadow-sm">
                <div>
                    <h1 className="text-4xl font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <Wallet className="w-7 h-7" />
                        </div>
                        Caja y Finanzas
                    </h1>
                    <p className="text-stone-400 text-sm mt-2 font-medium">
                        Control total de ingresos, egresos y comprobantes del Atelier
                    </p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 px-8 py-4 rounded-[2rem] flex flex-col items-center">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Efectivo en Caja</span>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                                ${cashData?.total?.toLocaleString('es-AR') ?? '0'}
                            </span>
                            <button 
                                onClick={() => setShowMovementModal(true)}
                                className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 transition-all hover:scale-110 shadow-lg shadow-emerald-600/20"
                                title="Registrar Salida"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            fetchPayments(dateFrom || undefined, dateTo || undefined, selectedMethod || undefined);
                            fetchCashData();
                        }}
                        className="p-4 bg-stone-100 dark:bg-stone-800 rounded-2xl text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all hover:rotate-180"
                        title="Actualizar"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Tabs & Period Filters */}
            <div className="flex flex-col lg:flex-row items-center justify-between mb-8 gap-4">
                <div className="flex bg-stone-100 dark:bg-stone-800 p-1.5 rounded-2xl shadow-inner w-full lg:w-auto">
                    <button
                        onClick={() => setActiveTab('payments')}
                        className={`flex-1 lg:flex-none px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'payments'
                            ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm'
                            : 'text-stone-400 hover:text-stone-600'
                            }`}
                    >
                        Pagos de Ventas
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 lg:flex-none px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history'
                            ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm'
                            : 'text-stone-400 hover:text-stone-600'
                            }`}
                    >
                        Historial de Caja
                    </button>
                </div>

                <div className="flex items-center gap-3 flex-wrap justify-center lg:justify-end">
                    {[
                        { key: 'all', label: 'Todo' },
                        { key: 'month', label: 'Este Mes' },
                        { key: 'last_month', label: 'Mes Pasado' },
                    ].map(p => (
                        <button
                            key={p.key}
                            onClick={() => applyPreset(p.key)}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activePreset === p.key
                                ? 'bg-stone-900 dark:bg-stone-200 text-white dark:text-stone-900 shadow-md'
                                : 'bg-white dark:bg-stone-800 text-stone-400 hover:bg-stone-50 border border-stone-100 dark:border-stone-700'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button
                        onClick={clearFilters}
                        className="p-2.5 bg-white dark:bg-stone-800 text-stone-400 rounded-xl hover:text-red-500 transition-colors border border-stone-100 dark:border-stone-700"
                        title="Limpiar filtros"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {activeTab === 'payments' ? (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    {/* KPI Grid */}
                    {s && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                            {[
                                { label: 'Total Recaudado', val: `$${(s?.grandTotal ?? 0).toLocaleString('es-AR')}`, sub: selectedMethod ? getMethodInfo(selectedMethod).label : 'Todos los métodos', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                                { label: 'Cant. Operaciones', val: s?.totalCount ?? 0, sub: 'Pagos registrados', icon: Hash, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                                { label: 'Ticket Promedio', val: `$${(s?.averagePayment ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`, sub: 'por transacción', icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                            ].map((kpi, idx) => (
                                <div key={idx} className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-[2rem] p-7 transition-all hover:shadow-xl hover:shadow-stone-200/40 dark:hover:shadow-black/20 group">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className={`p-3 rounded-2xl ${kpi.bg} ${kpi.color} transition-transform group-hover:scale-110`}>
                                            <kpi.icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{kpi.label}</span>
                                    </div>
                                    <p className="text-3xl font-black text-stone-800 dark:text-white tracking-tight leading-none mb-1">
                                        {kpi.val}
                                    </p>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{kpi.sub}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Method Filters */}
                    <div className="mb-10">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-5 pl-1">Filtrar por medio de pago</h2>
                        <div className="flex flex-wrap gap-3">
                            {PAYMENT_METHODS.map(pm => {
                                const isSelected = selectedMethod === pm.key;
                                return (
                                    <button
                                        key={pm.key}
                                        onClick={() => handleMethodFilter(pm.key)}
                                        className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${isSelected
                                            ? `${pm.color} border-transparent text-white shadow-lg shadow-${pm.color.split('-')[1]}-500/20 scale-105`
                                            : 'bg-white dark:bg-stone-800 text-stone-500 border-stone-100 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500'
                                            }`}
                                    >
                                        <pm.icon className={`w-4 h-4 ${isSelected ? 'text-white' : pm.textColor}`} />
                                        {pm.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Table Container */}
                    <div className="bg-white dark:bg-stone-900 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 overflow-hidden shadow-sm">
                        <div className="p-8 border-b border-stone-50 dark:border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="relative flex-1 max-w-md">
                                <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Buscar cliente..."
                                    className="w-full pl-11 pr-4 py-3.5 bg-stone-50 dark:bg-stone-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest italic">
                                Mostrando {filteredPayments.length} de {data?.payments?.length || 0} registros
                            </span>
                        </div>

                        {filteredPayments.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b border-stone-50 dark:border-stone-800">
                                            <th className="px-8 py-5 text-left text-[10px] font-black text-stone-400 uppercase tracking-widest">Fecha y Hora</th>
                                            <th className="px-8 py-5 text-left text-[10px] font-black text-stone-400 uppercase tracking-widest">Cliente</th>
                                            <th className="px-8 py-5 text-left text-[10px] font-black text-stone-400 uppercase tracking-widest">Método</th>
                                            <th className="px-8 py-5 text-left text-[10px] font-black text-stone-400 uppercase tracking-widest">Estado Caja</th>
                                            <th className="px-8 py-5 text-right text-[10px] font-black text-stone-400 uppercase tracking-widest">Monto</th>
                                            <th className="px-8 py-5 text-center text-[10px] font-black text-stone-400 uppercase tracking-widest whitespace-nowrap">Comprobante</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50 dark:divide-stone-800">
                                        {filteredPayments.map((p) => {
                                            const info = getMethodInfo(p.method);
                                            return (
                                                <tr key={p.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors group">
                                                    <td className="px-8 py-5">
                                                        <p className="text-xs font-black text-stone-800 dark:text-stone-200">
                                                            {p.date ? format(new Date(p.date), 'dd MMM yyyy', { locale: es }) : '---'}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-stone-400">
                                                            {p.date ? format(new Date(p.date), 'HH:mm') : '--:--'} hs
                                                        </p>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <p className="text-sm font-black text-stone-800 dark:text-stone-200">{p.clientName}</p>
                                                        <p className="text-[10px] font-bold text-stone-400">Orden: #{p.orderId.slice(-6).toUpperCase()}</p>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${info.lightBg} ${info.textColor} text-[10px] font-black uppercase tracking-widest`}>
                                                            <info.icon size={12} />
                                                            {info.label}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        {(p.method === 'EFECTIVO' || p.method === 'CASH') ? (
                                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Suma a Caja
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] font-black text-stone-300 uppercase tracking-widest">Externo</span>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <p className="text-lg font-black text-stone-800 dark:text-white tracking-tighter">
                                                            ${(p.amount ?? 0).toLocaleString('es-AR')}
                                                        </p>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        {p.receiptUrl ? (
                                                            <button 
                                                                onClick={() => setViewingReceipt(p.receiptUrl)}
                                                                className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all mx-auto shadow-sm"
                                                                title="Ver Comprobante"
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-stone-300 italic">No disponible</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 text-stone-300 dark:text-stone-700">
                                <Search size={48} className="mb-4 opacity-20" />
                                <p className="text-xs font-black uppercase tracking-widest">No se encontraron pagos</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    {/* Cash History (Movements) */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Summary Bar */}
                        <div className="lg:col-span-1 border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-sm">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Balance Manual</h3>
                            <div>
                                <p className="text-4xl font-black text-stone-800 dark:text-white tracking-tighter">${(cashData?.manualBalance ?? 0).toLocaleString('es-AR')}</p>
                                <p className="text-[10px] font-bold text-stone-400 mt-1 uppercase tracking-widest">Registros de Entradas y Salidas</p>
                            </div>
                            <div className="h-px bg-stone-100 dark:bg-stone-800 w-full" />
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Ingresos Manuales</span>
                                    <span className="text-xs font-black text-emerald-500">$0</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Egresos Manuales</span>
                                    <span className="text-xs font-black text-red-500">${(Math.abs(cashData?.manualBalance ?? 0)).toLocaleString('es-AR')}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowMovementModal(true)}
                                className="w-full mt-4 py-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-stone-900/10 dark:shadow-white/5 hover:scale-105 active:scale-95 transition-all"
                            >
                                Registrar Salida
                            </button>
                        </div>

                        {/* Timeline */}
                        <div className="lg:col-span-3">
                            <div className="bg-white dark:bg-stone-900 p-10 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 shadow-sm min-h-[500px]">
                                <h3 className="text-xl font-black text-stone-800 dark:text-white mb-8 tracking-tight flex items-center gap-2">
                                    <History className="w-6 h-6 text-primary" /> Historial de Movimientos
                                </h3>

                                <div className="space-y-8 relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-stone-100 dark:before:bg-stone-800">
                                    {cashData?.movements && cashData.movements.length > 0 ? (
                                        cashData.movements.map((m) => (
                                            <div key={m.id} className="relative pl-14 flex items-start justify-between group">
                                                <div className={`absolute left-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-lg ${
                                                    m.type === 'IN' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                                                }`}>
                                                    {m.type === 'IN' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                                        <h4 className="text-sm font-black text-stone-800 dark:text-white">{m.reason}</h4>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                                            m.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                                                        }`}>
                                                            {m.type === 'IN' ? 'Entrada' : 'Salida'}
                                                        </span>
                                                        {m.category && m.category !== 'OTRO' && (
                                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest bg-stone-100 dark:bg-stone-700 text-stone-500">
                                                                {m.category === 'PAGO_LABORATORIO' ? 'Lab' : m.category === 'GASTO_GENERAL' ? 'Gasto' : m.category === 'APORTE_EFECTIVO' ? 'Aporte' : m.category}
                                                            </span>
                                                        )}
                                                        {m.laboratory && (
                                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                                                {m.laboratory}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                                        <span>{m.createdAt ? format(new Date(m.createdAt), 'dd MMMM, HH:mm', { locale: es }) : '---'}</span>
                                                        <span className="text-stone-200">|</span>
                                                        <span>Por: {m.user?.name ?? 'Desconocido'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    {m.receiptUrl && (
                                                        <button 
                                                            onClick={() => setViewingReceipt(m.receiptUrl || null)}
                                                            className="p-3 text-stone-400 hover:text-primary transition-all rounded-xl hover:bg-stone-50"
                                                            title="Ver Comprobante"
                                                        >
                                                            <ImageIcon size={18} />
                                                        </button>
                                                    )}
                                                    <p className={`text-xl font-black tracking-tight ${m.type === 'IN' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {m.type === 'IN' ? '+' : '-'}${(m.amount ?? 0).toLocaleString('es-AR')}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-20 text-stone-300">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] italic">No hay movimientos registrados</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {viewingReceipt && (
                <div
                    className="fixed inset-0 bg-stone-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-8 animate-in fade-in duration-300"
                    onClick={() => setViewingReceipt(null)}
                >
                    <div className="bg-white dark:bg-stone-800 rounded-[3rem] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-stone-100 dark:border-stone-700 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-widest text-stone-400">Vista de Comprobante</span>
                            <button onClick={() => setViewingReceipt(null)} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-stone-50 dark:bg-stone-900/50 p-4">
                            <img src={viewingReceipt} alt="Comprobante" className="w-full h-auto rounded-2xl shadow-lg" />
                        </div>
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
                                        <ArrowDownRight className="w-6 h-6" />
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
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-stone-300">$</span>
                                        <input 
                                            type="number" 
                                            value={movementAmount}
                                            onChange={e => setMovementAmount(e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-stone-50 dark:bg-stone-900 border-none rounded-2xl py-5 pl-12 pr-6 text-2xl font-black outline-none focus:ring-4 focus:ring-red-500/10 transition-all placeholder:text-stone-200"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Motivo / Descripción</label>
                                    <textarea 
                                        value={movementReason}
                                        onChange={e => setMovementReason(e.target.value)}
                                        placeholder="Ej: Pago a proveedores, Gastos diarios..."
                                        rows={2}
                                        className="w-full bg-stone-50 dark:bg-stone-900 border-none rounded-2xl p-5 text-sm font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Adjuntar Ticket (Opcional)</label>
                                    <div className="relative">
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={handleReceiptUpload}
                                            className="hidden" 
                                            id="output-receipt"
                                        />
                                        <label htmlFor="output-receipt" className={`w-full h-24 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                                            movementReceiptUrl ? 'border-primary bg-primary/5 text-primary' : 'border-stone-100 dark:border-stone-800 text-stone-400 hover:bg-stone-50'
                                        }`}>
                                            {movementReceiptUrl ? (
                                                <>
                                                    <ImageIcon size={24} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Imagen Cargada ✓</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Plus size={24} className="opacity-30" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Subir Imagen</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-[1.5rem] flex gap-4 border border-amber-100 dark:border-amber-900/30">
                                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                                    <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed italic">
                                        Se enviará una notificación crítica con este retiro a la administración central.
                                    </p>
                                </div>

                                <button 
                                    onClick={handleSaveMovement}
                                    disabled={!movementAmount || !movementReason || isSavingMovement}
                                    className="w-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 py-6 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-stone-900/20 dark:shadow-white/5 disabled:opacity-50 disabled:scale-100"
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
