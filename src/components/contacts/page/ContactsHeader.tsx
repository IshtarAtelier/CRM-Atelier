'use client';

import React from 'react';
import { Plus, Heart, Clock } from 'lucide-react';

interface ContactsHeaderProps {
    activeTab: string;
    showFavorites: boolean;
    setShowFavorites: (val: boolean) => void;
    favoriteCount: number;
    onNewContact: () => void;
    expiredRx: { id: string; name: string; months: number }[];
    showRxAlert: boolean;
    setShowRxAlert: (val: boolean) => void;
    onSelectContact: (id: string) => void;
}

export default function ContactsHeader({
    activeTab,
    showFavorites,
    setShowFavorites,
    favoriteCount,
    onNewContact,
    expiredRx,
    showRxAlert,
    setShowRxAlert,
    onSelectContact
}: ContactsHeaderProps) {
    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic">
                        Gestión de <span className="text-primary not-italic text-stone-900 border-b-4 border-primary/30">Contactos</span>
                    </h1>
                    <p className="text-stone-500 mt-2 font-medium uppercase text-[10px] tracking-[0.2em]">
                        {activeTab === 'ALL' ? 'Todos los registros' : activeTab === 'CONTACT' ? 'Prospectos' : activeTab === 'CONFIRMED' ? 'Pedidos Confirmados' : 'Ventas Cerradas'}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowFavorites(!showFavorites)}
                        className={`p-5 rounded-2xl border transition-all relative ${showFavorites
                            ? 'bg-red-50 text-red-500 border-red-200'
                            : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700'
                            }`}
                    >
                        <Heart className={`w-6 h-6 ${showFavorites ? 'fill-current' : ''}`} />
                        {favoriteCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-stone-900 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                {favoriteCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={onNewContact}
                        className="flex items-center gap-3 px-8 py-5 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-2xl text-sm font-black shadow-2xl shadow-stone-400/20 hover:scale-105 active:scale-95 transition-all group"
                    >
                        <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" strokeWidth={3} />
                        NUEVO CONTACTO
                    </button>
                </div>
            </header>

            {/* Prescription Renewal Alert */}
            {showRxAlert && expiredRx.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-4 animate-in slide-in-from-top duration-500">
                    <Clock className="w-6 h-6 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-amber-700 dark:text-amber-400">
                            🔔 {expiredRx.length} receta{expiredRx.length > 1 ? 's' : ''} vencida{expiredRx.length > 1 ? 's' : ''} (+12 meses)
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {expiredRx.slice(0, 5).map(rx => (
                                <button
                                    key={rx.id}
                                    onClick={() => onSelectContact(rx.id)}
                                    className="px-3 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-800 transition-all"
                                >
                                    {rx.name} ({rx.months}m)
                                </button>
                            ))}
                            {expiredRx.length > 5 && (
                                <span className="px-3 py-1 text-amber-500 text-xs font-bold">+{expiredRx.length - 5} más</span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setShowRxAlert(false)}
                        className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0"
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
}
