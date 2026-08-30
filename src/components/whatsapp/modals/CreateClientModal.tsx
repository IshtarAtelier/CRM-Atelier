'use client';

import { Loader2, Sparkles, UserPlus, X } from 'lucide-react';
import { CONTACT_SOURCES_SELECCIONABLES } from '@/lib/contact-source';
import { ModalShell } from './ModalShell';
import type { ClienteExtraido } from '../types';

export interface CreateClientModalProps {
    datos: ClienteExtraido;
    onDatos: (d: ClienteExtraido) => void;
    creando: boolean;
    onConfirmar: () => void;
    onCerrar: () => void;
}

const campo =
    'w-full px-3 py-2 min-h-10 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-white focus:ring-2 focus:ring-violet-700 focus:border-transparent transition-all';
const rotulo = 'text-[11px] font-black uppercase tracking-widest text-stone-700 dark:text-stone-300 mb-1 block';

/**
 * La ficha que propone la IA a partir de la conversación.
 *
 * Quién la crea es la persona logueada (lo resuelve el servidor con la sesión);
 * `creationMethod: 'ASISTENTE_WHATSAPP'` solo declara CÓMO — apretó el botón del
 * buzón con los datos que prellenó el asistente, que es distinto de que el bot
 * la haya creado solo.
 */
export function CreateClientModal({ datos, onDatos, creando, onConfirmar, onCerrar }: CreateClientModalProps) {
    const incompleto = !datos.name.trim() || !datos.contactSource?.trim() || !datos.phone?.trim();

    return (
        <ModalShell etiqueta="la ficha del cliente" onCerrar={onCerrar} ancho="max-w-md">
            <div className="overflow-y-auto">
                <div className="px-6 py-4 bg-violet-700 flex items-center justify-between">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5" aria-hidden /> Crear ficha
                    </h3>
                    <button type="button" onClick={onCerrar} aria-label="Cerrar" className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
                <p className="px-6 pt-3 text-xs text-stone-700 dark:text-stone-300 font-medium">
                    Datos extraídos automáticamente de la conversación. Editá lo que necesites antes de confirmar.
                </p>

                <div className="p-6 space-y-3">
                    <div>
                        <label htmlFor="ficha-nombre" className={rotulo}>Nombre *</label>
                        <input id="ficha-nombre" value={datos.name} onChange={e => onDatos({ ...datos, name: e.target.value })} className={campo} />
                    </div>
                    <div>
                        <label htmlFor="ficha-tel" className={rotulo}>Teléfono *</label>
                        <input id="ficha-tel" value={datos.phone || ''} onChange={e => onDatos({ ...datos, phone: e.target.value || null })} placeholder="Ej: 3515551234" className={campo} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="ficha-interes" className={rotulo}>Interés</label>
                            <input id="ficha-interes" value={datos.interest || ''} onChange={e => onDatos({ ...datos, interest: e.target.value || null })} placeholder="Ej: Multifocal" className={campo} />
                        </div>
                        <div>
                            <label htmlFor="ficha-obra" className={rotulo}>Obra social</label>
                            <input id="ficha-obra" value={datos.insurance || ''} onChange={e => onDatos({ ...datos, insurance: e.target.value || null })} placeholder="Ej: OSDE" className={campo} />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="ficha-origen" className={rotulo}>Origen *</label>
                        <select id="ficha-origen" value={datos.contactSource || ''} onChange={e => onDatos({ ...datos, contactSource: e.target.value })} className={`${campo} cursor-pointer`}>
                            <option value="">Seleccionar origen...</option>
                            {CONTACT_SOURCES_SELECCIONABLES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="ficha-notas" className={rotulo}>Notas</label>
                        <textarea id="ficha-notas" value={datos.notes || ''} onChange={e => onDatos({ ...datos, notes: e.target.value || null })} rows={2} placeholder="Detalles importantes de la conversación..." className={`${campo} resize-none`} />
                    </div>
                </div>

                <div className="px-6 pb-5 flex gap-2">
                    <button type="button" onClick={onCerrar} className="flex-1 px-4 min-h-10 bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-stone-300 dark:hover:bg-stone-700 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirmar}
                        disabled={creando || incompleto}
                        className="flex-1 px-4 min-h-10 bg-violet-700 hover:bg-violet-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-700"
                    >
                        {creando
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</>
                            : <><UserPlus className="w-4 h-4" /> Crear ficha</>}
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}
