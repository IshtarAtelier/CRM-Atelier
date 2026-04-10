'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface ContactsFiltersProps {
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    selectedInterest: string;
    setSelectedInterest: (val: string) => void;
}

export default function ContactsFilters({
    searchQuery,
    setSearchQuery,
    selectedInterest,
    setSelectedInterest
}: ContactsFiltersProps) {
    // FIX: Populated with real metadata instead of being empty
    const productTypes = [
        { id: 'ALL', label: 'Todos los Intereses' },
        { id: 'Monofocal', label: 'Monofocal' },
        { id: 'Multifocal', label: 'Multifocal' },
        { id: 'Bifocal', label: 'Bifocal' },
        { id: 'Armazón', label: 'Solo Armazón' },
        { id: 'Lente de Contacto', label: 'Lente de Contacto' },
    ];

    return (
        <div className="space-y-4">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Buscar por nombre, teléfono, interés u obra social..."
                    className="w-full pl-12 pr-6 py-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl shadow-sm focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Filtros de Tipo de Producto */}
            <div className="flex flex-wrap gap-2 pt-2">
                {productTypes.map((type) => (
                    <button
                        key={type.id}
                        onClick={() => setSelectedInterest(type.id)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${selectedInterest === type.id
                            ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                            : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 text-stone-400 hover:border-stone-200 dark:hover:border-stone-600'
                            }`}
                    >
                        {type.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
