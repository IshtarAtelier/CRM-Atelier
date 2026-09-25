import React, { useState } from "react";
import { ChevronDown, ShoppingBag, Tag } from "lucide-react";
import type { AppliedCoupon } from "@/components/checkout/CouponField";
import type { TotalesCheckout } from "@/services/PricingService";
import { ResumenCupon, ResumenItems, ResumenTotales } from "@/components/checkout/CheckoutSummarySidebar";
import { precioConSigno } from "@/lib/format-precio";

/**
 * Resumen del pedido para CELULAR, arriba del formulario.
 *
 * En una columna, la columna derecha del escritorio cae DEBAJO del botón de
 * pagar: a 390 px el botón quedaba en ~2165 px y el total y el cupón recién en
 * ~2341 px (auditoría del 25/9/2026). Quien quería cargar un cupón o ver
 * cuánto pagaba tenía que pasar de largo el botón que cierra la compra.
 *
 * Plegado muestra lo que decide la compra (el total, y el cupón si hay);
 * desplegado, el mismo detalle que la columna de escritorio — las piezas son
 * las mismas (`CheckoutSummarySidebar`), así que no pueden decir otra cosa.
 */
export function CheckoutResumenCelular({ items, totales, isWholesale, appliedCoupon, onCouponApplied, bonificados2x1 = 0, descuentoTransferenciaPct }: { items: any[], totales: TotalesCheckout, isWholesale?: boolean, appliedCoupon?: AppliedCoupon | null, onCouponApplied: (coupon: AppliedCoupon | null) => void, bonificados2x1?: number, descuentoTransferenciaPct: number }) {
  const [abierto, setAbierto] = useState(false);
  const cantidad = items.reduce((acc, i) => acc + (i.quantity || 1), 0);
  const descuentoCupon = totales.subtotal - totales.subtotalConCupon;

  return (
    <section aria-label="Resumen del pedido" className="lg:hidden bg-[#fafafa] border border-stone-200 rounded-2xl">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        aria-controls="resumen-pedido-celular"
        className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <span className="flex items-start gap-2.5 min-w-0">
          <ShoppingBag className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-stone-900 whitespace-nowrap">
              Tu pedido
              <ChevronDown className={`w-4 h-4 text-stone-700 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} />
            </span>
            <span className="block text-[11px] text-stone-600 whitespace-nowrap mt-0.5">
              {cantidad === 1 ? "1 producto" : `${cantidad} productos`} · {abierto ? "ocultar detalle" : "ver detalle"}
            </span>
          </span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-lg font-semibold text-stone-950 leading-tight">{precioConSigno(totales.total)}</span>
          {totales.cuotas > 1 && (
            <span className="block text-[11px] text-stone-600">{totales.cuotas} x {precioConSigno(totales.valorCuota)}</span>
          )}
        </span>
      </button>

      {/* Plegado, el cupón igual se ve: aplicado, con cuánto descuenta; si no
          hay, un acceso directo para cargarlo sin buscarlo al final. */}
      {!abierto && !isWholesale && (
        <div className="px-4 pb-4 -mt-1">
          {appliedCoupon && descuentoCupon > 0 ? (
            <p className="flex items-center justify-between gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Cupón {appliedCoupon.code}</span>
              <span>-{precioConSigno(descuentoCupon)}</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 underline underline-offset-4 decoration-stone-300 hover:text-black"
            >
              <Tag className="w-3.5 h-3.5" /> ¿Tenés un código de descuento?
            </button>
          )}
        </div>
      )}

      {abierto && (
        <div id="resumen-pedido-celular" className="border-t border-stone-200 px-4 pt-5 pb-5">
          <ResumenItems items={items} isWholesale={isWholesale} />
          {!isWholesale && (
            <div className="border-t border-stone-200 pt-5 mb-2">
              <ResumenCupon totales={totales} bonificados2x1={bonificados2x1} appliedCoupon={appliedCoupon} onCouponApplied={onCouponApplied} />
            </div>
          )}
          <div className="border-t border-stone-200 pt-5">
            <ResumenTotales totales={totales} appliedCoupon={appliedCoupon} isWholesale={isWholesale} descuentoTransferenciaPct={descuentoTransferenciaPct} />
          </div>
        </div>
      )}
    </section>
  );
}
