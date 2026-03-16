'use client';

import { Heart, X, User, ChevronRight } from 'lucide-react';
import { Contact } from '@/types/contacts';

interface FavoritesPanelProps {
    favorites: Contact[];
    onClose: () => void;
    onSelect: (id: string) => void;
}

export default function FavoritesPanel({ favorites, onClose, onSelect }: FavoritesPanelProps) {
    return (
        <div className="fixed top-24 right-8 bottom-24 w-80 bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl z-40 rounded-[3rem] shadow-2xl border border-stone-200/50 dark:border-stone-800/50 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-500">
            <header className="p-6 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/30">
                <div className="flex items-center gap-3 text-red-500">
                    <Heart className="w-6 h-6 fill-current" />
                    <h3 className="font-black text-stone-800 dark:text-white uppercase tracking-tighter italic">Favoritos</h3>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors">
                    <X className="w-4 h-4 text-stone-400" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {favorites.length > 0 ? (
                    favorites.map(contact => (
                        <button
                            key={contact.id}
                            onClick={() => onSelect(contact.id)}
                            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-stone-800 rounded-[2rem] border border-stone-100 dark:border-stone-700 hover:border-red-200 dark:hover:border-red-900/30 hover:shadow-lg transition-all text-left group"
                        >
                            <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-400 shrink-0">
                                <User className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-stone-800 dark:text-stone-200 text-sm truncate tracking-tight">{contact.name}</p>
                                <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">{contact.phone}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-stone-200 group-hover:text-red-300 transition-colors" />
                        </button>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-6">
                        <Heart className="w-12 h-12 text-stone-100 mb-4" />
                        <p className="text-xs font-black text-stone-300 uppercase tracking-widest leading-relaxed">Marca contactos con un corazón para verlos aquí</p>
                    </div>
                )}
            </div>
        </div>
    );
}
