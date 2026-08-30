'use client';

/**
 * Las respuestas rápidas.
 *
 * Las que son plantilla oficial de Meta se envían DIRECTO como plantilla (con
 * confirmación), nunca se pegan al textarea: pegadas, con la ventana de 24 h
 * cerrada, el 409 truncaba el texto a 60 caracteres como "tema" de
 * retomar_conversacion y salía un mensaje roto (pasó en vivo el 30/8). Por eso
 * acá se ven separadas y rotuladas como plantilla.
 */

import { QUICK_REPLIES } from '../quick-replies';
import type { QuickReply } from '../types';

export interface QuickRepliesPanelProps {
    /** Texto libre: se pega en el redactor. */
    onElegirTexto: (texto: string) => void;
    /** Plantilla oficial: se envía como plantilla. */
    onElegirPlantilla: (qr: QuickReply) => void;
}

export function QuickRepliesPanel({ onElegirTexto, onElegirPlantilla }: QuickRepliesPanelProps) {
    const libres = QUICK_REPLIES.filter(q => !q.templateName);
    const plantillas = QUICK_REPLIES.filter(q => q.templateName);

    const boton = (qr: QuickReply, esPlantilla: boolean) => (
        <button
            key={qr.label}
            type="button"
            onClick={() => (esPlantilla ? onElegirPlantilla(qr) : onElegirTexto(qr.text))}
            className={`px-4 py-2 min-h-10 rounded-xl shadow-sm hover:shadow-md border transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                esPlantilla
                    ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-800'
                    : 'bg-white dark:bg-stone-700 border-stone-300 dark:border-stone-600'
            }`}
        >
            <span className="block text-[12px] font-black text-stone-900 dark:text-white uppercase tracking-wider">
                {qr.label}
            </span>
            <span className="block text-xs text-stone-700 dark:text-stone-300 truncate max-w-[220px] mt-0.5">
                {qr.text}
            </span>
        </button>
    );

    return (
        <div className="mb-4 bg-stone-50 dark:bg-stone-800 rounded-3xl p-4 border border-stone-300 dark:border-stone-700 shadow-inner max-h-56 overflow-y-auto">
            <p className="text-[11px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-widest mb-3">
                Respuestas rápidas
            </p>
            <div className="flex flex-wrap gap-2">{libres.map(qr => boton(qr, false))}</div>

            <p className="text-[11px] font-black text-violet-800 dark:text-violet-300 uppercase tracking-widest mt-4 mb-2">
                Plantillas aprobadas · salen aunque la conversación esté cerrada
            </p>
            <div className="flex flex-wrap gap-2">{plantillas.map(qr => boton(qr, true))}</div>
        </div>
    );
}
