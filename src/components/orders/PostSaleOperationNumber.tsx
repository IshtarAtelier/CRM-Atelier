'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Pencil, Plus, X } from 'lucide-react';

/**
 * El nº de operación del caso de post-venta, A MANO en la tarjeta.
 *
 * Ishtar, 20/10/2026: "mejorá el espacio donde va el número de operación nuevo
 * en post venta, no está bien accesible". Hasta acá el campo vivía adentro del
 * formulario completo del caso (desplegable, dentro de la tarjeta desplegable,
 * en la sección "Resolución en laboratorio") y había que guardar el formulario
 * entero para cargar un número. Es el dato que más se busca y el que más tarde
 * se carga (recién cuando el laboratorio procesó el caso), así que va arriba de
 * todo, siempre visible, y se edita y guarda ahí mismo.
 *
 * Guarda por el MISMO camino que el formulario (`PATCH /api/orders/[id]` con
 * `postSaleNewOrderNumber`), así conserva sus efectos: el caso pasa solo a
 * "En laboratorio" al recibir número y el cambio queda anotado en el historial.
 * Se usa en la ficha del cliente (PostSaleTab) y en el tablero de Ventas
 * (PostSaleCard): un solo componente para que los dos lugares se comporten igual.
 */

interface Props {
    /** Venta del caso. Sin venta (caso huérfano) el número se muestra pero no se edita. */
    orderId: string | null | undefined;
    value: string | null | undefined;
    onSaved: () => void;
    /** Compacto para el tablero de ventas (chips más chicos, sin etiqueta). */
    compact?: boolean;
}

/** Los números de operación que hay cargados ("80530908 - 80530914" → dos). */
export function operationNumbersOf(value: string | null | undefined): string[] {
    return (value || '').match(/\d{4,}/g) || [];
}

export function PostSaleOperationNumber({ orderId, value, onSaved, compact = false }: Props) {
    const nums = operationNumbersOf(value);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (!editing) setDraft(value || ''); }, [value, editing]);
    // Al abrir la edición el número queda seleccionado: escribir lo reemplaza
    // (si no, el nuevo se pegaba al final del viejo).
    useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

    const copy = async (n: string) => {
        try {
            await navigator.clipboard.writeText(n);
            setCopied(n);
            setTimeout(() => setCopied(null), 1500);
        } catch { /* sin portapapeles: el número igual se ve y se puede seleccionar */ }
    };

    const guardar = async () => {
        if (!orderId || saving) return;
        const nuevo = draft.trim();
        if (nuevo === (value || '').trim()) { setEditing(false); return; }
        setSaving(true);
        setError(null);
        try {
            // Mismo aviso de duplicado que el nº de pedido de la venta: si el
            // número ya está en otra venta u otro caso, se dice antes de guardar.
            if (nuevo) {
                const chk = await fetch(`/api/orders/check-lab-number?numero=${encodeURIComponent(nuevo)}&orderId=${encodeURIComponent(orderId)}`)
                    .then(r => (r.ok ? r.json() : null)).catch(() => null);
                if (chk?.duplicado && !window.confirm(`${chk.mensaje}\n\n¿Guardar igual?`)) { setSaving(false); return; }
            }
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                // Vacío = sin número todavía (se puede borrar un número cargado por error).
                body: JSON.stringify({ postSaleNewOrderNumber: nuevo || null }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                setError(d.error || 'No se pudo guardar el número.');
                return;
            }
            setEditing(false);
            onSaved();
        } catch {
            setError('No se pudo conectar con el servidor.');
        } finally { setSaving(false); }
    };

    const chip = compact
        ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-950/30 font-mono text-[10px] font-black text-blue-700 dark:text-blue-400 hover:border-blue-400 transition-colors'
        : 'group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold text-stone-700 dark:text-stone-200 hover:border-stone-900 dark:hover:border-primary transition-colors';
    const accion = compact
        ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed text-[9px] font-black uppercase tracking-widest transition-colors'
        : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed text-[10px] font-black uppercase tracking-widest transition-colors';

    if (editing) {
        return (
            <div className="flex items-center flex-wrap gap-2">
                {!compact && <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Nº de operación</span>}
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); guardar(); }
                        if (e.key === 'Escape') { setEditing(false); setError(null); }
                    }}
                    placeholder="Nº del laboratorio"
                    disabled={saving}
                    className="w-40 font-mono text-xs font-bold rounded-lg border-2 border-amber-400 dark:border-amber-700 bg-white dark:bg-stone-900 px-2.5 py-1 outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-50"
                />
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); guardar(); }}
                    disabled={saving}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                >
                    <Check className="w-3 h-3" /> {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditing(false); setError(null); }}
                    disabled={saving}
                    title="Cancelar"
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
                {error && <span className="text-[10px] font-bold text-rose-600 w-full">{error}</span>}
            </div>
        );
    }

    return (
        <div className="flex items-center flex-wrap gap-2">
            {!compact && nums.length > 0 && (
                <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">
                    {nums.length > 1 ? `Operaciones (${nums.length})` : 'Operación'}
                </span>
            )}
            {nums.map(n => (
                <button key={n} type="button" onClick={(e) => { e.stopPropagation(); copy(n); }} title="Copiar número de operación" className={chip}>
                    {n}
                    {copied === n
                        ? <Check className="w-3 h-3 text-emerald-600" />
                        : <Copy className={`w-3 h-3 ${compact ? 'text-blue-400' : 'text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200'}`} />}
                </button>
            ))}
            {orderId && (nums.length === 0 ? (
                // Sin número: el botón es el aviso. Ámbar, como el campo pendiente del formulario.
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                    className={`${accion} border-amber-400 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40`}
                >
                    <Plus className="w-3 h-3" /> Cargar nº de operación
                </button>
            ) : (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                    title="Cambiar el número de operación"
                    className={`${accion} border-stone-300 dark:border-stone-600 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:border-stone-500`}
                >
                    <Pencil className="w-3 h-3" /> {compact ? '' : 'Cambiar'}
                </button>
            ))}
        </div>
    );
}
