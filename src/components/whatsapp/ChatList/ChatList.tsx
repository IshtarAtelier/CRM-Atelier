'use client';

/**
 * El listado del buzón. Sirve a las dos vistas: la pantalla completa
 * (`/admin/whatsapp`) y la ventana flotante, que lo pide `compacto` y sin filtros.
 */

import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { ChatListItem } from './ChatListItem';
import type { Chat } from '../types';

export interface ChatListProps {
    chats: Chat[];
    chatSeleccionadoId?: string | null;
    asistenteGlobalActivo?: boolean;
    compacto?: boolean;
    /** Qué decir cuando no hay nada que mostrar. */
    vacioTexto?: string;
    onSeleccionar: (chat: Chat) => void;
    onFijar?: (chat: Chat) => void;
    onArchivar?: (chat: Chat) => void;
}

export function ChatList({
    chats,
    chatSeleccionadoId,
    asistenteGlobalActivo = false,
    compacto = false,
    vacioTexto = 'Todo limpio.',
    onSeleccionar,
    onFijar,
    onArchivar,
}: ChatListProps) {
    if (chats.length === 0) {
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <WhatsAppIcon className="w-6 h-6 text-stone-400" />
                    </div>
                    <p className="text-sm font-bold text-stone-600 dark:text-stone-400">{vacioTexto}</p>
                </div>
            </div>
        );
    }

    return (
        <div
            role="list"
            aria-label="Conversaciones"
            className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar"
        >
            {chats.map(chat => (
                <div role="listitem" key={chat.id}>
                    <ChatListItem
                        chat={chat}
                        seleccionado={chatSeleccionadoId === chat.id}
                        asistenteGlobalActivo={asistenteGlobalActivo}
                        compacto={compacto}
                        onSeleccionar={onSeleccionar}
                        onFijar={onFijar}
                        onArchivar={onArchivar}
                    />
                </div>
            ))}
        </div>
    );
}
