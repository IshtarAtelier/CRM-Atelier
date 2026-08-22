"use client";

/**
 * EL GLOBO DE URGENTES. Flota por encima de todo el panel, en cualquier
 * pantalla, hasta que la persona lee el mensaje.
 *
 * LA REGLA: se puede ACHICAR, no cerrar. Un botón de "cerrar" convierte al
 * urgente en un cartel más que se descarta sin leer por reflejo — que es
 * exactamente lo que hay que evitar. Achicado sigue visible como una burbuja
 * con el número, latiendo en la esquina, y vuelve a abrirse con un clic.
 *
 * Deja de aparecer cuando el mensaje queda LEÍDO, y leído es lo mismo que para
 * el resto del sistema: se abrió la conversación. No hay un estado separado de
 * "cerré el pop-up" que pueda contradecir al de lectura.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronDown, MessageSquareWarning, ArrowRight } from 'lucide-react';

interface Urgente {
    id: string;
    threadId: string;
    body: string;
    createdAt: string;
    senderName: string;
    subject: string | null;
}

export function UrgentePopup({ urgentes }: { urgentes: Urgente[] }) {
    const router = useRouter();
    const [achicado, setAchicado] = useState(false);
    const [indice, setIndice] = useState(0);

    // Si llega uno NUEVO estando achicado, se vuelve a abrir solo: si no, un
    // urgente posterior quedaría escondido detrás de la burbuja que la persona
    // ya había minimizado y nunca se enteraría.
    const idsClave = urgentes.map(u => u.id).join(',');
    useEffect(() => {
        if (urgentes.length > 0) {
            setAchicado(false);
            setIndice(0);
        }
    }, [idsClave, urgentes.length]);

    if (urgentes.length === 0) return null;

    const u = urgentes[Math.min(indice, urgentes.length - 1)];
    const hora = new Date(u.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    const ir = () => router.push(`/admin/mensajes?abrir=${u.threadId}`);

    // ── Achicado: burbuja en la esquina, imposible de perder de vista ──
    if (achicado) {
        return (
            <button
                onClick={() => setAchicado(false)}
                aria-label={`${urgentes.length} mensaje urgente sin leer. Abrir.`}
                className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 rounded-full bg-red-600 px-4 py-3 text-white shadow-2xl ring-4 ring-red-600/25 animate-bounce hover:bg-red-700 transition"
            >
                <MessageSquareWarning size={20} />
                <span className="text-sm font-bold">
                    {urgentes.length === 1 ? '1 urgente' : `${urgentes.length} urgentes`}
                </span>
            </button>
        );
    }

    // ── Abierto: barra sobre todo el panel ──
    return (
        <div
            role="alertdialog"
            aria-live="assertive"
            aria-label="Mensaje urgente"
            className="fixed inset-x-0 top-0 z-[9999] flex justify-center px-3 pt-3 pointer-events-none"
        >
            <div className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-2 ring-red-500 animate-[slideDown_.25s_ease-out]">
                {/* Encabezado */}
                <div className="flex items-center gap-2 bg-red-600 px-4 py-2 text-white">
                    <AlertTriangle size={18} className="animate-pulse shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider">Mensaje urgente</span>
                    {urgentes.length > 1 && (
                        <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold">
                            {indice + 1} de {urgentes.length}
                        </span>
                    )}
                    <button
                        onClick={() => setAchicado(true)}
                        title="Achicar (sigue visible hasta que lo leas)"
                        aria-label="Achicar el aviso"
                        className="ml-auto rounded-lg p-1 hover:bg-white/20 transition"
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>

                {/* El globo de conversación */}
                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-100 text-sm font-black text-red-700">
                            {u.senderName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-bold text-stone-800">{u.senderName}</span>
                                <span className="text-[11px] text-stone-500">{hora}</span>
                            </div>
                            {u.subject && (
                                <div className="text-xs font-semibold text-stone-600">{u.subject}</div>
                            )}
                            {/* La colita del globo, apuntando al autor */}
                            <div className="relative mt-1.5 rounded-2xl rounded-tl-sm bg-stone-100 px-4 py-2.5">
                                <span
                                    aria-hidden
                                    className="absolute -left-1.5 top-2 h-3 w-3 rotate-45 bg-stone-100"
                                />
                                <p className="relative whitespace-pre-wrap break-words text-sm text-stone-800">
                                    {u.body}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                        {urgentes.length > 1 && (
                            <button
                                onClick={() => setIndice(i => (i + 1) % urgentes.length)}
                                className="rounded-lg px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
                            >
                                Ver el siguiente
                            </button>
                        )}
                        <button
                            onClick={ir}
                            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition"
                        >
                            Leer y responder <ArrowRight size={15} />
                        </button>
                    </div>

                    <p className="mt-2 text-center text-[10px] text-stone-500">
                        Se puede achicar, pero sigue visible hasta que abras el mensaje.
                    </p>
                </div>
            </div>
        </div>
    );
}
