import React from 'react';
import { Microscope } from 'lucide-react';

interface ClientLabStat {
    name: string;
    cost: number;
    product: string;
}

interface LabStat {
    name: string;
    cost: number;
    revenue: number;
    profit: number;
    clients: ClientLabStat[];
}

export function LaboratoryStats({ data }: { data: LabStat[] }) {
    if (!data || data.length === 0) return null;

    return (
        <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border border-stone-200/60 dark:border-stone-700/60 rounded-3xl p-6 lg:p-8 mt-8 shadow-xl shadow-stone-200/20 dark:shadow-none">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-500">
                    <Microscope className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Rentabilidad</h2>
                    <p className="text-xl font-black text-stone-800 dark:text-white tracking-tight">Desempeño por Laboratorio</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data.map((lab, i) => {
                    const margin = lab.revenue > 0 ? ((lab.profit) / lab.revenue) * 100 : 0;
                    const marginColor = margin > 30 ? 'emerald' : margin > 0 ? 'amber' : 'red';

                    return (
                        <div key={i} className="group relative overflow-hidden bg-white dark:bg-stone-900/50 rounded-2xl border border-stone-100 dark:border-stone-800 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-stone-200/40 dark:hover:shadow-stone-900/50 hover:-translate-y-1">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-700 flex items-center justify-center text-stone-500 font-black text-sm shadow-inner">
                                        {lab.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-stone-800 dark:text-white tracking-tight text-lg leading-none">{lab.name}</h3>
                                        <p className="text-[10px] font-bold text-stone-400 mt-1">{lab.clients.length} ventas</p>
                                    </div>
                                </div>
                                <div className={`px-3 py-1.5 rounded-xl text-xs font-black shadow-sm
                                    ${marginColor === 'emerald' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' : 
                                      marginColor === 'amber' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400' : 
                                      'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'}`}>
                                    {margin.toFixed(0)}%
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-3 rounded-xl bg-stone-50/50 dark:bg-stone-800/30">
                                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1">Costo</p>
                                    <p className="text-base font-black text-red-500">${lab.cost.toLocaleString()}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-stone-50/50 dark:bg-stone-800/30">
                                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1">Facturación</p>
                                    <p className="text-base font-black text-stone-800 dark:text-white">${lab.revenue.toLocaleString()}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-stone-50/50 dark:bg-stone-800/30">
                                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1">Ganancia</p>
                                    <p className={`text-base font-black ${lab.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>${lab.profit.toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Margin bar */}
                            <div className="mt-5 w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden shadow-inner">
                                <div className={`h-full rounded-full transition-all duration-1000 ease-out
                                    ${marginColor === 'emerald' ? 'bg-emerald-500' : marginColor === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} 
                                    style={{ width: `${Math.min(Math.max(margin, 0), 100)}%` }} 
                                />
                            </div>

                            {/* Clients Breakdown */}
                            {lab.clients && lab.clients.length > 0 && (
                                <div className="mt-5 pt-5 border-t border-stone-100 dark:border-stone-800 max-h-48 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr>
                                                <th className="text-[8px] font-black text-stone-400 uppercase tracking-[0.2em] pb-3">Cliente / Producto</th>
                                                <th className="text-[8px] font-black text-stone-400 uppercase tracking-[0.2em] pb-3 text-right">Costo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="space-y-1">
                                            {lab.clients.map((c, idx) => (
                                                <tr key={idx} className="group/row rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                                                    <td className="py-2 pl-2 rounded-l-lg">
                                                        <div className="text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate max-w-[180px]">{c.name}</div>
                                                        <div className="text-[9px] font-medium text-stone-400 truncate max-w-[180px]" title={c.product}>{c.product}</div>
                                                    </td>
                                                    <td className="py-2 pr-2 text-[11px] font-black text-red-500 text-right rounded-r-lg">
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
    );
}
