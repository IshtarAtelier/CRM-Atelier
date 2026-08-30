'use client';

/**
 * El hilo de mensajes: separadores de día, burbujas y el auto-scroll.
 *
 * El auto-scroll vive acá porque es una regla del hilo, no de la pantalla:
 *  - al abrir otro chat, salta al final sin animación;
 *  - con el polling de 15 s NO baja si la persona estaba leyendo más arriba
 *    (antes cada recarga te devolvía al fondo y era imposible leer algo viejo);
 *  - con el buscador abierto nunca salta: te arrancaría el resultado de la vista.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { formatDateDivider } from '../format';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../types';

export interface ConversationHandle {
    /** Lleva la vista al último mensaje (lo usa el envío optimista). */
    irAlFinal: (suave?: boolean) => void;
}

export interface ConversationViewProps {
    mensajes: Message[];
    /** Cambiar de chat resetea el scroll; por eso el id es parte del contrato. */
    chatId: string;
    inicialContacto: string;
    busqueda?: string;
    idResultadoActivo?: string | null;
    compacto?: boolean;
}

export const ConversationView = forwardRef<ConversationHandle, ConversationViewProps>(
    function ConversationView({ mensajes, chatId, inicialContacto, busqueda = '', idResultadoActivo = null, compacto = false }, ref) {
        const cajaRef = useRef<HTMLDivElement>(null);
        const finRef = useRef<HTMLDivElement>(null);
        const ultimoChatScrolleado = useRef<string | null>(null);

        useImperativeHandle(ref, () => ({
            irAlFinal: (suave = true) => {
                setTimeout(() => finRef.current?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto' }), 100);
            },
        }), []);

        useEffect(() => {
            if (busqueda.trim()) return;
            const esChatNuevo = ultimoChatScrolleado.current !== chatId;

            const caja = cajaRef.current;
            const estabaAbajo = !caja || caja.scrollHeight - caja.scrollTop - caja.clientHeight < 150;
            if (!esChatNuevo && !estabaAbajo) return;

            // El timeout deja que imágenes y DOM rendericen antes de medir.
            const t = setTimeout(() => {
                finRef.current?.scrollIntoView({ behavior: esChatNuevo ? 'auto' : 'smooth' });
            }, 50);

            if (esChatNuevo && mensajes.length > 0) {
                ultimoChatScrolleado.current = chatId;
            }
            return () => clearTimeout(t);
            // `busqueda` a propósito fuera: abrir la lupa no debe disparar un salto.
        }, [mensajes, chatId]);

        return (
            <div
                ref={cajaRef}
                className={`flex-1 overflow-y-auto ${compacto ? 'px-3 py-4 space-y-3' : 'px-6 py-8 space-y-6'} custom-scrollbar-smooth`}
            >
                {mensajes.map((msg, idx) => {
                    let mostrarDivisor = idx === 0;
                    if (idx > 0) {
                        const anterior = mensajes[idx - 1];
                        mostrarDivisor = new Date(msg.createdAt).toDateString() !== new Date(anterior.createdAt).toDateString();
                    }

                    return (
                        <div key={msg.id || `msg-${idx}`} id={`msg-${msg.id}`} className="flex flex-col w-full gap-4">
                            {mostrarDivisor && (
                                <div className="flex justify-center w-full my-1">
                                    <span className="bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                                        {formatDateDivider(msg.createdAt)}
                                    </span>
                                </div>
                            )}
                            <MessageBubble
                                msg={msg}
                                inicialContacto={inicialContacto}
                                busqueda={busqueda}
                                esResultadoActivo={msg.id === idResultadoActivo}
                                compacto={compacto}
                            />
                        </div>
                    );
                })}
                <div ref={finRef} className="h-4" />
            </div>
        );
    }
);
