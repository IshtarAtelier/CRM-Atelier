'use client';

import { Package, Tag, Layers, DollarSign, Trash2, Edit3, MoreVertical, Star } from 'lucide-react';
import { Product } from '@/hooks/useProducts';
import { getCategoryKey, isMultifocal2x1 } from '@/lib/promo-utils';

interface ProductCardProps {
    product: Product;
    onDelete: (id: string) => void;
    isAdmin?: boolean;
}

export function ProductCard({ product, onDelete, isAdmin = false }: ProductCardProps) {
    const isCristal = product.category === 'Cristal'
        || product.type?.startsWith('Cristal')
        || ['MONOFOCAL','MULTIFOCAL','BIFOCAL','OCUPACIONAL'].includes(product.type?.toUpperCase() || '');
    const isLowStock = !isCristal && product.stock <= 2;

    return (
        <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 p-6 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onDelete(product.id)}
                    className="p-3 bg-red-50 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl transition-all"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            <div className="flex items-start gap-5">
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 border-2 ${isLowStock ? 'bg-amber-50 border-amber-100 text-amber-500' : 'bg-stone-50 border-stone-100 text-stone-400 dark:bg-stone-800 dark:border-stone-700'}`}>
                    <Package className="w-8 h-8" />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black text-primary uppercase tracking-widest">{product.category}</span>
                        {product.type && (
                            <>
                                <span className="w-1 h-1 bg-stone-300 rounded-full" />
                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest italic">{product.type}</span>
                            </>
                        )}
                    </div>
                    <h3 className="text-lg font-black text-stone-900 dark:text-white uppercase tracking-tight truncate leading-tight flex items-center gap-2">
                        {product.name || product.brand || 'Sin nombre'}
                        {product.is2x1 && (
                            <span className="shrink-0 px-2 py-0.5 bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 text-[9px] font-black rounded-full border border-emerald-200 dark:border-emerald-800">
                                2x1
                            </span>
                        )}
                    </h3>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mt-1 italic">
                        {product.brand || ''}
                    </p>
                    {product.laboratory && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full uppercase tracking-widest">
                            🏭 {product.laboratory}
                        </span>
                    )}
                </div>
            </div>

            <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} gap-4 mt-8 pt-6 border-t border-stone-50 dark:border-stone-800`}>
                {isAdmin && (
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Inversión (Costo)</p>
                    <p className="text-sm font-black text-stone-600 dark:text-stone-300 uppercase tracking-tighter">${product.cost.toLocaleString()}</p>
                </div>
                )}
                <div className={`space-y-1 ${isAdmin ? 'text-right' : ''}`}>
                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Precio Venta</p>
                    <p className="text-xl font-black text-primary tracking-tighter">${product.price.toLocaleString()}</p>
                </div>
            </div>

            <div className={`mt-4 py-3 px-5 rounded-2xl flex items-center justify-between ${isCristal ? 'bg-blue-500/10 text-blue-600' : isLowStock ? 'bg-amber-500/10 text-amber-600' : 'bg-stone-50/50 dark:bg-stone-800/50 text-stone-500'}`}>
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{isCristal ? 'Bajo Demanda' : 'Stock Disponible'}</span>
                </div>
                <span className={`text-sm font-black ${isLowStock ? 'animate-pulse' : ''}`}>{isCristal ? '∞' : `${product.stock} u.`}</span>
            </div>
        </div>
    );
}
