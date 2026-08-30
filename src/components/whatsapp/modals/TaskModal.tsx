'use client';

import { Calendar, X } from 'lucide-react';

export interface TaskDraft {
    description: string;
    dueDate: string;
}

export interface TaskModalProps {
    borrador: TaskDraft;
    onBorrador: (b: TaskDraft) => void;
    guardando: boolean;
    onGuardar: () => void;
    onCerrar: () => void;
}

/** Agendar una tarea sobre la ficha del cliente de este chat. */
export function TaskModal({ borrador, onBorrador, guardando, onGuardar, onCerrar }: TaskModalProps) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Crear tarea">
            <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl overflow-hidden border border-stone-300 dark:border-stone-800">
                <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-black/20">
                    <h3 className="text-sm font-black uppercase tracking-widest text-stone-900 dark:text-stone-100 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-violet-700 dark:text-violet-400" aria-hidden /> Crear tarea
                    </h3>
                    <button type="button" onClick={onCerrar} aria-label="Cerrar" className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-lg text-stone-600 hover:text-stone-900 dark:text-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="tarea-desc" className="block text-[11px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-widest mb-1.5">Descripción</label>
                        <input
                            id="tarea-desc"
                            autoFocus
                            type="text"
                            className="w-full px-3 min-h-10 py-2 text-sm border border-stone-300 dark:border-stone-800 rounded-xl bg-white dark:bg-stone-950 text-stone-900 dark:text-white focus:ring-2 focus:ring-violet-700 focus:border-transparent outline-none"
                            placeholder="Ej: Llamar para avisar que llegó el anteojo"
                            value={borrador.description}
                            onChange={e => onBorrador({ ...borrador, description: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') onGuardar(); }}
                        />
                    </div>
                    <div>
                        <label htmlFor="tarea-fecha" className="block text-[11px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-widest mb-1.5">Fecha de vencimiento</label>
                        <input
                            id="tarea-fecha"
                            type="date"
                            className="w-full px-3 min-h-10 py-2 text-sm border border-stone-300 dark:border-stone-800 rounded-xl bg-white dark:bg-stone-950 text-stone-900 dark:text-white focus:ring-2 focus:ring-violet-700 focus:border-transparent outline-none"
                            value={borrador.dueDate}
                            onChange={e => onBorrador({ ...borrador, dueDate: e.target.value })}
                        />
                    </div>
                </div>
                <div className="px-6 py-4 bg-stone-50 dark:bg-stone-900/50 flex justify-end gap-3 border-t border-stone-200 dark:border-stone-800">
                    <button type="button" onClick={onCerrar} className="px-4 min-h-10 text-xs font-bold text-stone-700 dark:text-stone-300 hover:text-stone-900 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onGuardar}
                        disabled={guardando || !borrador.description.trim()}
                        className="px-5 min-h-10 text-xs font-black uppercase tracking-wider bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white rounded-xl shadow-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-700"
                    >
                        {guardando ? 'Guardando...' : 'Crear tarea'}
                    </button>
                </div>
            </div>
        </div>
    );
}
