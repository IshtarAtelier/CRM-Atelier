'use client';

import { useState, useEffect } from 'react';
import {
    FileText, TrendingUp, DollarSign, ShoppingBag, Users, Package,
    Calendar, ArrowDown, ArrowUp, Minus, Loader2, CreditCard, Banknote,
    PieChart, BarChart3, Printer, RefreshCw, ChevronDown, Award, FlaskConical,
    Plus, Trash2, Building2, Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import DoctorCommissions from '@/components/DoctorCommissions';

// ── Types ─────────────────────────────────────

interface FixedCost {
    id: string;
    name: string;
    amount: number;
    category: string;
    month: number;
    year: number;
    notes?: string;
    type?: string;
}

interface ReportData {
    summary: {
        totalRevenue: number;
        totalCosts: number;
        totalCostFrames: number;
        totalCostLenses: number;
        totalCostOther: number;
        totalPlatformFees: number;
        totalDoctorFees: number;
        totalFixedCosts: number;
        totalMarketingCosts?: number;
        totalProviderCosts?: number;
        totalSpecialDiscounts: number;
        netProfit: number;
        profitMargin: number;
        totalPaid: number;
        totalPending: number;
        ordersCount: number;
    };
    fixedCosts: FixedCost[];
    topClients: { name: string; total: number; orders: number }[];
    topProducts: { name: string; type: string; qty: number; revenue: number; cost: number }[];
    vendorStats: { name: string; revenue: number; orders: number; avgTicket: number }[];
    monthlyStats: { month: string; revenue: number; cost: number; profit: number; orders: number }[];
    paymentMethods: { method: string; total: number; count: number; commission: number }[];
    labStats: { laboratory: string; revenue: number; cost: number; profit: number; ordersCount: number; clients?: { name: string; date: string; product: string; revenue: number; cost: number }[] }[];
    billingStats: { account: string; total: number; count: number }[];
}

const FIXED_COST_CATEGORIES = [
    { id: 'CONTADORA', label: 'Contadora' },
    { id: 'SUELDOS', label: 'Sueldos' },
    { id: 'LIMPIEZA', label: 'Limpieza' },
    { id: 'ALQUILER', label: 'Alquiler' },
    { id: 'SERVICIOS', label: 'Servicios' },
    { id: 'IMPUESTOS', label: 'Impuestos' },
    { id: 'OTRO', label: 'Otro' },
];

const METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    EFECTIVO: 'Efectivo',
    DEBIT: 'Débito',
    CREDIT: 'Crédito (1 pago)',
    CREDIT_3: '3 Cuotas S/I',
    CREDIT_6: '6 Cuotas S/I',
    PLAN_Z: 'Plan Z',
    TRANSFER: 'Transferencia',
    TRANSFERENCIA_ISHTAR: 'Transf. Ishtar',
    TRANSFERENCIA_LUCIA: 'Transf. Lucía',
    PAY_WAY_3_ISH: 'PayWay 3c Ish',
    PAY_WAY_3_YANI: 'PayWay 3c Yani',
    PAY_WAY_6_ISH: 'PayWay 6c Ish',
    PAY_WAY_6_YANI: 'PayWay 6c Yani',
    NARANJA_Z_ISH: 'Naranja Z Ish',
    NARANJA_Z_YANI: 'Naranja Z Yani',
    GO_CUOTAS: 'Go Cuotas',
    GO_CUOTAS_ISH: 'Go Cuotas Ish',
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

export default function ReportesPage() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activePreset, setActivePreset] = useState('all');

    useEffect(() => {
        fetchReport();
    }, []);

    const fetchReport = async (from?: string, to?: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            const res = await fetch(`/api/reports?${params.toString()}`);
            const json = await res.json();
            
            if (json.error) {
                console.error('API Error fetching reports:', json.error);
                setData(null);
            } else {
                setData(json);
            }
        } catch (error) {
            console.error('Error fetching report:', error);
            setData(null);
        }
        setLoading(false);
    };

    const applyPreset = (preset: string) => {
        setActivePreset(preset);
        if (preset === 'all') {
            setDateFrom('');
            setDateTo('');
            fetchReport();
        } else {
            const { from, to } = getPresetDates(preset);
            setDateFrom(from);
            setDateTo(to);
            fetchReport(from, to);
        }
    };

    const applyCustomDates = () => {
        setActivePreset('custom');
        fetchReport(dateFrom, dateTo);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading && !data) {
        return (
            <main className="p-4 lg:p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-sm font-bold text-stone-400">Generando reporte...</p>
                </div>
            </main>
        );
    }

    const s = data?.summary;

    return (
        <main className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-20 print:p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-3">
                        <FileText className="w-9 h-9 text-primary" /> Reportes
                    </h1>
                    <p className="text-stone-400 text-sm mt-1 font-medium">
                        Análisis de costos, ganancias y rentabilidad
                    </p>
                </div>
                <div className="flex items-center gap-3 print:hidden">
                    <button
                        onClick={() => fetchReport(dateFrom || undefined, dateTo || undefined)}
                        className="p-3 bg-stone-100 dark:bg-stone-800 rounded-xl text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all hover:scale-105"
                        title="Actualizar"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-5 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
                    >
                        <Printer className="w-4 h-4" /> Imprimir
                    </button>
                </div>
            </div>

            {/* Date Filters */}
            <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-5 mb-8 print:hidden">
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

            {/* KPI Cards — Simple overview */}
            {s && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <KPICard
                            title="Ingreso Real"
                            value={`$${(s?.totalRevenue ?? 0).toLocaleString()}`}
                            sub={`${s.ordersCount} ventas · $${(s?.totalPending ?? 0).toLocaleString()} pendiente`}
                            icon={DollarSign}
                            color="stone"
                        />
                        <KPICard
                            title="Resultado Neto"
                            value={`$${(s?.netProfit ?? 0).toLocaleString()}`}
                            sub={`${s.profitMargin.toFixed(1)}% margen sobre ingreso`}
                            icon={TrendingUp}
                            color="emerald"
                            highlight
                        />
                        <KPICard
                            title="Pendiente de Cobro"
                            value={`$${(s?.totalPending ?? 0).toLocaleString()}`}
                            sub={`Pagado: $${(s?.totalPaid ?? 0).toLocaleString()}`}
                            icon={CreditCard}
                            color="blue"
                        />
                    </div>

                    {/* ── Estado de Resultados ────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Receipt className="w-5 h-5 text-primary" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Estado de Resultados</h2>
                            </div>

                            {/* ─ Ingresos ─ */}
                            <PLRow label="Ingresos (Cobrado)" value={s.totalRevenue} bold accent="text-stone-800 dark:text-white" />

                            {/* ─ Costos Variables ─ */}
                            <div className="mt-4 mb-1">
                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Costos Variables</span>
                            </div>
                            <PLRow label="CMV Armazones / Sol" value={-s.totalCostFrames} color="text-red-400" />
                            <PLRow label="CMV Cristales / Lentes" value={-s.totalCostLenses} color="text-red-400" />
                            {s.totalCostOther > 0 && <PLRow label="CMV Otros" value={-s.totalCostOther} color="text-red-400" />}
                            <PLRow label="Comisiones Plataforma" value={-s.totalPlatformFees} color="text-purple-400" sub="PayWay / Go Cuotas" />
                            <PLRow label="Comisiones Médicos" value={-s.totalDoctorFees} color="text-pink-400" sub="15% sobre neto" />
                            {s.totalSpecialDiscounts > 0 && <PLRow label="Envío / Desc. Especiales" value={-s.totalSpecialDiscounts} color="text-teal-500" />}

                            {/* ─ Margen de Contribución ─ */}
                            {(() => {
                                const variableCosts = s.totalCosts + s.totalPlatformFees + s.totalDoctorFees + (s.totalSpecialDiscounts || 0);
                                const margenContribucion = s.totalRevenue - variableCosts;
                                const margenPct = s.totalRevenue > 0 ? (margenContribucion / s.totalRevenue * 100) : 0;
                                return (
                                    <div className="border-t-2 border-dashed border-stone-200 dark:border-stone-600 mt-4 pt-3">
                                        <PLRow label={`Margen de Contribución (${margenPct.toFixed(0)}%)`} value={margenContribucion} bold accent={margenContribucion >= 0 ? 'text-blue-500' : 'text-red-500'} />
                                    </div>
                                );
                            })()}

                            {/* ─ Gastos Fijos y Marketing ─ */}
                            <div className="mt-4 mb-1">
                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Gastos Operativos y Marketing</span>
                            </div>
                            {(data?.fixedCosts && data.fixedCosts.length > 0) ? (
                                <>
                                    {/* Group by category for Fijos & Marketing only */}
                                    {Object.entries(
                                        data.fixedCosts
                                        .filter(fc => !fc.type || fc.type === 'FIJO' || fc.type === 'MARKETING' || fc.type === 'OTRO')
                                        .reduce<Record<string, number>>((acc, fc) => {
                                            const cat = fc.name || FIXED_COST_CATEGORIES.find(c => c.id === fc.category)?.label || fc.category;
                                            acc[cat] = (acc[cat] || 0) + fc.amount;
                                            return acc;
                                        }, {})
                                    ).map(([cat, amount]) => (
                                        <PLRow key={cat} label={cat} value={-amount} color="text-orange-400" />
                                    ))}
                                </>
                            ) : (
                                <p className="text-[10px] text-stone-400 font-medium py-2 pl-2">Sin gastos operativos cargados</p>
                            )}

                            {/* ─ Resultado Neto ─ */}
                            <div className="border-t-2 border-stone-200 dark:border-stone-600 mt-4 pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-black text-stone-800 dark:text-white uppercase tracking-tight">Resultado Neto</span>
                                    <span className={`text-2xl font-black ${(s?.netProfit ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        ${(s?.netProfit ?? 0).toLocaleString()}
                                    </span>
                                </div>
                                {s.totalRevenue > 0 && (
                                    <div className="flex h-3 rounded-full overflow-hidden mt-3 bg-stone-100 dark:bg-stone-700">
                                        <div className="bg-red-400 transition-all" style={{ width: `${(s.totalCosts / s.totalRevenue) * 100}%` }} title="CMV" />
                                        <div className="bg-purple-400 transition-all" style={{ width: `${(s.totalPlatformFees / s.totalRevenue) * 100}%` }} title="Plataforma" />
                                        <div className="bg-pink-400 transition-all" style={{ width: `${(s.totalDoctorFees / s.totalRevenue) * 100}%` }} title="Médicos" />
                                        <div className="bg-orange-400 transition-all" style={{ width: `${((s.totalFixedCosts + (s.totalMarketingCosts || 0)) / s.totalRevenue) * 100}%` }} title="G. Op." />
                                        <div className="bg-emerald-500 transition-all" style={{ width: `${Math.max(0, (s.netProfit / s.totalRevenue) * 100)}%` }} title="Ganancia" />
                                    </div>
                                )}
                                <div className="flex gap-4 mt-2 flex-wrap">
                                    {[
                                        { color: 'bg-red-400', label: 'CMV' },
                                        { color: 'bg-purple-400', label: 'Plataforma' },
                                        { color: 'bg-pink-400', label: 'Médicos' },
                                        { color: 'bg-orange-400', label: 'Operativos' },
                                        { color: 'bg-emerald-500', label: 'Ganancia' },
                                    ].map(l => (
                                        <div key={l.label} className="flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full ${l.color}`} />
                                            <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">{l.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Billing Summary / Facturación AFIP */}
                        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-3xl p-6 shadow-xl shadow-stone-200/20 dark:shadow-none print:shadow-none print:border-stone-200 col-span-1 border-t-4 border-t-indigo-500">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center print:border print:border-indigo-100">
                                    <Receipt className="w-5 h-5 text-indigo-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-stone-800 dark:text-white leading-tight">Facturación AFIP</h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Total comprobantes C</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {data?.billingStats?.map(b => (
                                    <div key={b.account} className="flex flex-col p-4 bg-stone-50 dark:bg-stone-900/50 rounded-2xl border-2 border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-black text-stone-600 dark:text-stone-300 uppercase tracking-widest">{b.account}</span>
                                            <span className="text-lg font-black text-indigo-600">${b.total.toLocaleString()}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-stone-400 capitalize">{b.count} comprobante{b.count !== 1 ? 's' : ''} emitido{b.count !== 1 ? 's' : ''}</span>
                                    </div>
                                ))}
                                {(!data?.billingStats || data.billingStats.length === 0) && (
                                    <div className="text-center py-6 text-stone-400 text-xs font-bold bg-stone-50 dark:bg-stone-900/50 rounded-2xl">
                                        No hay facturas emitidas en este período
                                    </div>
                                )}
                                <div className="mt-4 pt-4 border-t-2 border-dashed border-stone-200 dark:border-stone-700 flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Suma Total Facturada</span>
                                    <span className="text-xl font-black text-stone-800 dark:text-white">
                                        ${((data?.billingStats || []).reduce((acc, curr) => acc + curr.total, 0)).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Formas de Pago */}
                        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <CreditCard className="w-5 h-5 text-blue-500" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Formas de Pago</h2>
                            </div>

                            {data?.paymentMethods && data.paymentMethods.length > 0 ? (
                                <div className="space-y-3">
                                    {data.paymentMethods.map(pm => (
                                        <div key={pm.method} className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-900 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all group">
                                            <div className="flex items-center gap-3">
                                                {pm.method.includes('CREDIT') || pm.method === 'PLAN_Z' ? (
                                                    <CreditCard className="w-5 h-5 text-purple-500" />
                                                ) : pm.method === 'CASH' ? (
                                                    <Banknote className="w-5 h-5 text-emerald-500" />
                                                ) : (
                                                    <CreditCard className="w-5 h-5 text-blue-500" />
                                                )}
                                                <div>
                                                    <span className="text-sm font-black text-stone-800 dark:text-white">
                                                        {METHOD_LABELS[pm.method] || pm.method}
                                                    </span>
                                                    <span className="text-[9px] text-stone-400 font-bold block tracking-widest uppercase">
                                                        {pm.count} pago{pm.count !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-stone-800 dark:text-white">${pm.total.toLocaleString()}</p>
                                                {pm.commission > 0 && (
                                                    <p className="text-[9px] font-bold text-purple-500 tracking-widest uppercase">
                                                        -{' '}${pm.commission.toLocaleString()} comisión
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-stone-300">
                                    <CreditCard className="w-10 h-10 mx-auto mb-3" />
                                    <p className="text-xs font-black uppercase tracking-widest">Sin pagos registrados</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Monthly Chart */}
                    {data?.monthlyStats && data.monthlyStats.length > 0 && (
                        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6 mb-8">
                            <div className="flex items-center gap-2 mb-8">
                                <BarChart3 className="w-5 h-5 text-primary" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Facturación vs Costos (Mensual)</h2>
                            </div>
                            <div className="flex items-end gap-4 h-56 px-2">
                                {data.monthlyStats.map(m => {
                                    const maxVal = Math.max(...data.monthlyStats.map(x => x.revenue));
                                    const revenueH = maxVal > 0 ? (m.revenue / maxVal) * 100 : 0;
                                    const costH = maxVal > 0 ? (m.cost / maxVal) * 100 : 0;
                                    return (
                                        <div key={m.month} className="flex-1 flex flex-col items-center gap-2 group">
                                            {/* Tooltip */}
                                            <div className="bg-stone-900 text-white text-[9px] font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 whitespace-nowrap z-20 shadow-xl text-center">
                                                <p>💰 ${m.revenue.toLocaleString()}</p>
                                                <p>📉 Costo: ${m.cost.toLocaleString()}</p>
                                                <p className="text-emerald-400">✅ Ganancia: ${m.profit.toLocaleString()}</p>
                                            </div>
                                            {/* Bars */}
                                            <div className="relative w-full flex justify-center flex-1 items-end gap-1">
                                                <div
                                                    className="w-[45%] bg-primary/20 group-hover:bg-primary/40 rounded-t-lg transition-all cursor-pointer"
                                                    style={{ height: `${Math.max(revenueH, 3)}%` }}
                                                    title={`Facturación: $${m.revenue.toLocaleString()}`}
                                                />
                                                <div
                                                    className="w-[45%] bg-red-200 dark:bg-red-900 group-hover:bg-red-300 dark:group-hover:bg-red-800 rounded-t-lg transition-all cursor-pointer"
                                                    style={{ height: `${Math.max(costH, 3)}%` }}
                                                    title={`Costos: $${m.cost.toLocaleString()}`}
                                                />
                                            </div>
                                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest group-hover:text-primary transition-colors">{m.month}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex gap-6 mt-4 justify-center">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded bg-primary/30" />
                                    <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Facturación</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded bg-red-200 dark:bg-red-900" />
                                    <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Costos</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lab Profit Report */}
                    {data?.labStats && data.labStats.length > 0 && (
                        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6 mb-8">
                            <div className="flex items-center gap-2 mb-6">
                                <FlaskConical className="w-5 h-5 text-cyan-500" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Rentabilidad por Laboratorio</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {data.labStats.map((lab, i) => {
                                    const margin = lab.revenue > 0 ? ((lab.revenue - lab.cost) / lab.revenue) * 100 : 0;
                                    const maxRevenue = Math.max(...data.labStats.map(l => l.revenue));
                                    const barPct = maxRevenue > 0 ? (lab.revenue / maxRevenue) * 100 : 0;
                                    return (
                                        <div key={lab.laboratory} className="relative p-5 bg-gradient-to-br from-stone-50 to-stone-100/50 dark:from-stone-900 dark:to-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-700 hover:shadow-md transition-all group overflow-hidden">
                                            {/* Background bar */}
                                            <div className="absolute bottom-0 left-0 h-1 bg-cyan-500/20 rounded-full transition-all" style={{ width: `${barPct}%` }} />

                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${i === 0 ? 'bg-cyan-500 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-500'}`}>
                                                        <FlaskConical className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-stone-800 dark:text-white text-sm block">{lab.laboratory}</span>
                                                        <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">{lab.ordersCount} venta{lab.ordersCount !== 1 ? 's' : ''}</span>
                                                    </div>
                                                </div>
                                                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${margin > 30 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : margin > 0 ? 'bg-amber-100 dark:bg-amber-950 text-amber-600' : 'bg-red-100 dark:bg-red-950 text-red-600'}`}>
                                                    {margin.toFixed(0)}%
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Costo</p>
                                                    <p className="text-base font-black text-red-500">${lab.cost.toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Facturación</p>
                                                    <p className="text-base font-black text-stone-800 dark:text-white">${lab.revenue.toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Ganancia</p>
                                                    <p className={`text-base font-black ${lab.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>${lab.profit.toLocaleString()}</p>
                                                </div>
                                            </div>

                                            {/* Margin bar */}
                                            <div className="mt-3 w-full bg-stone-200 dark:bg-stone-700 h-2 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-700 ${margin > 30 ? 'bg-emerald-500' : margin > 0 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(Math.max(margin, 0), 100)}%` }} />
                                            </div>

                                            {/* Clients Breakdown */}
                                            {lab.clients && lab.clients.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-700/50 max-h-48 overflow-y-auto custom-scrollbar">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr>
                                                                <th className="text-[8px] font-black text-stone-400 uppercase tracking-widest pb-2">Cliente / Producto</th>
                                                                <th className="text-[8px] font-black text-stone-400 uppercase tracking-widest pb-2 text-right">Costo</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {lab.clients.map((c, idx) => (
                                                                <tr key={idx} className="border-t border-stone-100 dark:border-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
                                                                    <td className="py-1.5 pr-2">
                                                                        <div className="text-[10px] font-bold text-stone-700 dark:text-stone-300 truncate max-w-[150px]">{c.name}</div>
                                                                        <div className="text-[8px] text-stone-400 truncate max-w-[150px]" title={c.product}>{c.product}</div>
                                                                    </td>
                                                                    <td className="py-1.5 text-[10px] font-black text-red-500 text-right">
                                                                        ${c.cost.toLocaleString()}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Top Clients & Top Products */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Clients */}
                        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Users className="w-5 h-5 text-amber-500" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Top Clientes</h2>
                            </div>
                            {data?.topClients && data.topClients.length > 0 ? (
                                <div className="space-y-2">
                                    {data.topClients.map((client, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-900 transition-all">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${i < 3 ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400' : 'bg-stone-100 dark:bg-stone-700 text-stone-400'}`}>
                                                    {i + 1}
                                                </span>
                                                <div>
                                                    <p className="text-sm font-bold text-stone-800 dark:text-white">{client.name}</p>
                                                    <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">{client.orders} compra{client.orders !== 1 ? 's' : ''}</p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-black text-stone-800 dark:text-white">${client.total.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptySection message="Sin datos de clientes" />
                            )}
                        </div>

                        {/* Top Products */}
                        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <ShoppingBag className="w-5 h-5 text-blue-500" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Productos Más Vendidos</h2>
                            </div>
                            {data?.topProducts && data.topProducts.length > 0 ? (
                                <div className="space-y-2">
                                    {data.topProducts.map((product, i) => {
                                        const margin = product.revenue > 0 ? ((product.revenue - product.cost) / product.revenue) * 100 : 0;
                                        return (
                                            <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-900 transition-all">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-stone-800 dark:text-white truncate">{product.name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">{product.type}</span>
                                                        <span className="text-[9px] text-stone-300">·</span>
                                                        <span className="text-[9px] text-stone-400 font-bold">{product.qty} u.</span>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0 ml-4">
                                                    <p className="text-sm font-black text-stone-800 dark:text-white">${product.revenue.toLocaleString()}</p>
                                                    <p className={`text-[9px] font-bold uppercase tracking-widest ${margin > 30 ? 'text-emerald-500' : margin > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                                                        {margin.toFixed(0)}% margen
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <EmptySection message="Sin datos de productos" />
                            )}
                        </div>
                    </div>

                    {/* Fixed Costs Section has been replaced by Gastos Page */}


                    {/* Doctor Commissions */}
                    <DoctorCommissions />

                    {/* Vendor Metrics */}
                    {data?.vendorStats && data.vendorStats.length > 0 && (
                        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6 mt-8">
                            <div className="flex items-center gap-2 mb-6">
                                <Award className="w-5 h-5 text-violet-500" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Rendimiento por Vendedor</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {data.vendorStats.map((v, i) => {
                                    const maxRev = Math.max(...data.vendorStats.map(x => x.revenue));
                                    const pct = maxRev > 0 ? (v.revenue / maxRev) * 100 : 0;
                                    return (
                                        <div key={i} className="relative p-5 bg-gradient-to-br from-stone-50 to-stone-100/50 dark:from-stone-900 dark:to-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-700 hover:shadow-md transition-all group overflow-hidden">
                                            {/* Background bar */}
                                            <div className="absolute bottom-0 left-0 h-1 bg-violet-500/20 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black ${i === 0 ? 'bg-violet-500 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-500'}`}>
                                                        {i + 1}
                                                    </div>
                                                    <span className="font-black text-stone-800 dark:text-white text-sm">{v.name}</span>
                                                </div>
                                                {i === 0 && <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest">Top</span>}
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Facturación</p>
                                                    <p className="text-lg font-black text-stone-800 dark:text-white">${v.revenue.toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Ventas</p>
                                                    <p className="text-lg font-black text-stone-800 dark:text-white">{v.orders}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Ticket Prom</p>
                                                    <p className="text-lg font-black text-stone-800 dark:text-white">${v.avgTicket.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </main>
    );
}

// ── Sub-components ─────────────────────────

function KPICard({ title, value, sub, icon: Icon, color, highlight }: any) {
    const colorMap: Record<string, string> = {
        stone: 'bg-stone-50 dark:bg-stone-700 text-stone-500',
        red: 'bg-red-50 dark:bg-red-950 text-red-500',
        emerald: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-500',
        blue: 'bg-blue-50 dark:bg-blue-950 text-blue-500',
    };

    return (
        <div className={`bg-white dark:bg-stone-800 border-2 rounded-2xl p-6 transition-all hover:shadow-lg ${highlight
            ? 'border-emerald-200 dark:border-emerald-800 ring-2 ring-emerald-100 dark:ring-emerald-900'
            : 'border-stone-100 dark:border-stone-700'
            }`}>
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-xl ${colorMap[color] || colorMap.stone}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{title}</span>
            </div>
            <p className={`text-2xl font-black tracking-tight ${highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-800 dark:text-white'}`}>
                {value}
            </p>
            <p className="text-[10px] font-bold text-stone-400 mt-1">{sub}</p>
        </div>
    );
}

function CostRow({ label, value, total, color, tooltip }: { label: string; value: number; total: number; color: string; tooltip?: string }) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="group" title={tooltip}>
            <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className="text-xs font-bold text-stone-600 dark:text-stone-300">{label}</span>
                    {tooltip && (
                        <span className="text-[8px] font-bold text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">{tooltip}</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-stone-800 dark:text-white">${value.toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-stone-400 w-12 text-right">{pct.toFixed(1)}%</span>
                </div>
            </div>
            <div className="w-full bg-stone-100 dark:bg-stone-700 h-2 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
        </div>
    );
}

function EmptySection({ message }: { message: string }) {
    return (
        <div className="text-center py-10 text-stone-300 dark:text-stone-600">
            <Minus className="w-8 h-8 mx-auto mb-2" />
            <p className="text-xs font-black uppercase tracking-widest">{message}</p>
        </div>
    );
}

function FixedCostsSection({ fixedCosts, onRefresh }: { fixedCosts: FixedCost[]; onRefresh: () => void }) {
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        amount: '',
        category: 'OTRO',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        notes: '',
    });

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.amount) return;
        setLoading(true);
        try {
            const res = await fetch('/api/fixed-costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    amount: Number(form.amount),
                }),
            });
            if (res.ok) {
                setForm({ name: '', amount: '', category: 'OTRO', month: new Date().getMonth() + 1, year: new Date().getFullYear(), notes: '' });
                setShowForm(false);
                onRefresh();
            }
        } catch (err) {
            console.error('Error adding fixed cost:', err);
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este gasto fijo?')) return;
        try {
            await fetch(`/api/fixed-costs/${id}`, { method: 'DELETE' });
            onRefresh();
        } catch (err) {
            console.error('Error deleting fixed cost:', err);
        }
    };

    const total = fixedCosts.reduce((s, fc) => s + fc.amount, 0);
    const monthNames = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    return (
        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6 mt-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-orange-500" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Gastos Fijos del Período</h2>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-orange-500">Total: ${total.toLocaleString()}</span>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="p-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all hover:scale-105"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Add Form */}
            {showForm && (
                <form onSubmit={handleAdd} className="mb-6 p-5 bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-700 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Nombre *</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="Ej: Alquiler"
                                className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold text-stone-800 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/20"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Monto *</label>
                            <input
                                type="number"
                                value={form.amount}
                                onChange={e => setForm({ ...form, amount: e.target.value })}
                                placeholder="0"
                                className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold text-stone-800 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/20"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Categoría</label>
                            <select
                                value={form.category}
                                onChange={e => setForm({ ...form, category: e.target.value })}
                                className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold text-stone-800 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/20"
                            >
                                {FIXED_COST_CATEGORIES.map(c => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Mes / Año</label>
                            <div className="flex gap-2">
                                <select
                                    value={form.month}
                                    onChange={e => setForm({ ...form, month: Number(e.target.value) })}
                                    className="flex-1 px-2 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold text-stone-800 dark:text-white outline-none"
                                >
                                    {monthNames.slice(1).map((m, i) => (
                                        <option key={i+1} value={i+1}>{m}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    value={form.year}
                                    onChange={e => setForm({ ...form, year: Number(e.target.value) })}
                                    className="w-20 px-2 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold text-stone-800 dark:text-white outline-none"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            placeholder="Notas (opcional)"
                            className="flex-1 px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold text-stone-800 dark:text-white outline-none"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-600 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Agregar'}
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            {fixedCosts.length > 0 ? (
                <div className="space-y-2">
                    {fixedCosts.map(fc => (
                        <div key={fc.id} className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-900 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-950 rounded-lg flex items-center justify-center">
                                    <Receipt className="w-4 h-4 text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-stone-800 dark:text-white">{fc.name}</p>
                                    <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">
                                        {FIXED_COST_CATEGORIES.find(c => c.id === fc.category)?.label || fc.category} · {monthNames[fc.month]} {fc.year}
                                        {fc.notes ? ` · ${fc.notes}` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-black text-orange-500">${fc.amount.toLocaleString()}</span>
                                <button
                                    onClick={() => handleDelete(fc.id)}
                                    className="p-1.5 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8 text-stone-300 dark:text-stone-600">
                    <Building2 className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs font-black uppercase tracking-widest">Sin gastos fijos cargados</p>
                    <p className="text-[9px] text-stone-400 mt-1">Agregá contadora, alquiler, sueldos, etc.</p>
                </div>
            )}
        </div>
    );
}

function PLRow({ label, value, bold, accent, color, sub }: {
    label: string;
    value: number;
    bold?: boolean;
    accent?: string;
    color?: string;
    sub?: string;
}) {
    const textColor = accent || color || 'text-stone-600 dark:text-stone-300';
    return (
        <div className={`flex justify-between items-center py-1.5 ${bold ? '' : 'pl-3'}`}>
            <div className="flex items-center gap-2">
                <span className={`text-xs ${bold ? 'font-black' : 'font-medium'} ${bold ? (accent || 'text-stone-800 dark:text-white') : 'text-stone-500 dark:text-stone-400'}`}>
                    {label}
                </span>
                {sub && <span className="text-[8px] text-stone-400 font-medium">{sub}</span>}
            </div>
            <span className={`text-sm ${bold ? 'font-black' : 'font-bold'} ${textColor} tabular-nums`}>
                {value < 0 ? '-' : ''}${Math.abs(value).toLocaleString()}
            </span>
        </div>
    );
}
