'use client';

// ────────────────────────────────────────────────────────────────────────────
// El color de UNA línea del pedido, visible y editable donde está el cristal.
//
// Antes el color solo se podía elegir mientras se armaba el presupuesto: una
// vez guardado, corregir un tono obligaba a abrir el presupuesto entero,
// editarlo y volver a guardar todo. Acá se corrige la línea sola.
//
// TEÑIDO y FOTOCROMÁTICO no son lo mismo y no piden lo mismo:
//   · el teñido es un color que se le manda a hacer al cristal → tono, grado
//     (qué tan oscuro) y a qué armazón va: los tres obligatorios para vender.
//   · el fotocromático ya viene así de fábrica y se oscurece solo con el sol →
//     solo se elige de qué color se pone. No tiene grado.
// ────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Palette, Glasses, Check } from 'lucide-react';
import { paletaDeFotocromatico } from '@/lib/constants/paletas-color';
import { TONOS_TENIDO, INTENSIDADES_TENIDO, estiloDeTenidoDelProducto } from '@/lib/constants/tenido';
import { isTeñidoAddon } from '@/lib/promo-utils';

interface Props {
    orderId: string;
    item: any;
    /** Cuántos armazones lleva el pedido: con más de uno hay que decir a cuál va. */
    totalArmazones: number;
    /** false en una venta enviada a fábrica: se muestra, no se edita. */
    editable: boolean;
    onSaved?: () => void | Promise<void>;
}

/** El producto de la línea, mirando también los snapshots (pedidos viejos). */
function productoDe(item: any) {
    return item?.product || {
        name: item?.productNameSnapshot,
        category: item?.productCategorySnapshot,
        type: item?.productTypeSnapshot,
    };
}

export default function LineaColorEditor({ orderId, item, totalArmazones, editable, onSaved }: Props) {
    const producto = productoDe(item);
    const esTenido = isTeñidoAddon(producto);
    const paleta = paletaDeFotocromatico(producto);

    // Una línea que no lleva color a elegir no muestra nada: ni teñido ni
    // fotocromático es la mayoría del pedido.
    const llevaColor = esTenido || !!paleta;

    const [abierto, setAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!llevaColor) return null;

    const tonos = paleta
        ? paleta.tonos
        : TONOS_TENIDO.map(t => ({ name: t.name, hexColor: t.hexColor }));

    const hex = tonos.find(t => t.name === item.crystalColor)?.hexColor || null;
    const estilo = esTenido ? (estiloDeTenidoDelProducto(producto) || item.crystalColorType || 'COMPACTO') : null;

    // Qué le falta a esta línea para poder venderse. El teñido pide los tres.
    const faltaColor = !item.crystalColor;
    const faltaGrado = esTenido && !item.crystalColorNote;
    const faltaArmazon = esTenido && totalArmazones > 1 && !item.framePosition;
    const falta = faltaColor || faltaGrado || faltaArmazon;

    const guardar = async (cambios: Record<string, unknown>) => {
        setGuardando(true);
        setError(null);
        try {
            const res = await fetch(`/api/orders/${orderId}/items/${item.id}/color`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crystalColor: item.crystalColor,
                    crystalColorType: estilo,
                    crystalColorNote: esTenido ? item.crystalColorNote : null,
                    framePosition: item.framePosition ?? null,
                    ...cambios,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setError(err.error || 'No se pudo guardar');
                return;
            }
            await onSaved?.();
        } catch (e: any) {
            setError(e.message || 'Error de red');
        } finally {
            setGuardando(false);
        }
    };

    // Lo que se lee de un vistazo, esté abierto o cerrado.
    const resumen = [
        esTenido && estilo ? (estilo === 'DEGRADE' ? 'Degradé' : estilo === 'MUESTRA' ? 'Según muestra' : 'Compacto') : null,
        item.crystalColor,
        esTenido && item.crystalColorNote ? `grado ${item.crystalColorNote}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <div className="mt-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <button
                    type="button"
                    disabled={!editable}
                    onClick={() => setAbierto(o => !o)}
                    aria-expanded={abierto}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        falta
                            ? 'bg-amber-500 text-white'
                            : 'bg-violet-600 text-white'
                    } ${editable ? 'hover:brightness-110 cursor-pointer' : 'cursor-default opacity-90'}`}
                >
                    {hex
                        ? <span className="w-3 h-3 rounded-full border border-white/70" style={{ backgroundColor: hex }} />
                        : <Palette className="w-3 h-3" />}
                    {esTenido ? 'Teñido' : 'Fotocromático'}
                    {resumen ? ` · ${resumen}` : ' · sin color'}
                </button>

                {esTenido && item.framePosition && totalArmazones > 1 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                        <Glasses className="w-3 h-3" />
                        {item.framePosition}º Armazón
                    </span>
                )}

                {falta && editable && (
                    <span className="text-[10px] font-bold text-amber-600">
                        falta {[faltaColor && 'el color', faltaGrado && 'el grado', faltaArmazon && 'a qué armazón va'].filter(Boolean).join(', ')}
                    </span>
                )}
            </div>

            {abierto && editable && (
                <div className="mt-2 rounded-2xl border-2 border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-3">
                    {!esTenido && (
                        <p className="text-[10px] font-medium text-violet-500 dark:text-violet-400 mb-2">
                            Este cristal se oscurece solo con la luz del sol. Elegí de qué color se pone; no lleva grado.
                        </p>
                    )}

                    {/* A qué armazón va el teñido. Con un solo anteojo no hay nada que preguntar. */}
                    {esTenido && totalArmazones > 1 && (
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="text-[9px] font-bold text-violet-500 uppercase tracking-wider">¿Para cuál armazón? *</span>
                            {Array.from({ length: totalArmazones }, (_, i) => i + 1).map(pos => (
                                <button
                                    key={pos}
                                    type="button"
                                    disabled={guardando}
                                    onClick={() => guardar({ framePosition: pos })}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                        item.framePosition === pos
                                            ? 'bg-violet-600 text-white border-violet-700'
                                            : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-violet-300'
                                    }`}
                                >
                                    {pos}º armazón
                                </button>
                            ))}
                        </div>
                    )}

                    {esTenido && (
                        <div className="mb-3 flex items-center gap-2">
                            <label htmlFor={`grado-l-${item.id}`} className="text-[9px] font-bold text-violet-500 uppercase tracking-wider">Grado *</label>
                            <select
                                id={`grado-l-${item.id}`}
                                disabled={guardando}
                                value={item.crystalColorNote || ''}
                                onChange={e => guardar({ crystalColorNote: e.target.value })}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                            >
                                <option value="">— elegí —</option>
                                {INTENSIDADES_TENIDO.map(g => <option key={g} value={g}>{g}</option>)}
                                {/* Un grado cargado antes que no esté en la lista no se pierde. */}
                                {item.crystalColorNote && !INTENSIDADES_TENIDO.includes(item.crystalColorNote) && (
                                    <option value={item.crystalColorNote}>{item.crystalColorNote}</option>
                                )}
                            </select>
                        </div>
                    )}

                    <p className="text-[9px] font-bold text-violet-500 uppercase tracking-wider mb-2">
                        Color{paleta ? ` — ${paleta.label}` : ''} *
                    </p>
                    {paleta?.porConfirmar && (
                        <p className="text-[10px] font-bold text-amber-600 mb-2">
                            ⚠️ Esta lista todavía no está confirmada contra la lista de precios — chequeá con el laboratorio.
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {tonos.map(t => (
                            <button
                                key={t.name}
                                type="button"
                                disabled={guardando}
                                onClick={() => guardar({ crystalColor: t.name })}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all ${
                                    item.crystalColor === t.name
                                        ? 'bg-violet-600 text-white border-violet-700'
                                        : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-violet-300'
                                }`}
                            >
                                <span className="w-4 h-4 rounded-full border border-white/30" style={{ backgroundColor: t.hexColor }} />
                                {t.name}
                                {item.crystalColor === t.name && <Check className="w-3 h-3" />}
                            </button>
                        ))}
                    </div>

                    {error && <p className="mt-2 text-[10px] font-bold text-rose-600">{error}</p>}
                    {guardando && <p className="mt-2 text-[10px] font-bold text-violet-500">Guardando…</p>}
                </div>
            )}
        </div>
    );
}
