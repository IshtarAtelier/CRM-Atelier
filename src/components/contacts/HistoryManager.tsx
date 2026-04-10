'use client';

import React, { useState } from 'react';
import { History, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistoryManagerProps {
    contactId: string;
    interactions: any[];
    onAddInteraction: (content: string) => Promise<void>;
}

export default function HistoryManager({
    contactId,
    interactions,
    onAddInteraction
}: HistoryManagerProps) {
    const [newNote, setNewNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        if (!newNote.trim()) return;
        setIsSaving(true);
        try {
            await onAddInteraction(newNote);
            setNewNote('');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-stone-50 dark:bg-stone-800/30 p-6 rounded-[2rem] border border-stone-100 dark:border-stone-800">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1 mb-2 block">Nueva anotación</label>
                <div className="flex gap-3">
                    <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Registra una llamada, consulta o detalle..."
                        className="flex-1 bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none h-24"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving || !newNote.trim()}
                        className="self-end px-6 py-4 bg-stone-900 text-white dark:bg-primary rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                    >
                        {isSaving ? '...' : 'Registrar'}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {interactions.length === 0 ? (
                    <div className="text-center py-12 text-stone-300 italic text-sm">No hay actividad registrada.</div>
                ) : (
                    interactions.map((interaction, idx) => (
                        <div key={interaction.id} className="relative pl-8">
                            {idx !== interactions.length - 1 && (
                                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-stone-100 dark:bg-stone-800" />
                            )}
                            <div className="absolute left-0 top-1.5 w-6 h-6 bg-white dark:bg-stone-900 rounded-full border-2 border-primary flex items-center justify-center z-10">
                                <MessageCircle className="w-3 h-3 text-primary" />
                            </div>
                            <div className="bg-white dark:bg-stone-900/50 p-5 rounded-2xl border border-stone-50 dark:border-stone-800 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                        {format(new Date(interaction.createdAt), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-stone-700 dark:text-stone-300 leading-relaxed">{interaction.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
