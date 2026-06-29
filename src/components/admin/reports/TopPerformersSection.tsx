import React from 'react';
import { Users, ShoppingBag } from 'lucide-react';

interface TopClient {
    name: string;
    total: number;
    orders: number;
}

interface TopProduct {
    name: string;
    revenue: number;
    cost: number;
    qty: number;
    type: string;
}

interface TopPerformersProps {
    topClients: TopClient[];
    topProducts: TopProduct[];
}

function EmptySection({ message }: { message: string }) {
    return (
        <div className="text-center py-12 bg-stone-50/50 dark:bg-stone-800/30 rounded-2xl border border-dashed border-stone-200 dark:border-stone-700">
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">{message}</p>
        </div>
    );
}

export function TopPerformersSection({ topClients, topProducts }: TopPerformersProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {/* Top Clients */}
            <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border border-stone-200/60 dark:border-stone-700/60 rounded-3xl p-6 lg:p-8 shadow-xl shadow-stone-200/20 dark:shadow-none">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-500">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Ranking</h2>
                        <p className="text-xl font-black text-stone-800 dark:text-white tracking-tight">Top Clientes</p>
                    </div>
                </div>
                
                {topClients && topClients.length > 0 ? (
                    <div className="space-y-3">
                        {topClients.map((client, i) => (
                            <div key={i} className="group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800 hover:border-amber-200 dark:hover:border-amber-800/50 hover:shadow-lg hover:shadow-amber-100/50 dark:hover:shadow-none transition-all duration-300">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-inner
                                        ${i === 0 ? 'bg-gradient-to-br from-amber-200 to-amber-400 text-amber-900 shadow-amber-300/50' : 
                                          i === 1 ? 'bg-gradient-to-br from-stone-200 to-stone-300 text-stone-600' : 
                                          i === 2 ? 'bg-gradient-to-br from-orange-200 to-orange-300 text-orange-800' : 
                                          'bg-stone-50 dark:bg-stone-800 text-stone-400 border border-stone-100 dark:border-stone-700'}`}>
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-stone-800 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{client.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md">
                                                {client.orders} compra{client.orders !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <span className="text-base font-black text-stone-800 dark:text-white">${client.total.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptySection message="Sin datos de clientes" />
                )}
            </div>

            {/* Top Products */}
            <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border border-stone-200/60 dark:border-stone-700/60 rounded-3xl p-6 lg:p-8 shadow-xl shadow-stone-200/20 dark:shadow-none">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-500">
                        <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Ranking</h2>
                        <p className="text-xl font-black text-stone-800 dark:text-white tracking-tight">Top Productos</p>
                    </div>
                </div>
                
                {topProducts && topProducts.length > 0 ? (
                    <div className="space-y-3">
                        {topProducts.map((product, i) => {
                            const margin = product.revenue > 0 ? ((product.revenue - product.cost) / product.revenue) * 100 : 0;
                            const marginColor = margin > 30 ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50' : margin > 0 ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/50' : 'text-red-500 bg-red-50 dark:bg-red-950/50';

                            return (
                                <div key={i} className="group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800 hover:border-blue-200 dark:hover:border-blue-800/50 hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-none transition-all duration-300">
                                    <div className="flex-1 min-w-0 mr-4">
                                        <p className="text-sm font-black text-stone-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={product.name}>
                                            {product.name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[8px] font-black text-stone-500 uppercase tracking-widest bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md truncate max-w-[100px]">
                                                {product.type}
                                            </span>
                                            <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest bg-stone-50 dark:bg-stone-800/50 px-2 py-0.5 rounded-md border border-stone-100 dark:border-stone-700">
                                                {product.qty} {
                                                    (product.type.toLowerCase().includes('cristal') || ['monofocal', 'multifocal', 'bifocal', 'ocupacional'].includes(product.type.toLowerCase()))
                                                        ? (product.qty === 1 ? 'par' : 'pares')
                                                        : 'unid.'
                                                }
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-base font-black text-stone-800 dark:text-white">${product.revenue.toLocaleString()}</p>
                                        <p className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md mt-1 inline-block ${marginColor}`}>
                                            {margin.toFixed(0)}% mrg
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
    );
}
