'use client';

import { useEffect, useRef, useState } from 'react';
import { Save, X, AlertTriangle, Check, Loader2 } from 'lucide-react';

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

export default function LabNumberEditor({ value, onChange, orderId, onSave, onCancel, saving, tone = 'blue' }: Props) {
    const [estado, setEstado] = useState<Estado>('idle');
    const [mensaje, setMensaje] = useState('');
    const inicial = useRef(value);

    useEffect(() => {
        const texto = (value || '').trim();
        // Sin número que valga la pena chequear, o el mismo con el que se abrió
        // el campo (no se está duplicando nada: ya es de este pedido).
        if (!/\d{4,}/.test(texto) || texto === (inicial.current || '').trim()) {
            setEstado('idle'); setMensaje('');
            return;
        }
        setEstado('checking');
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/orders/check-lab-number?numero=${encodeURIComponent(texto)}&orderId=${orderId}`);
                if (!res.ok) throw new Error('check falló');
                const data = await res.json();
                setEstado(data.duplicado ? 'duplicado' : 'libre');
                setMensaje(data.mensaje || '');
            } catch {
                // No decir "libre" sin haber podido verificar.
                setEstado('error');
                setMensaje('No se pudo verificar si el número está repetido. Al guardar, el sistema lo vuelve a controlar.');
            }
        }, 400);
        return () => clearTimeout(t);
    }, [value, orderId]);

    const bloqueado = estado === 'duplicado' || estado === 'checking' || !!saving;
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
                <button
                    onClick={() => { if (!bloqueado) onSave(); }}
                    disabled={bloqueado}
                    title={estado === 'duplicado' ? 'No se puede guardar: el número está repetido' : 'Guardar'}
                    className={`p-2 ${btn} text-white rounded-xl transition-all ${bloqueado ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105'}`}
                >
                    <Save className="w-4 h-4" />
                </button>
                <button
                    onClick={onCancel}
                    className="p-2 bg-stone-200 dark:bg-stone-700 text-stone-500 rounded-xl hover:scale-105 transition-all"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {estado === 'duplicado' && (
                <div id={`dup-${orderId}`} role="alert"
                    className="mt-2 flex items-start gap-2 rounded-xl border-2 border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-snug">
                        <p className="font-black text-red-700 dark:text-red-300 uppercase tracking-wide">Ese número ya está usado</p>
                        <p className="text-red-700/90 dark:text-red-300/90 mt-0.5">{mensaje}</p>
                    </div>
                </div>
            )}
            {estado === 'error' && (
                <p className="mt-2 text-[11px] font-bold text-amber-600 dark:text-amber-400">{mensaje}</p>
            )}
        </div>
    );
}
