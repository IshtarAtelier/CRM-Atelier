"use client";

import { useEffect, useRef, useState } from "react";
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

// El carrito lateral vive en la barra de navegación, así que el hook corre en
// cada página: sin esto, cada navegación con algo en el carrito era una
// consulta a la base. La misma consulta se reusa un minuto; un rechazo del
// checkout (refrescarCarrito) siempre pregunta de nuevo.
const VIGENCIA_MS = 60_000;
let ultimaRespuesta: { url: string; at: number; data: unknown } | null = null;
async function traerPrecios(url: string, forzar: boolean): Promise<unknown> {
  if (!forzar && ultimaRespuesta && ultimaRespuesta.url === url && Date.now() - ultimaRespuesta.at < VIGENCIA_MS) {
    return ultimaRespuesta.data;
  }
  const r = await fetch(url, { cache: "no-store" });
  const data = r.ok ? await r.json() : null;
  if (data) ultimaRespuesta = { url, at: Date.now(), data };
  return data;
}

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
  // El último pedido de puesta al día ya atendido: solo ESE fuerza a preguntar.
  const pedidoAtendido = useRef(0);
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
    const forzar = pedido !== pedidoAtendido.current;
    pedidoAtendido.current = pedido;
    traerPrecios(url, forzar)
      .then((crudo) => {
        const data = crudo as { opciones?: OpcionCristalWeb[]; armazones?: ArmazonAlDia[] } | null;
        if (!vivo || !Array.isArray(data?.opciones)) return;
        const opciones = indexarOpciones(data.opciones);
        const armazones = new Map((data.armazones ?? []).map(a => [a.id, a]));
        const sacados: string[] = [];
        const subieron: string[] = [];
        for (const item of useCart.getState().items) {
          const nombre = `${item.brand || ""} ${item.model || ""}`.trim() || "Un anteojo";
          const armazon = mayorista ? undefined : armazones.get(item.productId);
          // Solo sale lo que ya no se vende. Un stock en 0 puede ser la reserva
          // de esta misma persona (intentó pagar con Mercado Pago y volvió):
          // sacarlo le vaciaba el carrito diciendo "se agotó" justo cuando la
          // pantalla decía "tu carrito sigue acá". El checkout dirá si no hay.
          if (armazon && !armazon.aLaVenta) {
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
          sacados.length ? `Sacamos del carrito ${sacados.join(", ")}: ya no está a la venta.` : "",
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
