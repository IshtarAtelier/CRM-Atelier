'use client';

import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Loader2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { formatearPrecio } from '@/lib/format-precio';
import { formatDate } from '@/lib/format-date';
import type { ComparacionDePrecios } from '@/lib/precios-vigentes';

// ────────────────────────────────────────────────────────────────────────────
// El aviso de "este presupuesto tiene precios viejos" (Ishtar, 5/10/2026).
//
// Sale antes de mandarlo, cobrarlo o pasarlo a venta. Para ENVIAR se puede
// seguir con los precios cotizados (queda firmado en la ficha). Para COBRAR o
// PASAR A VENTA no: hay que actualizar, y si se le respeta el precio anterior
// al cliente, lo hace un administrador con un descuento especial.
// ────────────────────────────────────────────────────────────────────────────

export type AccionConPrecios = 'ver' | 'pdf' | 'whatsapp' | 'enviar-pdf' | 'cobrar' | 'convertir';

const ETIQUETA_OJO: Record<string, string> = { OD: 'OD', OI: 'OI', RIGHT: 'OD', LEFT: 'OI' };
const $ = (n: number) => `$${formatearPrecio(n)}`;

interface AvisoPreciosViejosProps {
    comparacion: ComparacionDePrecios;
    accion: AccionConPrecios;
    onActualizar: () => Promise<void>;
    /** Seguir sin actualizar. No se ofrece para cobrar ni para pasar a venta. */
    onSeguirIgual?: () => void;
    onClose: () => void;
}

export default function AvisoPreciosViejos({ comparacion, accion, onActualizar, onSeguirIgual, onClose }: AvisoPreciosViejosProps) {
    const [actualizando, setActualizando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const exigeActualizar = accion === 'cobrar' || accion === 'convertir';
    const sinCambios = comparacion.itemsTotales - comparacion.filas.length;
    const sube = comparacion.diferencia > 0;

    const actualizar = async () => {
        setActualizando(true);
        setError(null);
        try {
            await onActualizar();
        } catch (e: any) {
            setError(e?.message || 'No se pudieron actualizar los precios');
            setActualizando(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} maxWidth="xl">
            <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-6 py-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/40">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-amber-800 dark:text-amber-300">Este presupuesto tiene precios viejos</h3>
                            <p className="text-xs font-bold text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                                {comparacion.cotizadoEl ? `Se cotizó el ${formatDate(comparacion.cotizadoEl)} · ` : ''}
                                {comparacion.filas.length} de {comparacion.itemsTotales} ítems cambiaron de precio
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-amber-700/60 hover:text-amber-800 hover:bg-amber-100 transition-all" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="max-h-56 overflow-y-auto">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5 items-baseline text-xs">
                            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Ítem</span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 text-right">Cotizado</span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 text-right">Hoy</span>
                            {comparacion.filas.map(f => (
                                <React.Fragment key={f.itemId}>
                                    <span className="font-bold text-stone-700 dark:text-stone-200">
                                        {f.nombre}{f.ojo ? ` · ${ETIQUETA_OJO[f.ojo] || f.ojo}` : ''}{f.cantidad > 1 ? ` ×${f.cantidad}` : ''}
                                    </span>
                                    <span className="text-right text-stone-400 line-through">{$(f.cotizado)}</span>
                                    <span className="text-right font-black text-stone-800 dark:text-stone-100">{$(f.hoy)}</span>
                                </React.Fragment>
                            ))}
                            {sinCambios > 0 && (
                                <>
                                    <span className="text-stone-400">{sinCambios === 1 ? 'El otro ítem' : `Los otros ${sinCambios} ítems`}</span>
                                    <span className="text-right text-stone-400">sin cambios</span>
                                    <span />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-stone-50 dark:bg-stone-800/60 p-3">
                            <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Total cotizado (lista)</p>
                            <p className="text-xl font-black text-stone-700 dark:text-stone-200">{$(comparacion.listaCotizada)}</p>
                            <p className="text-[10px] font-bold text-stone-400">Efectivo {$(comparacion.efectivoCotizado)}</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 p-3">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Total con precios de hoy</p>
                            <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{$(comparacion.listaHoy)}</p>
                            <p className="text-[10px] font-bold text-emerald-700/70 dark:text-emerald-400/70">Efectivo {$(comparacion.efectivoHoy)}</p>
                        </div>
                    </div>

                    <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
                        Diferencia: {sube ? '+' : '−'}{$(Math.abs(comparacion.diferencia))} de lista.{' '}
                        {exigeActualizar
                            ? `No se puede cobrar ni pasar a venta con precios viejos.${sube ? ` Si querés respetarle el precio anterior, actualizá y pedile a un administrador un descuento especial de ${$(comparacion.diferencia)}.` : ''}`
                            : 'Lo que elijas queda anotado en la ficha con tu nombre.'}
                    </p>

                    {error && <p className="text-xs font-bold text-red-600">{error}</p>}

                    <div className="flex flex-col sm:flex-row gap-2">
                        <button
                            onClick={actualizar}
                            disabled={actualizando}
                            className="flex-1 py-3.5 rounded-2xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60"
                        >
                            {actualizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {accion === 'ver' ? 'Actualizar precios' : 'Actualizar precios y seguir'}
                        </button>
                        {!exigeActualizar && onSeguirIgual && accion !== 'ver' && (
                            <button
                                onClick={onSeguirIgual}
                                disabled={actualizando}
                                className="flex-1 py-3.5 rounded-2xl border-2 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-[11px] font-black uppercase tracking-widest hover:bg-stone-50 dark:hover:bg-stone-800 transition-all disabled:opacity-60"
                            >
                                {accion === 'pdf' ? 'Descargar' : 'Enviar'} con los precios cotizados
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
