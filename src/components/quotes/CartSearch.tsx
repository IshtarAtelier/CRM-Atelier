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
        <div className="mb-6 relative group/search">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Agregar cualquier producto (Cristal, Armazón, etc.)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 py-3 pl-11 pr-4 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-stone-300 dark:text-stone-100"
                />
            </div>
            {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-250/60 dark:border-stone-750 rounded-2xl shadow-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-1.5 duration-200">
                    {results.map(p => (
                        <button
                            key={p.id}
                            onClick={() => onSelect(p)}
                            className="w-full flex items-center justify-between p-3.5 hover:bg-primary/5 transition-colors text-left group/item border-b border-stone-100 dark:border-stone-800/40 last:border-0"
                        >
                            <div className="flex-1 min-w-0 pr-4">
                                <p className="text-xs font-bold text-stone-800 dark:text-stone-150 uppercase truncate">
                                    {p.brand} <span className="text-stone-550 dark:text-stone-400 font-medium lowercase">· {p.name}</span>
                                </p>
                                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mt-0.5">
                                    {p.type || p.category} {p.lensIndex ? `· Índ: ${p.lensIndex}` : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-primary">${safePrice(p.price).toLocaleString()}</span>
                                <div className="w-6 h-6 bg-primary text-white rounded-lg flex items-center justify-center scale-0 group-hover/item:scale-100 transition-all">
                                    <Plus className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
