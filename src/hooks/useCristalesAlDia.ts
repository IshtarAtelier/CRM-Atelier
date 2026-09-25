"use client";

import { useEffect } from "react";
import { useCart } from "@/store/useCart";
import { calcularConfiguracion } from "@/lib/cristales-web/calculo";
import { claveDeCristal, indexarOpciones, tieneCristales, type OpcionCristalWeb } from "@/lib/cristales-web/claves";

/**
 * Pone al día el precio de los cristales de los ítems del carrito.
 *
 * El carrito vive en el navegador (localStorage) y guarda el precio del
 * momento en que se armó. Si después cambia el precio de un cristal en el
 * sistema, el checkout cobra el nuevo y, si es más alto, rechaza la compra con
 * "Discrepancia de precio" — un error que el cliente no puede resolver
 * reintentando. Con esto el carrito recalcula cada ítem con el MISMO cálculo y
 * las mismas opciones que usa el checkout, así lo que ve es lo que se cobra.
 *
 * Solo toca los cristales: el armazón queda con el precio con el que se agregó
 * (`basePrice`). Una opción que dejó de estar disponible no se toca acá: el
 * checkout la rechaza con el motivo. De paso completa el título de la opción
 * en los carritos viejos, que solo guardaban la clave.
 */
export function useCristalesAlDia() {
  const items = useCart(s => s.items);
  const updateItemLensConfig = useCart(s => s.updateItemLensConfig);
  const conCristales = items.filter(i => tieneCristales(i.lensConfig) && !i.lensConfig?.secondPair2x1);
  const firma = conCristales.map(i => `${i.id}:${i.price}`).join("|");

  useEffect(() => {
    if (!firma) return;
    let vivo = true;
    fetch("/api/web/pricing", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { opciones?: OpcionCristalWeb[] } | null) => {
        if (!vivo || !Array.isArray(data?.opciones)) return;
        const opciones = indexarOpciones(data.opciones);
        for (const item of useCart.getState().items) {
          if (!tieneCristales(item.lensConfig) || item.lensConfig?.secondPair2x1) continue;
          const base = item.basePrice ?? item.price;
          const r = calcularConfiguracion({ basePrice: base, lensConfig: item.lensConfig, opciones });
          if (!r.ok) continue;
          // Los carritos anteriores al 26/9/2026 no guardaban el título de la
          // opción y el carrito mostraba la clave ("organico ar").
          const clave = claveDeCristal(item.lensConfig).clave;
          const etiqueta = clave && item.lensConfig.lensType !== "NONE" ? opciones[clave]?.etiqueta ?? null : item.lensConfig.etiqueta ?? null;
          if (r.total !== item.price || etiqueta !== (item.lensConfig.etiqueta ?? null)) {
            updateItemLensConfig(item.id, { ...item.lensConfig, etiqueta }, r.total - base);
          }
        }
      })
      .catch(() => {});
    return () => { vivo = false; };
    // `firma` cambia solo si entra/sale un ítem con cristales o cambia su precio.
  }, [firma, updateItemLensConfig]);
}
