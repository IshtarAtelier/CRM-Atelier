'use client';

/**
 * El adjunto de un mensaje: audio, imagen, video o documento — y el texto de
 * reemplazo cuando WhatsApp mandó el tipo pero no la URL.
 */

import { Archive, FileText, Image as ImageIcon, Mic, Paperclip, PlaySquare } from 'lucide-react';
import { resolveMediaUrl } from '../format';
import type { Message } from '../types';

export function MessageMedia({ msg }: { msg: Message }) {
    const url = resolveMediaUrl(msg.mediaUrl);

    if (msg.mediaUrl) {
        if (msg.type === 'AUDIO') {
            return (
                <div className="mb-2 bg-black/5 dark:bg-white/10 p-2 rounded-2xl flex flex-col gap-2 border border-black/10">
                    <div className="flex items-center">
                        <Mic className="w-5 h-5 opacity-70 mr-2 shrink-0" aria-hidden />
                        <audio controls src={url} className="h-10 w-48 outline-none" preload="metadata" />
                    </div>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold underline underline-offset-2 ml-7 hover:opacity-80"
                    >
                        Descargar audio (si no se reproduce)
                    </a>
                </div>
            );
        }
        if (msg.type === 'IMAGE') {
            return (
                <div className="mb-2 overflow-hidden rounded-xl border border-black/10">
                    <img
                        src={url}
                        alt="Imagen enviada en la conversación"
                        className="max-w-full max-h-64 object-contain"
                        onError={e => {
                            const t = e.target as HTMLImageElement;
                            t.src = '';
                            t.alt = 'Imagen no disponible';
                            t.style.opacity = '0.5';
                            t.style.height = '40px';
                        }}
                    />
                </div>
            );
        }
        if (msg.type === 'VIDEO') {
            return (
                <div className="mb-2 overflow-hidden rounded-xl border border-black/10">
                    <video controls src={url} className="max-w-full max-h-64 object-contain rounded-xl" />
                </div>
            );
        }
        if (msg.type === 'DOCUMENT') {
            const nombre = msg.content && msg.content !== '[Media/Documento]' && msg.content !== '[Media]'
                ? msg.content
                : 'Documento PDF';
            return (
                <div className="mb-2 bg-stone-100 dark:bg-stone-800 p-3 rounded-2xl flex items-center justify-between border border-stone-300 dark:border-stone-700 max-w-xs gap-3">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="w-6 h-6 text-stone-600 dark:text-stone-300 shrink-0" aria-hidden />
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">{nombre}</p>
                            <span className="text-[10px] text-stone-600 dark:text-stone-400 uppercase tracking-widest font-extrabold">Documento</span>
                        </div>
                    </div>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-10 min-h-10 inline-flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        aria-label={`Descargar ${nombre}`}
                        title="Descargar documento"
                    >
                        <Paperclip className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                    </a>
                </div>
            );
        }
        return null;
    }

    // Sin URL: el tipo llegó pero el archivo no. Se dice con texto, no con un hueco.
    const fallback: Record<string, { icono: React.ReactNode; texto: string }> = {
        AUDIO: { icono: <Mic className="w-4 h-4" aria-hidden />, texto: 'Audio de WhatsApp' },
        IMAGE: { icono: <ImageIcon className="w-4 h-4" aria-hidden />, texto: 'Imagen de WhatsApp' },
        VIDEO: { icono: <PlaySquare className="w-4 h-4" aria-hidden />, texto: 'Video de WhatsApp' },
        DOCUMENT: { icono: <Archive className="w-4 h-4" aria-hidden />, texto: 'Documento de WhatsApp' },
    };
    const f = fallback[msg.type];
    if (!f) return null;
    return (
        <div className="mb-1 flex items-center gap-2 italic text-sm opacity-80">
            {f.icono} {f.texto}
        </div>
    );
}
