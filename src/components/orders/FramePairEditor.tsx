'use client';

// ────────────────────────────────────────────────────────────────────────────
// El cuadro COMPLETO de un armazón: forma, medidas (A/B/DBL/ED), detalles y su
// foto — con guardado propio.
//
// En un 2x1 hay DOS armazones distintos, así que este cuadro se monta dos
// veces, uno arriba del otro, cada uno con sus datos y su botón de guardar.
// El guardado es individual a propósito: el vendedor mide el primer armazón,
// lo guarda, y recién después agarra el segundo — si el guardado fuera uno
// solo al final, un cierre de pestaña en el medio perdía la mitad del trabajo.
//
// Cada instancia PATCHea SOLO sus campos (par 1: frameA…; par 2: frameA2…),
// así guardar un par jamás pisa lo cargado en el otro.
// ────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Glasses } from 'lucide-react';
import FramePhotoUploader from './FramePhotoUploader';

interface FramePairValues {
    shape: string;
    a: string;
    b: string;
    dbl: string;
    edc: string;
    details: string;
    imageUrl: string | null;
    // Altura pupilar por ojo: VARÍA según el armazón elegido (se toma con el
    // armazón puesto), por eso vive acá. La DNP no: es del cliente y queda en
    // la receta tal cual está cargada.
    heightOD: string;
    heightOI: string;
}

interface Props {
    orderId: string;
    /** 1 = campos base (frameA…), 2 = campos del segundo par (frameA2…). */
    pair: 1 | 2;
    /** Título del cuadro: "Armazón" o "1º / 2º armazón". */
    title: string;
    initial: FramePairValues;
    /** Aviso al padre después de un guardado exitoso (refresca la ficha). */
    onSaved?: () => void | Promise<void>;
    /** Estilo del par 2 en el resto del sistema: borde naranja. */
    accent?: 'stone' | 'orange';
}

/** A qué columnas de la orden escribe cada par. */
const CAMPOS: Record<1 | 2, Record<keyof FramePairValues, string>> = {
    1: { shape: 'labFrameShape', a: 'frameA', b: 'frameB', dbl: 'frameDbl', edc: 'frameEdc', details: 'labFrameDetails', imageUrl: 'frameImageUrl',
         heightOD: 'labHeightOD', heightOI: 'labHeightOI' },
    2: { shape: 'labFrameShape2', a: 'frameA2', b: 'frameB2', dbl: 'frameDbl2', edc: 'frameEdc2', details: 'labFrameDetails2', imageUrl: 'frameImageUrl2',
         heightOD: 'labHeightOD2', heightOI: 'labHeightOI2' },
};

export default function FramePairEditor({ orderId, pair, title, initial, onSaved, accent = 'stone' }: Props) {
    const [v, setV] = useState<FramePairValues>(initial);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const set = (k: keyof FramePairValues) => (val: string | null) => {
        setSaved(false);
        setV(prev => ({ ...prev, [k]: val }));
    };

    const guardar = async () => {
        setSaving(true);
        try {
            const campos = CAMPOS[pair];
            const body: Record<string, unknown> = {};
            (Object.keys(campos) as (keyof FramePairValues)[]).forEach(k => { body[campos[k]] = v[k] || null; });

            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setSaved(true);
                await onSaved?.();
            } else {
                const err = await res.json().catch(() => ({}));
                alert(`⚠️ No se guardó el ${title.toLowerCase()}: ${err.error || 'error desconocido'}`);
            }
        } catch (e: any) {
            alert(`⚠️ Error de red guardando el ${title.toLowerCase()}: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const esNaranja = accent === 'orange';
    const borde = esNaranja ? 'border-orange-200 dark:border-orange-800/50' : 'border-stone-200 dark:border-stone-700';
    const tituloColor = esNaranja ? 'text-orange-600 dark:text-orange-400' : 'text-stone-700 dark:text-stone-300';
    const iconoColor = esNaranja ? 'text-orange-500' : 'text-indigo-500';
    const inputCls = 'w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-800 dark:text-stone-200';

    const campo = (label: string, k: keyof FramePairValues, placeholder: string, extra = '') => (
        <div className={extra}>
            <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">{label}</label>
            <input
                type="text"
                value={(v[k] as string) || ''}
                onChange={(e) => set(k)(e.target.value)}
                placeholder={placeholder}
                className={inputCls}
            />
        </div>
    );

    return (
        <div className={`bg-stone-50 dark:bg-stone-900/50 rounded-[2rem] p-6 border-2 ${borde}`}>
            <div className="flex items-center gap-2 mb-4">
                <Glasses className={`w-5 h-5 ${iconoColor}`} />
                <h4 className={`text-[10px] font-black ${tituloColor} uppercase tracking-widest`}>
                    {title} — medidas, forma y foto
                </h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {campo('Forma / Aro', 'shape', 'Ej: Redondo, Cuadrado')}
                {campo('Horizontal (A)', 'a', 'Ej: 52')}
                {campo('Vertical (B)', 'b', 'Ej: 45')}
                {campo('Puente (Pte / DBL)', 'dbl', 'Ej: 18')}
                {campo('Diagonal (ED / EDC)', 'edc', 'Ej: 54')}
                {campo('Detalles / Notas del Armazón', 'details', 'Ej: Patillas con flex, acetato negro', 'col-span-2 sm:col-span-3')}
            </div>

            {/* Altura pupilar: se toma CON el armazón puesto, así que es de este
                armazón. La DNP no va acá: es del cliente y vive en la receta. */}
            <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-700">
                <p className="text-[9px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-3">
                    Altura pupilar de este armazón
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {campo('Altura OD', 'heightOD', 'Ej: 20')}
                    {campo('Altura OI', 'heightOI', 'Ej: 20')}
                </div>
            </div>

            <div className="mt-5 pt-4 border-t border-stone-200 dark:border-stone-700">
                <FramePhotoUploader
                    label={`Foto del ${title.toLowerCase()} *`}
                    value={v.imageUrl}
                    onChange={set('imageUrl')}
                    hint="La ve el cliente en la confirmación de compra."
                />
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
                {saved && <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">✓ Guardado</span>}
                <button
                    onClick={guardar}
                    disabled={saving}
                    className="px-6 py-2.5 bg-stone-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    {saving ? 'Guardando...' : `Guardar ${title}`}
                </button>
            </div>
        </div>
    );
}
