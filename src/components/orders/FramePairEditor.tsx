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
import { Glasses, ChevronDown } from 'lucide-react';
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
    /** Posición del armazón: 1..N (uno por par de cristales). */
    pair: number;
    /** Título del cuadro: "Armazón" o "1º / 2º / 3º…". */
    title: string;
    initial: FramePairValues;
    /** Aviso al padre después de un guardado exitoso (refresca la ficha). */
    onSaved?: () => void | Promise<void>;
    /** Estilo del par 2 en el resto del sistema: borde naranja. */
    accent?: 'stone' | 'orange';
    /**
     * El teñido que va en ESTE armazón ("Compacto · Sepia · grado 3"), tal cual
     * quedó cargado en la línea del pedido. Se muestra acá porque es donde se
     * lee sin adivinar: el teñido se elige en la línea del cristal, y con dos
     * anteojos en pantalla no había forma de ver a cuál de los dos le tocaba.
     */
    tint?: string | null;
    /** Los cristales de este armazón son fotocromáticos. */
    photochromic?: boolean;
}

export default function FramePairEditor({ orderId, pair, title, initial, onSaved, accent = 'stone', tint = null, photochromic = false }: Props) {
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
            // Un endpoint por POSICIÓN: guardar este armazón nunca toca a los
            // otros, por más que haya cuatro en pantalla.
            const res = await fetch(`/api/orders/${orderId}/frames/${pair}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(v),
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

    // Con dos armazones en pantalla el scroll se hace largo, así que el cuadro
    // arranca PLEGADO cuando ya está completo: lo que falta cargar se ve, lo
    // que ya está hecho se resume en una línea y se abre con un clic.
    const completo = !!(v.shape && v.a && v.b && v.dbl && v.edc && v.imageUrl);
    const [abierto, setAbierto] = useState(!completo);

    const resumen = [v.shape, [v.a, v.b, v.edc, v.dbl].filter(Boolean).join('/'),
        v.heightOD || v.heightOI ? `Alt ${v.heightOD || '—'}/${v.heightOI || '—'}` : null]
        .filter(Boolean).join(' · ');

    return (
        <div className={`bg-stone-50 dark:bg-stone-900/50 rounded-[2rem] px-5 py-4 border-2 ${borde}`}>
            <div className="flex items-center gap-2">
                <Glasses className={`w-4 h-4 shrink-0 ${iconoColor}`} />
                <h4 className={`text-[10px] font-black ${tituloColor} uppercase tracking-widest shrink-0`}>{title}</h4>

                {/* Plegado: el resumen de una línea reemplaza al cuadro entero. */}
                {!abierto && (
                    <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 truncate flex-1">
                        {resumen || 'sin cargar'}
                        {v.imageUrl ? ' · 📷' : ''}
                    </span>
                )}
                {abierto && <span className="flex-1" />}

                {completo && !abierto && <span className="text-[10px] font-black text-emerald-600 shrink-0">✓</span>}
                {saved && <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 shrink-0">Guardado</span>}

                {abierto && (
                    <button
                        onClick={guardar}
                        disabled={saving}
                        className="px-4 py-2 bg-stone-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shrink-0"
                    >
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => setAbierto(o => !o)}
                    aria-expanded={abierto}
                    aria-label={abierto ? `Plegar ${title}` : `Desplegar ${title}`}
                    className="p-1 text-stone-400 hover:text-stone-600 shrink-0"
                >
                    <ChevronDown className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Plegado, el cristal de este armazón se resume en una tira fina:
                el cuadro cerrado tiene que decir qué lleva sin ocupar alto. */}
            {!abierto && (tint || photochromic) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {tint && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-violet-600 text-white">
                            Teñido · {tint}
                        </span>
                    )}
                    {photochromic && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            Fotocromático
                        </span>
                    )}
                </div>
            )}

            {abierto && (
                <>
                    {/* Todo en una sola grilla: medidas y altura juntas, sin
                        separadores ni subtítulos que solo agregan alto. La altura
                        va acá porque varía con el armazón; la DNP es del cliente
                        y vive en la receta. */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-3">
                        {campo('Forma / Aro', 'shape', 'Redondo')}
                        {campo('Horiz. (A)', 'a', '52')}
                        {campo('Vert. (B)', 'b', '45')}
                        {campo('Puente', 'dbl', '18')}
                        {campo('Diag. (ED)', 'edc', '54')}
                        {campo('Altura OD', 'heightOD', '20')}
                        {campo('Altura OI', 'heightOI', '20')}
                    </div>

                    {/* Foto y detalles en la misma fila: la foto es chica y deja
                        todo el resto del ancho al texto. */}
                    <div className="flex gap-4 mt-3">
                        <FramePhotoUploader
                            label="Foto *"
                            value={v.imageUrl}
                            onChange={set('imageUrl')}
                            compact
                        />
                        <div className="flex-1">
                            {campo('Detalles / Notas del Armazón', 'details', 'Ej: Patillas con flex, acetato negro')}
                            <p className="mt-1 text-[10px] font-medium text-stone-400">
                                La foto la ve el cliente en la confirmación de compra.
                            </p>
                        </div>
                    </div>

                    {/* Qué cristal va en ESTE armazón. Va abajo de todo y en
                        grande a propósito: es lo último que se lee antes de
                        guardar, y es el dato que el cliente va a ver junto a
                        esta misma foto. Se carga en la línea del pedido — acá
                        se muestra para poder controlarlo, no para editarlo. */}
                    {(tint || photochromic) && (
                        <div className="mt-3 rounded-2xl border-2 border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-4 py-3">
                            <p className="text-[9px] font-black text-violet-500 dark:text-violet-400 uppercase tracking-widest mb-1">
                                El cristal de este armazón
                            </p>
                            {tint && (
                                <p className="text-sm font-black text-violet-800 dark:text-violet-200 uppercase tracking-wide">
                                    Cristal teñido · {tint}
                                </p>
                            )}
                            {photochromic && (
                                <p className="text-sm font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                                    Cristal fotocromático
                                </p>
                            )}
                            <p className="mt-1 text-[10px] font-medium text-violet-500 dark:text-violet-400">
                                Se elige en la línea del teñido, arriba. Esto es lo que va a leer el cliente al lado de la foto.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
