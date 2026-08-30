'use client';

/**
 * La zona de escritura: emojis, adjunto, respuestas rápidas, textarea, micrófono
 * y enviar. Es el mismo redactor en la pantalla completa y en la ventana
 * flotante; `compacto` solo achica, no saca funciones.
 *
 * Accesibilidad: todos los botones son de 40 px o más, llevan `aria-label` (los
 * de ícono suelto no decían nada a un lector de pantalla) y anillo de foco
 * visible. El estado "grabando" se dice con texto, no solo con el color rojo.
 */

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { Bot, Mic, Paperclip, Send, Smile, X } from 'lucide-react';
import { BarraGrabacion, useGrabadorAudio } from './AudioRecorder';
import { QuickRepliesPanel } from './QuickRepliesPanel';
import type { AdjuntoMedia, QuickReply } from '../types';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

export interface ComposerProps {
    texto: string;
    onTexto: (v: string) => void;
    adjunto: AdjuntoMedia | null;
    onAdjunto: (a: AdjuntoMedia | null) => void;
    enviando: boolean;
    onEnviar: () => void;
    onEnviarAudio: (base64: string, mimetype: string) => void;
    onPlantillaRapida: (qr: QuickReply) => void;
    compacto?: boolean;
}

export function Composer({
    texto,
    onTexto,
    adjunto,
    onAdjunto,
    enviando,
    onEnviar,
    onEnviarAudio,
    onPlantillaRapida,
    compacto = false,
}: ComposerProps) {
    const [verEmojis, setVerEmojis] = useState(false);
    const [verRapidas, setVerRapidas] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { grabando, segundos, empezar, detener, cancelar } = useGrabadorAudio(onEnviarAudio);

    const elegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            onAdjunto({ base64, mimetype: file.type, filename: file.name });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const hayContenido = texto.trim().length > 0 || !!adjunto;
    const botonIcono = 'min-w-10 min-h-10 p-2.5 rounded-2xl transition-all shadow-sm inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';

    return (
        <div className={`${compacto ? 'p-3' : 'p-4'} bg-white/90 dark:bg-stone-900/90 backdrop-blur-2xl border-t border-stone-200 dark:border-white/10 shrink-0`}>
            {verRapidas && (
                <QuickRepliesPanel
                    onElegirTexto={t => { setVerRapidas(false); onTexto(t); }}
                    onElegirPlantilla={qr => { setVerRapidas(false); onPlantillaRapida(qr); }}
                />
            )}

            {adjunto && (
                <div className="mb-4 inline-flex items-center gap-3 p-2 pr-4 bg-stone-100 dark:bg-stone-800 rounded-2xl border border-stone-300 dark:border-stone-700">
                    <div className="relative">
                        <img
                            src={`data:${adjunto.mimetype};base64,${adjunto.base64}`}
                            alt={`Adjunto ${adjunto.filename}`}
                            className="h-14 w-14 object-cover rounded-xl"
                        />
                        <button
                            type="button"
                            onClick={() => onAdjunto(null)}
                            aria-label="Quitar el adjunto"
                            className="absolute -top-2 -right-2 w-6 h-6 bg-stone-900 text-white rounded-full flex items-center justify-center shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Adjunto listo</span>
                </div>
            )}

            <div className="flex items-end gap-3 max-w-[1200px] mx-auto relative">
                {verEmojis && (
                    <div className="absolute bottom-[80px] left-0 z-50 drop-shadow-2xl">
                        <EmojiPicker
                            onEmojiClick={emojiData => onTexto(texto + emojiData.emoji)}
                            autoFocusSearch={false}
                        />
                    </div>
                )}

                <div className="flex bg-stone-100 dark:bg-stone-800 rounded-3xl p-1.5 shadow-inner">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,application/pdf"
                        className="hidden"
                        onChange={elegirArchivo}
                    />
                    <button
                        type="button"
                        onClick={() => setVerEmojis(v => !v)}
                        aria-label="Emojis"
                        aria-pressed={verEmojis}
                        title="Emojis"
                        className={`${botonIcono} ${verEmojis ? 'bg-white text-emerald-700' : 'text-stone-700 dark:text-stone-300 hover:bg-white hover:text-stone-900'}`}
                    >
                        <Smile className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Adjuntar archivo"
                        title="Adjuntar archivo"
                        className={`${botonIcono} text-stone-700 dark:text-stone-300 hover:bg-white hover:text-stone-900`}
                    >
                        <Paperclip className="w-5 h-5 -rotate-45" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setVerRapidas(v => !v)}
                        aria-label="Respuestas rápidas"
                        aria-pressed={verRapidas}
                        title="Respuestas rápidas"
                        className={`${botonIcono} ${verRapidas ? 'bg-indigo-100 text-indigo-800' : 'text-stone-700 dark:text-stone-300 hover:bg-white hover:text-indigo-800'}`}
                    >
                        <Bot className="w-5 h-5" />
                    </button>
                </div>

                {grabando ? (
                    <BarraGrabacion segundos={segundos} onCancelar={cancelar} />
                ) : (
                    <div className="flex-1 bg-white dark:bg-stone-800 border-[3px] border-stone-200 dark:border-stone-700 rounded-[2rem] flex items-end px-6 shadow-sm focus-within:border-emerald-600 transition-colors">
                        <textarea
                            aria-label="Escribir un mensaje"
                            value={texto}
                            onChange={e => {
                                onTexto(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    onEnviar();
                                    setTimeout(() => {
                                        if (e.target instanceof HTMLTextAreaElement) e.target.style.height = 'auto';
                                    }, 10);
                                }
                            }}
                            onFocus={() => setVerEmojis(false)}
                            placeholder="Escribí un mensaje..."
                            rows={1}
                            className="w-full py-4 bg-transparent outline-none text-[15px] font-medium text-stone-900 dark:text-white placeholder:text-stone-500 resize-none overflow-y-auto custom-scrollbar-smooth"
                            style={{ minHeight: compacto ? '48px' : '56px', maxHeight: '150px' }}
                        />
                    </div>
                )}

                {!hayContenido && !grabando ? (
                    <button
                        type="button"
                        onClick={empezar}
                        aria-label="Grabar un audio"
                        title="Grabar un audio"
                        className="h-14 w-14 bg-emerald-700 hover:bg-emerald-800 text-white rounded-[2rem] flex items-center justify-center shadow-xl transition-all active:scale-95 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-700"
                    >
                        <Mic className="w-6 h-6" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={grabando ? detener : onEnviar}
                        disabled={enviando}
                        aria-label={grabando ? 'Enviar el audio grabado' : 'Enviar mensaje'}
                        title={grabando ? 'Enviar el audio' : 'Enviar'}
                        className="h-14 w-14 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-[2rem] flex items-center justify-center shadow-xl transition-all active:scale-95 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-700"
                    >
                        <Send className="w-6 h-6 ml-1" />
                    </button>
                )}
            </div>
        </div>
    );
}
