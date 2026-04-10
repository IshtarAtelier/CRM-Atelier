'use client';

import React from 'react';
import { Search, Plus } from 'lucide-react';
import { safePrice } from '@/lib/promo-utils';

interface CartSearchProps {
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    results: any[];
    onSelect: (product: any) => void;
}

export default function CartSearch({
    searchQuery,
    setSearchQuery,
    results,
    onSelect
}: CartSearchProps) {
    return (
        <div className="mb-8 relative group/search">
            <div className="relative">
                <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Agregar cualquier producto (Cristal, Armazón, etc.)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-900/50 border-2 border-stone-100 dark:border-stone-800 py-4 px-14 rounded-3xl text-sm font-black outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-stone-300"
                />
            </div>
            {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-stone-900 border-2 border-primary/20 rounded-3xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {results.map(p => (
                        <button
                            key={p.id}
                            onClick={() => onSelect(p)}
                            className="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-colors text-left group/item border-b border-stone-50 dark:border-stone-800 last:border-0"
                        >
                            <div className="flex-1">
                                <p className="text-xs font-black text-stone-800 dark:text-white uppercase">
                                    {p.brand} {p.model || p.name}
                                </p>
                                <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">
                                    {p.type || p.category} {p.lensIndex ? `· ${p.lensIndex}` : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-primary">${safePrice(p.price).toLocaleString()}</span>
                                <div className="w-7 h-7 bg-primary text-white rounded-lg flex items-center justify-center scale-0 group-hover/item:scale-100 transition-all">
                                    <Plus className="w-4 h-4" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
