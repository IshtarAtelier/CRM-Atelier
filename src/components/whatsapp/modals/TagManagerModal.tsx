'use client';

/**
 * Gestor de etiquetas del buzón.
 *
 * Una etiqueta no es solo un color: puede apagar o encender el bot al asignarse,
 * avisar por WhatsApp a un número, y la IA puede ponerla sola si se le escribe
 * una condición. Por eso el editor está acá completo y no en un menú al paso.
 */

import { useState } from 'react';
import { Bot, Phone, Plus, Sparkles, Tag as TagIcon, X } from 'lucide-react';
import type { Tag } from '../types';

export interface TagManagerModalProps {
    tags: Tag[];
    /** Vuelve a pedir la lista al servidor después de guardar o borrar. */
    onRecargar: () => Promise<void> | void;
    onCerrar: () => void;
}

const campo =
    'w-full bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl px-4 py-2.5 min-h-10 text-sm font-medium text-stone-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-700/30 focus:border-violet-700';
const rotulo = 'text-[11px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5';

export function TagManagerModal({ tags, onRecargar, onCerrar }: TagManagerModalProps) {
    const [editando, setEditando] = useState<Partial<Tag> | null>(null);
    const [guardando, setGuardando] = useState(false);

    const guardar = async () => {
        if (!editando?.name) { alert('El nombre es obligatorio'); return; }
        setGuardando(true);
        try {
            const method = editando.id ? 'PUT' : 'POST';
            const url = editando.id ? `/api/tags/${editando.id}` : '/api/tags';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editando),
            });
            if (!res.ok) {
                const errText = await res.text();
                alert(`Error al guardar (Código ${res.status}): ${errText.substring(0, 100)}`);
                return;
            }
            await onRecargar();
            setEditando(null);
        } catch (error) {
            alert('Error de conexión: ' + (error instanceof Error ? error.message : 'desconocido'));
        } finally {
            setGuardando(false);
        }
    };

    const borrar = async () => {
        if (!editando?.id) return;
        if (!confirm('¿Seguro que querés borrar esta etiqueta?')) return;
        await fetch(`/api/tags/${editando.id}`, { method: 'DELETE' });
        await onRecargar();
        setEditando(null);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Gestor de etiquetas">
            <div className="bg-white dark:bg-stone-900 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-stone-200 dark:border-stone-800 flex justify-between items-center">
                    <h2 className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                        <TagIcon className="w-6 h-6 text-violet-700 dark:text-violet-400" aria-hidden />
                        Gestor de etiquetas e IA
                    </h2>
                    <button type="button" onClick={onCerrar} aria-label="Cerrar" className="min-w-10 min-h-10 inline-flex items-center justify-center bg-stone-100 dark:bg-stone-800 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                        <X className="w-5 h-5 text-stone-700 dark:text-stone-300" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-8">
                    <div className="lg:w-1/3 flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-widest mb-2">Etiquetas actuales</h3>
                        {tags.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setEditando(t)}
                                aria-pressed={editando?.id === t.id}
                                className={`flex items-center justify-between p-3 min-h-10 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                                    editando?.id === t.id ? 'border-violet-600 ring-1 ring-violet-600' : 'border-stone-300 dark:border-stone-800 hover:border-violet-400'
                                }`}
                            >
                                <span className="flex items-center gap-3">
                                    <span aria-hidden className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: t.color || '#9e7f65' }} />
                                    <span className="text-sm font-bold text-stone-800 dark:text-stone-200">{t.name}</span>
                                </span>
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setEditando({ name: '', color: '#1677ff', botAction: 'NONE', notifyPhone: '', autoAssignCondition: '' })}
                            className="mt-2 flex items-center justify-center gap-2 p-3 min-h-10 border-2 border-dashed border-stone-400 dark:border-stone-700 rounded-2xl text-stone-700 dark:text-stone-300 hover:text-violet-800 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-all font-bold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                            <Plus className="w-4 h-4" aria-hidden /> Crear nueva
                        </button>
                    </div>

                    <div className="lg:w-2/3 bg-stone-50 dark:bg-stone-900/50 p-6 rounded-3xl border border-stone-300 dark:border-stone-800 flex flex-col gap-5">
                        {editando ? (
                            <>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label htmlFor="tag-nombre" className={rotulo}>Nombre de la etiqueta</label>
                                        <input id="tag-nombre" type="text" value={editando.name || ''} onChange={e => setEditando({ ...editando, name: e.target.value })} className={campo} placeholder="Ej: Urgente, VIP, Proveedor" />
                                    </div>
                                    <div>
                                        <label htmlFor="tag-color" className={rotulo}>Color</label>
                                        <input id="tag-color" type="color" value={editando.color || '#1677ff'} onChange={e => setEditando({ ...editando, color: e.target.value })} className="w-14 h-[42px] bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl p-1 cursor-pointer" />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="tag-condicion" className={rotulo}>
                                        <Sparkles className="w-3.5 h-3.5 text-violet-700 dark:text-violet-400" aria-hidden /> Condición de auto-asignación (IA)
                                    </label>
                                    <textarea id="tag-condicion" value={editando.autoAssignCondition || ''} onChange={e => setEditando({ ...editando, autoAssignCondition: e.target.value })} rows={3} className={`${campo} resize-none`} placeholder="Opcional. Ej: Cuando el cliente diga que necesita los lentes rápido o use la palabra urgente." />
                                    <p className="text-[11px] text-stone-700 dark:text-stone-300 mt-1.5">
                                        Si escribís una condición, el bot detecta la intención en la conversación y aplica esta etiqueta automáticamente.
                                    </p>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-5">
                                    <div className="flex-1">
                                        <label htmlFor="tag-accion" className={rotulo}><Bot className="w-3.5 h-3.5" aria-hidden /> Acción del bot</label>
                                        <select id="tag-accion" value={editando.botAction || 'NONE'} onChange={e => setEditando({ ...editando, botAction: e.target.value })} className={campo}>
                                            <option value="NONE">No hacer nada (solo visual)</option>
                                            <option value="TURN_OFF">Apagar bot al asignar</option>
                                            <option value="TURN_ON">Activar bot al asignar</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label htmlFor="tag-aviso" className={rotulo}><Phone className="w-3.5 h-3.5" aria-hidden /> Notificación por WhatsApp</label>
                                        <input id="tag-aviso" type="text" value={editando.notifyPhone || ''} onChange={e => setEditando({ ...editando, notifyPhone: e.target.value })} className={campo} placeholder="Opcional. Ej: 5493512222222" />
                                        <p className="text-[11px] text-stone-700 dark:text-stone-300 mt-1">Se envía un WhatsApp a este número cuando se asigne la etiqueta.</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-stone-200 dark:border-stone-800">
                                    {editando.id ? (
                                        <button type="button" onClick={borrar} className="px-4 min-h-10 text-xs font-bold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                                            Borrar
                                        </button>
                                    ) : <div />}
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={() => setEditando(null)} className="px-5 min-h-10 text-sm font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                                            Cancelar
                                        </button>
                                        <button type="button" onClick={guardar} disabled={guardando} className="px-6 min-h-10 bg-violet-700 hover:bg-violet-800 text-white text-sm font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-700">
                                            {guardando ? 'Guardando...' : 'Guardar etiqueta'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-stone-600 dark:text-stone-400 gap-3 py-10">
                                <TagIcon className="w-12 h-12 opacity-30" aria-hidden />
                                <p className="text-sm font-medium">Seleccioná una etiqueta o creá una nueva.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
