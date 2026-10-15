"use client";
/**
 * Lightbox de la galería de la ficha (plan tienda, Fase 1.7, 15/10/2026).
 *
 * Por qué existe: en la ficha no había zoom —tap y doble tap sobre la foto no
 * abrían nada— y quien quiere ver el acetato, la bisagra o el logo de la
 * patilla se quedaba con la foto chica. Infinit tiene 9 fotos con zoom; acá
 * ninguna. Vive junto a la página porque solo la usa la ficha.
 *
 * Qué hace, sin librerías:
 *  · tap (o clic) sobre la foto: alterna entre entera y 2,5× centrado donde se
 *    tocó; doble tap hace lo mismo (es el gesto que la gente prueba primero);
 *  · pinch con dos dedos: escala entre 1× y 4×;
 *  · con zoom, arrastrar mueve la foto;
 *  · Esc, el botón o tocar el fondo cierran. Se usan <img> nativos: a este
 *    tamaño no hay que optimizar nada y el pinch necesita el archivo entero.
 */
import { useEffect, useRef, useState } from "react";

const ZOOM_TAP = 2.5;
const ZOOM_MAX = 4;

export function GaleriaZoom({
  imagenes,
  alts,
  indiceInicial,
  onCerrar,
}: {
  imagenes: string[];
  alts: string[];
  indiceInicial: number;
  onCerrar: () => void;
}) {
  const [indice, setIndice] = useState(indiceInicial);
  const [escala, setEscala] = useState(1);
  const [desplazamiento, setDesplazamiento] = useState({ x: 0, y: 0 });
  const [origen, setOrigen] = useState({ x: 50, y: 50 });
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const pinchInicial = useRef<{ distancia: number; escala: number } | null>(null);
  const arrastre = useRef<{ x: number; y: number; dx: number; dy: number; movio: boolean } | null>(null);
  const ultimoTap = useRef(0);

  // Esc cierra; el fondo no scrollea mientras está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", onKey);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  const reiniciar = () => { setEscala(1); setDesplazamiento({ x: 0, y: 0 }); };
  const cambiarFoto = (i: number) => { setIndice((i + imagenes.length) % imagenes.length); reiniciar(); };

  const alternarZoom = (clienteX: number, clienteY: number, rect: DOMRect) => {
    if (escala > 1) { reiniciar(); return; }
    setOrigen({ x: ((clienteX - rect.left) / rect.width) * 100, y: ((clienteY - rect.top) / rect.height) * 100 });
    setDesplazamiento({ x: 0, y: 0 });
    setEscala(ZOOM_TAP);
  };

  const distancia = () => {
    const [a, b] = Array.from(punteros.current.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
      className="fixed inset-0 z-[300] bg-black flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white text-[11px] font-bold uppercase tracking-widest">
        <span>{indice + 1} / {imagenes.length} · {escala > 1 ? "Tocá para achicar" : "Tocá para ampliar"}</span>
        <button
          onClick={onCerrar}
          aria-label="Cerrar foto ampliada"
          className="min-h-11 min-w-11 flex items-center justify-center rounded-full hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div
        className="flex-1 min-h-0 relative overflow-hidden select-none"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (punteros.current.size === 2) {
            pinchInicial.current = { distancia: distancia(), escala };
            arrastre.current = null;
          } else if (punteros.current.size === 1) {
            arrastre.current = { x: e.clientX, y: e.clientY, dx: desplazamiento.x, dy: desplazamiento.y, movio: false };
          }
        }}
        onPointerMove={(e) => {
          if (!punteros.current.has(e.pointerId)) return;
          punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (punteros.current.size === 2 && pinchInicial.current) {
            const nueva = Math.min(ZOOM_MAX, Math.max(1, pinchInicial.current.escala * (distancia() / pinchInicial.current.distancia)));
            setEscala(nueva);
            if (nueva === 1) setDesplazamiento({ x: 0, y: 0 });
          } else if (punteros.current.size === 1 && arrastre.current && escala > 1) {
            const a = arrastre.current;
            const dx = e.clientX - a.x, dy = e.clientY - a.y;
            if (Math.abs(dx) + Math.abs(dy) > 6) a.movio = true;
            setDesplazamiento({ x: a.dx + dx, y: a.dy + dy });
          }
        }}
        onPointerUp={(e) => {
          punteros.current.delete(e.pointerId);
          if (punteros.current.size < 2) pinchInicial.current = null;
          const a = arrastre.current;
          arrastre.current = null;
          if (punteros.current.size === 0 && a && !a.movio) {
            // Un tap (o doble tap: el segundo también entra acá) alterna el zoom.
            const ahora = Date.now();
            if (ahora - ultimoTap.current < 300) { ultimoTap.current = 0; return; }
            ultimoTap.current = ahora;
            alternarZoom(e.clientX, e.clientY, (e.currentTarget as HTMLElement).getBoundingClientRect());
          }
        }}
        onPointerCancel={(e) => { punteros.current.delete(e.pointerId); pinchInicial.current = null; arrastre.current = null; }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagenes[indice]}
          alt={alts[indice] || ""}
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain"
          style={{
            transform: `translate(${desplazamiento.x}px, ${desplazamiento.y}px) scale(${escala})`,
            transformOrigin: `${origen.x}% ${origen.y}%`,
            transition: pinchInicial.current ? "none" : "transform 0.25s ease-out",
            cursor: escala > 1 ? "zoom-out" : "zoom-in",
          }}
        />
      </div>

      {imagenes.length > 1 && (
        <div className="flex items-center justify-center gap-3 px-4 py-3">
          <button onClick={() => cambiarFoto(indice - 1)} aria-label="Foto anterior" className="min-h-11 min-w-11 flex items-center justify-center rounded-full text-white hover:bg-white/10">‹</button>
          {imagenes.map((src, i) => (
            <button
              key={src + i}
              onClick={() => cambiarFoto(i)}
              aria-label={`Ver foto ${i + 1}`}
              className={`w-10 h-10 rounded-full overflow-hidden border-2 bg-white ${i === indice ? "border-white" : "border-transparent opacity-60"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
          <button onClick={() => cambiarFoto(indice + 1)} aria-label="Foto siguiente" className="min-h-11 min-w-11 flex items-center justify-center rounded-full text-white hover:bg-white/10">›</button>
        </div>
      )}
    </div>
  );
}
