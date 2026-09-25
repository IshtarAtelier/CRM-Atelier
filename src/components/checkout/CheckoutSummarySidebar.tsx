import React from "react";
import { describirConfiguracion, tieneCristales } from '@/lib/cristales-web/claves';
import Image from "next/image";
import { CreditCard, BadgePercent, Truck } from "lucide-react";
import { CouponField, type AppliedCoupon } from "@/components/checkout/CouponField";
import { getItemUnitPrice } from "@/store/useCart";
import { PricingService, type TotalesCheckout } from "@/services/PricingService";
import { recetaPendiente } from '@/lib/checkout/receta';
import { ETIQUETA_MP_CUOTAS_LARGAS } from '@/lib/promo-cuotas';
import { formatearPrecio, precioConSigno } from '@/lib/format-precio';

/*
 * El resumen del pedido se muestra en DOS lugares: la columna derecha en
 * escritorio y el desplegable de arriba del formulario en celular
 * (`CheckoutResumenCelular`). Las piezas de abajo son las que comparten, así
 * los dos dicen lo mismo. Todos los importes salen de `totales`
 * (`PricingService.totalesCheckout`), que es el MISMO objeto que usa el botón
 * de pagar: el total del resumen no puede diferir del botón.
 */

/** Los productos del carrito, con su configuración de cristales. */
export function ResumenItems({ items, isWholesale }: { items: any[], isWholesale?: boolean }) {
  return (
    <div className="flex flex-col gap-6 mb-6 overflow-y-auto max-h-[40vh] pr-2">
      {items.map((item) => (
        <div key={item.id} className="flex gap-4">
          <div className="w-16 h-16 bg-white border border-stone-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0 relative p-2">
            <Image unoptimized={String(item.image || '/images/og-image.jpg').startsWith('data:')} src={item.image || '/images/og-image.jpg'} alt={item.model || 'Producto'} fill className="w-full h-full object-contain mix-blend-multiply p-2" />
            <div className="absolute -top-2 -right-2 bg-stone-200 text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center z-10">
              {item.quantity}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-0.5">{item.brand}</p>
            <p className="text-sm font-medium leading-tight mb-1">{item.model}</p>
            {tieneCristales(item.lensConfig) && (
              <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-stone-400">
                <p>Cristales: {describirConfiguracion(item.lensConfig)}</p>
                {/* Un tilde verde comunica "ya la tenemos". Cuando la receta
                    está pendiente hay que decirlo con otro tono: si no, el
                    cliente que pagó cree que mandó todo y nadie le pide nada
                    hasta que el pedido se traba en el laboratorio. */}
                {item.lensConfig.prescriptionFile && (
                  recetaPendiente(item.lensConfig.prescriptionFile) ? (
                    <p className="text-amber-600 font-medium">⏳ Receta: te la pedimos por WhatsApp</p>
                  ) : (
                    <p className="text-green-600 font-medium">✓ Receta: {item.lensConfig.prescriptionFile}</p>
                  )
                )}
              </div>
            )}
            <p className="text-sm font-bold mt-1">${(getItemUnitPrice(item, !!isWholesale) * item.quantity).toLocaleString("es-AR")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** El 2x1 aplicado (si hay) y el campo del cupón. No aplica a mayoristas. */
export function ResumenCupon({ totales, bonificados2x1 = 0, appliedCoupon, onCouponApplied }: { totales: TotalesCheckout, bonificados2x1?: number, appliedCoupon?: AppliedCoupon | null, onCouponApplied: (coupon: AppliedCoupon | null) => void }) {
  const descuento2x1 = totales.bruto - totales.subtotal;
  return (
    <>
      {descuento2x1 > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-stone-800 bg-stone-950 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--dorado)]">2x1 aplicado</p>
            <p className="text-[11px] font-semibold text-stone-300 mt-0.5">
              {bonificados2x1 === 1 ? "1 armazón sin cargo" : `${bonificados2x1} armazones sin cargo`}
            </p>
          </div>
          <span className="shrink-0 text-sm font-black text-[var(--dorado)]">−{precioConSigno(descuento2x1)}</span>
        </div>
      )}
      {/* El cupón se calcula sobre lo que queda a pagar tras el 2x1, no sobre el bruto. */}
      <CouponField subtotal={totales.subtotal} appliedCoupon={appliedCoupon || null} onApplied={onCouponApplied} />
    </>
  );
}

/** Subtotal, descuentos, recargo del plan y TOTAL: el mismo número que el botón. */
export function ResumenTotales({ totales, appliedCoupon, isWholesale, descuentoTransferenciaPct }: { totales: TotalesCheckout, appliedCoupon?: AppliedCoupon | null, isWholesale?: boolean, descuentoTransferenciaPct: number }) {
  const descuento2x1 = totales.bruto - totales.subtotal;
  const descuentoCupon = totales.subtotal - totales.subtotalConCupon;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between text-sm text-stone-500">
        <span>Subtotal</span>
        <span className="flex items-baseline gap-2">
          {descuento2x1 > 0 && (
            <span className="text-sm font-medium text-stone-400 line-through decoration-1">{precioConSigno(totales.bruto)}</span>
          )}
          {precioConSigno(totales.subtotal)}
        </span>
      </div>

      {descuentoCupon > 0 && appliedCoupon && (
        <div className="flex justify-between text-sm text-emerald-700 font-medium animate-in fade-in">
          <span>Cupón {appliedCoupon.code}</span>
          <span>-{precioConSigno(descuentoCupon)}</span>
        </div>
      )}

      <div className="flex justify-between text-sm text-stone-500">
        <span>Envío</span>
        <span className="text-black font-bold uppercase tracking-widest text-[10px] mt-1">Gratis</span>
      </div>

      {isWholesale && (
        <div className="flex justify-between text-[10px] text-blue-600 font-black uppercase tracking-widest bg-blue-50/50 p-2 rounded border border-blue-100/80 my-1 animate-in fade-in">
          <span>Tarifa Mayorista Activa</span>
          <span>Precio Neto</span>
        </div>
      )}

      {totales.descuentoTransferencia > 0 && (
        <div className="flex justify-between text-sm text-green-700 font-medium animate-in fade-in">
          <span>Descuento ({descuentoTransferenciaPct}% OFF Transferencia)</span>
          <span>-{precioConSigno(totales.descuentoTransferencia)}</span>
        </div>
      )}

      {/* El plan de 12 cuotas cuesta más que la lista, y el resumen tiene que
          sumar: sin esta línea el total salta de $160.000 a $176.000 sin
          explicación. Se nombra el PLAN, nunca el porcentaje (regla de
          comunicación de Ishtar del 31/8, ver promo-cuotas.ts). */}
      {totales.recargoCuotas > 0 && (
        <div className="flex justify-between text-sm text-stone-600 animate-in fade-in">
          <span>Plan {ETIQUETA_MP_CUOTAS_LARGAS}</span>
          <span>+{precioConSigno(totales.recargoCuotas)}</span>
        </div>
      )}

      <div className="flex justify-between items-end border-t border-stone-200 pt-4 mt-2">
        <span className="text-[11px] font-black uppercase tracking-widest">Total</span>
        <div className="text-right">
          <span className="text-xs text-stone-500 block mb-1">ARS</span>
          <span className="text-2xl font-light transition-all" data-testid="checkout-total">
            {precioConSigno(totales.total)}
          </span>
          {totales.cuotas > 1 && (
            <span className="text-xs text-stone-600 block mt-1">
              {totales.cuotas} x {precioConSigno(totales.valorCuota)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CheckoutSummarySidebar({ items, totales, webSettings, isWholesale, appliedCoupon, onCouponApplied, bonificados2x1 = 0 }: { items: any[], totales: TotalesCheckout, webSettings?: { web_promo_cash_discount: number, web_promo_installments: string }, isWholesale?: boolean, appliedCoupon?: AppliedCoupon | null, onCouponApplied?: (coupon: AppliedCoupon | null) => void, bonificados2x1?: number }) {
  const descuentoTransferenciaPct = webSettings?.web_promo_cash_discount || 15;
  // Los chips muestran lo que costaría CADA plan sobre lo que queda a pagar
  // (con 2x1 y cupón): números resueltos, el cliente no calcula nada.
  const vidriera = PricingService.preciosVidriera(totales.subtotalConCupon, descuentoTransferenciaPct);

  return (
    <div className="lg:col-span-5 bg-[#fafafa] p-8 lg:p-10 border border-stone-200 rounded-2xl sticky top-32">
      <h2 className="text-[11px] font-black uppercase tracking-widest border-b border-stone-200 pb-4 mb-6">Resumen de Compra</h2>

      {!isWholesale && (
        <div className="flex flex-col gap-2 mb-6">
          {/* Números RESUELTOS (regla de Ishtar: el cliente no calcula nada):
              cada chip dice cuánto por cuota, sobre el subtotal con cupón.
              Orden de venta (27/8): primero 12, después 6, después contado. */}
          <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-4 py-3">
            <CreditCard className="w-4 h-4 text-stone-700 shrink-0" />
            {/* Las 12 se dicen "cuotas fijas", sin el % ni "con Mercado Pago"
                (decisión de Ishtar, 31/8 noche). La frase sale de
                promo-cuotas.ts; el importe del chip ya trae el recargo. */}
            <p className="text-xs font-semibold flex-1">{ETIQUETA_MP_CUOTAS_LARGAS}</p>
            <span className="text-[9px] font-black uppercase tracking-widest bg-sky-600 text-white px-2 py-1 rounded">12 x ${formatearPrecio(vidriera.cuota12)}</span>
          </div>
          <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-4 py-3">
            <CreditCard className="w-4 h-4 text-stone-700 shrink-0" />
            <p className="text-xs font-semibold flex-1 capitalize">{webSettings?.web_promo_installments || "6 cuotas sin interés"}</p>
            <span className="text-[9px] font-black uppercase tracking-widest bg-stone-900 text-white px-2 py-1 rounded">6 x ${formatearPrecio(vidriera.cuota6)}</span>
          </div>
          <div className="flex items-center gap-3 bg-emerald-50/60 border border-emerald-200 rounded-lg px-4 py-3">
            <BadgePercent className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs font-semibold flex-1 text-emerald-900">Transferencia {descuentoTransferenciaPct}% OFF</p>
            <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white px-2 py-1 rounded">Ahorrás ${formatearPrecio(vidriera.ahorroContado)}</span>
          </div>
          <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-4 py-3">
            <Truck className="w-4 h-4 text-stone-700 shrink-0" />
            <p className="text-xs font-semibold flex-1">Envío gratis a todo el país</p>
            <span className="text-[9px] font-black uppercase tracking-widest border border-stone-900 px-2 py-1 rounded">Sin cargo</span>
          </div>
        </div>
      )}

      <ResumenItems items={items} isWholesale={isWholesale} />

      {!isWholesale && onCouponApplied && (
        <div className="border-t border-stone-200 pt-6 mb-2">
          <ResumenCupon totales={totales} bonificados2x1={bonificados2x1} appliedCoupon={appliedCoupon} onCouponApplied={onCouponApplied} />
        </div>
      )}

      <div className="border-t border-stone-200 pt-6">
        <ResumenTotales totales={totales} appliedCoupon={appliedCoupon} isWholesale={isWholesale} descuentoTransferenciaPct={descuentoTransferenciaPct} />
      </div>
    </div>
  );
}
