'use client';

// ────────────────────────────────────────────────────────────────────────────
// La foto del armazón, sacada por el VENDEDOR al cerrar la venta.
//
// La primera versión de la confirmación de compra le pedía la foto al cliente.
// Estaba al revés: el cliente tiene que RECONOCER su armazón, no fotografiarlo
// — pedirle trabajo justo cuando le estamos pidiendo que revise el pedido es la
// forma más segura de que no haga ninguna de las dos cosas. La foto la saca
// quien lo tiene en la mano.
//
// Un 2x1 puede entrar en UNA sola foto: cuando el vendedor sube la primera y
// marca "los dos pares están en esta foto", la segunda se guarda vacía. Es lo
// más práctico en el mostrador, que es donde esto se usa.
// ────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Camera, X, Loader2, AlertTriangle } from 'lucide-react';
import { resolveStorageUrl } from '@/lib/utils/storage';

interface Props {
    /** URL ya guardada (o null). */
    value: string | null | undefined;
    onChange: (url: string | null) => void;
    label: string;
    /** Sin edición: solo se mira la foto (venta ya enviada a fábrica). */
    readOnly?: boolean;
    /** Ayuda debajo del recuadro. */
    hint?: string;
}

export default function FramePhotoUploader({ value, onChange, label, readOnly = false, hint }: Props) {
    const [subiendo, setSubiendo] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const subir = async (file: File) => {
        setError(null);
        setSubiendo(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            if (!res.ok) throw new Error(`El servidor rechazó la imagen (${res.status})`);
            const data = await res.json();
            if (!data?.url) throw new Error('La subida no devolvió una URL');
            onChange(data.url);
        } catch (e: any) {
            // Que el vendedor SEPA que no quedó: un fallo mudo acá significa una
            // venta sin foto y nadie enterándose hasta el reclamo.
            setError(e.message || 'No se pudo subir la foto');
        } finally {
            setSubiendo(false);
        }
    };

    const src = value ? resolveStorageUrl(value) : null;

    return (
        <div>
            <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">{label}</p>

            {src ? (
                <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src}
                        alt={`Foto del armazón — ${label}`}
                        className="w-32 h-32 object-cover rounded-2xl border-2 border-stone-200 dark:border-stone-700"
                    />
                    {!readOnly && (
                        <button
                            type="button"
                            onClick={() => onChange(null)}
                            aria-label={`Quitar la foto de ${label}`}
                            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center hover:scale-110 transition-transform"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            ) : readOnly ? (
                <p className="text-xs font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Sin foto del armazón
                </p>
            ) : (
                <label className="w-32 h-32 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-600 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors">
                    {subiendo ? (
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    ) : (
                        <>
                            <Camera className="w-6 h-6 text-stone-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Subir foto</span>
                        </>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={subiendo}
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) subir(f);
                            e.target.value = '';
                        }}
                    />
                </label>
            )}

            {error && <p className="mt-1 text-[10px] font-bold text-red-500 max-w-32">{error}</p>}
            {hint && !error && <p className="mt-1 text-[10px] font-medium text-stone-400 max-w-40">{hint}</p>}
        </div>
    );
}
