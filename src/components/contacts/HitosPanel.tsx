'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, Calendar, Target, ShoppingBag, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Hito {
    id: string;
    type: string;
    content: string;
    createdAt: string;
}

interface HitosPanelProps {
    contactId: string;
    interactions: any[];
    onRefresh: () => void;
}

export default function HitosPanel({ contactId, interactions, onRefresh }: HitosPanelProps) {
    const [isExtracting, setIsExtracting] = useState(false);

    // Filter interactions that are milestones
    // We detect hitos by the "📍 [HITO]" prefix or the type if we start using types properly
    const hitos = interactions.filter(i => i.content.startsWith('📍 [HITO]'))
        .map(i => {
            const content = i.content.replace('📍 [HITO] ', '');
            return { ...i, content };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const handleExtract = async () => {
        setIsExtracting(true);
        try {
            const res = await fetch('/api/bot/hitos/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: contactId }),
            });
            if (res.ok) {
                onRefresh();
            }
        } catch (error) {
            console.error('Error extracting hitos:', error);
        } finally {
            setIsExtracting(false);
        }
    };

    const getHitoIcon = (type: string) => {
        switch (type) {
            case 'SUMMARY': return <MessageSquare className="w-3.5 h-3.5" />;
            case 'PRODUCT_OFFERED': return <ShoppingBag className="w-3.5 h-3.5" />;
            case 'FOLLOW_UP': return <Calendar className="w-3.5 h-3.5" />;
            case 'PRESCRIPTION_RECEIVED': return <Target className="w-3.5 h-3.5" />;
            default: return <Sparkles className="w-3.5 h-3.5" />;
        }
    };

    const getHitoColor = (type: string) => {
        switch (type) {
            case 'SUMMARY': return 'bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800';
            case 'PRODUCT_OFFERED': return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800';
            case 'FOLLOW_UP': return 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800';
            case 'PRESCRIPTION_RECEIVED': return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800';
            default: return 'bg-stone-50 text-stone-600 border-stone-100 dark:bg-stone-800/50 dark:text-stone-400 dark:border-stone-700';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-violet-500" />
                    <h3 className="text-xs font-black text-stone-800 dark:text-white uppercase tracking-widest">Hitos de Conversación</h3>
                </div>
                <button
                    onClick={handleExtract}
                    disabled={isExtracting}
                    className="flex items-center gap-2 px-4 py-1.5 bg-stone-900 text-white dark:bg-white dark:text-stone-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                >
                    {isExtracting ? (
                        <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Extrayendo...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-3 h-3" />
                            Extraer
                        </>
                    )}
                </button>
            </div>

            {hitos.length === 0 ? (
                <div className="p-8 text-center bg-stone-50 dark:bg-stone-800/30 rounded-[2rem] border-2 border-dashed border-stone-100 dark:border-stone-800">
                    <p className="text-xs text-stone-400 font-bold italic">No hay hitos extraídos aún. Usá el botón &quot;Extraer&quot; para que la IA resuma la conversación.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {hitos.slice(0, 4).map((hito) => (
                        <div 
                            key={hito.id} 
                            className={`p-4 rounded-2xl border-2 transition-all hover:shadow-md ${getHitoColor(hito.type)}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {getHitoIcon(hito.type)}
                                    <span className="text-[10px] font-black uppercase tracking-widest">{hito.type}</span>
                                </div>
                                <span className="text-[9px] font-bold opacity-60">
                                    {format(new Date(hito.createdAt), "d MMM", { locale: es })}
                                </span>
                            </div>
                            <p className="text-xs font-medium leading-relaxed">{hito.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
