'use client';

import { Sparkles, X } from 'lucide-react';
import { ModalShell } from './ModalShell';

export interface SummaryModalProps {
    texto: string;
    onTexto: (v: string) => void;
    onGuardar: () => void;
    onCerrar: () => void;
}

/**
 * El resumen del chat. No es una nota decorativa: el bot lo lee para no perder
 * el contexto, así que lo que se escriba acá cambia lo que el asistente responde.
 */
export function SummaryModal({ texto, onTexto, onGuardar, onCerrar }: SummaryModalProps) {
    return (
        <ModalShell etiqueta="el resumen del chat" onCerrar={onCerrar}>
            <div className="flex flex-col min-h-0">
                <div className="px-6 py-5 border-b border-stone-200 dark:border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-black text-stone-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-violet-700 dark:text-violet-400" aria-hidden /> Resumen del chat
                    </h3>
                    <button type="button" onClick={onCerrar} aria-label="Cerrar" className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                        <X className="w-5 h-5 text-stone-700 dark:text-stone-300" />
                    </button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    <p className="text-xs text-stone-700 dark:text-stone-300 mb-4 font-medium">
                        Este resumen e hitos son leídos automáticamente por el bot para no perder el contexto.
                        Podés editarlo si querés agregar una indicación especial para el asistente o para vos.
                    </p>
                    <label htmlFor="resumen-chat" className="sr-only">Resumen del chat</label>
                    <textarea
                        id="resumen-chat"
                        value={texto}
                        onChange={e => onTexto(e.target.value)}
                        rows={8}
                        placeholder="Aún no hay un resumen para este chat..."
                        className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-sm font-medium text-stone-900 dark:text-white focus:ring-2 focus:ring-violet-700 focus:border-transparent transition-all resize-none"
                    />
                </div>
                <div className="px-6 py-5 border-t border-stone-200 dark:border-white/10 flex justify-end gap-3">
                    <button type="button" onClick={onCerrar} className="px-4 min-h-10 text-sm font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                        Cancelar
                    </button>
                    <button type="button" onClick={onGuardar} className="px-5 min-h-10 bg-violet-700 hover:bg-violet-800 text-white text-sm font-bold rounded-xl shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-700">
                        Guardar resumen
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}
