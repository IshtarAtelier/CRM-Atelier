'use client';

/**
 * La ventana de servicio de 24 h de la API oficial.
 *
 * Dentro de la ventana se puede responder con texto libre; fuera, SOLO con una
 * plantilla aprobada por Meta. Es la diferencia entre que un mensaje salga o
 * rebote con un 409, así que se dice con palabras y con ícono — nunca con el
 * verde/ámbar solo.
 */

import { Clock, Lock } from 'lucide-react';
import { ventana24h } from '../format';
import type { Chat } from '../types';

export function WindowBadge({ chat, compacto = false }: { chat: Chat; compacto?: boolean }) {
    const { abierta, texto } = ventana24h(chat);
    const clases = `inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${compacto ? 'text-[10px]' : 'text-[11px]'} uppercase tracking-wide font-black`;

    if (abierta) {
        return (
            <span
                className={`${clases} bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200`}
                title="El cliente escribió hace menos de 24 h: se puede responder con texto libre"
            >
                <Clock className="w-3 h-3" aria-hidden /> Conversación abierta · {texto}
            </span>
        );
    }

    return (
        <span
            className={`${clases} bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200`}
            title="Pasaron más de 24 h desde el último mensaje del cliente: solo se puede mandar una plantilla aprobada"
        >
            <Lock className="w-3 h-3" aria-hidden /> Conversación cerrada · solo plantilla
        </span>
    );
}
