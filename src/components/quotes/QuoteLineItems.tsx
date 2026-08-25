'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { lensOriginFromItem } from '@/lib/lens-origin';
import LensOriginBadge from '@/components/ui/LensOriginBadge';
import LineaColorEditor from './LineaColorEditor';
import { pick2x1FrameDiscount, etiquetaBonificacion2x1, modoBonificacionGuardada } from '@/lib/promo-utils';
import { colorDeLenteEnPedido } from '@/lib/color-de-lente';

interface QuoteLineItemsProps {
    items: any[];
    markup: number;
    appliedPromoName?: string;
    /** Descuento de promo GUARDADO en la venta (es el número que manda: la
     *  vista lo muestra tal cual, nunca lo recalcula). */
    appliedPromoDiscount?: number;
    specialDiscount?: number;
    /** Con el id del pedido, el color de cada línea se corrige acá mismo. */
    orderId?: string;
    /** false en una venta ya enviada: se ve, no se toca. */
    editable?: boolean;
    /** Cuántos armazones lleva el pedido (para preguntar a cuál va el teñido). */
    totalArmazones?: number;
    onSaved?: () => void | Promise<void>;
}

export default function QuoteLineItems({
    items,
    markup,
    appliedPromoName,
    appliedPromoDiscount = 0,
    specialDiscount = 0,
    orderId,
    editable = false,
    totalArmazones = 1,
    onSaved,
}: QuoteLineItemsProps) {
    // Detect if this order has a 2x1 promo applied (either multifocal or generic)
    const hasPromo = appliedPromoName && (appliedPromoName.includes('2x1') || appliedPromoName.includes('Bonificado'));

    // Cuál armazón va bonificado (solo para mostrarlo; la plata la calcula
    // PricingService). Sale de pick2x1FrameDiscount — el MISMO módulo que pone
    // la plata — así la insignia nunca puede señalar un armazón distinto del
    // que el total descontó (la copia anterior seguía la regla vieja del
    // "segundo más caro" y marcaba mal la mezcla tildado + sin tildar).
    // Para productos borrados el ítem cae a sus snapshots, que no traen el
    // tilde: sin tilde no hay insignia, igual que no hubo descuento.
    const bonifiedItemId = React.useMemo(() => {
        if (!hasPromo || !items || items.length === 0) return null;
        const promo = pick2x1FrameDiscount(items.map(it => ({
            ...it,
            product: it.product || {
                category: it.productCategorySnapshot,
                type: it.productTypeSnapshot,
                name: it.productNameSnapshot,
                brand: it.productBrandSnapshot,
            },
            __orig: it,
        })));
        return promo.item?.__orig?.id ?? null;
    }, [items, hasPromo]);

    return (
        <div className="space-y-3">
            <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Plus className="w-3 h-3" /> Detalle de productos
            </h4>
            {items.map((item: any) => {
                const itemPrice = item.price * item.quantity;
                const priceWithMarkup = itemPrice * (1 + markup / 100);
                const isBonified = item.id === bonifiedItemId;
                // Si el producto fue borrado del catálogo, cae a la foto congelada en la línea
                const brand = item.product?.brand || item.productBrandSnapshot || '';
                const name = item.product?.name || item.productNameSnapshot || 'Producto eliminado';
                const typeLabel = item.product?.type || item.product?.category || item.productTypeSnapshot || item.productCategorySnapshot || '';
                // Color de la lente EN EL PEDIDO: blanco de fábrica, pero si el
                // anteojo va teñido dice "De sol — teñido …". Si el producto fue
                // borrado del catálogo se deriva igual, de los snapshots.
                const colorLente = colorDeLenteEnPedido(item, items);

                return (
                    <div key={item.id} className={`flex justify-between items-center bg-stone-50/50 dark:bg-stone-900/30 px-5 py-3 rounded-2xl border ${isBonified ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/30' : 'border-stone-100 dark:border-stone-800'} backdrop-blur-sm group/item hover:border-primary/30 transition-all`}>
                        <div className="flex items-center gap-3">
                            {item.eye && (
                                <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-[10px] font-black uppercase tracking-widest italic leading-none ${item.eye === 'OD' ? 'bg-stone-900 text-white dark:bg-stone-700' : 'bg-stone-200 text-stone-600 dark:bg-stone-800'}`}>
                                    {item.eye}
                                </span>
                            )}
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-stone-800 dark:text-stone-200 block group-hover/item:text-primary transition-colors">
                                        {brand ? `${brand.toUpperCase()} · ` : ''}{name}
                                    </span>
                                    {isBonified && (
                                        <span className="bg-emerald-500 text-white text-[7px] px-1.5 py-0.5 rounded-lg font-black uppercase tracking-widest animate-pulse">
                                            BONIFICADO 2x1
                                        </span>
                                    )}
                                    <LensOriginBadge origin={lensOriginFromItem(item)} />
                                </div>
                                <span className="text-[10px] font-bold text-stone-400">
                                    {typeLabel} x{item.quantity}
                                    {colorLente ? <span className="text-stone-500 dark:text-stone-300"> · {colorLente}</span> : null}
                                </span>
                                {/* El color del cristal (el tono del fotocromático, o el
                                    color y el grado del teñido) vive acá: donde está el
                                    cristal, se lee y se corrige sin abrir el presupuesto
                                    entero. */}
                                {orderId && (
                                    <LineaColorEditor
                                        orderId={orderId}
                                        item={item}
                                        totalArmazones={totalArmazones}
                                        editable={editable}
                                        onSaved={onSaved}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            {isBonified ? (
                                // Se bonifica UNA unidad, con el descuento GUARDADO
                                // en la venta (gratis entero o 50%): se tacha el
                                // bruto de la línea y abajo va lo que se cobra de
                                // verdad, con la etiqueta que dice por qué.
                                (() => {
                                    const modo = modoBonificacionGuardada(appliedPromoName);
                                    const factor = 1 + markup / 100;
                                    const descuento = (appliedPromoDiscount > 0 ? appliedPromoDiscount : (modo === 'MITAD' ? item.price / 2 : item.price)) * factor;
                                    const neto = Math.max(0, priceWithMarkup - descuento);
                                    return (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] line-through text-stone-400 font-bold">
                                                ${priceWithMarkup.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                            <span className="text-sm font-black text-emerald-500">
                                                {neto === 0 ? 'SIN CARGO' : `$${neto.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                            </span>
                                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider">
                                                {etiquetaBonificacion2x1(modo)}{item.quantity > 1 ? ` · 1 de ${item.quantity}` : ''}
                                            </span>
                                        </div>
                                    );
                                })()
                            ) : (
                                <span className="text-sm font-black tracking-tight text-stone-900 dark:text-stone-100">
                                    ${priceWithMarkup.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}

            {hasPromo && (
                <div className="flex justify-between items-center bg-emerald-500/5 dark:bg-emerald-500/10 px-5 py-4 rounded-2xl border-2 border-dashed border-emerald-500/20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center">
                            <Plus className="w-4 h-4 rotate-45" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Bonificación Aplicada</span>
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{appliedPromoName}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 italic font-serif">DESCONTADO</span>
                    </div>
                </div>
            )}

            {specialDiscount > 0 && (
                <div className="flex justify-between items-center bg-rose-500/5 dark:bg-rose-500/10 px-5 py-4 rounded-2xl border-2 border-dashed border-rose-500/20 mt-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-rose-500 text-white rounded-lg flex items-center justify-center">
                            <Plus className="w-4 h-4 rotate-45" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest block">Descuento Especial</span>
                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">Aplicado por administración</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400 italic font-serif">-${Math.round(specialDiscount).toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
