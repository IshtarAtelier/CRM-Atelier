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
// En un 2x1 hay una foto POR armazón: son dos armazones distintos, con medidas
// distintas, y cada imagen tiene que corresponderse con los datos de su cuadro.
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
    /** Recuadro chico, para cuando conviven dos armazones en pantalla. */
    compact?: boolean;
}

export default function FramePhotoUploader({ value, onChange, label, readOnly = false, hint, compact = false }: Props) {
    const [subiendo, setSubiendo] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /** El archivo en base64, para poder mostrárselo al verificador. */
    const aBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
        fr.onerror = () => reject(new Error('No se pudo leer el archivo'));
        fr.readAsDataURL(file);
    });

    const subir = async (file: File) => {
        setError(null);
        setSubiendo(true);
        try {
            // 1. ¿Es un armazón? Se verifica ANTES de subir: si no lo es, no se
            //    guarda nada. Sin este paso, la forma más rápida de cumplir el
            //    requisito obligatorio es subir cualquier imagen — y esa foto no
            //    prueba nada el día del reclamo.
            const base64 = await aBase64(file);
            const ver = await fetch('/api/frame-photo/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64, mimeType: file.type }),
            }).then(r => r.json()).catch(() => ({ ok: true }));

            if (ver?.ok === false) {
                setError(`Esa foto no es un armazón: ${ver.motivo} Sacale una foto al anteojo.`);
                return;
            }

            // 2. Recién ahora se sube.
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
    const caja = compact ? 'w-20 h-20' : 'w-32 h-32';

    return (
        <div>
            <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">{label}</p>

            {src ? (
                <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src}
                        alt={`Foto del armazón — ${label}`}
                        className={`${caja} object-cover rounded-2xl border-2 border-stone-200 dark:border-stone-700`}
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
                <label className={`${caja} rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-600 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors`}>
                    {subiendo ? (
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    ) : (
                        <>
                            <Camera className={compact ? 'w-5 h-5 text-stone-400' : 'w-6 h-6 text-stone-400'} />
                            <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 text-center px-1">Subir foto</span>
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
