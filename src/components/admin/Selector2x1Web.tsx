"use client";

// ────────────────────────────────────────────────────────────────────────────
// Desde dónde se marca qué armazones entran en el 2x1 de la tienda web.
//
// POR QUÉ ES UNA PANTALLA Y NO UN TILDE EN CADA FICHA
// El tilde por producto ya existe en el inventario, pero decidir una promo así
// es abrir 106 fichas de a una. Una promo se decide MIRANDO EL CATÁLOGO: cuáles
// entran, cuáles no, cuántos quedaron. Eso necesita verlos todos juntos.
//
// LO QUE ESTA PANTALLA TIENE QUE DEJAR CLARO
//  · Cuántos hay marcados AHORA. Es el número que decide si la promo existe.
//  · Que marcar REGALA producto. Por eso el resumen dice el precio del más
//    barato marcado: es lo que se está regalando por cada par.
//  · Que se guarda al tocar "Guardar", no al tildar. Un clic accidental sobre
//    una grilla de 106 no puede cambiar una promo.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { formatearPrecio } from "@/lib/format-precio";

interface Armazon {
    id: string;
    name: string | null;
    model: string | null;
    brand: string | null;
    price: number;
    category: string | null;
    stock: number | null;
    eligible2x1Web: boolean;
    imagenesCatalogo: string[];
}

export function Selector2x1Web() {
    const [armazones, setArmazones] = useState<Armazon[]>([]);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [busqueda, setBusqueda] = useState("");

    // Lo tildado en pantalla, que puede diferir de la base hasta que se guarde.
    const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
    // Lo que hay en la base, para saber qué cambió sin volver a pedirla.
    const [enBase, setEnBase] = useState<Set<string>>(() => new Set());

    useEffect(() => {
        let vivo = true;
        fetch("/api/products/promo-2x1-web")
            .then(r => (r.ok ? r.json() : Promise.reject(new Error("Sin permiso o sin respuesta"))))
            .then(d => {
                if (!vivo) return;
                const lista: Armazon[] = d.armazones || [];
                setArmazones(lista);
                const marcados = new Set(lista.filter(a => a.eligible2x1Web).map(a => a.id));
                setSeleccion(marcados);
                setEnBase(new Set(marcados));
            })
            .catch(e => vivo && setError(e.message))
            .finally(() => vivo && setCargando(false));
        return () => { vivo = false; };
    }, []);

    const visibles = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return armazones;
        return armazones.filter(a =>
            `${a.name || ""} ${a.model || ""} ${a.brand || ""} ${a.category || ""}`.toLowerCase().includes(q));
    }, [armazones, busqueda]);

    // Qué cambió respecto de la base. Se manda solo eso: mandar los 106 en cada
    // guardado escribiría 106 filas y ensuciaría el AuditLog con cambios que no
    // fueron cambios.
    const { aMarcar, aDesmarcar } = useMemo(() => {
        const aMarcar: string[] = [];
        const aDesmarcar: string[] = [];
        for (const a of armazones) {
            const antes = enBase.has(a.id);
            const ahora = seleccion.has(a.id);
            if (ahora && !antes) aMarcar.push(a.id);
            if (!ahora && antes) aDesmarcar.push(a.id);
        }
        return { aMarcar, aDesmarcar };
    }, [armazones, seleccion, enBase]);

    const hayCambios = aMarcar.length > 0 || aDesmarcar.length > 0;

    // El más barato de los marcados: es LO QUE SE REGALA por cada par, porque la
    // promo bonifica el más barato. Que el número esté a la vista mientras se
    // elige es el punto de esta pantalla.
    const seRegala = useMemo(() => {
        const precios = armazones.filter(a => seleccion.has(a.id)).map(a => a.price).filter(p => p > 0);
        return precios.length ? Math.min(...precios) : 0;
    }, [armazones, seleccion]);

    const alternar = (id: string) => {
        setSeleccion(prev => {
            const s = new Set(prev);
            if (s.has(id)) s.delete(id); else s.add(id);
            return s;
        });
        setAviso(null);
    };

    const guardar = async () => {
        setGuardando(true);
        setError(null);
        setAviso(null);
        try {
            for (const [ids, marcar] of [[aMarcar, true], [aDesmarcar, false]] as const) {
                if (!ids.length) continue;
                const r = await fetch("/api/products/promo-2x1-web", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids, marcar }),
                });
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "No se pudo guardar");
            }
            setEnBase(new Set(seleccion));
            setAviso(`Guardado. ${seleccion.size} armazón(es) en el 2x1.`);
        } catch (e: any) {
            setError(e.message || "No se pudo guardar");
        } finally {
            setGuardando(false);
        }
    };

    if (cargando) return <p className="text-xs text-stone-500">Cargando armazones…</p>;
    if (error && !armazones.length) return <p className="text-xs text-rose-600">{error}</p>;

    return (
        <div className="space-y-4">
            {/* Resumen: el número que decide si la promo existe, y lo que cuesta */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/25 p-4">
                <div className="min-w-0 flex-1">
                    <p className="text-2xl font-black text-stone-900 dark:text-white">
                        {seleccion.size}
                        <span className="text-sm font-bold text-stone-400"> de {armazones.length}</span>
                    </p>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500 mt-0.5">
                        armazones en el 2x1
                    </p>
                    {seleccion.size === 0 ? (
                        // No es un detalle: con cero marcados la tienda no muestra
                        // nada aunque el interruptor esté prendido.
                        <p className="text-[11px] text-amber-700 dark:text-amber-500 mt-2 font-semibold">
                            Sin ninguno marcado, la promo no aparece en la tienda aunque el interruptor esté prendido.
                        </p>
                    ) : seleccion.size === 1 ? (
                        <p className="text-[11px] text-amber-700 dark:text-amber-500 mt-2 font-semibold">
                            Con uno solo marcado nadie puede armar un par: hacen falta al menos dos.
                        </p>
                    ) : (
                        <p className="text-[11px] text-stone-500 mt-2">
                            Por cada par, se regala el más barato de los marcados:{" "}
                            <span className="font-black text-stone-800 dark:text-stone-200">{formatearPrecio(seRegala)}</span>
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setSeleccion(new Set(armazones.map(a => a.id)))}
                        className="min-h-11 px-4 rounded-full border border-stone-300 dark:border-stone-700 text-[11px] font-black uppercase tracking-widest text-stone-700 dark:text-stone-300 hover:border-stone-900 dark:hover:border-stone-400 transition-colors"
                    >
                        Marcar todos
                    </button>
                    <button
                        type="button"
                        onClick={() => setSeleccion(new Set())}
                        className="min-h-11 px-4 rounded-full border border-stone-300 dark:border-stone-700 text-[11px] font-black uppercase tracking-widest text-stone-700 dark:text-stone-300 hover:border-stone-900 dark:hover:border-stone-400 transition-colors"
                    >
                        Ninguno
                    </button>
                    <button
                        type="button"
                        onClick={guardar}
                        disabled={!hayCambios || guardando}
                        className="min-h-11 px-5 rounded-full bg-stone-900 text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-700 transition-colors"
                    >
                        {guardando ? "Guardando…" : hayCambios ? `Guardar (${aMarcar.length + aDesmarcar.length})` : "Guardado"}
                    </button>
                </div>
            </div>

            {aviso && <p className="text-xs font-bold text-emerald-600">{aviso}</p>}
            {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

            <input
                type="search"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, modelo o categoría…"
                className="w-full px-4 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
            />

            {/* La grilla. `aria-pressed` y no un checkbox suelto: cada tarjeta ES
                el control, y un lector de pantalla tiene que poder decir si está
                marcada sin depender del color del borde. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[520px] overflow-y-auto pr-1">
                {visibles.map(a => {
                    const marcado = seleccion.has(a.id);
                    return (
                        <button
                            key={a.id}
                            type="button"
                            aria-pressed={marcado}
                            onClick={() => alternar(a.id)}
                            className={`text-left p-3 rounded-xl border-2 transition-colors ${
                                marcado
                                    ? "border-stone-900 dark:border-stone-300 bg-stone-900/5 dark:bg-white/5"
                                    : "border-stone-200 dark:border-stone-800 hover:border-stone-400"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-[11px] font-black uppercase tracking-wide text-stone-900 dark:text-white leading-tight line-clamp-2">
                                    {a.name || a.model}
                                </p>
                                <span
                                    aria-hidden="true"
                                    className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center text-[11px] font-black ${
                                        marcado
                                            ? "bg-stone-900 border-stone-900 text-white dark:bg-white dark:border-white dark:text-stone-900"
                                            : "border-stone-300 dark:border-stone-700 text-transparent"
                                    }`}
                                >
                                    ✓
                                </span>
                            </div>
                            <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-widest">{a.category || "—"}</p>
                            <p className="text-xs font-black text-stone-800 dark:text-stone-200 mt-1.5">{formatearPrecio(a.price)}</p>
                            {/* Sin stock no se puede vender, así que tampoco regalar.
                                No se bloquea —el stock cambia— pero se avisa. */}
                            {(a.stock ?? 0) <= 0 && (
                                <p className="text-[10px] font-bold text-amber-600 mt-1">Sin stock</p>
                            )}
                        </button>
                    );
                })}
            </div>

            {visibles.length === 0 && (
                <p className="text-xs text-stone-500">Ningún armazón coincide con «{busqueda}».</p>
            )}
        </div>
    );
}
