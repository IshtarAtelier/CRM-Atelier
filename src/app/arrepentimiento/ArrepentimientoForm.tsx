"use client";

import { useState, type FormEvent } from "react";

type Estado =
  | { tipo: "inicial" }
  | { tipo: "enviando" }
  | { tipo: "listo"; codigo: string }
  | { tipo: "error"; mensaje: string };

/**
 * Formulario del botón de arrepentimiento: número de pedido, email y motivo
 * opcional. Sin login. Al enviarlo muestra el código de trámite, que es la
 * constancia que pide la norma. La respuesta es la misma exista o no el pedido.
 */
export function ArrepentimientoForm() {
  const [numeroPedido, setNumeroPedido] = useState("");
  const [email, setEmail] = useState("");
  const [motivo, setMotivo] = useState("");
  const [sitio, setSitio] = useState(""); // campo trampa: una persona no lo ve
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEstado({ tipo: "enviando" });
    try {
      const res = await fetch("/api/web/arrepentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroPedido, email, motivo: motivo || null, sitio: sitio || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.codigo) {
        setEstado({ tipo: "error", mensaje: data?.error || "No pudimos registrar tu solicitud. Probá de nuevo en unos minutos o escribinos por WhatsApp." });
        return;
      }
      setEstado({ tipo: "listo", codigo: data.codigo });
    } catch {
      setEstado({ tipo: "error", mensaje: "No hay conexión. Probá de nuevo en unos minutos o escribinos por WhatsApp." });
    }
  }

  if (estado.tipo === "listo") {
    return (
      <div role="status" aria-live="polite" className="border border-emerald-700/30 bg-emerald-50 px-6 py-6">
        <p className="text-[17px] font-bold text-stone-900">Recibimos tu solicitud.</p>
        <p className="mt-2 text-[16px] text-stone-700">Tu código de trámite es:</p>
        <p className="mt-2 font-mono text-2xl font-bold tracking-wider text-stone-900 select-all">{estado.codigo}</p>
        <p className="mt-4 text-[15px] text-stone-700">
          Guardalo: es tu constancia. Si el email es el que usaste para comprar, también te lo mandamos por mail. Te vamos a contactar para coordinar la devolución.
        </p>
      </div>
    );
  }

  const enviando = estado.tipo === "enviando";

  return (
    <form onSubmit={enviar} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="arrepentimiento-pedido" className="block text-[15px] font-semibold text-stone-900">
          Número de pedido
        </label>
        <input
          id="arrepentimiento-pedido"
          name="numeroPedido"
          required
          minLength={3}
          maxLength={40}
          autoComplete="off"
          placeholder="#A1B2"
          value={numeroPedido}
          onChange={e => setNumeroPedido(e.target.value)}
          aria-describedby="arrepentimiento-pedido-ayuda"
          className="w-full border border-stone-300 bg-white px-4 py-3 text-[16px] text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8a6d3b]"
        />
        <p id="arrepentimiento-pedido-ayuda" className="text-[14px] text-stone-600">
          Está en el mail de confirmación de la compra.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="arrepentimiento-email" className="block text-[15px] font-semibold text-stone-900">
          Email
        </label>
        <input
          id="arrepentimiento-email"
          name="email"
          type="email"
          required
          maxLength={160}
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          aria-describedby="arrepentimiento-email-ayuda"
          className="w-full border border-stone-300 bg-white px-4 py-3 text-[16px] text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8a6d3b]"
        />
        <p id="arrepentimiento-email-ayuda" className="text-[14px] text-stone-600">
          El que usaste al comprar.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="arrepentimiento-motivo" className="block text-[15px] font-semibold text-stone-900">
          Motivo <span className="font-normal text-stone-600">(opcional)</span>
        </label>
        <textarea
          id="arrepentimiento-motivo"
          name="motivo"
          rows={4}
          maxLength={1000}
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          className="w-full border border-stone-300 bg-white px-4 py-3 text-[16px] text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8a6d3b]"
        />
      </div>

      {/* Campo trampa para robots: fuera de la vista y del teclado. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="arrepentimiento-sitio">No completar</label>
        <input id="arrepentimiento-sitio" name="sitio" tabIndex={-1} autoComplete="off" value={sitio} onChange={e => setSitio(e.target.value)} />
      </div>

      {estado.tipo === "error" && (
        <p role="alert" className="border border-red-700/30 bg-red-50 px-4 py-3 text-[15px] text-red-800">
          {estado.mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full bg-stone-900 px-6 py-4 text-[15px] font-bold uppercase tracking-[0.15em] text-white hover:bg-black disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Enviar solicitud de arrepentimiento"}
      </button>
    </form>
  );
}
