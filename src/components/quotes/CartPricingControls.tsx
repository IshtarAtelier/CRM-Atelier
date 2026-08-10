'use client';

import React from 'react';
import { TrendingUp, Banknote, ArrowRightLeft, CreditCard, Lock } from 'lucide-react';
import {
    OPCIONES_DESCUENTO_EFECTIVO,
    OPCIONES_DESCUENTO_TRANSFERENCIA,
    OPCIONES_RECARGO_CUOTAS,
    TOPE_VENDEDOR,
} from '@/lib/constants/descuentos';

interface CartPricingControlsProps {
    markup: number;
    setMarkup: (val: number) => void;
    discountCash: number;
    setDiscountCash: (val: number) => void;
    discountTransfer: number;
    setDiscountTransfer: (val: number) => void;
    discountCard: number;
    setDiscountCard: (val: number) => void;
    specialDiscount?: number;
    setSpecialDiscount?: (val: number) => void;
    currentUserRole?: string;
    isCard?: boolean;
}

export default function CartPricingControls({
    markup,
    setMarkup,
    discountCash,
    setDiscountCash,
    discountTransfer,
    setDiscountTransfer,
    discountCard,
    setDiscountCard,
    specialDiscount = 0,
    setSpecialDiscount,
    currentUserRole,
    isCard = true
}: CartPricingControlsProps) {
    const isAdmin = currentUserRole === 'ADMIN';

    // El vendedor solo ve hasta su tope. Si la orden ya trae un descuento mayor
    // —el admin lo autorizó—, esa opción se mantiene a la vista: si no, el select
    // no podría representar su propio valor y al guardar lo bajaría solo.
    const hastaElTope = (opciones: readonly number[], tope: number, actual: number) =>
        isAdmin ? [...opciones] : opciones.filter(v => v <= Math.max(tope, actual));

    return (
        <div className={`grid grid-cols-2 gap-3 mb-6 ${setSpecialDiscount ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-2xl border border-stone-250/60 dark:border-stone-800 transition-all focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-400/25 group/markup">
                 <div className="flex items-center gap-1.5 mb-1.5">
                     <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                     <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Markup</span>
                 </div>
                 <div className="flex items-center gap-1">
                    <input
                        type="number"
                        min={0}
                        value={markup || ''}
                        onChange={e => setMarkup(Math.abs(Number(e.target.value)))}
                        className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-blue-500">%</span>
                 </div>
            </div>
            <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-2xl border border-stone-250/60 dark:border-stone-800 transition-all focus-within:border-emerald-450 dark:focus-within:border-emerald-550 focus-within:ring-2 focus-within:ring-emerald-400/25 group/efvo">
                 <div className="flex items-center gap-1.5 mb-1.5">
                     <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                     <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Dto. Efvo</span>
                 </div>
                 <select
                    value={discountCash}
                    onChange={e => setDiscountCash(Number(e.target.value))}
                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                >
                    {hastaElTope(OPCIONES_DESCUENTO_EFECTIVO, TOPE_VENDEDOR.discountCash, discountCash)
                        .map(v => <option key={v} value={v}>-{v}%</option>)}
                </select>
            </div>
            <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-2xl border border-stone-250/60 dark:border-stone-800 transition-all focus-within:border-violet-400 dark:focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-400/25 group/transf">
                 <div className="flex items-center gap-1.5 mb-1.5">
                     <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500" />
                     <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Dto. Transf</span>
                 </div>
                 <select
                    value={discountTransfer}
                    onChange={e => setDiscountTransfer(Number(e.target.value))}
                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                >
                    {hastaElTope(OPCIONES_DESCUENTO_TRANSFERENCIA, TOPE_VENDEDOR.discountTransfer, discountTransfer)
                        .map(v => <option key={v} value={v}>-{v}%</option>)}
                </select>
            </div>
            <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-2xl border border-stone-250/60 dark:border-stone-800 transition-all focus-within:border-orange-400 dark:focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-400/25 group/card">
                 <div className="flex items-center gap-1.5 mb-1.5">
                     <CreditCard className="w-3.5 h-3.5 text-orange-500" />
                     <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Rec. Cuotas</span>
                 </div>
                 <select
                    value={discountCard}
                    onChange={e => setDiscountCard(Number(e.target.value))}
                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                >
                    {OPCIONES_RECARGO_CUOTAS.map(v => <option key={v} value={v}>{v === 0 ? '0%' : `+${v}%`}</option>)}
                </select>
            </div>
            
            {/* El vendedor lo VE pero no lo edita: escondérselo hacía que ni se
                acordara de que existe. Bloqueado y con el aviso a la vista, sabe
                que el descuento especial se pide. Ojo: el bloqueo real está en el
                servidor (POST y PATCH de /api/orders) — esto es solo la pantalla. */}
            {setSpecialDiscount && (
                <div className="p-3 bg-stone-50 dark:bg-stone-900/40 rounded-2xl border border-stone-250/60 dark:border-stone-800 transition-all focus-within:border-rose-400 dark:focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-400/25 group/special">
                     <div className="flex items-center gap-1.5 mb-1.5">
                         {isAdmin
                             ? <Banknote className="w-3.5 h-3.5 text-rose-500" />
                             : <Lock className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />}
                         <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Dto. Especial</span>
                     </div>
                     <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-rose-550">$</span>
                          <input
                            type="number"
                            min={0}
                            value={specialDiscount || ''}
                            onChange={e => setSpecialDiscount(Math.abs(Number(e.target.value)))}
                            disabled={!isAdmin}
                            title={isAdmin ? undefined : 'El descuento especial lo aplica el administrador: solicitáselo.'}
                            // Sin `opacity` en el estado bloqueado: bajarla haría
                            // ilegible un texto de 12px. Se marca con el candado,
                            // el fondo y el cursor, y el número se lee entero.
                            className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-stone-100 dark:disabled:bg-stone-800/60 disabled:text-stone-700 dark:disabled:text-stone-300 disabled:cursor-not-allowed"
                            placeholder={isAdmin ? 'Monto' : 'Solicitar'}
                        />
                     </div>
                     {/* -700 y no -600: a 9px, un -600 sobre el -50 de la
                         tarjeta da ~3,4:1 y no llega al piso de 4,5:1. */}
                     {!isAdmin && (
                         <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-stone-700 dark:text-stone-300">
                             Lo aplica el admin
                         </p>
                     )}
                </div>
            )}
        </div>
    );
}
