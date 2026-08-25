'use client';

// ────────────────────────────────────────────────────────────────────────────
// El armazón de UNA línea del pedido, editable donde está el armazón.
//
// Pedido de Ishtar (25/8): «no veo que se despliegue ahí mismo para agregar
// las fotos y demás». Antes la asociación al par solo existía en el carrito de
// edición, y la foto y las medidas vivían en cuadros sueltos al final de la
// ficha: había que asociar en un lado, bajar hasta el otro y emparejar de
// memoria. Acá el renglón del armazón pregunta de cuál par es y, apenas se
// sabe, despliega EN EL LUGAR el mismo cuadro de fábrica que usa todo el
// sistema (FramePairEditor: foto, forma, medidas, alturas).
//
// Asignar acomoda el resto solo (asignarParAlArmazon): si otro armazón tenía
// ese par se suelta, y cuando queda uno solo sin asignar se completa — cada
// cambio se guarda al instante por el endpoint de línea, como el color.
// ────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Glasses } from 'lucide-react';
import FramePairEditor from '@/components/orders/FramePairEditor';
import { esArmazonItem, nombreDeArmazon, asignarParAlArmazon } from '@/lib/armazon-por-par';
import { framesDeLaOrden, etiquetaArmazon } from '@/lib/order-frames';
import { describeLabFrameDetails } from '@/lib/lab-frame-summary';

interface Props {
    orderId: string;
    item: any;
    /** TODAS las líneas del pedido: asignar puede soltar o completar otra. */
    items: any[];
    /** El pedido entero: de acá salen las medidas y la foto ya cargadas. */
    order: any;
    totalArmazones: number;
    /** false en una venta enviada a fábrica: ahí manda el repaso bloqueado. */
    editable: boolean;
    onSaved?: () => void | Promise<void>;
}

export default function LineaArmazonEditor({ orderId, item, items, order, totalArmazones, editable, onSaved }: Props) {
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!esArmazonItem(item)) return null;

    // Con un solo anteojo no hay nada que preguntar: es el armazón 1.
    const pos = totalArmazones === 1 ? 1 : (item.framePosition || null);

    const asignar = async (nuevaPos: number) => {
        setGuardando(true);
        setError(null);
        try {
            const idx = items.findIndex(x => x.id === item.id);
            for (const c of asignarParAlArmazon(items, idx, nuevaPos, totalArmazones)) {
                const linea = items[c.idx];
                // El mismo endpoint de línea que usa el color: hay que reenviar
                // los campos de color de ESA línea para no pisarlos con null.
                const res = await fetch(`/api/orders/${orderId}/items/${linea.id}/color`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        crystalColor: linea.crystalColor ?? null,
                        crystalColorType: linea.crystalColorType ?? null,
                        crystalColorNote: linea.crystalColorNote ?? null,
                        framePosition: c.framePosition,
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    setError(err.error || 'No se pudo guardar la asociación');
                    return;
                }
            }
            await onSaved?.();
        } catch (e: any) {
            setError(e.message || 'Error de red');
        } finally {
            setGuardando(false);
        }
    };

    const f = pos ? framesDeLaOrden(order).find(fr => fr.position === pos) : null;
    const parLab = pos ? describeLabFrameDetails(order).pairs.find(pl => pl.pair === pos) : null;
    const rx = order?.prescription || null;
    const alto = (delPedido: unknown, deReceta: unknown) =>
        delPedido != null ? String(delPedido) : (deReceta != null ? String(deReceta) : '');

    return (
        <div className="mt-2 space-y-2">
            {totalArmazones > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                    <Glasses className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider shrink-0">
                        ¿De cuál par es? {editable ? '*' : ''}
                    </span>
                    {Array.from({ length: totalArmazones }, (_, i) => i + 1).map(par => {
                        const elegido = item.framePosition === par;
                        return (
                            <button
                                key={par}
                                type="button"
                                disabled={!editable || guardando}
                                onClick={() => asignar(par)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                    elegido
                                        ? 'bg-amber-500 text-white border-amber-600'
                                        : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-amber-300'
                                } ${!editable ? 'opacity-60 cursor-default' : ''}`}
                            >
                                {par}º par
                            </button>
                        );
                    })}
                    {!item.framePosition && editable && (
                        <span className="text-[10px] text-stone-400">el par sin armazón de la óptica va en el del cliente</span>
                    )}
                    {guardando && <span className="text-[10px] font-bold text-amber-600">Guardando…</span>}
                </div>
            )}

            {error && <p className="text-[10px] font-bold text-rose-600">{error}</p>}

            {/* Apenas se sabe cuál es, la carga de fábrica se despliega ACÁ. */}
            {pos && editable && (
                <FramePairEditor
                    key={`linea-arm-${item.id}-${pos}`}
                    orderId={orderId}
                    pair={pos}
                    title={`${etiquetaArmazon(pos, totalArmazones)} — ${nombreDeArmazon(item) || 'este armazón'}`}
                    accent={pos % 2 === 0 ? 'orange' : 'stone'}
                    initial={{
                        shape: f?.shape || '',
                        a: f?.a || '', b: f?.b || '', dbl: f?.dbl || '', edc: f?.edc || '',
                        details: f?.details || '',
                        imageUrl: f?.imageUrl || null,
                        heightOD: alto(f?.heightOD, rx?.heightOD),
                        heightOI: alto(f?.heightOI, rx?.heightOI),
                    }}
                    defaultOpen={!(f?.shape && f?.imageUrl)}
                    tint={parLab?.tint || null}
                    photochromic={!!parLab?.photochromic}
                    photochromicColor={parLab?.photochromicColor || null}
                    onSaved={onSaved}
                />
            )}
        </div>
    );
}
