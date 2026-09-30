'use client';

import { useState } from 'react';
import { Receipt, Plus, X, Loader2, Check } from 'lucide-react';
import { formatearPrecio } from '@/lib/format-precio';
import { formatDate } from '@/lib/format-date';
import type { LabCostEntryResumen } from '@/types/orders';

/**
 * Comprobante del laboratorio en la venta: qué factura o remito emitió el lab
 * por el pedido y, para el admin, si cerró con el costo cargado.
 *
 * Lo que se muestra sale del cruce de costos (`LabCostEntry`), que es la única
 * fuente de comprobantes de laboratorio: los de Optovisión y Grupo Óptico
 * llegan solos y acá se ven; los de un lab sin portal (la Cámara) se cargan
 * desde este mismo bloque y caen en el mismo cruce.
 */

interface Props {
    orderId: string;
    labOrderNumber?: string | null;
    entries?: LabCostEntryResumen[] | null;
    isAdmin: boolean;
    onSaved: () => void;
}

const ESTADO: Record<string, { texto: string; clase: string }> = {
    OK: { texto: 'cerró con el costo', clase: 'text-emerald-700 dark:text-emerald-400' },
    OVERCOST: { texto: 'sobrecosto', clase: 'text-rose-700 dark:text-rose-400' },
    UNDERCOST: { texto: 'a favor', clase: 'text-sky-700 dark:text-sky-400' },
    PENDING: { texto: 'faltan comprobantes', clase: 'text-amber-700 dark:text-amber-400' },
    UNMATCHED: { texto: 'sin venta', clase: 'text-stone-500' },
};

export default function ComprobanteLab({ orderId, labOrderNumber, entries, isAdmin, onSaved }: Props) {
    const [abierto, setAbierto] = useState(false);
    const [comprobante, setComprobante] = useState('');
    const [importe, setImporte] = useState('');
    const [fecha, setFecha] = useState('');
    const [tipo, setTipo] = useState<'factura' | 'remito'>('factura');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const refs = (entries || []).flatMap(e =>
        (Array.isArray(e.invoiceRefs) ? e.invoiceRefs : []).map(r => ({ ...r, entry: e }))
    );
    const sinRefsConImporte = (entries || []).filter(e => !(Array.isArray(e.invoiceRefs) && e.invoiceRefs.length) && (e.billedTotal ?? e.billedNet) != null);

    const guardar = async () => {
        setError('');
        const monto = Number(String(importe).replace(/\./g, '').replace(',', '.'));
        if (!comprobante.trim()) { setError('Falta el número de comprobante.'); return; }
        if (!Number.isFinite(monto) || monto <= 0) { setError('El importe tiene que ser mayor a cero.'); return; }
        setGuardando(true);
        try {
            const res = await fetch(`/api/orders/${orderId}/comprobante-lab`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comprobante: comprobante.trim(), importe: monto, fecha: fecha || null, tipo }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { setError(data.error || 'No se pudo guardar.'); return; }
            setAbierto(false); setComprobante(''); setImporte(''); setFecha('');
            onSaved();
        } catch {
            setError('No se pudo guardar.');
        } finally {
            setGuardando(false);
        }
    };

    if (!labOrderNumber) return null;

    return (
        <div className="w-full lg:w-72 text-[11px]">
            {(refs.length > 0 || sinRefsConImporte.length > 0) && (
                <ul className="space-y-0.5 mb-1">
                    {refs.map((r, i) => (
                        <li key={`${r.entry.id}-${i}`} className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                            <Receipt className="w-3 h-3 flex-shrink-0 text-stone-400" />
                            {r.url ? (
                                <a href={r.url} target="_blank" rel="noreferrer" className="font-bold underline decoration-dotted">{r.comprobante}</a>
                            ) : (
                                <span className="font-bold">{r.comprobante}</span>
                            )}
                            {r.importe != null && <span>${formatearPrecio(r.importe)}</span>}
                            {r.entry.invoiceDate && <span className="text-stone-400">{formatDate(r.entry.invoiceDate)}</span>}
                        </li>
                    ))}
                    {sinRefsConImporte.map(e => (
                        <li key={e.id} className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                            <Receipt className="w-3 h-3 flex-shrink-0 text-stone-400" />
                            <span className="font-bold">Pedido {e.labOrderNumber}</span>
                            <span>${formatearPrecio(e.billedTotal ?? e.billedNet)}</span>
                        </li>
                    ))}
                </ul>
            )}
            {isAdmin && (entries || []).map(e => {
                const est = ESTADO[e.status];
                if (!est || e.status === 'PENDING' && refs.length === 0) return null;
                return (
                    <p key={e.id} className={`font-black uppercase tracking-wide ${est.clase}`}>
                        {est.texto}
                        {e.difference != null && Math.abs(e.difference) >= 1 && (
                            <> {e.difference > 0 ? '+' : '−'}${formatearPrecio(Math.abs(e.difference))}</>
                        )}
                    </p>
                );
            })}

            {!abierto ? (
                <button
                    type="button"
                    onClick={() => setAbierto(true)}
                    className="mt-1 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-stone-500 hover:text-emerald-700 dark:hover:text-emerald-400"
                >
                    <Plus className="w-3 h-3" /> {refs.length ? 'Otro comprobante' : 'Cargar factura / remito del lab'}
                </button>
            ) : (
                <div className="mt-1 p-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 space-y-1.5">
                    <div className="flex gap-1">
                        <select value={tipo} onChange={e => setTipo(e.target.value as 'factura' | 'remito')} className="px-1.5 py-1 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-[11px]">
                            <option value="factura">Factura</option>
                            <option value="remito">Remito</option>
                        </select>
                        <input
                            value={comprobante}
                            onChange={e => setComprobante(e.target.value)}
                            placeholder="Nº (ej. FC A 00002-00152120)"
                            className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-[11px]"
                        />
                    </div>
                    <div className="flex gap-1">
                        <input
                            value={importe}
                            onChange={e => setImporte(e.target.value)}
                            inputMode="decimal"
                            placeholder="Importe total $"
                            className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-[11px]"
                        />
                        <input
                            type="date"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                            className="px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-[11px]"
                        />
                    </div>
                    {error && <p className="text-rose-600 dark:text-rose-400 font-bold">{error}</p>}
                    <div className="flex gap-1 justify-end">
                        <button type="button" onClick={() => { setAbierto(false); setError(''); }} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-600" title="Cancelar">
                            <X className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={guardar} disabled={guardando} className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black uppercase tracking-wide text-[10px] inline-flex items-center gap-1 disabled:opacity-50">
                            {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Guardar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
