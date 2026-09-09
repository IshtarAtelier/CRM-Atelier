'use client';

import React from 'react';
import Image from 'next/image';
import { Check, Plus, Glasses, Eye, Sun, Activity, Box, Watch, Droplets, Gem, FlaskConical } from 'lucide-react';
import type { Product } from '@/types/orders';
import { safePrice, getCategoryKey } from '@/lib/promo-utils';
import { PricingService } from '@/services/PricingService';
import { ETIQUETA_MP_CUOTAS_LARGAS } from '@/lib/promo-cuotas';
import { RECARGO_MP_CUOTAS_LARGAS } from '@/lib/constants/descuentos';
import { precioConOferta } from '@/lib/precio-oferta';
import { normalizeLensOrigin } from '@/lib/lens-origin';
import { formatLensRange } from '@/lib/lens-range';
import { resolveStorageUrl } from '@/lib/utils/storage';

/**
 * LA TABLA DEL COTIZADOR — una sola, para todas las solapas.
 *
 * Ishtar, 8/9/2026: "igualá a este modelo todas las vistas que sean iguales, en
 * todas las solapas, tanto en TODOS como en ARMAZONES etc". El modelo es la
 * tabla de cristales: una fila por producto y las CINCO formas de pago en
 * columnas rotuladas (Lista · Efectivo · Transf. · 6 cuotas · 12 cuotas).
 *
 * Antes cada solapa tenía su propio render: cristales esta tabla, tratamientos
 * otra tabla con dos precios, y el resto (armazones, sol, contactología,
 * accesorios) tarjetas donde el precio iba apretado en un renglón de 9px. El
 * vendedor tenía que calcular a mano lo que acá ya está resuelto.
 *
 * Es el patrón "un dato que se muestra en más de un lugar se arma en UN solo
 * lugar": si mañana cambia una forma de pago, se toca este archivo y cambian
 * todas las solapas juntas.
 */

export type VarianteTabla = 'cristal' | 'general';

type Props = {
    productos: Product[];
    variante: VarianteTabla;
    markup: number;
    discountCash: number;
    discountTransfer: number;
    quoteItems: { product?: Product | null; quantity?: number }[];
    addToQuote: (p: Product) => void;
    /** Cabecera de grupo: familia en cristales, marca en el resto. `null` = sin agrupar. */
    agrupar?: ((p: Product) => string) | null;
    /** Cómo se nombra lo que se cuenta en la cabecera de grupo. */
    sustantivo?: [string, string];
    tipoConSeparador: (t?: string | null) => string;
};

/**
 * La miniatura del producto, con RESPALDO. Varias fotos del catálogo apuntan a
 * www.kazwiniopticalgroup.com, que la CSP del sitio no permite (solo el dominio
 * sin www): esas imágenes NO cargan y dejaban el ícono de imagen rota en cada
 * fila. Si la imagen falla, se muestra el ícono de la categoría.
 */
const ICONO_POR_CATEGORIA: Record<string, React.ComponentType<{ className?: string }>> = {
    'Armazón': Glasses, 'Cristal': Eye, 'Lente de sol': Sun, 'Lente de contacto': Activity,
    'Accesorio': Box, 'Reloj': Watch, 'Líquido / Solución': Droplets, 'Joyería': Gem,
    'Tratamiento': FlaskConical,
};

function Miniatura({ product, src }: { product: Product; src: string | null }) {
    const [falló, setFalló] = React.useState(false);
    const Icono = ICONO_POR_CATEGORIA[getCategoryKey(product.type ?? null, product.category)] ?? Box;
    if (src && !falló) {
        return (
            <Image unoptimized width={28} height={28} src={src} alt={product.name || ''}
                onError={() => setFalló(true)}
                className="w-7 h-7 object-contain rounded border border-sidebar-border bg-background shrink-0" />
        );
    }
    return (
        <div className="w-7 h-7 rounded border border-sidebar-border bg-background flex items-center justify-center shrink-0">
            <Icono className="w-3.5 h-3.5 text-foreground/40" />
        </div>
    );
}

const esTratamiento = (p: Product) => getCategoryKey(p.type ?? null, p.category) === 'Tratamiento';

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

/** Las cinco formas de pago salen SIEMPRE de acá — nunca recalculadas en la vista. */
export function formasDePago(product: Product, markup: number, dCash: number, dTransfer: number) {
    const oferta = precioConOferta(product);
    const lista = safePrice(oferta.final) * (1 + markup / 100);
    const { installment12 } = PricingService.cuotasMpLargas(lista);
    return {
        oferta,
        lista,
        efectivo: lista * (1 - dCash / 100),
        transferencia: lista * (1 - dTransfer / 100),
        cuota6: lista / 6,
        cuota12: installment12,
    };
}

export default function TablaCotizador({
    productos, variante, markup, discountCash, discountTransfer,
    quoteItems, addToQuote, agrupar, sustantivo = ['item', 'items'], tipoConSeparador,
}: Props) {
    const esCristal = variante === 'cristal';
    // 11 columnas en cristales (índice, confección y rango son propios del
    // cristal); 8 en el resto. El colSpan de la cabecera de grupo se deriva de
    // acá para que nunca quede desalineada al tocar las columnas.
    const columnas = esCristal ? 11 : 8;

    return (
        <>
            {/* Desktop / tablet: la tabla */}
            <div className="hidden md:block rounded-xl border border-sidebar-border overflow-hidden bg-sidebar">
                <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                    <table className="w-full text-left border-collapse table-fixed" style={{ minWidth: esCristal ? 1080 : 940 }}>
                        <thead>
                            <tr className="bg-sidebar text-foreground/55 border-b border-sidebar-border">
                                <th className="pl-4 pr-1 py-2.5 text-[9px] font-bold uppercase tracking-wider w-[118px]">Tipo · Marca</th>
                                {esCristal && <th className="px-1 py-2.5 text-[9px] font-bold uppercase tracking-wider text-center w-[44px]">Índice</th>}
                                <th className="px-1.5 py-2.5 text-[9px] font-bold uppercase tracking-wider text-center w-[86px]">{esCristal ? 'Confección' : 'Stock / Lab'}</th>
                                <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider">Descripción</th>
                                {esCristal && <th className="px-2 py-2.5 text-[9px] font-bold uppercase tracking-wider text-center w-[136px]">Rango</th>}
                                <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-right w-[90px]">Lista</th>
                                <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-right w-[110px] text-primary">Efectivo</th>
                                <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-right w-[90px]">Transf.</th>
                                <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-right w-[92px]" title="3 y 6 cuotas sin interés">6 Cuotas</th>
                                {/* El 10% se aclara siempre. Acá no entra la etiqueta completa, así que
                                    va abreviada y la frase canónica queda al pie de la tabla. */}
                                <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-right w-[100px]" title={ETIQUETA_MP_CUOTAS_LARGAS}>
                                    12 Cuotas +{RECARGO_MP_CUOTAS_LARGAS}%
                                </th>
                                <th className="px-2 py-2.5 w-10 text-center"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {productos.map((product, i) => {
                                const grupo = agrupar ? agrupar(product) : null;
                                const abreGrupo = grupo != null && (i === 0 || agrupar!(productos[i - 1]) !== grupo);
                                const enGrupo = abreGrupo ? productos.filter(x => agrupar!(x) === grupo).length : 0;
                                const inQuote = quoteItems.find(i2 => i2.product?.id === product.id);
                                const p = formasDePago(product, markup, discountCash, discountTransfer);
                                const origin = normalizeLensOrigin(product.origin);
                                const img = resolveStorageUrl(product.imagenesCatalogo?.[0] || product.rawImageUrls?.[0] || null);
                                return (
                                    <React.Fragment key={product.id}>
                                        {abreGrupo && (
                                            <tr>
                                                <td colSpan={columnas} className="bg-primary/[0.07] border-y border-sidebar-border px-4 py-2">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/70">{grupo}</span>
                                                    <span className="ml-2 text-[10px] font-medium text-foreground/45">
                                                        {enGrupo} {enGrupo === 1 ? sustantivo[0] : sustantivo[1]}
                                                    </span>
                                                </td>
                                            </tr>
                                        )}
                                        <tr
                                            onClick={() => addToQuote(product)}
                                            className="group cursor-pointer transition-colors border-b border-sidebar-border last:border-b-0 hover:bg-primary/[0.06]"
                                        >
                                            <td className="px-4 py-2 align-top">
                                                {/* Sin tipo cargado no se pinta un renglón con un guion: la marca
                                                    sube y la fila queda de una línea, no de dos vacías. */}
                                                {product.type && (
                                                    <p className="text-[10px] font-bold uppercase text-foreground/55 leading-tight truncate">{tipoConSeparador(product.type)}</p>
                                                )}
                                                <p className={`text-[10px] font-semibold uppercase text-foreground/55 truncate ${product.type ? 'mt-0.5' : ''}`}>{product.brand || '—'}</p>
                                            </td>
                                            {esCristal && (
                                                <td className="px-3 py-2 text-center align-top">
                                                    <span className="text-[10px] font-bold text-foreground/55">{product.lensIndex || '—'}</span>
                                                </td>
                                            )}
                                            <td className="px-1.5 py-2 text-center align-top">
                                                {esCristal ? (
                                                    origin ? (
                                                        <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${origin === 'STOCK' ? 'border-emerald-800 text-emerald-500' : 'border-sky-800 text-sky-500'}`}>
                                                            {origin === 'STOCK' ? 'Stock' : 'Laboratorio'}
                                                        </span>
                                                    ) : <span className="text-[10px] text-foreground/55">—</span>
                                                ) : esTratamiento(product) ? (
                                                    // Un tratamiento no tiene unidades en góndola: lo que importa
                                                    // es qué laboratorio lo hace.
                                                    <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600">
                                                        {product.laboratory || 'A pedido'}
                                                    </span>
                                                ) : (
                                                    // En armazones y accesorios lo que importa es cuántos quedan:
                                                    // el vendedor no puede prometer lo que no está.
                                                    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                                                        (product.stock ?? 0) <= 0 ? 'border-rose-800 text-rose-500'
                                                            : (product.stock ?? 0) <= 2 ? 'border-amber-700 text-amber-500'
                                                                : 'border-emerald-800 text-emerald-500'}`}>
                                                        {product.stock == null ? 'A pedido' : `${product.stock} u.`}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 align-top">
                                                <div className="flex items-start gap-2">
                                                    {!esCristal && <Miniatura product={product} src={img} />}
                                                    {/* El 2x1 es la promo que más se vende: tiene que verse de lejos. */}
                                                    {product.is2x1 && (
                                                        <span className="shrink-0 mt-px px-1.5 py-0.5 rounded text-[9px] font-black tracking-wide bg-primary text-primary-foreground shadow-sm">2x1</span>
                                                    )}
                                                    <p className="text-[13px] font-semibold leading-snug">{product.name || '—'}</p>
                                                    {/* Oferta de la tienda: las columnas ya muestran el rebajado y sin
                                                        este cartel no se distingue de un producto sin promo. */}
                                                    {p.oferta.enOferta && (
                                                        <span className="shrink-0 mt-px px-1.5 py-0.5 rounded text-[9px] font-black tracking-wide bg-rose-100 text-rose-700 border border-rose-200">
                                                            {p.oferta.descuentoPct}% OFF
                                                        </span>
                                                    )}
                                                    {!esCristal && product.publishToWeb && (
                                                        <span className="shrink-0 mt-px px-1.5 py-0.5 rounded text-[9px] font-black tracking-wide bg-violet-100 text-violet-700 border border-violet-200">Web</span>
                                                    )}
                                                </div>
                                            </td>
                                            {esCristal && (
                                                <td className="px-3 py-2 text-center align-top">
                                                    <span className="text-[10px] font-medium text-foreground/55 leading-tight block">{formatLensRange(product) || '—'}</span>
                                                </td>
                                            )}
                                            <td className="px-3 py-2 text-right align-top">
                                                <span className="text-xs font-semibold text-foreground/55 tabular-nums">{pesos(p.lista)}</span>
                                            </td>
                                            <td className="px-4 py-2 text-right align-top">
                                                <span className="text-sm font-black text-primary tabular-nums">{pesos(p.efectivo)}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right align-top">
                                                <span className="text-xs font-semibold text-foreground/55 tabular-nums">{pesos(p.transferencia)}</span>
                                            </td>
                                            {/* 3 y 6 cuotas son SIN INTERÉS: la cuota es la lista dividido 6. */}
                                            <td className="px-3 py-2 text-right align-top">
                                                <span className="text-xs font-semibold text-foreground/55 tabular-nums">{pesos(p.cuota6)}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right align-top">
                                                <span className="text-xs font-semibold text-foreground/55 tabular-nums">{pesos(p.cuota12)}</span>
                                            </td>
                                            <td className="px-2 py-2 text-center align-top">
                                                {inQuote ? (
                                                    <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto">
                                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full border border-sidebar-border flex items-center justify-center mx-auto opacity-60 group-hover:opacity-100 group-hover:border-primary group-hover:bg-primary/10 transition-all">
                                                        <Plus className="w-3.5 h-3.5 text-foreground/55 group-hover:text-primary transition-colors" />
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-foreground/55 border-t border-sidebar-border">
                    {ETIQUETA_MP_CUOTAS_LARGAS} · Mercado Pago
                </p>
            </div>

            {/* Mobile: la misma información, en tarjetas — las cinco formas rotuladas. */}
            <div className="md:hidden flex flex-col gap-2">
                {productos.map(product => {
                    const inQuote = quoteItems.find(i => i.product?.id === product.id);
                    const p = formasDePago(product, markup, discountCash, discountTransfer);
                    const origin = normalizeLensOrigin(product.origin);
                    return (
                        <button
                            key={product.id}
                            onClick={() => addToQuote(product)}
                            className={`w-full text-left p-3 rounded-xl border transition-all ${inQuote ? 'bg-primary/[0.06] border-primary/30' : 'bg-sidebar border-sidebar-border'}`}
                        >
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                {product.type && <span className="text-[9px] font-bold uppercase text-foreground/55">{tipoConSeparador(product.type)}</span>}
                                {product.brand && <span className="text-[9px] font-bold uppercase text-foreground/55">{product.type ? '· ' : ''}{product.brand}</span>}
                                {product.lensIndex && <span className="text-[9px] font-bold text-foreground/55">· idx {product.lensIndex}</span>}
                                {product.is2x1 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-primary text-primary-foreground">2x1</span>}
                                {origin && (
                                    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${origin === 'STOCK' ? 'border-emerald-800 text-emerald-500' : 'border-sky-800 text-sky-500'}`}>
                                        {origin === 'STOCK' ? 'Stock' : 'Laboratorio'}
                                    </span>
                                )}
                                {!esCristal && product.stock != null && (
                                    <span className="text-[9px] font-bold uppercase text-foreground/55">· {product.stock} u.</span>
                                )}
                            </div>
                            <p className="text-sm font-semibold text-foreground leading-snug">{product.name || '—'}</p>
                            {formatLensRange(product) && (
                                <p className="text-[10px] font-medium text-foreground/55 mt-1">{formatLensRange(product)}</p>
                            )}
                            <div className="flex items-end justify-between mt-2 gap-3">
                                <div className="tabular-nums leading-tight flex-1">
                                    {p.oferta.enOferta && (
                                        <span className="text-[10px] font-black text-rose-600 block">
                                            <span className="line-through text-foreground/45 font-semibold">${p.oferta.lista.toLocaleString('es-AR')}</span> {p.oferta.descuentoPct}% OFF
                                        </span>
                                    )}
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-foreground/45 w-[52px]">Efectivo</span>
                                        <span className="text-base font-black text-primary">{pesos(p.efectivo)}</span>
                                    </div>
                                    {([
                                        ['Transf.', p.transferencia],
                                        ['Lista', p.lista],
                                        ['6 cuotas', p.cuota6],
                                        ['12 cuotas', p.cuota12],
                                    ] as const).map(([rotulo, valor]) => (
                                        <div key={rotulo} className="flex items-baseline gap-2">
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-foreground/40 w-[52px]">{rotulo}</span>
                                            <span className="text-[11px] font-semibold text-foreground/60">{pesos(valor)}</span>
                                        </div>
                                    ))}
                                </div>
                                {inQuote ? (
                                    <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                                        <Check className="w-4 h-4 text-emerald-400" />
                                    </div>
                                ) : (
                                    <div className="w-7 h-7 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                                        <Plus className="w-4 h-4 text-primary" />
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </>
    );
}
