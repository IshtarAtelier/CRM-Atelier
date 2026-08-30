'use client';

/**
 * Los chips de etiquetas de la cabecera.
 *
 * Se muestran los de ESTADO (seguimientos: son accionables) + 2 etiquetas
 * comunes + un "+N" que abre el selector completo. Antes se pintaban TODAS con
 * flex-wrap y, con las 8-10 que acumula la IA, la fila envolvía y tapaba el
 * nombre del cliente y los botones del header.
 */

import { esEtiquetaDeEstado, getLabelStyle, getLabelStyleInline, rotuloSeguimiento } from '../format';
import type { Tag } from '../types';

const MAX_VISIBLES = 2;

export interface LabelChipsProps {
    etiquetas: string[];
    tags: Tag[];
    /** Click en un chip de seguimiento: cancela todos y marca SIN_SEGUIMIENTO. */
    onCancelarSeguimientos: () => void;
    /** Click en el chip "sin seguimiento": lo saca. */
    onReactivarSeguimientos: () => void;
    /** Click en "+N": abre el selector completo. */
    onVerTodas: () => void;
}

export function LabelChips({
    etiquetas,
    tags,
    onCancelarSeguimientos,
    onReactivarSeguimientos,
    onVerTodas,
}: LabelChipsProps) {
    const sinFijado = (etiquetas || []).filter(l => l !== 'Fijado');
    if (sinFijado.length === 0) return null;

    const estado = sinFijado.filter(esEtiquetaDeEstado);
    const comunes = sinFijado.filter(l => !esEtiquetaDeEstado(l));
    const visibles = comunes.slice(0, MAX_VISIBLES);
    const ocultas = comunes.length - visibles.length;
    const chip = 'px-2 py-1 rounded-full text-[11px] font-bold border max-w-[150px] truncate';

    return (
        <div className="hidden lg:flex items-center gap-1.5 mr-2 border-r border-stone-300 dark:border-stone-700 pr-2">
            {estado.map(lbl => {
                if (lbl === 'SIN_SEGUIMIENTO') {
                    return (
                        <button
                            key={lbl}
                            type="button"
                            onClick={onReactivarSeguimientos}
                            title="Click para reactivar seguimientos"
                            className={`${chip} bg-red-100 text-red-800 border-red-300 hover:bg-emerald-100 hover:text-emerald-800 hover:border-emerald-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600`}
                        >
                            🚫 Sin seguimiento
                        </button>
                    );
                }
                return (
                    <button
                        key={lbl}
                        type="button"
                        onClick={onCancelarSeguimientos}
                        title="Click para cancelar seguimientos"
                        className={`${chip} bg-amber-100 text-amber-900 border-amber-300 hover:bg-red-100 hover:text-red-800 hover:border-red-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600`}
                    >
                        📅 {rotuloSeguimiento(lbl)}
                    </button>
                );
            })}

            {visibles.map(lbl => {
                const tagObj = tags.find(t => t.name === lbl);
                if (tagObj?.color) {
                    return <span key={lbl} title={lbl} style={getLabelStyleInline(tagObj.color)} className={chip}>{lbl}</span>;
                }
                return <span key={lbl} title={lbl} className={`${chip} ${getLabelStyle(lbl)}`}>{lbl}</span>;
            })}

            {ocultas > 0 && (
                <button
                    type="button"
                    onClick={onVerTodas}
                    title={`${ocultas} etiquetas más — click para ver y editar todas`}
                    className={`${chip} bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-300 dark:border-stone-700 hover:bg-stone-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600`}
                >
                    +{ocultas}
                </button>
            )}
        </div>
    );
}
