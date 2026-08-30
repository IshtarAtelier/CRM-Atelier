'use client';

/**
 * La cabecera de la conversación abierta: quién es, en qué estado está la
 * ventana de 24 h, y las acciones sobre ESTE chat (buscar, etiquetar, archivar,
 * seguimientos, asistente).
 *
 * Accesibilidad: los botones eran de 28 px con íconos sin rótulo. Acá todos
 * llegan a 40 px, declaran `aria-label` y el interruptor del asistente usa
 * `role="switch"` con su estado escrito al lado ("Activa" / "Inactiva").
 */

import { useState } from 'react';
import {
    Archive, ArchiveRestore, Calendar, ChevronLeft, Loader2, Maximize2, Phone, Search, Sparkles, Tag, X,
} from 'lucide-react';
import { ChatLabelPicker } from '../ChatLabelPicker';
import { getDisplayName, inicialDe, rotuloSeguimiento, telefonoVisible } from '../format';
import { LabelChips } from './LabelChips';
import { WindowBadge } from './WindowBadge';
import type { Chat, Tag as TagType } from '../types';

const botonIcono =
    'min-w-10 min-h-10 inline-flex items-center justify-center border rounded-xl transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';
const botonNeutro =
    'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700';

export interface ChatHeaderProps {
    chat: Chat;
    tags: TagType[];
    esApiOficial: boolean;
    /** Volver al listado (móvil, o la ventana flotante). */
    onVolver: () => void;
    /** Ir a la pantalla completa. Solo lo pasa la ventana flotante. */
    onExpandir?: () => void;
    onAbrirResumen: () => void;
    onCrearTarea: () => void;
    extrayendoFicha: boolean;
    onCrearFicha: () => void;
    buscadorAbierto: boolean;
    onAlternarBuscador: () => void;
    selectorEtiquetasAbierto: boolean;
    onSelectorEtiquetas: (abierto: boolean) => void;
    onAlternarEtiqueta: (label: string) => Promise<void>;
    onArchivar: () => void;
    onCambiarEtiquetas: (etiquetas: string[]) => void;
    onToggleBot: (activo: boolean) => void;
    compacto?: boolean;
}

export function ChatHeader({
    chat,
    tags,
    esApiOficial,
    onVolver,
    onExpandir,
    onAbrirResumen,
    onCrearTarea,
    extrayendoFicha,
    onCrearFicha,
    buscadorAbierto,
    onAlternarBuscador,
    selectorEtiquetasAbierto,
    onSelectorEtiquetas,
    onAlternarEtiqueta,
    onArchivar,
    onCambiarEtiquetas,
    onToggleBot,
    compacto = false,
}: ChatHeaderProps) {
    const [menuSeguimientos, setMenuSeguimientos] = useState(false);
    const etiquetas = chat.chatLabels || [];
    const seguimientos = etiquetas.filter(l => l.startsWith('SEGUIMIENTO_'));
    const sinSeguimiento = etiquetas.includes('SIN_SEGUIMIENTO');
    const nombre = getDisplayName(chat);

    const cancelarSeguimientos = () => {
        const next = etiquetas.filter(l => !l.startsWith('SEGUIMIENTO_'));
        if (!next.includes('SIN_SEGUIMIENTO')) next.push('SIN_SEGUIMIENTO');
        onCambiarEtiquetas(next);
        setMenuSeguimientos(false);
    };
    const reactivarSeguimientos = () => {
        onCambiarEtiquetas(etiquetas.filter(l => l !== 'SIN_SEGUIMIENTO'));
        setMenuSeguimientos(false);
    };
    const bloquearSeguimientos = () => {
        if (!etiquetas.includes('SIN_SEGUIMIENTO')) onCambiarEtiquetas([...etiquetas, 'SIN_SEGUIMIENTO']);
        setMenuSeguimientos(false);
    };

    return (
        <div className="px-4 py-3 bg-white/90 dark:bg-black/30 backdrop-blur-md border-b border-stone-200 dark:border-white/10 flex items-center justify-between gap-2 shrink-0 z-10 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
                <button
                    type="button"
                    onClick={onVolver}
                    aria-label="Volver al listado"
                    className={`${compacto ? '' : 'lg:hidden'} ${botonIcono} ${botonNeutro}`}
                >
                    <ChevronLeft className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                </button>

                <div aria-hidden className="w-10 h-10 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center text-sm font-black shrink-0 shadow-md">
                    {inicialDe(chat)}
                </div>

                <div className="min-w-0">
                    <button
                        type="button"
                        onClick={onAbrirResumen}
                        title="Ver y editar el resumen del chat"
                        className="text-sm font-black text-stone-900 dark:text-white truncate flex items-center gap-1.5 hover:text-violet-800 dark:hover:text-violet-300 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                        {nombre}
                        {chat.client && (
                            <span className="px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-stone-800 text-[10px] font-black tracking-widest uppercase text-stone-700 dark:text-stone-300 shrink-0">
                                CRM
                            </span>
                        )}
                    </button>
                    <div className="text-[11px] font-bold text-stone-700 dark:text-stone-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Phone className="w-3 h-3" aria-hidden /> {telefonoVisible(chat)}
                        {chat.client ? (
                            <a
                                href={`/admin/contactos?id=${chat.client.id}`}
                                className="px-2 py-1 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-md text-[10px] uppercase tracking-wider font-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            >
                                Ver ficha
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={onCrearFicha}
                                disabled={extrayendoFicha}
                                className="px-2.5 py-1 bg-violet-700 hover:bg-violet-800 text-white rounded-lg text-[10px] uppercase tracking-wider font-black transition-all shadow-md disabled:opacity-60 inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            >
                                {extrayendoFicha
                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Analizando...</>
                                    : <><Sparkles className="w-3 h-3" /> Crear ficha</>}
                            </button>
                        )}
                        {esApiOficial && <WindowBadge chat={chat} compacto={compacto} />}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                {onExpandir && (
                    <button
                        type="button"
                        onClick={onExpandir}
                        aria-label="Abrir en la pantalla completa del buzón"
                        title="Abrir en el buzón completo"
                        className={`${botonIcono} ${botonNeutro}`}
                    >
                        <Maximize2 className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                    </button>
                )}

                {!compacto && chat.client && (
                    <button
                        type="button"
                        onClick={onCrearTarea}
                        className="hidden lg:inline-flex items-center gap-1.5 px-3 min-h-10 text-xs font-bold bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-50 transition-colors shadow-sm mr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                        <Calendar className="w-4 h-4 text-violet-700 dark:text-violet-400" aria-hidden />
                        Crear tarea
                    </button>
                )}

                {!compacto && (
                    <LabelChips
                        etiquetas={etiquetas}
                        tags={tags}
                        onCancelarSeguimientos={cancelarSeguimientos}
                        onReactivarSeguimientos={reactivarSeguimientos}
                        onVerTodas={() => onSelectorEtiquetas(true)}
                    />
                )}

                <button
                    type="button"
                    onClick={onAlternarBuscador}
                    aria-label="Buscar en esta conversación"
                    aria-pressed={buscadorAbierto}
                    title="Buscar en esta conversación"
                    className={`${botonIcono} ${buscadorAbierto ? 'bg-emerald-700 border-emerald-700' : botonNeutro}`}
                >
                    <Search className={`w-4 h-4 ${buscadorAbierto ? 'text-white' : 'text-stone-700 dark:text-stone-300'}`} />
                </button>

                {!compacto && (
                    <>
                        <ChatLabelPicker
                            labels={etiquetas}
                            availableTags={tags}
                            onToggle={onAlternarEtiqueta}
                            isOpen={selectorEtiquetasAbierto}
                            onOpenChange={onSelectorEtiquetas}
                            triggerIcon={<Tag className="w-4 h-4 text-stone-700 dark:text-stone-300" />}
                        />

                        <button
                            type="button"
                            onClick={onArchivar}
                            aria-label={chat.archived ? 'Desarchivar la conversación' : 'Archivar la conversación'}
                            title={chat.archived ? 'Desarchivar' : 'Archivar'}
                            className={`${botonIcono} ${botonNeutro}`}
                        >
                            {chat.archived
                                ? <ArchiveRestore className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                                : <Archive className="w-4 h-4 text-stone-700 dark:text-stone-300" />}
                        </button>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setMenuSeguimientos(v => !v)}
                                aria-expanded={menuSeguimientos}
                                aria-label={
                                    sinSeguimiento
                                        ? 'Seguimientos bloqueados. Gestionar seguimientos'
                                        : seguimientos.length > 0
                                            ? `${seguimientos.length} seguimientos enviados. Gestionar seguimientos`
                                            : 'Sin seguimientos. Gestionar seguimientos'
                                }
                                title="Gestionar seguimientos"
                                className={`${botonIcono} relative ${
                                    sinSeguimiento
                                        ? 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-900'
                                        : seguimientos.length > 0
                                            ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-900'
                                            : botonNeutro
                                }`}
                            >
                                <Calendar className={`w-4 h-4 ${sinSeguimiento ? 'text-red-700 dark:text-red-300' : seguimientos.length > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-stone-700 dark:text-stone-300'}`} />
                                {(seguimientos.length > 0 || sinSeguimiento) && (
                                    <span
                                        aria-hidden
                                        className={`absolute -top-1 -right-1 w-4 h-4 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-sm ${sinSeguimiento ? 'bg-red-600' : 'bg-amber-600'}`}
                                    >
                                        {sinSeguimiento ? '✕' : seguimientos.length}
                                    </span>
                                )}
                            </button>

                            {menuSeguimientos && (
                                <div className="absolute right-0 top-12 bg-white dark:bg-stone-900 border border-stone-300 dark:border-white/10 rounded-2xl shadow-2xl z-50 w-60 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[11px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-widest px-1">Seguimientos</p>
                                        <button
                                            type="button"
                                            onClick={() => setMenuSeguimientos(false)}
                                            aria-label="Cerrar el menú de seguimientos"
                                            className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                                        >
                                            <X className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
                                        </button>
                                    </div>

                                    {seguimientos.length > 0 ? (
                                        <>
                                            {seguimientos.map(lbl => (
                                                <div key={lbl} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 mb-1">
                                                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300">📅 {rotuloSeguimiento(lbl, true)}</span>
                                                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">Enviado ✓</span>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={cancelarSeguimientos}
                                                className="w-full mt-2 px-3 min-h-10 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 rounded-xl text-xs font-bold transition-all border border-red-300 dark:border-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                            >
                                                🚫 Cancelar todos los seguimientos
                                            </button>
                                        </>
                                    ) : sinSeguimiento ? (
                                        <>
                                            <p className="px-2 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 mb-2 text-xs font-bold text-red-800 dark:text-red-300">
                                                🚫 Seguimientos desactivados
                                            </p>
                                            <button
                                                type="button"
                                                onClick={reactivarSeguimientos}
                                                className="w-full px-3 min-h-10 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all border border-emerald-300 dark:border-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                            >
                                                ✅ Reactivar seguimientos
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <p className="px-2 py-2 rounded-lg bg-stone-100 dark:bg-stone-800 mb-2 text-xs font-medium text-stone-700 dark:text-stone-300">
                                                Sin seguimientos programados
                                            </p>
                                            <button
                                                type="button"
                                                onClick={bloquearSeguimientos}
                                                className="w-full px-3 min-h-10 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 rounded-xl text-xs font-bold transition-all border border-red-300 dark:border-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                            >
                                                🚫 Bloquear seguimientos futuros
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="w-px h-6 bg-stone-300 dark:bg-stone-700 mx-0.5" />
                    </>
                )}

                <div className="flex items-center gap-2 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-full border border-stone-300 dark:border-stone-700 shadow-sm">
                    <div className="flex flex-col items-end leading-tight">
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-400">Asistente</span>
                        <span className={`text-[11px] font-bold ${chat.botEnabled ? 'text-violet-800 dark:text-violet-300' : 'text-stone-600 dark:text-stone-400'}`}>
                            {chat.botEnabled ? 'Activa' : 'Inactiva'}
                        </span>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={chat.botEnabled}
                        aria-label={`Asistente en este chat: ${chat.botEnabled ? 'activa' : 'inactiva'}`}
                        onClick={() => onToggleBot(!chat.botEnabled)}
                        className={`w-11 h-6 rounded-full transition-colors relative shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${chat.botEnabled ? 'bg-violet-700' : 'bg-stone-400 dark:bg-stone-600'}`}
                    >
                        <span className={`block w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${chat.botEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                    </button>
                </div>
            </div>
        </div>
    );
}
