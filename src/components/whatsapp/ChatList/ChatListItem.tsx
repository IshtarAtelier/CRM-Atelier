'use client';

/**
 * Una fila del buzón.
 *
 * Accesibilidad: los botones de fijar/archivar aparecían solo al pasar el mouse
 * (`opacity-0 group-hover`), lo que los volvía invisibles con teclado y difíciles
 * de encontrar con baja visión. Ahora también se muestran con el foco
 * (`focus-within`) y cada uno declara su estado en `aria-label`, no solo en color.
 */

import { format } from 'date-fns';
import { Archive, ArchiveRestore, Bot, Heart, Pin } from 'lucide-react';
import { getDisplayName, inicialDe } from '../format';
import type { Chat } from '../types';

export interface ChatListItemProps {
    chat: Chat;
    seleccionado: boolean;
    /** El asistente global está encendido: solo entonces el punto del bot significa algo. */
    asistenteGlobalActivo?: boolean;
    /** Vista reducida (ventana flotante): sin acciones de fila ni avatar grande. */
    compacto?: boolean;
    onSeleccionar: (chat: Chat) => void;
    onFijar?: (chat: Chat) => void;
    onArchivar?: (chat: Chat) => void;
}

export function ChatListItem({
    chat,
    seleccionado,
    asistenteGlobalActivo = false,
    compacto = false,
    onSeleccionar,
    onFijar,
    onArchivar,
}: ChatListItemProps) {
    const etiquetas = chat.chatLabels || [];
    const fijado = etiquetas.includes('Fijado') || !!chat.client?.isFavorite;
    const ultimo = chat.messages?.[0];
    const nombre = getDisplayName(chat);

    return (
        <div
            role="button"
            tabIndex={0}
            aria-current={seleccionado ? 'true' : undefined}
            onClick={() => onSeleccionar(chat)}
            onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSeleccionar(chat);
                }
            }}
            className={`w-full text-left p-3 rounded-2xl transition-all relative border group/card cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
                seleccionado
                    ? 'bg-white dark:bg-stone-800 border-transparent shadow-lg shadow-black/5 ring-1 ring-stone-900/10 dark:ring-white/10 z-10'
                    : 'hover:bg-white/60 dark:hover:bg-stone-800/50 border-transparent text-stone-800 dark:text-stone-200'
            }`}
        >
            <div className="flex items-center gap-3">
                <div className="relative group/avatar">
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onFijar?.(chat); }}
                        disabled={!onFijar}
                        aria-label={fijado ? `Quitar a ${nombre} de favoritos` : `Marcar a ${nombre} como favorito`}
                        title={fijado ? 'Quitar de favoritos' : 'Marcar como favorito'}
                        className={`${compacto ? 'w-10 h-10 text-base' : 'w-12 h-12 text-lg'} rounded-2xl flex items-center justify-center font-black shrink-0 transition-all duration-200 relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                            fijado
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                                : seleccionado
                                    ? chat.botEnabled
                                        ? 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-md'
                                        : 'bg-emerald-600 text-white'
                                    : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200'
                        } ${onFijar ? 'hover:scale-110' : ''}`}
                    >
                        {fijado ? (
                            <Heart className="w-5 h-5 fill-current text-white" />
                        ) : (
                            <>
                                <span className={onFijar ? 'group-hover/avatar:hidden' : ''}>{inicialDe(chat)}</span>
                                {onFijar && (
                                    <Heart className="w-5 h-5 hidden group-hover/avatar:block text-stone-600 dark:text-stone-300 fill-transparent" />
                                )}
                            </>
                        )}
                    </button>
                    {chat.botEnabled && asistenteGlobalActivo && !seleccionado && (
                        <span
                            title="El asistente responde este chat"
                            className="absolute -bottom-1 -right-1 w-5 h-5 bg-violet-600 rounded-full border-2 border-white dark:border-stone-900 flex items-center justify-center pointer-events-none"
                        >
                            <Bot className="w-3 h-3 text-white" />
                        </span>
                    )}
                </div>

                <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between gap-2">
                        <span className={`text-[13px] font-black truncate flex items-center gap-1.5 ${seleccionado ? 'text-stone-900 dark:text-white' : ''}`}>
                            {!compacto && onFijar && (
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); onFijar(chat); }}
                                    aria-label={etiquetas.includes('Fijado') ? `Desfijar ${nombre}` : `Fijar ${nombre} arriba`}
                                    title={etiquetas.includes('Fijado') ? 'Desfijar' : 'Fijar'}
                                    className={`transition-all duration-200 shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                                        etiquetas.includes('Fijado')
                                            ? 'text-amber-600 opacity-100'
                                            : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100'
                                    }`}
                                >
                                    <Pin className={`w-3.5 h-3.5 ${etiquetas.includes('Fijado') ? 'fill-current' : 'rotate-45'}`} />
                                </button>
                            )}
                            {!compacto && onArchivar && (
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); onArchivar(chat); }}
                                    aria-label={chat.archived ? `Desarchivar ${nombre}` : `Archivar ${nombre}`}
                                    title={chat.archived ? 'Desarchivar' : 'Archivar'}
                                    className={`transition-all duration-200 shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                                        chat.archived
                                            ? 'text-stone-600 dark:text-stone-300 opacity-100'
                                            : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100'
                                    }`}
                                >
                                    {chat.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                                </button>
                            )}
                            <span className="truncate flex items-center gap-1">
                                {nombre}
                                {etiquetas.some(l => l.startsWith('SEGUIMIENTO_')) && (
                                    <span title="Seguimiento activo" aria-label="Seguimiento activo" className="text-[10px]">📅</span>
                                )}
                                {etiquetas.includes('SIN_SEGUIMIENTO') && (
                                    <span title="Sin seguimiento" aria-label="Sin seguimiento" className="text-[10px]">🚫</span>
                                )}
                            </span>
                        </span>
                        {chat.lastMessageAt && (
                            <span className="text-[11px] text-stone-600 dark:text-stone-400 font-bold shrink-0 tabular-nums">
                                {format(new Date(chat.lastMessageAt), 'HH:mm')}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                        <p className={`text-[12px] truncate max-w-[80%] ${chat.unreadCount > 0 ? 'font-black text-stone-900 dark:text-white' : 'text-stone-600 dark:text-stone-400 font-medium'}`}>
                            {ultimo ? (
                                <>
                                    {ultimo.direction === 'OUTBOUND' && <span className="opacity-70 mr-1">Tú:</span>}
                                    {ultimo.type === 'AUDIO' ? '🎧 Audio' : ultimo.type === 'IMAGE' ? '📷 Imagen' : ultimo.content}
                                </>
                            ) : '...'}
                        </p>
                        {chat.unreadCount > 0 && (
                            <span
                                aria-label={`${chat.unreadCount} sin leer`}
                                className="min-w-5 h-5 px-1.5 bg-emerald-600 text-white rounded-full text-[11px] font-black flex items-center justify-center shadow-sm"
                            >
                                {chat.unreadCount}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
