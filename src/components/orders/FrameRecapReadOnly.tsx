'use client';

// ────────────────────────────────────────────────────────────────────────────
// El repaso del armazón de una venta YA ENVIADA A FÁBRICA, en solo lectura.
//
// Reemplaza al editor de medidas cuando la venta está bloqueada: hasta el
// 12/8/2026 esa pantalla mostraba inputs y un botón "Guardar medidas" sobre una
// venta que la fábrica ya estaba fabricando — y encima mostraba UN solo par,
// así que el segundo armazón de un 2x1 desaparecía de la vista.
//
// Los datos salen de `describeLabFrameDetails()`, la misma fuente que usan la
// ficha, la lista de ventas y el PDF del cliente: lo que se ve acá es
// exactamente lo que se fabrica.
// ────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Glasses, Lock, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { describeLabFrameDetails, type LabFrameOrder } from '@/lib/lab-frame-summary';

interface Props {
    order: LabFrameOrder;
    /** Arranca desplegado. Por defecto colapsado: ocupa poco y se abre al tocarlo. */
    defaultOpen?: boolean;
}

function Dato({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-xs font-bold text-stone-800 dark:text-stone-200">{value}</p>
        </div>
    );
}

export default function FrameRecapReadOnly({ order, defaultOpen = false }: Props) {
    const [abierto, setAbierto] = useState(defaultOpen);
    const resumen = describeLabFrameDetails(order);

    return (
        <div className="bg-stone-50 dark:bg-stone-900/50 rounded-[2rem] border-2 border-stone-200 dark:border-stone-700 overflow-hidden">
            <button
                type="button"
                onClick={() => setAbierto(v => !v)}
                aria-expanded={abierto}
                className="w-full flex items-center gap-2 p-6 text-left hover:bg-stone-100/70 dark:hover:bg-stone-800/40 transition-colors"
            >
                <Glasses className="w-5 h-5 text-indigo-500 shrink-0" />
                <h4 className="text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-widest flex-1">
                    Armazón, medidas y teñido — tal cual se fabrica
                </h4>
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400 shrink-0">
                    <Lock className="w-3 h-3" /> Bloqueado
                </span>
                {abierto
                    ? <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />}
            </button>

            {abierto && (
                <div className="px-6 pb-6 space-y-4">
                    {resumen.isEmpty ? (
                        <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
                            No se cargó ningún dato de armazón en esta venta.
                        </p>
                    ) : (
                        <>
                            {resumen.origin && <Dato label="Origen del armazón" value={resumen.origin} />}

                            {resumen.pairs.map(par => (
                                <div key={par.pair} className="rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-4">
                                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-3">{par.label}</p>
                                    {par.isEmpty ? (
                                        <p className="text-xs font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5" /> Sin medidas cargadas
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {par.shape && <Dato label="Forma / Aro" value={par.shape} />}
                                            {par.measurements && <Dato label="Medidas" value={par.measurements} />}
                                            {par.details && <Dato label="Detalles" value={par.details} />}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* El teñido se dice SIEMPRE, incluso cuando no lleva: que no aparezca
                                nada es justo lo que hace dudar a quien lee. */}
                            <Dato label="Teñido" value={resumen.tint ? resumen.tint.text : 'No lleva teñido'} />
                            {resumen.tint?.ambiguousPair && (
                                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    Hay dos pares y una sola línea de teñido: el sistema no sabe a cuál corresponde. Confirmalo con laboratorio.
                                </p>
                            )}

                            {resumen.notes && <Dato label="Notas para el laboratorio" value={resumen.notes} />}
                        </>
                    )}

                    <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 pt-1">
                        Esta venta ya se envió a fábrica: nada de esto se puede modificar. Para corregirla, un administrador
                        tiene que reabrirla — la reapertura y el cambio quedan registrados en la ficha del cliente.
                    </p>
                </div>
            )}
        </div>
    );
}
