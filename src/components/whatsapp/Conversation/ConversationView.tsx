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

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { formatDateDivider } from '../format';
import { MessageBubble } from './MessageBubble';
import { useWhatsAppAcciones, useWhatsAppDatos } from '../WhatsAppProvider';
import { PAGINA_MENSAJES } from '@/lib/whatsapp/paginacion';
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

        // ── Paginación hacia atrás ────────────────
        // La API trae de a 60 (`PAGINA_MENSAJES`); scrollear cerca del techo
        // pide la página anterior y se recoloca el scroll para que el mensaje
        // que se estaba leyendo no se mueva. Vive acá y no en las pantallas:
        // el buzón completo y la ventana flotante lo heredan igual.
        const { sinAnteriores, cargandoAnteriores } = useWhatsAppDatos();
        const { cargarMensajesAnteriores } = useWhatsAppAcciones();
        const pidiendoAnteriores = useRef(false);
        const hayAnteriores = mensajes.length >= PAGINA_MENSAJES && !sinAnteriores[chatId];

        const onScroll = useCallback(async () => {
            const caja = cajaRef.current;
            if (!caja || pidiendoAnteriores.current || !hayAnteriores) return;
            if (caja.scrollTop > 120) return;
            pidiendoAnteriores.current = true;
            const alturaPrevia = caja.scrollHeight;
            const topPrevio = caja.scrollTop;
            await cargarMensajesAnteriores(chatId);
            requestAnimationFrame(() => {
                const c = cajaRef.current;
                if (c) c.scrollTop = c.scrollHeight - alturaPrevia + topPrevio;
                pidiendoAnteriores.current = false;
            });
        }, [cargarMensajesAnteriores, chatId, hayAnteriores]);

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
                onScroll={onScroll}
                // Sin el anclaje nativo del navegador: al prepender la página
                // anterior ya recolocamos el scroll a mano, y con los dos
                // activos la vista saltaba el doble.
                className={`flex-1 overflow-y-auto [overflow-anchor:none] ${compacto ? 'px-3 py-4 space-y-3' : 'px-6 py-8 space-y-6'} custom-scrollbar-smooth`}
            >
                {hayAnteriores && (
                    <div className="flex justify-center py-1" aria-live="polite">
                        <span className="text-[11px] font-medium text-stone-600 dark:text-stone-400">
                            {cargandoAnteriores ? 'Cargando mensajes anteriores…' : 'Subí para ver mensajes anteriores'}
                        </span>
                    </div>
                )}
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
