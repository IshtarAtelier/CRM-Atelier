"use client";

import { useCart, getItemUnitPrice } from "@/store/useCart";
import { useIsWholesale, useWholesaleCartBackfill } from "@/hooks/useIsWholesale";
import { WHOLESALE_MIN_PIECES } from "@/lib/constants";
import { X, Trash2, ChevronRight, ShieldCheck, Truck, CreditCard, Building2, Handshake } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { calcular2x1Armazones, armazonesDelCarrito } from "@/lib/promo-2x1-armazones";
import { usePromo2x1 } from "@/hooks/usePromo2x1";
import { Modal } from "@/components/ui/Modal";
import { LensConfigurator } from "@/components/Storefront/LensConfigurator";
import Image from "next/image";
import { recetaPendiente } from '@/lib/checkout/receta';
import { PricingService } from "@/services/PricingService";
import { ETIQUETA_MP_CUOTAS_LARGAS } from "@/lib/promo-cuotas";

export function CartSidebar() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, getCartTotal } = useCart();
  const { isWholesale } = useIsWholesale();
  const { activa: promo2x1Activa, ids: idsPromo2x1 } = usePromo2x1();
  // El descuento se calcula con la MISMA función que usa la ruta de pago. Acá
  // es solo para mostrar: quien cobra es el servidor, contra la base.
  const promo2x1 = calcular2x1Armazones(armazonesDelCarrito(items, isWholesale, idsPromo2x1), promo2x1Activa);
  const totalConPromo = Math.max(0, getCartTotal(isWholesale) - promo2x1.descuento);
  useWholesaleCartBackfill(isWholesale);
  const [mounted, setMounted] = useState(false);
  const [configuringItemId, setConfiguringItemId] = useState<string | null>(null);

  // Prevent hydration mismatch
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <>
      {isOpen && (
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-[backdropFade_0.3s_ease-out]"
          />
        )}

      {isOpen && (
          <div
            className="cart-slide-in fixed top-0 right-0 h-full w-full max-w-[400px] bg-white z-[101] flex flex-col shadow-2xl"
          >
            {/* Header del Carrito */}
            <div className="px-6 py-6 border-b border-stone-200 flex justify-between items-center">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-black">
                Carrito ({items.reduce((acc, i) => acc + i.quantity, 0)})
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar carrito"
                className="text-stone-500 hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de Productos */}
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                  <span className="text-4xl mb-4">🛒</span>
                  <p className="text-xs uppercase tracking-widest font-bold">Tu carrito está vacío</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex gap-4 group">
                    {/* Imagen */}
                    <div className="w-24 h-24 bg-stone-100 flex items-center justify-center overflow-hidden relative rounded-sm shrink-0">
                      <Image unoptimized={String(item.image || '/images/og-image.jpg').startsWith('data:')} src={item.image || '/images/og-image.jpg'} alt={item.model} fill sizes="96px" className="w-full h-full object-contain mix-blend-multiply" />
                    </div>

                    {/* Info */}
                    <div className="flex flex-col justify-between flex-1 py-1">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="text-sm font-bold leading-tight">{item.brand} {item.model}</h3>
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="text-stone-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {item.lensConfig && (item.lensConfig.lensType !== "NONE" || item.lensConfig.color) && (
                          <div className="mt-2 flex flex-col gap-1">
                            <p className="text-[10px] text-stone-600 uppercase tracking-widest font-bold">
                              {item.lensConfig.lensType === "NONE" ? "SIN AUMENTO" : item.lensConfig.lensType} {item.lensConfig.treatment && `+ ${item.lensConfig.treatment.replace(/_/g, ' ')}`}
                            </p>
                            {item.lensConfig.color && (
                              <p className="text-xs text-stone-500 uppercase tracking-widest flex items-center gap-1">
                                {item.lensColor && (
                                  <span className="w-2 h-2 rounded-full border border-stone-300" style={{ backgroundColor: item.lensColor }} />
                                )}
                                Tinte: {item.lensConfig.color}
                              </p>
                            )}
                            {/* Ver la nota en src/lib/checkout/receta.ts: el
                                tilde verde solo va cuando la receta llegó. */}
                            {item.lensConfig.prescriptionFile && (
                              <p className={`text-xs uppercase tracking-widest flex items-center gap-1 ${
                                recetaPendiente(item.lensConfig.prescriptionFile) ? 'text-amber-700' : 'text-green-700'
                              }`}>
                                {recetaPendiente(item.lensConfig.prescriptionFile)
                                  ? '⏳ Receta: te la pedimos por WhatsApp'
                                  : `✓ Receta: ${item.lensConfig.prescriptionFile}`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-end mt-4">
                        {/* Selector de cantidad */}
                        <div className="flex items-center border border-stone-200 rounded-sm">
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="px-2 py-0.5 text-stone-500 hover:text-black"
                          >
                            −
                          </button>
                          <span className="text-xs font-mono w-6 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={typeof item.stock === 'number' && item.stock > 0 && item.quantity >= item.stock}
                            className="px-2 py-0.5 text-stone-500 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
                            title={typeof item.stock === 'number' && item.stock > 0 && item.quantity >= item.stock ? 'Sin más stock disponible' : undefined}
                          >
                            +
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">${(getItemUnitPrice(item, isWholesale) * item.quantity).toLocaleString("es-AR")}</p>
                          {isWholesale && item.wholesaleBasePrice != null && item.wholesaleBasePrice > 0 && (
                            <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">Mayorista</p>
                          )}
                          {(!item.lensConfig || (item.lensConfig.lensType === "NONE" && !item.lensConfig.color)) && (
                            <button
                              onClick={() => setConfiguringItemId(item.id)}
                              className="text-xs uppercase tracking-widest font-bold text-blue-700 hover:text-blue-800 underline mt-1"
                            >
                              + Agregar Cristales
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer / Checkout */}
            {items.length > 0 && (
              <div className="border-t border-stone-200 p-6 bg-[#fafafa]">
                {isWholesale && (
                  <div className="flex justify-between items-center text-[10px] text-blue-600 font-black uppercase tracking-widest bg-blue-50/50 p-2 rounded border border-blue-100/80 mb-4">
                    <span>Tarifa Mayorista Activa</span>
                    <span>Precio Neto</span>
                  </div>
                )}
                {/* El 2x1, cuando entró: se dice qué se ahorró y cuánto.
                    Va ARRIBA del subtotal porque explica por qué el número de
                    abajo bajó — si apareciera después, se leería como un cargo. */}
                {promo2x1.aplica && (
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-stone-800 bg-stone-950 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--dorado)]">2x1 aplicado</p>
                      <p className="text-[11px] font-semibold text-stone-300 mt-0.5">
                        {promo2x1.bonificados === 1 ? "1 armazón sin cargo" : `${promo2x1.bonificados} armazones sin cargo`}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-[var(--dorado)]">
                      −${promo2x1.descuento.toLocaleString("es-AR")}
                    </span>
                  </div>
                )}

                {/* El empujón: solo cuando falta UNO. Con dos o más faltando, el
                    mensaje deja de ser una oportunidad al alcance y pasa a ser
                    una condición de venta. */}
                {promo2x1Activa && !isWholesale && promo2x1.faltanParaElProximo === 1 && (
                  <div className="mb-3 rounded-xl border border-dashed border-stone-400 bg-white px-4 py-3">
                    <p className="text-[11px] font-bold text-stone-800 leading-snug">
                      Sumá <span className="font-black">un armazón más</span> y te llevás el más barato de los dos <span className="font-black">sin cargo</span>.
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black uppercase tracking-widest text-stone-500">Subtotal</span>
                  <span className="flex items-baseline gap-2">
                    {promo2x1.aplica && (
                      <span className="text-sm font-medium text-stone-400 line-through decoration-1">
                        ${getCartTotal(isWholesale).toLocaleString("es-AR")}
                      </span>
                    )}
                    <span className="text-xl font-light">${totalConPromo.toLocaleString("es-AR")}</span>
                  </span>
                </div>

                {/* Números resueltos en el paso de mayor abandono: cuánto por
                    cuota, cuánto al contado y cuánto en 12 — el cliente no
                    calcula nada (los valores salen de PricingService). */}
                {/* Sobre `totalConPromo`, no sobre el subtotal: si el 2x1 ya
                    entró, las cuotas y el contado se calculan sobre lo que se
                    paga de verdad. Con el bruto, el cliente vería una cuota más
                    alta que la que le van a cobrar. Primero el 2x1, después el
                    15% — al revés el descuento daría negativo. */}
                {!isWholesale && totalConPromo > 0 && (() => {
                  const v = PricingService.preciosVidriera(totalConPromo, 15);
                  return (
                    // Orden de venta (pedido de Ishtar, 27/8): primero 12,
                    // después 6, después transferencia.
                    <div className="mb-5 grid grid-cols-1 gap-1.5 text-[11px] font-semibold text-stone-600">
                      <div className="flex justify-between"><span>{ETIQUETA_MP_CUOTAS_LARGAS}</span><span className="font-black text-stone-900">12 x ${v.cuota12.toLocaleString("es-AR")}</span></div>
                      <div className="flex justify-between"><span>6 cuotas sin interés</span><span className="font-black text-stone-900">6 x ${v.cuota6.toLocaleString("es-AR")}</span></div>
                      <div className="flex justify-between text-emerald-700"><span>Transferencia 15% OFF</span><span className="font-black">${v.contado.toLocaleString("es-AR")}</span></div>
                    </div>
                  );
                })()}

                {(() => {
                  const totalPiezas = items.reduce((acc, i) => acc + i.quantity, 0);
                  const faltanPiezas = isWholesale && totalPiezas < WHOLESALE_MIN_PIECES;
                  if (faltanPiezas) {
                    return (
                      <>
                        <div className="mb-4 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 text-center font-semibold">
                          Pedido mínimo mayorista: {WHOLESALE_MIN_PIECES} piezas.
                          <br />Llevás {totalPiezas} — agregá {WHOLESALE_MIN_PIECES - totalPiezas} más para continuar.
                        </div>
                        <div className="w-full flex items-center justify-center gap-2 bg-stone-300 text-stone-500 px-6 py-4 text-xs font-black uppercase tracking-widest cursor-not-allowed select-none">
                          Finalizar Pedido Mayorista <ChevronRight className="w-4 h-4" />
                        </div>
                      </>
                    );
                  }
                  return (
                    <>
                      <Link
                        href="/checkout"
                        onClick={() => setIsOpen(false)}
                        className="w-full flex items-center justify-center gap-2 bg-black text-white px-6 py-4 text-xs font-black uppercase tracking-widest hover:bg-stone-800 transition-colors"
                      >
                        {isWholesale ? "Finalizar Pedido Mayorista" : "Finalizar mi compra"} <ChevronRight className="w-4 h-4" />
                      </Link>
                      {/* Las tres dudas que frenan el clic, respondidas justo debajo del botón. */}
                      {!isWholesale && (
                        <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wider text-stone-500">
                          6 cuotas sin interés · Envío gratis · Pago seguro
                        </p>
                      )}
                    </>
                  );
                })()}

                {isWholesale ? (
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-200 pt-4">
                    <div className="flex flex-col items-center text-center">
                      <Building2 className="w-4 h-4 text-blue-600 mb-1" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Canal Ópticas</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <Truck className="w-4 h-4 text-stone-700 mb-1" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Envío a Coordinar</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <Handshake className="w-4 h-4 text-stone-700 mb-1" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Pago a Convenir</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-200 pt-4">
                    <div className="flex flex-col items-center text-center">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 mb-1" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Pago Seguro</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <Truck className="w-4 h-4 text-stone-700 mb-1" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Envío Gratis</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <CreditCard className="w-4 h-4 text-stone-700 mb-1" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">6 Cuotas</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      {/* Modal Configurador de Cristales */}
      <Modal isOpen={!!configuringItemId} onClose={() => setConfiguringItemId(null)} maxWidth="4xl">
        {configuringItemId && (() => {
          const item = items.find(i => i.id === configuringItemId);
          if (!item) return null;
          return (
            <div className="bg-[#fafafa] dark:bg-[#fafafa] w-full max-h-[85vh] overflow-y-auto px-6 py-8 sm:p-12 text-black rounded-[2rem] shadow-inner relative">
              <button
                onClick={() => setConfiguringItemId(null)}
                aria-label="Cerrar configurador de cristales"
                className="absolute top-4 right-4 p-2 text-stone-500 hover:text-black hover:bg-stone-100 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
                <LensConfigurator 
                  basePrice={item.basePrice || item.price} 
                  productId={item.productId} 
                  productInfo={{ brand: item.brand, model: item.model, image: item.image }}
                  cartItemId={item.id}
                  onSuccess={() => setConfiguringItemId(null)}
                />
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
