'use client';

import React, { useState } from 'react';
import { 
    History, 
    MessageCircle, 
    Calculator, 
    ShoppingBag, 
    CheckCircle2, 
    Sparkles, 
    AlertCircle 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistoryManagerProps {
    contactId: string;
    contactCreatedAt: string;
    contactCreatedBy?: string;
    interactions: any[];
    onAddInteraction: (content: string) => Promise<void>;
}

export default function HistoryManager({
    contactId,
    contactCreatedAt,
    contactCreatedBy = 'Sistema',
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

    const getInteractionStyles = (type: string) => {
        switch (type) {
            case 'BUDGET_SENT':
                return {
                    icon: Calculator,
                    borderColor: 'border-amber-400 dark:border-amber-600',
                    textColor: 'text-amber-500 dark:text-amber-400',
                    bgColor: 'bg-amber-50/50 dark:bg-amber-950/10'
                };
            case 'SALE_CONFIRMED':
                return {
                    icon: ShoppingBag,
                    borderColor: 'border-emerald-400 dark:border-emerald-600',
                    textColor: 'text-emerald-500 dark:text-emerald-400',
                    bgColor: 'bg-emerald-50/50 dark:bg-emerald-950/10'
                };
            case 'TASK_COMPLETED':
                return {
                    icon: CheckCircle2,
                    borderColor: 'border-blue-400 dark:border-blue-600',
                    textColor: 'text-blue-500 dark:text-blue-400',
                    bgColor: 'bg-blue-50/50 dark:bg-blue-950/10'
                };
            case 'SYSTEM':
                return {
                    icon: Sparkles,
                    borderColor: 'border-purple-400 dark:border-purple-600',
                    textColor: 'text-purple-500 dark:text-purple-400',
                    bgColor: 'bg-purple-50/50 dark:bg-purple-950/10'
                };
            case 'ERROR':
                return {
                    icon: AlertCircle,
                    borderColor: 'border-red-400 dark:border-red-600',
                    textColor: 'text-red-500 dark:text-red-400',
                    bgColor: 'bg-red-50/50 dark:bg-red-950/10'
                };
            default:
                return {
                    icon: MessageCircle,
                    borderColor: 'border-stone-300 dark:border-stone-700',
                    textColor: 'text-stone-500 dark:text-stone-400',
                    bgColor: 'bg-white dark:bg-stone-900/50'
                };
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
                {/* Creation Block */}
                <div className="relative pl-8">
                    {interactions.length > 0 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-stone-100 dark:bg-stone-800" />
                    )}
                    <div className="absolute left-0 top-1.5 w-6 h-6 bg-white dark:bg-stone-900 rounded-full border-2 border-indigo-400 dark:border-indigo-600 flex items-center justify-center z-10">
                        <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900 shadow-sm transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                {contactCreatedAt ? format(new Date(contactCreatedAt), "EEEE d 'de' MMMM, HH:mm", { locale: es }) : 'FECHA DESCONOCIDA'}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 leading-relaxed">
                            Ficha creada por <strong className="font-bold">{contactCreatedBy}</strong>
                        </p>
                    </div>
                </div>

                {interactions.map((interaction, idx) => {
                    const styles = getInteractionStyles(interaction.type);
                    const IconComponent = styles.icon;

                    return (
                        <div key={interaction.id || `int-${idx}`} className="relative pl-8">
                            {idx !== interactions.length - 1 && (
                                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-stone-100 dark:bg-stone-800" />
                            )}
                            <div className={`absolute left-0 top-1.5 w-6 h-6 bg-white dark:bg-stone-900 rounded-full border-2 ${styles.borderColor} flex items-center justify-center z-10`}>
                                <IconComponent className={`w-3 h-3 ${styles.textColor}`} />
                            </div>
                            <div className={`${styles.bgColor} p-5 rounded-2xl border border-stone-100 dark:border-stone-800/80 shadow-sm transition-all`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                        {format(new Date(interaction.createdAt), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">{interaction.content}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
