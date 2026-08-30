'use client';

/**
 * Modal "la conversación está cerrada": aparece cuando el buzón intenta mandar
 * texto libre a un cliente que no escribió en las últimas 24 h (API oficial
 * de WhatsApp). Ofrece mandar la plantilla aprobada `retomar_conversacion`
 * con el nombre y el tema; el texto que quería mandar el vendedor queda como
 * sugerencia de tema y NO se envía (Meta solo permite el texto aprobado).
 */

import { useState } from 'react';
import { WHATSAPP_TEMPLATES, renderTemplate } from '@/lib/whatsapp/templates';

interface Props {
    open: boolean;
    chatId: string;
    nombre: string;
    /** Texto que el vendedor había escrito: se usa como tema sugerido. */
    textoOriginal: string;
    onClose: () => void;
    /** Se llama cuando la plantilla salió bien. */
    onSent: () => void;
}

export function TemplatePromptModal({ open, chatId, nombre, textoOriginal, onClose, onSent }: Props) {
    // El texto original solo sirve de tema si ya ES un tema corto: un mensaje
    // largo o con saltos de línea truncado a 60 caracteres salía como un
    // "tema" roto (pasó en vivo el 30/8). En ese caso el campo queda vacío y
    // la vendedora escribe un tema breve a mano (el botón queda deshabilitado
    // hasta que lo haga).
    const [tema, setTema] = useState(() => {
        const original = textoOriginal || '';
        if (original.length > 60 || original.includes('\n')) return '';
        return original.replace(/\s+/g, ' ').trim();
    });
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) return null;
    const def = WHATSAPP_TEMPLATES.retomar_conversacion;
    const preview = renderTemplate('retomar_conversacion', [nombre || 'cliente', tema || 'tu consulta']);

    const enviar = async () => {
        setSending(true);
        setError(null);
        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId,
                    message: '',
                    forceTemplate: true,
                    template: { name: def.name, bodyParams: [nombre || 'cliente', tema.trim()] },
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
            onSent();
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-6">
                <h2 className="text-lg font-black text-stone-800 dark:text-white tracking-tight">La conversación está cerrada</h2>
                <p className="text-sm text-stone-500 mt-1">
                    Pasaron más de 24 h desde el último mensaje del cliente. WhatsApp solo deja mandar una
                    <strong> plantilla aprobada</strong>; cuando responda, se abre de nuevo y podés escribir libre.
                </p>

                <label className="block mt-5 text-[10px] font-black uppercase tracking-widest text-stone-400">Tema (breve)</label>
                <input
                    value={tema}
                    onChange={e => setTema(e.target.value)}
                    maxLength={60}
                    className="mt-1 w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="tus lentes multifocales"
                />

                <div className="mt-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 p-4 text-sm text-stone-700 dark:text-stone-200 whitespace-pre-wrap">
                    {preview}
                    <div className="mt-2 flex gap-2">
                        {def.buttons?.map(b => (
                            <span key={b.text} className="px-3 py-1 rounded-full bg-white dark:bg-stone-800 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300">{b.text}</span>
                        ))}
                    </div>
                </div>

                {textoOriginal?.trim() && (
                    <p className="mt-3 text-xs text-stone-400">Tu mensaje original no se envía; guardalo para cuando el cliente conteste.</p>
                )}
                {error && <p className="mt-3 text-xs font-bold text-red-600">{error}</p>}

                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800">Cancelar</button>
                    <button onClick={enviar} disabled={sending || !tema.trim()} className="px-5 py-2 rounded-xl text-sm font-black bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                        {sending ? 'Enviando…' : 'Enviar plantilla'}
                    </button>
                </div>
            </div>
        </div>
    );
}
