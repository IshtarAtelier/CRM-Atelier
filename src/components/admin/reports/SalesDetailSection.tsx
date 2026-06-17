import React, { useState, useEffect } from 'react';
import { List, ChevronRight } from 'lucide-react';

interface SaleItem {
    name: string;
    type: string;
    eye?: string;
    lab?: string;
    price: number;
    cost: number;
    is2x1Free?: boolean;
}

interface SaleDetail {
    id: string;
    fullId: string;
    date: string;
    clientName: string;
    vendorName: string;
    orderType: string;
    totalPaid: number;
    cmv: number;
    platformFee: number;
    doctorFee: number;
    specialDiscount: number;
    netProfit: number;
    profitMargin: number;
    month: string;
    items: SaleItem[];
    paymentMethods: string[];
    hasInvoice: boolean;
    discounts: {
        cash: number;
        transfer: number;
        card: number;
        general: number;
    };
    appliedPromo?: string;
    markup: number;
}

const ORDER_TYPE_COLORS: Record<string, string> = {
    'ARM+CRIS': 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800',
    'CRISTAL': 'bg-cyan-100 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800',
    'ARMAZÓN': 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
    'OTRO': 'bg-stone-100 dark:bg-stone-800/50 text-stone-500 border border-stone-200 dark:border-stone-700',
};

const ORDER_TYPE_SORT: Record<string, number> = {
    'ARM+CRIS': 0,
    'CRISTAL': 1,
    'ARMAZÓN': 2,
    'OTRO': 3,
};

const METHOD_LABELS: Record<string, string> = {
    'CASH': 'Efectivo',
    'TRANSFER': 'Transf.',
    'CREDIT_CARD': 'T.Crédito',
    'DEBIT_CARD': 'T.Débito',
    'GOCUOTAS': 'GoCuotas',
};

export function SalesDetailSection({ salesDetail }: { salesDetail: SaleDetail[] }) {
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [sortBy, setSortBy] = useState<'type' | 'date' | 'profit'>('type');

    // Group by month
    const months = salesDetail.reduce<Record<string, SaleDetail[]>>((acc, sale) => {
        if (!acc[sale.month]) acc[sale.month] = [];
        acc[sale.month].push(sale);
        return acc;
    }, {});

    useEffect(() => {
        const keys = Object.keys(months);
        if (keys.length > 0 && Object.keys(expandedMonths).length === 0) {
            setExpandedMonths({ [keys[0]]: true });
        }
     
    }, [salesDetail]);

    const toggleMonth = (month: string) => {
        setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
    };

    const sortSales = (sales: SaleDetail[]) => {
        return [...sales].sort((a, b) => {
            if (sortBy === 'type') return (ORDER_TYPE_SORT[a.orderType] ?? 9) - (ORDER_TYPE_SORT[b.orderType] ?? 9);
            if (sortBy === 'profit') return b.netProfit - a.netProfit;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    };

    return (
        <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border border-stone-200/60 dark:border-stone-700/60 rounded-3xl p-6 lg:p-8 mb-8 shadow-xl shadow-stone-200/20 dark:shadow-none print:break-before-page">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                        <List className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Detalle Operativo</h2>
                        <p className="text-xl font-black text-stone-800 dark:text-white tracking-tight">Ventas por Mes</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-900/50 p-1.5 rounded-xl border border-stone-100 dark:border-stone-800 print:hidden">
                    {([
                        { key: 'type' as const, label: 'Tipo' },
                        { key: 'date' as const, label: 'Fecha' },
                        { key: 'profit' as const, label: 'Ganancia' },
                    ]).map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setSortBy(opt.key)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                                sortBy === opt.key
                                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-sm'
                                    : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-6">
                {Object.entries(months).map(([month, sales]) => {
                    const isOpen = expandedMonths[month];
                    const sorted = sortSales(sales);
                    const monthRevenue = sales.reduce((s, sale) => s + sale.totalPaid, 0);
                    const monthProfit = sales.reduce((s, sale) => s + sale.netProfit, 0);
                    const monthCMV = sales.reduce((s, sale) => s + sale.cmv, 0);

                    return (
                        <div key={month} className="group border border-stone-200/80 dark:border-stone-700/80 rounded-2xl overflow-hidden bg-white dark:bg-stone-900/40 shadow-sm hover:shadow-md transition-shadow duration-300">
                            {/* Month Header */}
                            <button
                                onClick={() => toggleMonth(month)}
                                className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gradient-to-r hover:from-stone-50 hover:to-white dark:hover:from-stone-800/50 dark:hover:to-stone-900/50 transition-all text-left gap-4"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg transition-colors duration-300 ${isOpen ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 text-stone-400 dark:bg-stone-800'}`}>
                                        <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
                                    </div>
                                    <div>
                                        <span className="text-lg font-black text-stone-800 dark:text-white tracking-tight block">{month}</span>
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{sales.length} operacion{sales.length !== 1 ? 'es' : ''}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 text-right sm:pr-4">
                                    <div className="hidden sm:block">
                                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1">Ingreso</p>
                                        <p className="text-base font-black text-stone-800 dark:text-white">${monthRevenue.toLocaleString()}</p>
                                    </div>
                                    <div className="hidden sm:block">
                                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1">Costo</p>
                                        <p className="text-base font-black text-red-500">${monthCMV.toLocaleString()}</p>
                                    </div>
                                    <div className="pl-6 border-l border-stone-100 dark:border-stone-800">
                                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1">Ganancia Neta</p>
                                        <p className={`text-xl font-black tracking-tight ${monthProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>${monthProfit.toLocaleString()}</p>
                                    </div>
                                </div>
                            </button>

                            {/* Sales Table */}
                            {isOpen && (
                                <div className="overflow-x-auto border-t border-stone-100 dark:border-stone-800">
                                    <table className="w-full text-left min-w-[900px]">
                                        <thead>
                                            <tr className="bg-stone-50/50 dark:bg-stone-900/50">
                                                <th className="pl-4 pr-2 py-3 text-[9px] font-black text-stone-400 uppercase tracking-widest w-8"></th>
                                                <th className="px-3 py-3 text-[9px] font-black text-stone-400 uppercase tracking-widest">Fecha / #OP</th>
                                                <th className="px-3 py-3 text-[9px] font-black text-stone-400 uppercase tracking-widest">Cliente / Vendedor</th>
                                                <th className="px-3 py-3 text-[9px] font-black text-stone-400 uppercase tracking-widest text-center">Tipo</th>
                                                <th className="px-3 py-3 text-[9px] font-black text-stone-400 uppercase tracking-widest text-right">Ingreso</th>
                                                <th className="px-3 py-3 text-[9px] font-black text-stone-400 uppercase tracking-widest text-right">Costo</th>
                                                <th className="px-3 py-3 text-[9px] font-black text-stone-400 uppercase tracking-widest text-right">Comisiones</th>
                                                <th className="px-3 py-3 text-[9px] font-black text-stone-400 uppercase tracking-widest text-right">Descuentos</th>
                                                <th className="px-4 py-3 text-[9px] font-black text-stone-400 uppercase tracking-widest text-right">Ganancia</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sorted.map(sale => (
                                                <SaleRow
                                                    key={sale.fullId}
                                                    sale={sale}
                                                    isExpanded={!!expandedRows[sale.fullId]}
                                                    onToggle={() => setExpandedRows(prev => ({ ...prev, [sale.fullId]: !prev[sale.fullId] }))}
                                                />
                                            ))}
                                        </tbody>
                                        {/* Month Totals Footer */}
                                        <tfoot>
                                            <tr className="bg-stone-100/50 dark:bg-stone-800/50 border-t-2 border-stone-200 dark:border-stone-700">
                                                <td colSpan={4} className="px-4 py-4 text-xs font-black text-stone-800 dark:text-white uppercase tracking-widest">
                                                    Total Consolidado
                                                </td>
                                                <td className="px-3 py-4 text-sm font-black text-stone-800 dark:text-white text-right">${monthRevenue.toLocaleString()}</td>
                                                <td className="px-3 py-4 text-sm font-black text-red-500 text-right">${monthCMV.toLocaleString()}</td>
                                                <td className="px-3 py-4 text-xs font-bold text-stone-500 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        {sales.reduce((s, sale) => s + sale.platformFee, 0) > 0 && (
                                                            <span className="text-purple-500">Plat: ${sales.reduce((s, sale) => s + sale.platformFee, 0).toLocaleString()}</span>
                                                        )}
                                                        {sales.reduce((s, sale) => s + sale.doctorFee, 0) > 0 && (
                                                            <span className="text-pink-500">Med: ${sales.reduce((s, sale) => s + sale.doctorFee, 0).toLocaleString()}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-xs font-bold text-stone-500 text-right">
                                                    <span className="text-orange-500">${sales.reduce((s, sale) => s + sale.specialDiscount, 0).toLocaleString()}</span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`text-base font-black ${monthProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            ${monthProfit.toLocaleString()}
                                                        </span>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md mt-1 ${monthProfit >= 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'}`}>
                                                            {monthRevenue > 0 ? ((monthProfit / monthRevenue) * 100).toFixed(1) : 0}% margen
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function SaleRow({ sale, isExpanded, onToggle }: {
    sale: SaleDetail;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const formatDate = (d: string) => {
        try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); }
        catch { return d; }
    };

    const getDiscountLabel = (sale: SaleDetail): string => {
        const parts: string[] = [];
        if (sale.discounts.cash > 0) parts.push(`${sale.discounts.cash}% ef`);
        if (sale.discounts.transfer > 0) parts.push(`${sale.discounts.transfer}% tr`);
        if (sale.discounts.card > 0) parts.push(`${sale.discounts.card}% tj`);
        if (sale.discounts.general > 0) parts.push(`${sale.discounts.general}% gral`);
        if (sale.appliedPromo) parts.push(sale.appliedPromo);
        if (sale.markup > 0) parts.push(`+${sale.markup}% rec`);
        if (sale.specialDiscount > 0) parts.push(`-$${sale.specialDiscount.toLocaleString()}`);
        return parts.join(' · ') || '—';
    };

    return (
        <>
            <tr
                onClick={onToggle}
                className="border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/60 cursor-pointer transition-colors group"
            >
                <td className="pl-4 pr-2 py-4">
                    <div className={`p-1 rounded-md transition-colors ${isExpanded ? 'bg-stone-200 dark:bg-stone-700' : 'group-hover:bg-stone-200 dark:group-hover:bg-stone-700'}`}>
                        <ChevronRight className={`w-3 h-3 text-stone-400 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                </td>
                <td className="px-3 py-4">
                    <div className="text-[11px] font-bold text-stone-800 dark:text-stone-200">{formatDate(sale.date)}</div>
                    <div className="text-[9px] font-mono font-bold text-stone-400 mt-0.5">#{sale.id}</div>
                </td>
                <td className="px-3 py-4">
                    <div className="text-[11px] font-bold text-stone-800 dark:text-white truncate max-w-[150px]">{sale.clientName}</div>
                    <div className="text-[9px] font-medium text-stone-400 truncate max-w-[150px] mt-0.5">{sale.vendorName}</div>
                </td>
                <td className="px-3 py-4 text-center">
                    <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-[0.1em] whitespace-nowrap ${ORDER_TYPE_COLORS[sale.orderType] || ORDER_TYPE_COLORS['OTRO']}`}>
                        {sale.orderType}
                    </span>
                </td>
                <td className="px-3 py-4 text-[12px] font-black text-stone-800 dark:text-white text-right tabular-nums">
                    ${sale.totalPaid.toLocaleString()}
                </td>
                <td className="px-3 py-4 text-[12px] font-black text-red-500 text-right tabular-nums">
                    ${sale.cmv.toLocaleString()}
                </td>
                <td className="px-3 py-4 text-right">
                    <div className="flex flex-col items-end gap-1">
                        {sale.platformFee > 0 && <span className="text-[10px] font-bold text-purple-500 tabular-nums">P: ${sale.platformFee.toLocaleString()}</span>}
                        {sale.doctorFee > 0 && <span className="text-[10px] font-bold text-pink-500 tabular-nums">M: ${sale.doctorFee.toLocaleString()}</span>}
                        {sale.platformFee === 0 && sale.doctorFee === 0 && <span className="text-[10px] font-medium text-stone-300">—</span>}
                    </div>
                </td>
                <td className="px-3 py-4 text-right">
                    <div className="text-[9px] font-bold text-orange-500 max-w-[100px] truncate ml-auto" title={getDiscountLabel(sale)}>
                        {getDiscountLabel(sale)}
                    </div>
                </td>
                <td className="px-4 py-4 text-right">
                    <div className="flex flex-col items-end gap-1">
                        <span className={`text-[13px] font-black tabular-nums ${sale.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            ${sale.netProfit.toLocaleString()}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                            sale.profitMargin > 50 ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' :
                            sale.profitMargin > 30 ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' :
                            sale.profitMargin > 0 ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' :
                            'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                        }`}>
                            {sale.profitMargin.toFixed(0)}%
                        </span>
                    </div>
                </td>
            </tr>
            
            {/* Expanded item detail */}
            {isExpanded && (
                <tr className="bg-stone-50/50 dark:bg-stone-900/30">
                    <td colSpan={9} className="px-4 py-4">
                        <div className="ml-8 mr-2 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/50 dark:border-stone-700/50 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-300">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/30">
                                        <th className="px-5 py-2.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Producto</th>
                                        <th className="px-4 py-2.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Tipo</th>
                                        <th className="px-4 py-2.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Ojo</th>
                                        <th className="px-4 py-2.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Lab</th>
                                        <th className="px-4 py-2.5 text-[9px] font-black text-stone-400 uppercase tracking-widest text-right">Precio</th>
                                        <th className="px-5 py-2.5 text-[9px] font-black text-stone-400 uppercase tracking-widest text-right">Costo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50 dark:divide-stone-800/50">
                                    {sale.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors">
                                            <td className="px-5 py-3 text-[11px] font-bold text-stone-700 dark:text-stone-300 max-w-[250px] truncate">
                                                {item.name}
                                                {item.is2x1Free && <span className="ml-2 px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 rounded-md text-[8px] font-black uppercase tracking-wider">2x1 bonif.</span>}
                                            </td>
                                            <td className="px-4 py-3 text-[10px] font-medium text-stone-500">{item.type}</td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-stone-600 dark:text-stone-400">{item.eye || '—'}</td>
                                            <td className="px-4 py-3 text-[10px] font-medium text-stone-500">{item.lab || '—'}</td>
                                            <td className="px-4 py-3 text-[11px] font-black text-stone-700 dark:text-stone-300 text-right tabular-nums">
                                                {item.price > 0 ? `$${item.price.toLocaleString()}` : <span className="text-teal-500 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-md">$0</span>}
                                            </td>
                                            <td className="px-5 py-3 text-[11px] font-black text-red-500 text-right tabular-nums">
                                                ${item.cost.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            
                            <div className="px-5 py-3 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/20 flex items-center gap-3 flex-wrap">
                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em]">Pagos:</span>
                                {[...new Set(sale.paymentMethods)].map((m, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-[9px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-widest shadow-sm">
                                        {METHOD_LABELS[m] || m}
                                    </span>
                                ))}
                                {sale.hasInvoice && (
                                    <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 rounded-lg text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1 shadow-sm ml-auto">
                                        Facturada ✓
                                    </span>
                                )}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
