'use client';

import React from 'react';
import { ShoppingBag, X, Minus, Plus, Palette, ChevronDown } from 'lucide-react';
import { isMultifocal2x1, isCrystal, getCategoryKey, safePrice } from '@/lib/promo-utils';
import { formatLensRange } from '@/lib/lens-range';
import { needsColorSelection } from '@/lib/crystal-color-utils';
import { INTENSIDADES_TENIDO, estiloDeTenidoDelProducto } from '@/lib/constants/tenido';
import { paletaDeFotocromatico } from '@/lib/constants/paletas-color';
import { lensOriginFromItem } from '@/lib/lens-origin';
import LensOriginBadge from '@/components/ui/LensOriginBadge';

interface CrystalColorOption {
    id: string;
    name: string;
    category: string;
    hexColor?: string | null;
}

interface CartLineItemsProps {
    items: any[];
    onUpdateQuantity: (idx: number, delta: number) => void;
    onRemoveItem: (idx: number) => void;
    onUpdateItemColor?: (idx: number, color: string, colorType: string) => void;
    /** @deprecated El estilo lo define el producto; ya no se elige en el carrito. */
    onUpdateItemStyle?: (idx: number, style: string) => void;
    onUpdateItemNote?: (idx: number, note: string) => void;
    markup: number;
    secondFrameUid: number | null;
    promoFrameDiscount: number;
    crystalColors?: CrystalColorOption[];
    tintStylePrices?: Record<string, number>;
}

export default function CartLineItems({
    items,
    onUpdateQuantity,
    onRemoveItem,
    onUpdateItemColor,
    onUpdateItemStyle: _onUpdateItemStyle,
    onUpdateItemNote,
    markup,
    secondFrameUid,
    promoFrameDiscount,
    crystalColors = [],
    tintStylePrices: _tintStylePrices = {}
}: CartLineItemsProps) {
    const [expandedColorIdx, setExpandedColorIdx] = React.useState<number | null>(null);

    // La paleta se busca ACÁ si nadie la pasó.
    //
    // Antes dependía de que cada pantalla que monta el carrito se acordara de
    // cargarla: el cotizador lo hacía, la ficha del cliente no, y en la ficha
    // el vendedor veía el botón COLOR pero abría vacío — sin forma de elegir el
    // tono y sin ningún aviso de por qué. Un componente que necesita un dato
    // para funcionar no puede depender de que el de arriba se acuerde.
    const [coloresPropios, setColoresPropios] = React.useState<CrystalColorOption[]>([]);
    React.useEffect(() => {
        if (crystalColors.length > 0) return;
        let vivo = true;
        fetch('/api/crystal-colors')
            .then(r => (r.ok ? r.json() : []))
            .then(data => { if (vivo && Array.isArray(data)) setColoresPropios(data); })
            .catch(err => console.error('[Colores de teñido] No se pudieron cargar:', err));
        return () => { vivo = false; };
    }, [crystalColors.length]);

    const colores: CrystalColorOption[] = crystalColors.length > 0 ? crystalColors : coloresPropios;

    if (items.length === 0) {
        return (
            <div className="py-12 text-center border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-[2.5rem] bg-stone-50/50 dark:bg-stone-900/20">
                <ShoppingBag className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-4" />
                <p className="text-xs font-black text-stone-300 uppercase tracking-widest">El presupuesto está vacío</p>
                <p className="text-[10px] font-bold text-stone-400 mt-2">Usá el buscador de arriba para agregar ítems</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 mb-6">
            {items.map((item, idx) => {
                const showColorSelector = needsColorSelection(item.product);
                const isColorExpanded = expandedColorIdx === idx;
                const hasColor = !!item.crystalColor;
                const hasNote = !!item.crystalColorNote;
                // El estilo lo define el PRODUCTO ("Teñido Degradé" es degradé).
                // Si el producto no lo dice, se respeta lo que ya tenga el item.
                const estiloDelItem = estiloDeTenidoDelProducto(item.product) || item.crystalColorType || 'COMPACTO';

                // QUÉ COLORES se ofrecen depende del cristal: un Transitions
                // Gen S viene en 8, un Xtractive en gris, y el teñido a pedido
                // tiene los tonos de SmartLab. Ofrecer colores que ese cristal no
                // tiene es un pedido rebotado; esconder los que sí tiene es una
                // venta que no se hace.
                const paleta = paletaDeFotocromatico(item.product);
                const tonosParaElegir = paleta
                    ? paleta.tonos.map(t => ({ id: `${paleta.id}-${t.name}`, name: t.name, category: estiloDelItem, hexColor: t.hexColor }))
                    : colores
                        .filter(c => c.category === estiloDelItem)
                        .filter((c, i, arr) => arr.findIndex(o => o.name === c.name) === i);

                // La muestra del tono elegido, para que el botón la lleve puesta.
                const colorHex = tonosParaElegir.find(c => c.name === item.crystalColor)?.hexColor
                    || colores.find(c => c.name === item.crystalColor)?.hexColor
                    || null;

                return (
                    <div key={idx} className="space-y-0">
                        {/* Main item row */}
                        <div className={`flex items-center gap-3 bg-stone-50 dark:bg-stone-900 p-3 sm:p-4 ${showColorSelector && isColorExpanded ? 'rounded-t-2xl border-b-0' : 'rounded-2xl'} border border-stone-200/60 dark:border-stone-800 group hover:border-primary/30 transition-all`}>
                            {item.eye && (
                                <span className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-bold uppercase shrink-0 ${item.eye === 'OD' ? 'bg-stone-900 text-white dark:bg-stone-750' : 'bg-stone-200 text-stone-600 dark:bg-stone-805'}`}>
                                    {item.eye}
                                </span>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-stone-800 dark:text-stone-150 truncate group-hover:text-primary transition-colors flex items-center gap-2">
                                    {item.product?.brand || item.productBrandSnapshot || '—'} · {item.product?.name || item.productNameSnapshot || 'Producto eliminado'}
                                    {safePrice(item.customPrice) === 0 && isMultifocal2x1(item.product) && (
                                        <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                                            BONIFICADO 2x1
                                        </span>
                                    )}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                                        {getCategoryKey(item.product?.type || item.productCategorySnapshot || null, item.product?.category || item.productCategorySnapshot || null)}
                                        {item.isPromo && <span className="text-emerald-500 ml-2">† SIN CARGO 2x1</span>}
                                    </p>
                                    <LensOriginBadge origin={lensOriginFromItem(item)} />
                                    {isCrystal(item.product) && item.product && formatLensRange(item.product) && (
                                        <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                            {formatLensRange(item.product)}
                                        </span>
                                    )}
                                    {(hasColor || hasNote) && (
                                        <span className="inline-flex items-center gap-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                            <Palette className="w-3 h-3" />
                                            {hasColor && <>{item.crystalColorType === 'DEGRADE' ? 'Degradé' : item.crystalColorType === 'MUESTRA' ? 'Muestra' : 'Compacto'} · {item.crystalColor}</>}
                                            {hasColor && hasNote && ' — '}
                                            {hasNote && item.crystalColorNote}
                                        </span>
                                    )}
                                </div>
                            </div>

            {/* El botón que abre el selector de color e intensidad.
                Era una pastilla chiquita que decía "Color" y pasaba desapercibida
                —el vendedor no encontraba dónde cargar el dato, y sin color el
                pedido no se puede convertir en venta—. Ahora es un botón lleno,
                dice qué hay que hacer, y mientras falta el color se ve en ámbar
                con la muestra del tono cuando ya está elegido. */}
                            {showColorSelector && (
                                <button
                                    onClick={() => setExpandedColorIdx(isColorExpanded ? null : idx)}
                                    aria-expanded={isColorExpanded}
                                    title={hasColor ? 'Cambiar el color o la intensidad del teñido' : 'Elegir el color y la intensidad del teñido'}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 shadow-sm hover:scale-[1.03] active:scale-95 ${
                                        hasColor
                                            ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-500/25'
                                            : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/30 ring-2 ring-amber-300/60 animate-pulse'
                                    }`}
                                >
                                    {hasColor && colorHex ? (
                                        <span
                                            className="w-4 h-4 rounded-full border-2 border-white/70 shadow-sm shrink-0"
                                            style={{ backgroundColor: colorHex }}
                                        />
                                    ) : (
                                        <Palette className="w-4 h-4 shrink-0" />
                                    )}
                                    {hasColor ? `${item.crystalColor}${hasNote ? ` · ${item.crystalColorNote}` : ''}` : 'Elegir color'}
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isColorExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            )}

                            {(!item.isPromo && !isCrystal(item.product)) && (
                                <div className="flex items-center gap-1 bg-white dark:bg-stone-800 p-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
                                    <button onClick={() => onUpdateQuantity(idx, -1)} className="w-7 h-7 rounded flex items-center justify-center text-stone-400 hover:bg-stone-50 hover:text-stone-800 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                                    <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                                    <button onClick={() => onUpdateQuantity(idx, 1)} className="w-7 h-7 rounded flex items-center justify-center text-stone-400 hover:bg-stone-50 hover:text-stone-800 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                                </div>
                            )}
                            {isCrystal(item.product) && (
                                <div className="flex items-center gap-1 bg-stone-100/50 dark:bg-stone-800/20 px-2 py-1 rounded-lg border border-stone-200/50 dark:border-stone-800 opacity-60">
                                    <span className="text-[9px] font-bold uppercase text-stone-400">Cant: {item.quantity}</span>
                                </div>
                            )}
                            <div className="w-24 text-right pr-1">
                                {item.uid === secondFrameUid && promoFrameDiscount > 0 ? (
                                    <div className="flex flex-col">
                                        <span className="text-[10px] line-through text-stone-400 font-semibold">${item.customPrice.toLocaleString()}</span>
                                        <span className="text-xs font-extrabold text-emerald-500">${Math.max(0, item.customPrice - promoFrameDiscount).toLocaleString()}</span>
                                    </div>
                                ) : item.isPromo ? (
                                    <span className="text-[10px] font-bold text-emerald-500">SIN CARGO</span>
                                ) : (
                                    <span className="text-xs font-bold text-stone-700 dark:text-stone-200">
                                        ${(item.customPrice * (1 + markup / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                )}
                            </div>
                            <button onClick={() => onRemoveItem(idx)} className="text-stone-300 hover:text-red-500 transition-colors p-1"><X className="w-4 h-4" /></button>
                        </div>

                        {/* Inline Color Selector — Nota libre + Two-step: Style → Color */}
                        {showColorSelector && isColorExpanded && (
                            <div className="bg-violet-50 dark:bg-violet-950/30 border-x-2 border-b-2 border-violet-300 dark:border-violet-800 rounded-b-2xl p-4 animate-in slide-in-from-top-1 duration-300">
                                <p className="text-[10px] font-black text-violet-700 dark:text-violet-300 uppercase tracking-widest mb-3">
                                    Teñido — elegí el color y el grado
                                </p>
                                {/* Intensidad: se sugieren los valores que ofrece SmartLab, pero
                                    el campo se puede ESCRIBIR. Hay pedidos que piden cosas como
                                    "60% más oscuro arriba", y encerrar eso en una lista obligaría
                                    al vendedor a elegir algo que no es lo que pidió el cliente. */}
                                <div className="mb-3 flex items-center gap-1.5">
                                    <Palette className="w-3 h-3 text-violet-400 shrink-0" />
                                    <label htmlFor={`grado-${idx}`} className="text-[9px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-wider shrink-0">
                                        Grado
                                    </label>
                                    <input
                                        id={`grado-${idx}`}
                                        type="text"
                                        list={`grados-tenido-${idx}`}
                                        defaultValue={item.crystalColorNote || ''}
                                        onBlur={e => onUpdateItemNote?.(idx, e.target.value)}
                                        placeholder="0.5 · 1 · 2 · 3 · 4 — o escribí el detalle"
                                        className="flex-1 min-w-0 px-2 py-1 rounded-lg text-[11px] font-medium border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20 outline-none transition-all"
                                    />
                                    <datalist id={`grados-tenido-${idx}`}>
                                        {INTENSIDADES_TENIDO.map(g => <option key={g} value={g} />)}
                                    </datalist>
                                </div>

                                {/* Los COLORES, directo. El estilo (compacto / degradé /
                                    según muestra) NO se elige acá: ya lo definió el producto
                                    —"Teñido Degradé" es degradé— y volver a preguntarlo pedía
                                    un dato que el sistema ya sabe, además de dejar que se lo
                                    contradiga y se mande así a fábrica. */}
                                {tonosParaElegir.length > 0 ? (
                                    <div>
                                        <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">
                                            Color{paleta ? ` — ${paleta.label}` : ''}
                                        </p>
                                        {paleta?.porConfirmar && (
                                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 mb-2">
                                                ⚠️ Esta lista todavía no está confirmada contra la lista de precios —
                                                chequeá con el laboratorio antes de mandarlo.
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {tonosParaElegir.map(color => {
                                                const isSelected = item.crystalColor === color.name;
                                                return (
                                                    <button
                                                        key={color.id}
                                                        onClick={() => {
                                                            onUpdateItemColor?.(idx, color.name, estiloDelItem);
                                                            setExpandedColorIdx(null);
                                                        }}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all hover:scale-105 active:scale-95 border ${
                                                            isSelected
                                                                ? 'bg-violet-600 text-white border-violet-700 shadow-md shadow-violet-500/20'
                                                                : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-violet-300 hover:bg-violet-50'
                                                        }`}
                                                    >
                                                        {color.hexColor && (
                                                            <span
                                                                className="w-4 h-4 rounded-full border border-white/30 shadow-sm flex-shrink-0"
                                                                style={{ backgroundColor: color.hexColor }}
                                                            />
                                                        )}
                                                        {color.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    // Que el vendedor SEPA por qué no puede elegir, en vez de
                                    // encontrarse un desplegable vacío sin explicación.
                                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500">
                                        Cargando los colores del laboratorio… si no aparecen, recargá la página.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
