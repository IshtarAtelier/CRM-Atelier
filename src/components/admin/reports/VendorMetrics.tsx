import React from 'react';
import { Award } from 'lucide-react';

interface VendorStat {
    name: string;
    revenue: number;
    orders: number;
    avgTicket: number;
}

export function VendorMetrics({ data }: { data: VendorStat[] }) {
    if (!data || data.length === 0) return null;

    return (
        <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border border-stone-200/60 dark:border-stone-700/60 rounded-3xl p-6 lg:p-8 mt-8 shadow-xl shadow-stone-200/20 dark:shadow-none">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/40 text-violet-500">
                    <Award className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Rendimiento</h2>
                    <p className="text-xl font-black text-stone-800 dark:text-white tracking-tight">Métricas por Vendedor</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {data.map((v, i) => {
                    const maxRev = Math.max(...data.map(x => x.revenue));
                    const pct = maxRev > 0 ? (v.revenue / maxRev) * 100 : 0;
                    
                    return (
                        <div key={i} className="group relative overflow-hidden bg-white dark:bg-stone-900/50 rounded-2xl border border-stone-100 dark:border-stone-800 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-violet-200/40 dark:hover:shadow-stone-900/50 hover:-translate-y-1 hover:border-violet-200 dark:hover:border-violet-800/50">
                            {/* Background bar */}
                            <div className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-violet-400 to-fuchsia-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
                            
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-inner
                                        ${i === 0 ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-violet-500/30' : 
                                          'bg-stone-100 dark:bg-stone-800 text-stone-400 border border-stone-200 dark:border-stone-700'}`}>
                                        {i + 1}
                                    </div>
                                    <span className="font-black text-stone-800 dark:text-white text-base tracking-tight">{v.name}</span>
                                </div>
                                {i === 0 && (
                                    <span className="text-[9px] font-black text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/50 px-2 py-1 rounded-lg uppercase tracking-[0.2em] shadow-sm">
                                        Top
                                    </span>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-stone-50 dark:bg-stone-800/40 rounded-xl p-3">
                                    <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Facturación</p>
                                    <p className="text-sm font-black text-violet-600 dark:text-violet-400">${v.revenue.toLocaleString()}</p>
                                </div>
                                <div className="bg-stone-50 dark:bg-stone-800/40 rounded-xl p-3">
                                    <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Ventas</p>
                                    <p className="text-sm font-black text-stone-800 dark:text-white">{v.orders}</p>
                                </div>
                                <div className="bg-stone-50 dark:bg-stone-800/40 rounded-xl p-3">
                                    <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Ticket Prom.</p>
                                    <p className="text-sm font-black text-stone-800 dark:text-white">${v.avgTicket.toLocaleString()}</p>
                                </div>
                            </div>
                            
                            {/* Ambient background glow on hover */}
                            <div className="absolute -right-12 -top-12 w-32 h-32 bg-violet-400/5 dark:bg-violet-500/10 rounded-full blur-3xl group-hover:bg-violet-400/10 transition-all duration-500" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
