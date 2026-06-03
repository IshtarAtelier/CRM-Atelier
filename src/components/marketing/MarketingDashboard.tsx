'use client';

import { useState, useEffect } from 'react';
import { 
    Megaphone, Target, TrendingUp, DollarSign, Users, 
    MousePointerClick, Search, RefreshCw, BarChart3, AlertCircle, Loader2
} from 'lucide-react';

export function MarketingDashboard() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/marketing/dashboard');
            const json = await res.json();
            if (json.success) {
                setData(json.data);
            } else {
                setError(json.error || 'Error al cargar datos');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 text-red-500 rounded-2xl">
                <p className="font-bold">Error: {error}</p>
                <button onClick={fetchDashboardData} className="mt-2 text-sm underline">Reintentar</button>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12 mt-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/50 dark:bg-[#1C1816]/50 backdrop-blur-md p-6 rounded-3xl border border-stone-200 dark:border-white/5 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-indigo-500" /> Rendimiento de Marketing
                    </h2>
                    <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
                        Control de inversión, CAC y atribución de ventas en tiempo real (Mes actual)
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={fetchDashboardData}
                        className="p-3 text-stone-500 hover:text-indigo-500 bg-stone-100 dark:bg-stone-800 hover:bg-indigo-500/10 rounded-xl transition-colors"
                        title="Actualizar Datos API"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Aviso de Conexión Parcial */}
            {(!data.isMetaConnected || !data.isGoogleConnected) && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider">APIs Publicitarias no conectadas</h4>
                        <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 font-bold">
                            Los datos de ventas y conversión son reales (extraídos de tu base de datos), pero los gastos en inversión muestran una simulación hasta que configures el Account ID de Meta y el Token de Desarrollador de Google Ads.
                        </p>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#1C1816] border border-stone-200 dark:border-white/5 rounded-3xl p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Inversión Mensual</p>
                        <p className="text-3xl font-black text-stone-800 dark:text-white">${data.totalSpent.toLocaleString()}</p>
                        <p className="text-xs font-bold text-stone-500 mt-2">Google: ${data.googleSpent.toLocaleString()} | Meta: ${data.metaSpent.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1C1816] border border-stone-200 dark:border-white/5 rounded-3xl p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">ROAS Global</p>
                        <p className="text-3xl font-black text-stone-800 dark:text-white">{data.roas}x</p>
                        <p className="text-xs font-bold text-emerald-500 mt-2">Facturación Bruta: ${data.totalSales.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1C1816] border border-stone-200 dark:border-white/5 rounded-3xl p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                            <Users className="w-6 h-6 text-amber-500" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">CAC Promedio</p>
                        <p className="text-3xl font-black text-stone-800 dark:text-white">${data.cac.toLocaleString()}</p>
                        <p className="text-xs font-bold text-stone-500 mt-2">Gasto Total / {data.ordersCount} ventas reales</p>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 border border-indigo-400 rounded-3xl p-6 shadow-lg shadow-indigo-500/20 text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                            <Target className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest mb-1">Ventas Atribuidas a Ads</p>
                        <p className="text-3xl font-black text-white">{data.adsAttributedOrders} / {data.ordersCount}</p>
                        <p className="text-xs font-bold text-indigo-100 mt-2">{data.ordersCount > 0 ? Math.round((data.adsAttributedOrders / data.ordersCount) * 100) : 0}% de las ventas del mes</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Atribución por Origen */}
                <div className="bg-white dark:bg-[#1C1816] border border-stone-200 dark:border-white/5 rounded-3xl p-6 xl:col-span-1 shadow-sm">
                    <div className="flex items-center gap-2 mb-8">
                        <Megaphone className="w-5 h-5 text-stone-500" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Origen de Ventas (Atribución)</h2>
                    </div>
                    <div className="space-y-4">
                        {data.sources.length === 0 ? (
                            <div className="text-center py-6 text-stone-400 text-sm">No hay ventas este mes</div>
                        ) : data.sources.map((source: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-stone-50 dark:bg-white/5 rounded-2xl">
                                <div>
                                    <p className="text-sm font-bold text-stone-800 dark:text-white">{source.name}</p>
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">
                                        {source.orders} ventas
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-black text-stone-800 dark:text-white">
                                        ${source.revenue.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Rendimiento de Campañas */}
                <div className="bg-white dark:bg-[#1C1816] border border-stone-200 dark:border-white/5 rounded-3xl p-6 xl:col-span-2 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-2">
                            <MousePointerClick className="w-5 h-5 text-stone-500" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Rendimiento por Campaña (APIs)</h2>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left min-w-[600px]">
                            <thead>
                                <tr>
                                    <th className="text-[10px] font-black text-stone-400 uppercase tracking-widest pb-4 pl-2">Campaña</th>
                                    <th className="text-[10px] font-black text-stone-400 uppercase tracking-widest pb-4">Inversión</th>
                                    <th className="text-[10px] font-black text-stone-400 uppercase tracking-widest pb-4">Clics / Leads</th>
                                    <th className="text-[10px] font-black text-stone-400 uppercase tracking-widest pb-4">Ventas CRM</th>
                                    <th className="text-[10px] font-black text-stone-400 uppercase tracking-widest pb-4 text-right pr-2">ROAS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.campaigns.map((camp: any, i: number) => (
                                    <tr key={i} className="border-t border-stone-100 dark:border-white/5 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="py-4 pl-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${camp.platform === 'Google' ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400'}`}>
                                                    <Search className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-stone-800 dark:text-white line-clamp-1">{camp.name}</p>
                                                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mt-1">{camp.platform}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <p className="text-sm font-black text-stone-800 dark:text-white">${camp.spent.toLocaleString()}</p>
                                        </td>
                                        <td className="py-4">
                                            <p className="text-sm font-bold text-stone-600 dark:text-stone-300">{camp.clicks}</p>
                                            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mt-1">{camp.leads} leads</p>
                                        </td>
                                        <td className="py-4">
                                            <div className="inline-flex items-center px-3 py-1.5 bg-stone-100 dark:bg-white/10 rounded-lg">
                                                <span className="text-xs font-black text-stone-800 dark:text-white">{camp.sales}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 text-right pr-2">
                                            <p className={`text-sm font-black ${camp.roas > 1 ? 'text-emerald-500' : 'text-red-500'}`}>{camp.roas}x</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
