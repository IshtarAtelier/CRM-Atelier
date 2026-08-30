'use client';

/**
 * Grabación de audio del redactor.
 *
 * El micrófono es un recurso del sistema operativo: si la pantalla se desmonta
 * en medio de una grabación (cambio de página, cierre de la ventana flotante),
 * quedaban vivos el intervalo del contador Y el `MediaRecorder` con los tracks
 * del stream abiertos — el navegador seguía mostrando "grabando" sin nadie
 * escuchando. El cleanup de abajo apaga las dos cosas y anula el `onstop` para
 * que no intente enviar un audio a mitad de desmontaje.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Trash2 } from 'lucide-react';
import { formatTime } from '../format';

export interface GrabadorAudio {
    grabando: boolean;
    segundos: number;
    empezar: () => Promise<void>;
    detener: () => void;
    cancelar: () => void;
}

/** @param onAudioListo se llama con el audio ya en base64 cuando se suelta el botón. */
export function useGrabadorAudio(onAudioListo: (base64: string, mimetype: string) => void): GrabadorAudio {
    const [grabando, setGrabando] = useState(false);
    const [segundos, setSegundos] = useState(0);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const callbackRef = useRef(onAudioListo);
    callbackRef.current = onAudioListo;

    const empezar = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            recorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = e => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(t => t.stop());
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    callbackRef.current(base64, 'audio/webm');
                };
            };

            recorder.start();
            setGrabando(true);
            setSegundos(0);
            timerRef.current = setInterval(() => setSegundos(prev => prev + 1), 1000);
        } catch (err) {
            console.error('Error al acceder al micrófono:', err);
            alert('No se pudo acceder al micrófono. Por favor, revisa los permisos del navegador.');
        }
    }, []);

    const detener = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        }
        setGrabando(false);
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    const cancelar = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.onstop = null; // que no se envíe lo grabado
            recorder.stream.getTracks().forEach(t => t.stop());
            recorder.stop();
        }
        setGrabando(false);
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            const recorder = recorderRef.current;
            if (recorder && recorder.state !== 'inactive') {
                recorder.onstop = null;
                recorder.stream.getTracks().forEach(t => t.stop());
                recorder.stop();
            }
        };
    }, []);

    return { grabando, segundos, empezar, detener, cancelar };
}

/** La barra roja que reemplaza al textarea mientras se graba. */
export function BarraGrabacion({ segundos, onCancelar }: { segundos: number; onCancelar: () => void }) {
    return (
        <div
            role="status"
            className="flex-1 flex items-center gap-4 bg-red-50 dark:bg-red-950/40 px-6 py-[14px] rounded-[2rem] border-[3px] border-red-300 dark:border-red-900 shadow-sm"
        >
            <Mic className="w-4 h-4 text-red-700 dark:text-red-300 shrink-0" aria-hidden />
            <span className="text-red-800 dark:text-red-200 font-black tracking-widest tabular-nums">{formatTime(segundos)}</span>
            <span className="text-red-800 dark:text-red-200 text-[13px] font-bold flex-1">Grabando audio...</span>
            <button
                type="button"
                onClick={onCancelar}
                aria-label="Descartar la grabación"
                title="Descartar la grabación"
                className="min-w-10 min-h-10 inline-flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
                <Trash2 className="w-5 h-5" />
            </button>
        </div>
    );
}
