'use client';

import { useState, useEffect } from 'react';
import {
    FileText, TrendingUp, DollarSign, ShoppingBag, Users, Package,
    Calendar, ArrowDown, ArrowUp, Minus, Loader2, CreditCard, Banknote,
    PieChart, BarChart3, Printer, RefreshCw, ChevronDown, Award
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import DoctorCommissions from '@/components/DoctorCommissions';

// ── Types ─────────────────────────────────────

interface ReportData {
    summary: {
        totalRevenue: number;
        totalCosts: number;
        totalCostFrames: number;
        totalCostLenses: number;
        totalCostOther: number;
        totalPlatformFees: number;
        netProfit: number;
        profitMargin: number;
        totalPaid: number;
        totalPending: number;
        ordersCount: number;
    };
    topClients: { name: string; total: number; orders: number }[];
    topProducts: { name: string; type: string; qty: number; revenue: number; cost: number }[];
    vendorStats: { name: string; revenue: number; orders: number; avgTicket: number }[];
    monthlyStats: { month: string; revenue: number; cost: number; profit: number; orders: number }[];
    paymentMethods: { method: string; total: number; count: number; commission: number }[];
}

const METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    DEBIT: 'Débito',
    CREDIT: 'Crédito (1 pago)',
    CREDIT_3: '3 Cuotas S/I',
    CREDIT_6: '6 Cuotas S/I',
    PLAN_Z: 'Plan Z',
    TRANSFER: 'Transferencia',
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
            setData(json);
        } catch (error) {
            console.error('Error fetching report:', error);
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
            <main className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
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

            {/* KPI Cards */}
            {s && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <KPICard
                            title="Facturación Total"
                            value={`$${s.totalRevenue.toLocaleString()}`}
                            sub={`${s.ordersCount} operaciones`}
                            icon={DollarSign}
                            color="stone"
                        />
                        <KPICard
                            title="Costos Totales"
                            value={`$${s.totalCosts.toLocaleString()}`}
                            sub={`+ $${s.totalPlatformFees.toLocaleString()} comisiones`}
                            icon={ArrowDown}
                            color="red"
                        />
                        <KPICard
                            title="Ganancia Neta"
                            value={`$${s.netProfit.toLocaleString()}`}
                            sub={`${s.profitMargin.toFixed(1)}% margen`}
                            icon={TrendingUp}
                            color="emerald"
                            highlight
                        />
                        <KPICard
                            title="Cobrado / Pendiente"
                            value={`$${s.totalPaid.toLocaleString()}`}
                            sub={`$${s.totalPending.toLocaleString()} pendiente`}
                            icon={CreditCard}
                            color="blue"
                        />
                    </div>

                    {/* Cost Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Desglose de Costos */}
                        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <PieChart className="w-5 h-5 text-red-500" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Desglose de Costos</h2>
                            </div>

                            <div className="space-y-4">
                                <CostRow
                                    label="Costo Armazones / Sol"
                                    value={s.totalCostFrames}
                                    total={s.totalRevenue}
                                    color="bg-amber-500"
                                />
                                <CostRow
                                    label="Costo Cristales / Lentes"
                                    value={s.totalCostLenses}
                                    total={s.totalRevenue}
                                    color="bg-blue-500"
                                />
                                <CostRow
                                    label="Otros Costos"
                                    value={s.totalCostOther}
                                    total={s.totalRevenue}
                                    color="bg-stone-400"
                                />
                                <CostRow
                                    label="Comisiones Plataforma"
                                    value={s.totalPlatformFees}
                                    total={s.totalRevenue}
                                    color="bg-purple-500"
                                    tooltip="3 cuotas: 10% · 6 cuotas / Plan Z: 20%"
                                />

                                <div className="border-t-2 border-stone-100 dark:border-stone-700 pt-4 mt-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-black text-stone-800 dark:text-white uppercase tracking-tight">Ganancia Neta</span>
                                        <span className={`text-xl font-black ${s.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            ${s.netProfit.toLocaleString()}
                                        </span>
                                    </div>
                                    {/* Visual breakdown bar */}
                                    <div className="flex h-4 rounded-full overflow-hidden mt-3 bg-stone-100 dark:bg-stone-700">
                                        {s.totalRevenue > 0 && (
                                            <>
                                                <div className="bg-amber-500 transition-all" style={{ width: `${(s.totalCostFrames / s.totalRevenue) * 100}%` }} title="Armazones" />
                                                <div className="bg-blue-500 transition-all" style={{ width: `${(s.totalCostLenses / s.totalRevenue) * 100}%` }} title="Cristales" />
                                                <div className="bg-stone-400 transition-all" style={{ width: `${(s.totalCostOther / s.totalRevenue) * 100}%` }} title="Otros" />
                                                <div className="bg-purple-500 transition-all" style={{ width: `${(s.totalPlatformFees / s.totalRevenue) * 100}%` }} title="Comisiones" />
                                                <div className="bg-emerald-500 transition-all" style={{ width: `${Math.max(0, (s.netProfit / s.totalRevenue) * 100)}%` }} title="Ganancia" />
                                            </>
                                        )}
                                    </div>
                                    <div className="flex gap-4 mt-2 flex-wrap">
                                        {[
                                            { color: 'bg-amber-500', label: 'Armazones' },
                                            { color: 'bg-blue-500', label: 'Cristales' },
                                            { color: 'bg-stone-400', label: 'Otros' },
                                            { color: 'bg-purple-500', label: 'Comisiones' },
                                            { color: 'bg-emerald-500', label: 'Ganancia' },
                                        ].map(l => (
                                            <div key={l.label} className="flex items-center gap-1.5">
                                                <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                                                <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">{l.label}</span>
                                            </div>
                                        ))}
                                    </div>
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
