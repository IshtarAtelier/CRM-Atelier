'use client';

import React from 'react';
import { Search, Globe, Store, Filter, AlertTriangle } from 'lucide-react';

interface ContactsFiltersProps {
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    selectedInterest: string;
    setSelectedInterest: (val: string) => void;
    locationFilter: string;
    setLocationFilter: (val: string) => void;
    showUnattendedOnly: boolean;
    setShowUnattendedOnly: (val: boolean) => void;
    unattendedCount: number;
}

export default function ContactsFilters({
    searchQuery,
    setSearchQuery,
    selectedInterest,
    setSelectedInterest,
    locationFilter,
    setLocationFilter,
    showUnattendedOnly,
    setShowUnattendedOnly,
    unattendedCount
}: ContactsFiltersProps) {
    const productTypes = [
        { id: 'ALL', label: 'Todos' },
        { id: 'Monofocal', label: 'Monofocal' },
        { id: 'Multifocal', label: 'Multifocal' },
        { id: 'Bifocal', label: 'Bifocal' },
        { id: 'Armazón', label: 'Armazón' },
        { id: 'Lente de Contacto', label: 'Lente de Contacto' },
    ];

    const locationTypes = [
        { id: 'ALL', label: 'Todos', icon: Filter },
        { id: 'LOCAL', label: 'Local', icon: Store },
        { id: 'ONLINE', label: 'Online', icon: Globe },
    ];

    return (
        <div className="space-y-6 mb-8">
            {/* Minimalist Search Bar */}
            <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-primary transition-colors duration-300" />
                <input
                    type="text"
                    placeholder="Buscar pacientes por nombre, teléfono, o interés..."
                    className="w-full pl-14 pr-6 py-5 bg-stone-50/50 dark:bg-stone-800/30 backdrop-blur-md border border-stone-200/50 dark:border-stone-700/50 rounded-full shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] focus:bg-white dark:focus:bg-stone-900 focus:ring-4 focus:ring-primary/10 focus:border-primary focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all font-medium text-stone-800 dark:text-stone-100 placeholder-stone-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-5">
                {/* Sin atender toggle */}
                <button
                    onClick={() => setShowUnattendedOnly(!showUnattendedOnly)}
                    className={`inline-flex w-max items-center gap-2 px-5 py-2.5 rounded-full text-[11px] uppercase tracking-widest font-black transition-all duration-300 border ${
                        showUnattendedOnly
                            ? 'bg-red-500 text-white border-red-400 shadow-md shadow-red-500/20 scale-105'
                            : 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40 hover:bg-red-100 dark:hover:bg-red-900/20'
                    }`}
                    title="Contactos sin presupuesto armado"
                >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Sin atender
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                        showUnattendedOnly ? 'bg-white/25 text-white' : 'bg-red-500 text-white'
                    }`}>{unattendedCount}</span>
                </button>

                {/* Modern Pill Location Toggle */}
                <div className="inline-flex w-max bg-stone-100/50 dark:bg-stone-800/50 backdrop-blur-md p-1.5 rounded-full border border-stone-200/50 dark:border-stone-700/50">
                    {locationTypes.map((type) => {
                        const Icon = type.icon;
                        const isActive = locationFilter === type.id;
                        return (
                            <button
                                key={type.id}
                                onClick={() => setLocationFilter(type.id)}
                                className={`relative flex items-center gap-2 px-6 py-2.5 rounded-full text-[11px] uppercase tracking-widest transition-all duration-300 ease-out ${
                                    isActive
                                        ? 'text-stone-900 dark:text-white'
                                        : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 font-medium'
                                }`}
                            >
                                {isActive && (
                                    <div className="absolute inset-0 bg-white dark:bg-stone-600 rounded-full shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-none -z-10 animate-in zoom-in-95 duration-200" />
                                )}
                                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'opacity-70'}`} />
                                <span className={isActive ? 'font-black' : ''}>{type.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Minimalist Product Selectors */}
                <div className="flex flex-wrap gap-2 flex-1">
                    {productTypes.map((type) => {
                        const isActive = selectedInterest === type.id;
                        return (
                            <button
                                key={type.id}
                                onClick={() => setSelectedInterest(type.id)}
                                className={`px-5 py-2.5 rounded-full text-[11px] uppercase tracking-[0.15em] transition-all duration-300 ${
                                    isActive
                                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-md font-black scale-105'
                                    : 'bg-transparent border border-stone-200 dark:border-stone-800 text-stone-500 font-bold hover:border-stone-300 dark:hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                                }`}
                            >
                                {type.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
