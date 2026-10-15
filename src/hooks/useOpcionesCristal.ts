"use client";

import { useEffect, useState } from "react";
import { indexarOpciones, type MapaOpciones, type OpcionCristalWeb } from "@/lib/cristales-web/claves";

/**
 * Las opciones de cristal publicadas (GET /api/web/pricing), para mostrar el
 * "Anteojo completo desde $X" en la tienda y en la ficha.
 *
 * Un solo pedido aunque lo usen varios componentes, y se renueva a los 10
 * minutos: la tienda navega sin recargar, y sin vencimiento un cambio de
 * precio de cristales en /admin/web no llegaba a una pestaña abierta hasta
 * recargarla. Si la API falla, devuelve null y la pantalla oculta el "desde"
 * en vez de inventarlo. El configurador pide sus propios precios al abrirse;
 * esto es solo para la vidriera.
 */
const VIGENCIA_MS = 10 * 60 * 1000;
let pedido: Promise<MapaOpciones | null> | null = null;
let pedidoEn = 0;

function pedirOpciones(): Promise<MapaOpciones | null> {
  if (pedido && Date.now() - pedidoEn > VIGENCIA_MS) pedido = null;
  if (!pedido) {
    pedidoEn = Date.now();
    pedido = fetch("/api/web/pricing", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { opciones?: OpcionCristalWeb[] } | null) =>
        Array.isArray(data?.opciones) ? indexarOpciones(data.opciones) : null,
      )
      .catch(() => null)
      .then(opciones => {
        // Un fallo no queda guardado: la próxima pantalla que lo pida reintenta.
        if (!opciones) pedido = null;
        return opciones;
      });
  }
  return pedido;
}

export function useOpcionesCristal(): MapaOpciones | null {
  const [opciones, setOpciones] = useState<MapaOpciones | null>(null);
  useEffect(() => {
    let vivo = true;
    pedirOpciones().then(o => { if (vivo) setOpciones(o); });
    return () => { vivo = false; };
  }, []);
  return opciones;
}
