'use client';

import { useState, useEffect } from 'react';
import {
    FileText, TrendingUp, DollarSign, Package, ArrowDown, RefreshCw, AlertCircle, Save, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';

import { KPICard } from '@/components/admin/reports/KPICard';
import { CostRow as ProfitLossChart } from '@/components/admin/reports/ProfitLossChart';
import { SalesDetailSection } from '@/components/admin/reports/SalesDetailSection';
import { TopPerformersSection } from '@/components/admin/reports/TopPerformersSection';
import { LaboratoryStats } from '@/components/admin/reports/LaboratoryStats';
import { VendorMetrics } from '@/components/admin/reports/VendorMetrics';
import DoctorCommissions from '@/components/admin/DoctorCommissions';

// ── Types ─────────────────────────────────────

export interface FixedCost {
    id: string;
    name: string;
    amount: number;
    category: string;
    month: number;
    year: number;
    notes?: string;
    type?: string;
}

export interface SaleDetailItem {
    name: string;
    type: string;
    eye?: string;
    price: number;
    cost: number;
    lab?: string;
    is2x1Free?: boolean;
}

export interface SaleDetail {
    id: string;
    fullId: string;
    date: string;
    month: string;
    clientName: string;
    vendorName: string;
    orderType: string;
    totalPaid: number;
    totalList: number;
    cmv: number;
    platformFee: number;
    doctorFee: number;
    specialDiscount: number;
    appliedPromo?: string;
    discounts: { cash: number; transfer: number; card: number; general: number };
    markup: number;
    netProfit: number;
    profitMargin: number;
    hasInvoice: boolean;
    paymentMethods: string[];
    items: SaleDetailItem[];
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
        totalPostSaleCosts?: number;
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
    salesDetail: SaleDetail[];
}

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

const STORAGE_KEY = 'atelier_reportes_state';

export default function ReportsDashboard() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activePreset, setActivePreset] = useState('month');
    const [saved, setSaved] = useState(false);

    // Restore saved state or default to current month
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                if (s.dateFrom && s.dateTo) {
                    setDateFrom(s.dateFrom);
                    setDateTo(s.dateTo);
                    setActivePreset(s.activePreset || '');
                    fetchReport(s.dateFrom, s.dateTo);
                    return;
                }
            }
        } catch { }
        const { from, to } = getPresetDates('month');
        setDateFrom(from);
        setDateTo(to);
        fetchReport(from, to);
    }, []);

    // Auto-save filters to localStorage
    useEffect(() => {
        if (dateFrom && dateTo) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ dateFrom, dateTo, activePreset }));
        }
    }, [dateFrom, dateTo, activePreset]);

    const fetchReport = async (from?: string, to?: string) => {
        setLoading(true);
        try {
            const f = from || dateFrom;
            const t = to || dateTo;
            const params = new URLSearchParams();
            if (f) params.append('from', f);
            if (t) params.append('to', t);

            const res = await fetch(`/api/reports?${params.toString()}`);
            if (res.ok) {
                const report = await res.json();
                setData(report);
            }
        } catch (err) {
            console.error('Error fetching report', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyFilter = () => {
        setActivePreset('');
        fetchReport();
    };

    const handlePreset = (preset: string) => {
        setActivePreset(preset);
        const { from, to } = getPresetDates(preset);
        setDateFrom(from);
        setDateTo(to);
        fetchReport(from, to);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0
        }).format(val || 0);
    };

    return (
        <main className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 pb-32">
            {/* ── Header & Filters ── */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 print:hidden">
                <div>
                    <h1 className="text-3xl font-black text-stone-800 dark:text-white tracking-tight">Reporte Financiero</h1>
                    <p className="text-stone-500 dark:text-stone-400 mt-2 font-medium">Análisis de rentabilidad, P&L y métricas operativas.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/80 dark:bg-stone-800/80 p-3 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 backdrop-blur-xl shadow-lg shadow-stone-200/20 dark:shadow-none">
                    <div className="flex items-center gap-2 bg-stone-100/50 dark:bg-stone-900/50 p-1.5 rounded-xl">
                        <button
                            onClick={() => handlePreset('month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activePreset === 'month' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
                        >
                            Mes
                        </button>
                        <button
                            onClick={() => handlePreset('last_month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activePreset === 'last_month' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
                        >
                            Mes Ant.
                        </button>
                        <button
                            onClick={() => handlePreset('quarter')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activePreset === 'quarter' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
                        >
                            Trimestre
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setActivePreset(''); }}
                            className="px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-800 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="text-stone-400 font-bold">-</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setActivePreset(''); }}
                            className="px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-800 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                            onClick={handleApplyFilter}
                            disabled={loading}
                            className="p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 hover:shadow-primary/40"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => {
                                localStorage.setItem(STORAGE_KEY, JSON.stringify({ dateFrom, dateTo, activePreset }));
                                setSaved(true);
                                setTimeout(() => setSaved(false), 2500);
                            }}
                            className={`p-2 rounded-xl transition-all flex items-center gap-1.5 ${saved
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600'
                            }`}
                            title="Guardar filtros para no perderlos"
                        >
                            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {loading && !data ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            ) : !data ? (
                <div className="flex flex-col items-center justify-center h-64 text-stone-400 gap-3">
                    <AlertCircle className="w-10 h-10 text-stone-300" />
                    <p className="font-bold text-sm tracking-widest uppercase">Sin datos para mostrar</p>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both space-y-8">
                    
                    {/* ── KPIs Principales ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KPICard
                            title="Ingreso Real (Cobrado)"
                            value={formatCurrency(data.summary.totalRevenue)}
                            sub={`Pendiente de cobro: ${formatCurrency(data.summary.totalPending)}`}
                            icon={DollarSign}
                            color="blue"
                        />
                        <KPICard
                            title="Costos y Gastos Totales"
                            value={formatCurrency(data.summary.totalCosts)}
                            sub="Operativos, Proveedores, Comisiones"
                            icon={ArrowDown}
                            color="red"
                        />
                        <KPICard
                            title="Resultado Neto"
                            value={formatCurrency(data.summary.netProfit)}
                            sub={`Margen: ${data.summary.profitMargin.toFixed(1)}%`}
                            icon={data.summary.netProfit >= 0 ? TrendingUp : ArrowDown}
                            color={data.summary.netProfit >= 0 ? 'emerald' : 'red'}
                            highlight={data.summary.netProfit >= 0}
                        />
                        <KPICard
                            title="Operaciones"
                            value={data.summary.ordersCount}
                            sub={`Ticket prom: ${formatCurrency(data.summary.ordersCount > 0 ? data.summary.totalRevenue / data.summary.ordersCount : 0)}`}
                            icon={Package}
                            color="purple"
                        />
                    </div>

                    {/* ── Estado de Resultados (P&L Breakdown) ── */}
                    <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border border-stone-200/60 dark:border-stone-700/60 rounded-3xl p-6 lg:p-8 shadow-xl shadow-stone-200/20 dark:shadow-none">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">P&L Breakdown</h2>
                                <p className="text-xl font-black text-stone-800 dark:text-white tracking-tight">Estado de Resultados</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <ProfitLossChart 
                                label="Costo Cristales / Lentes" 
                                value={data.summary.totalCostLenses} 
                                total={data.summary.totalRevenue} 
                                color="bg-cyan-500" 
                            />
                            <ProfitLossChart 
                                label="Costo Armazones / Sol" 
                                value={data.summary.totalCostFrames} 
                                total={data.summary.totalRevenue} 
                                color="bg-amber-500" 
                            />
                            <ProfitLossChart 
                                label="Costos Operativos Fijos" 
                                value={data.summary.totalFixedCosts} 
                                total={data.summary.totalRevenue} 
                                color="bg-orange-500" 
                            />
                            {data.summary.totalMarketingCosts ? (
                                <ProfitLossChart 
                                    label="Gastos de Marketing / Ads" 
                                    value={data.summary.totalMarketingCosts} 
                                    total={data.summary.totalRevenue} 
                                    color="bg-pink-500" 
                                />
                            ) : null}
                            <ProfitLossChart 
                                label="Comisiones Médicos" 
                                value={data.summary.totalDoctorFees} 
                                total={data.summary.totalRevenue} 
                                color="bg-rose-500" 
                            />
                            <ProfitLossChart 
                                label="Comisiones Plataforma" 
                                value={data.summary.totalPlatformFees} 
                                total={data.summary.totalRevenue} 
                                color="bg-purple-500" 
                                tooltip="Comisiones PayWay, GoCuotas, etc." 
                            />
                            {data.summary.totalPostSaleCosts ? (
                                <ProfitLossChart 
                                    label="Costos de Post-Venta / Garantías" 
                                    value={data.summary.totalPostSaleCosts} 
                                    total={data.summary.totalRevenue} 
                                    color="bg-amber-600" 
                                />
                            ) : null}
                        </div>
                    </div>

                    {/* ── Tablas Expandibles de Ventas ── */}
                    {data.salesDetail && data.salesDetail.length > 0 && (
                        <SalesDetailSection salesDetail={data.salesDetail} />
                    )}

                    {/* ── Top Clientes & Top Productos ── */}
                    <TopPerformersSection topClients={data.topClients} topProducts={data.topProducts} />

                    {/* ── Laboratorios ── */}
                    {data.labStats && data.labStats.length > 0 && (
                        <LaboratoryStats data={data.labStats.map(lab => ({
                            name: lab.laboratory,
                            cost: lab.cost,
                            revenue: lab.revenue,
                            profit: lab.profit,
                            clients: lab.clients || []
                        }))} />
                    )}

                    {/* ── Honorarios Médicos Pendientes ── */}
                    <DoctorCommissions />

                    {/* ── Rendimiento Vendedores ── */}
                    {data.vendorStats && data.vendorStats.length > 0 && (
                        <VendorMetrics data={data.vendorStats} />
                    )}
                </div>
            )}
        </main>
    );
}
