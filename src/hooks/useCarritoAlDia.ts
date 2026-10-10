"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/store/useCart";
import { calcularConfiguracion } from "@/lib/cristales-web/calculo";
import { claveDeCristal, indexarOpciones, tieneCristales, type OpcionCristalWeb } from "@/lib/cristales-web/claves";
import { precioConSigno } from "@/lib/format-precio";
import type { ArmazonAlDia } from "@/services/armazones-al-dia.service";

/** Evento para pedir una puesta al día ya (lo dispara el checkout ante un rechazo por precio o stock). */
const EVENTO_REFRESCAR = "atelier:carrito-al-dia";

export function refrescarCarrito() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_REFRESCAR));
}

/** Óptica logueada: el armazón lo pone al día useWholesaleCartBackfill, con su canal. */
function esMayorista(): boolean {
  try {
    return JSON.parse(localStorage.getItem("user") || "null")?.role === "OPTICA";
  } catch {
    return false;
  }
}

// El hook se monta en el carrito lateral Y en el checkout (los dos a la vez en
// /checkout): sin esto, un mismo cambio se avisaba dos veces.
let ultimaFirmaAvisada = "";

/**
 * Pone el carrito al día con el sistema: armazón (precio, stock, si se sigue
 * vendiendo) y cristales.
 *
 * El carrito vive en el navegador (localStorage) y guarda el precio del
 * momento en que se armó. El checkout cobra el de HOY y rechaza si el carrito
 * dice menos ("Discrepancia de precio… reintente"): un error que el cliente
 * no puede resolver reintentando. Hasta el 10/10/2026 esto solo cubría los
 * cristales; un armazón que había subido, que se despublicó o que se agotó
 * seguía en el carrito con el dato viejo hasta el último paso.
 *
 * Cada ítem se recalcula con el MISMO cálculo y las mismas reglas que el
 * checkout (precio en effectiveFramePrice, disponibilidad en
 * sePuedeVenderEnLaWeb): lo que se ve es lo que se cobra. Lo que ya no se
 * vende se saca del carrito, avisando. Una opción de cristal que dejó de estar
 * disponible no se toca acá: el checkout la rechaza con el motivo. De paso
 * completa el título de la opción en los carritos viejos, que solo guardaban
 * la clave.
 */
export function useCarritoAlDia() {
  const items = useCart(s => s.items);
  const ponerItemAlDia = useCart(s => s.ponerItemAlDia);
  const removeItem = useCart(s => s.removeItem);
  const [pedido, setPedido] = useState(0);
  const firma = items.map(i => `${i.id}:${i.productId}:${i.price}:${i.quantity}`).join("|");

  useEffect(() => {
    const refrescar = () => setPedido(n => n + 1);
    window.addEventListener(EVENTO_REFRESCAR, refrescar);
    return () => window.removeEventListener(EVENTO_REFRESCAR, refrescar);
  }, []);

  useEffect(() => {
    if (!firma) return;
    let vivo = true;
    const mayorista = esMayorista();
    // "unknown": ítem sin producto (el checkout lo rechaza con su motivo).
    const ids = [...new Set(useCart.getState().items.map(i => i.productId).filter(id => id && id !== "unknown"))];
    const url = mayorista || ids.length === 0
      ? "/api/web/pricing"
      : `/api/web/pricing?armazones=${encodeURIComponent(ids.join(","))}`;
    fetch(url, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { opciones?: OpcionCristalWeb[]; armazones?: ArmazonAlDia[] } | null) => {
        if (!vivo || !Array.isArray(data?.opciones)) return;
        const opciones = indexarOpciones(data.opciones);
        const armazones = new Map((data.armazones ?? []).map(a => [a.id, a]));
        const sacados: string[] = [];
        const subieron: string[] = [];
        for (const item of useCart.getState().items) {
          const nombre = `${item.brand || ""} ${item.model || ""}`.trim() || "Un anteojo";
          const armazon = mayorista ? undefined : armazones.get(item.productId);
          if (armazon && !armazon.disponible) {
            removeItem(item.id);
            sacados.push(nombre);
            continue;
          }
          // Segundo par del 2x1 Varilux: armazón y cristales en 0 (lo valida el
          // checkout). Solo se mira si se sigue vendiendo.
          const segundoPar = Boolean(item.lensConfig?.secondPair2x1);
          const base = armazon && !segundoPar ? armazon.precio : (item.basePrice ?? item.price);
          let precio = item.price;
          let lensConfig = item.lensConfig;
          if (segundoPar) {
            // nada que recalcular
          } else if (tieneCristales(item.lensConfig)) {
            const r = calcularConfiguracion({ basePrice: base, lensConfig: item.lensConfig, opciones });
            if (r.ok) {
              precio = r.total;
              // Los carritos anteriores al 26/9/2026 no guardaban el título de
              // la opción y el carrito mostraba la clave ("organico ar").
              const clave = claveDeCristal(item.lensConfig).clave;
              const etiqueta = clave && item.lensConfig.lensType !== "NONE" ? opciones[clave]?.etiqueta ?? null : item.lensConfig.etiqueta ?? null;
              if (etiqueta !== (item.lensConfig.etiqueta ?? null)) lensConfig = { ...item.lensConfig, etiqueta };
            } else {
              // Opción caída: se ajusta solo el armazón; el checkout dirá el motivo.
              precio = item.price - (item.basePrice ?? item.price) + base;
            }
          } else {
            precio = base;
          }
          const stock = armazon ? armazon.stock : item.stock;
          const cantidad = typeof stock === "number" && stock > 0 ? Math.min(item.quantity, stock) : item.quantity;
          if (precio > item.price) subieron.push(`${nombre}: ahora ${precioConSigno(precio)}`);
          if (precio !== item.price || base !== (item.basePrice ?? item.price) || lensConfig !== item.lensConfig
              || stock !== item.stock || cantidad !== item.quantity) {
            ponerItemAlDia(item.id, { price: precio, basePrice: base, lensConfig, stock, quantity: cantidad });
          }
        }
        const aviso = [
          sacados.length ? `Sacamos del carrito ${sacados.join(", ")}: ya no está a la venta o se agotó.` : "",
          subieron.length ? `Actualizamos el precio: ${subieron.join(" · ")}.` : "",
        ].filter(Boolean).join(" ");
        if (aviso && aviso !== ultimaFirmaAvisada) {
          ultimaFirmaAvisada = aviso;
          toast.info(aviso, { duration: 10000 });
        }
      })
      .catch(() => {});
    return () => { vivo = false; };
    // `firma` cambia si entra/sale un ítem o cambia su precio o cantidad;
    // `pedido`, cuando el checkout pide una puesta al día tras un rechazo.
  }, [firma, pedido, ponerItemAlDia, removeItem]);
}
