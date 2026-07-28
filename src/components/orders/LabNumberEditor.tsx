'use client';

import { useEffect, useRef, useState } from 'react';
import { Save, X, AlertTriangle, Check, Loader2, Ban, ExternalLink } from 'lucide-react';

/**
 * Campo del N° de operación con chequeo EN VIVO de duplicados.
 *
 * El número es la llave que ata el pedido del laboratorio a la venta: la factura
 * llega con ese número y por ahí se cruza el costo. Repetirlo deja el costo
 * colgado de la venta equivocada, y hasta ahora solo se avisaba por email
 * DESPUÉS de guardar. Acá se avisa mientras se tipea y no se deja guardar.
 *
 * El chequeo es una ayuda, no la garantía: el bloqueo real está en el servidor
 * (`OrderService.updateOrder`), así que si el chequeo falla o no llegó a
 * responder, guardar igual es seguro — el servidor rechaza.
 */

interface Props {
    value: string;
    onChange: (v: string) => void;
    orderId: string;
    onSave: () => void;
    onCancel: () => void;
    saving?: boolean;
    /** Color del botón guardar, para no desentonar con cada pantalla. */
    tone?: 'blue' | 'emerald';
}

type Estado = 'idle' | 'checking' | 'libre' | 'duplicado' | 'error';

interface Conflicto {
    numero: string;
    tipo: 'VENTA' | 'POSTVENTA';
    orderId: string | null;
    orderShort: string;
    cliente: string;
    labSentAt: string | null;
}

export default function LabNumberEditor({ value, onChange, orderId, onSave, onCancel, saving, tone = 'blue' }: Props) {
    const [estado, setEstado] = useState<Estado>('idle');
    const [mensaje, setMensaje] = useState('');
    const [conflictos, setConflictos] = useState<Conflicto[]>([]);
    const inicial = useRef(value);

    useEffect(() => {
        const texto = (value || '').trim();
        // Sin número que valga la pena chequear, o el mismo con el que se abrió
        // el campo (no se está duplicando nada: ya es de este pedido).
        if (!/\d{4,}/.test(texto) || texto === (inicial.current || '').trim()) {
            setEstado('idle'); setMensaje(''); setConflictos([]);
            return;
        }
        setEstado('checking');
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/orders/check-lab-number?numero=${encodeURIComponent(texto)}&orderId=${orderId}`);
                if (!res.ok) throw new Error('check falló');
                const data = await res.json();
                setEstado(data.duplicado ? 'duplicado' : 'libre');
                setConflictos(Array.isArray(data.conflictos) ? data.conflictos : []);
                setMensaje(data.mensaje || '');
            } catch {
                // No decir "libre" sin haber podido verificar.
                setConflictos([]);
                setEstado('error');
                setMensaje('No se pudo verificar si el número está repetido. Al guardar, el sistema lo vuelve a controlar.');
            }
        }, 400);
        return () => clearTimeout(t);
    }, [value, orderId]);

    const bloqueado = estado === 'duplicado' || estado === 'checking' || !!saving;
    const numerosRepetidos = [...new Set(conflictos.map(c => c.numero))];
    const btn = tone === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500';
    const borde = estado === 'duplicado'
        ? 'border-red-400 dark:border-red-600 focus:ring-red-500/20'
        : tone === 'emerald'
            ? 'border-emerald-300 focus:ring-emerald-500/20'
            : 'border-blue-300 dark:border-blue-700 focus:ring-blue-500/20';

    return (
        <div className="w-full">
            <div className="flex items-center gap-2">
                <div className="relative w-full">
                    <input
                        type="text"
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        placeholder="N° operación"
                        className={`w-full px-3 py-2 pr-9 border-2 ${borde} rounded-xl text-sm font-bold focus:ring-2 outline-none bg-white dark:bg-stone-900`}
                        autoFocus
                        aria-invalid={estado === 'duplicado'}
                        aria-describedby={mensaje ? `dup-${orderId}` : undefined}
                        onKeyDown={e => { if (e.key === 'Enter' && !bloqueado) onSave(); }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {estado === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-stone-400" />}
                        {estado === 'libre' && <Check className="w-4 h-4 text-emerald-500" />}
                        {estado === 'duplicado' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    </span>
                </div>
                {/* Bloqueado por duplicado NO es lo mismo que "esperá un segundo":
                    el candado se ve distinto del botón atenuado del chequeo. */}
                <button
                    onClick={() => { if (!bloqueado) onSave(); }}
                    disabled={bloqueado}
                    aria-label={estado === 'duplicado' ? 'No se puede guardar: el número está repetido' : 'Guardar'}
                    title={estado === 'duplicado' ? 'No se puede guardar: el número está repetido' : 'Guardar'}
                    className={`p-2 rounded-xl transition-all text-white ${estado === 'duplicado'
                        ? 'bg-stone-300 dark:bg-stone-600 cursor-not-allowed'
                        : `${btn} ${bloqueado ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105'}`}`}
                >
                    {estado === 'duplicado' ? <Ban className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                </button>
                <button
                    onClick={onCancel}
                    className="p-2 bg-stone-200 dark:bg-stone-700 text-stone-500 rounded-xl hover:scale-105 transition-all"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* El cartel se lee en tres golpes: qué número está repetido y que no
                se puede guardar · dónde está usado (una línea por lugar, con link
                a esa venta) · qué hacer. Nada de párrafos corridos: con dos
                conflictos se vuelve un bloque que nadie lee. */}
            {estado === 'duplicado' && (
                <div id={`dup-${orderId}`} role="alert"
                    className="mt-2 rounded-xl border-2 border-red-300 dark:border-red-800/70 bg-red-50 dark:bg-red-950/30 overflow-hidden">
                    <div className="flex items-center gap-2 bg-red-100 dark:bg-red-900/40 px-3 py-2">
                        <AlertTriangle className="w-[18px] h-[18px] text-red-600 dark:text-red-400 shrink-0" />
                        <p className="text-[13px] font-black text-red-700 dark:text-red-300 leading-tight">
                            {numerosRepetidos.length === 1
                                ? <>El N° <span className="font-mono">{numerosRepetidos[0]}</span> ya está usado</>
                                : <>Estos números ya están usados: <span className="font-mono">{numerosRepetidos.join(', ')}</span></>}
                            {' — '}no se puede guardar
                        </p>
                    </div>

                    <ul className="px-3 py-2 space-y-1">
                        {conflictos.map((c, i) => (
                            <li key={`${c.numero}-${c.orderId}-${i}`} className="text-xs text-red-800 dark:text-red-200 leading-snug">
                                <span className="font-mono font-bold">{c.numero}</span>
                                <span className="opacity-70"> · </span>
                                {c.tipo === 'POSTVENTA' ? 'postventa de ' : 'venta de '}
                                <strong>{c.cliente}</strong>
                                <span className="opacity-70"> · #{c.orderShort}</span>
                                {c.labSentAt && (
                                    <span className="opacity-70"> · a fábrica el {new Date(c.labSentAt).toLocaleDateString('es-AR')}</span>
                                )}
                                {c.orderId && (
                                    <a href={`/admin/ventas?orderId=${c.orderId}`} target="_blank" rel="noopener noreferrer"
                                        className="ml-1.5 inline-flex items-center gap-0.5 font-bold underline underline-offset-2 hover:no-underline">
                                        ver <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>

                    <p className="px-3 pb-2 text-[11px] text-red-700/80 dark:text-red-300/80 leading-snug">
                        Poné el número que corresponde a este pedido, o corregí el de la otra venta.
                        El costo del laboratorio se cruza por este número: repetido, la factura se cuelga de la venta equivocada.
                    </p>
                </div>
            )}
            {estado === 'error' && (
                <p className="mt-2 text-[11px] font-bold text-amber-600 dark:text-amber-400">{mensaje}</p>
            )}
        </div>
    );
}
