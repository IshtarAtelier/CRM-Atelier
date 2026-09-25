"use client";

// ────────────────────────────────────────────────────────────────────────────
// Qué producto del sistema vende cada opción de "Arma tus lentes".
//
// Cada card del configurador de la tienda ("Super Blue", "Varilux Premium",
// "Teñido Degradé"…) apunta a UN producto del inventario. El precio que ve y
// paga el cliente es el de ese producto, así que un cambio de precio en el
// inventario llega solo a la web. Acá se elige cuál.
//
// LO QUE ESTA PANTALLA TIENE QUE DEJAR CLARO
//  · A qué precio se está vendiendo HOY cada opción.
//  · Qué opciones NO se están vendiendo y por qué (sin producto, archivado,
//    sin precio): esas no aparecen en la tienda.
//  · Que se guarda al tocar "Guardar", no al elegir.
// Ver docs/cristales-web.md.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { precioConSigno } from "@/lib/format-precio";
import { motivoLegible } from "@/lib/cristales-web/calculo";
import type { GrupoCristal, MotivoNoDisponible } from "@/lib/cristales-web/claves";

interface ProductoResumen {
    id: string;
    name: string | null;
    laboratory: string | null;
    price: number;
    is2x1: boolean;
}

interface Opcion {
    clave: string;
    grupo: GrupoCristal;
    codigo: string;
    etiqueta: string;
    orden: number;
    activa: boolean;
    disponible: boolean;
    motivo: MotivoNoDisponible | null;
    precio: number | null;
    productId: string | null;
    producto: ProductoResumen | null;
    avisos: string[];
    updatedAt: string;
    updatedBy: string | null;
}

interface Candidato {
    id: string;
    name: string | null;
    type: string | null;
    laboratory: string | null;
    price: number;
    is2x1: boolean;
}

interface Borrador {
    productId: string | null;
    etiqueta: string;
    activa: boolean;
}

const TITULO_GRUPO: Record<GrupoCristal, string> = {
    MONOFOCAL: "Monofocal",
    BIFOCAL: "Bifocal",
    MULTIFOCAL: "Multifocal",
    TENIDO: "Teñido (anteojos de sol)",
};

const nombreCandidato = (c: Candidato | ProductoResumen) =>
    `${(c.name || "(sin nombre)").trim()} · ${precioConSigno(c.price)}${c.laboratory ? ` · ${c.laboratory}` : ""}${c.is2x1 ? " · 2x1" : ""}`;

export function CristalesConfigurador() {
    const [opciones, setOpciones] = useState<Opcion[]>([]);
    const [candidatos, setCandidatos] = useState<Record<GrupoCristal, Candidato[]>>({ MONOFOCAL: [], BIFOCAL: [], MULTIFOCAL: [], TENIDO: [] });
    const [borrador, setBorrador] = useState<Record<string, Borrador>>({});
    const [filtro, setFiltro] = useState<Record<string, string>>({});
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);

    const aplicarEstado = (d: { opciones: Opcion[]; candidatos: Record<GrupoCristal, Candidato[]> }) => {
        setOpciones(d.opciones);
        setCandidatos(d.candidatos);
        setBorrador(Object.fromEntries(d.opciones.map(o => [o.clave, { productId: o.productId, etiqueta: o.etiqueta, activa: o.activa }])));
    };

    useEffect(() => {
        let vivo = true;
        fetch("/api/admin/web-lens-options")
            .then(r => (r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.error || "Sin respuesta")))))
            .then(d => vivo && aplicarEstado(d))
            .catch(e => vivo && setError(e.message))
            .finally(() => vivo && setCargando(false));
        return () => { vivo = false; };
    }, []);

    // Qué cambió respecto de la base. Se manda solo eso: cada cambio es una
    // fila del AuditLog y tiene que corresponder a una decisión real.
    const cambios = useMemo(() => {
        const lista: { clave: string; productId?: string | null; etiqueta?: string; activa?: boolean }[] = [];
        for (const o of opciones) {
            const b = borrador[o.clave];
            if (!b) continue;
            const c: { clave: string; productId?: string | null; etiqueta?: string; activa?: boolean } = { clave: o.clave };
            if (b.productId !== o.productId) c.productId = b.productId;
            if (b.etiqueta.trim() !== o.etiqueta) c.etiqueta = b.etiqueta.trim();
            if (b.activa !== o.activa) c.activa = b.activa;
            if (Object.keys(c).length > 1) lista.push(c);
        }
        return lista;
    }, [opciones, borrador]);

    const guardar = async () => {
        setGuardando(true);
        setError(null);
        setAviso(null);
        try {
            const r = await fetch("/api/admin/web-lens-options", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cambios }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "No se pudo guardar");
            aplicarEstado(d);
            setAviso(`Guardado. ${d.actualizadas?.length ?? cambios.length} opción(es) actualizada(s): la tienda ya las muestra así.`);
        } catch (e: any) {
            setError(e.message || "No se pudo guardar");
        } finally {
            setGuardando(false);
        }
    };

    const editar = (clave: string, parcial: Partial<Borrador>) => {
        setBorrador(prev => ({ ...prev, [clave]: { ...prev[clave], ...parcial } }));
        setAviso(null);
    };

    if (cargando) return <p className="text-xs text-stone-500">Cargando opciones de cristal…</p>;
    if (error && !opciones.length) return <p className="text-xs text-rose-600">{error}</p>;

    const noSeVenden = opciones.filter(o => !o.disponible);
    const grupos = (["MONOFOCAL", "BIFOCAL", "MULTIFOCAL", "TENIDO"] as GrupoCristal[])
        .map(g => ({ grupo: g, opciones: opciones.filter(o => o.grupo === g).sort((a, b) => a.orden - b.orden) }))
        .filter(g => g.opciones.length > 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/25 p-4">
                <div className="min-w-0 flex-1">
                    <p className="text-2xl font-black text-stone-900 dark:text-white">
                        {opciones.length - noSeVenden.length}
                        <span className="text-sm font-bold text-stone-500"> de {opciones.length}</span>
                    </p>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500 mt-0.5">opciones a la venta en la tienda</p>
                    {noSeVenden.length > 0 ? (
                        <p className="text-[12px] text-rose-700 dark:text-rose-400 mt-2 font-semibold">
                            No se venden: {noSeVenden.map(o => `${o.etiqueta} (${motivoLegible(o.motivo)})`).join(" · ")}
                        </p>
                    ) : (
                        <p className="text-[12px] text-stone-600 dark:text-stone-400 mt-2">
                            Cada opción cobra el precio del producto elegido. Si cambiás el precio en el inventario, la tienda lo toma en la próxima visita.
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={guardar}
                    disabled={cambios.length === 0 || guardando}
                    className="min-h-11 px-5 rounded-full bg-stone-900 text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-700 transition-colors"
                >
                    {guardando ? "Guardando…" : cambios.length ? `Guardar (${cambios.length})` : "Guardado"}
                </button>
            </div>

            {aviso && <p className="text-xs font-bold text-emerald-700">{aviso}</p>}
            {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

            {grupos.map(({ grupo, opciones: delGrupo }) => (
                <section key={grupo} className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-400">{TITULO_GRUPO[grupo]}</h3>
                    {delGrupo.map(o => {
                        const b = borrador[o.clave] ?? { productId: o.productId, etiqueta: o.etiqueta, activa: o.activa };
                        const q = (filtro[o.clave] || "").trim().toLowerCase();
                        const lista = candidatos[grupo] || [];
                        const visibles = q ? lista.filter(c => `${c.name} ${c.laboratory}`.toLowerCase().includes(q)) : lista;
                        const elegido = lista.find(c => c.id === b.productId) ?? null;
                        const cambiado = b.productId !== o.productId || b.etiqueta.trim() !== o.etiqueta || b.activa !== o.activa;
                        return (
                            <div
                                key={o.clave}
                                className={`rounded-xl border-2 p-4 space-y-3 ${
                                    !o.disponible ? "border-rose-300 dark:border-rose-800" : cambiado ? "border-amber-400" : "border-stone-200 dark:border-stone-800"
                                }`}
                            >
                                <div className="flex flex-wrap items-center gap-3">
                                    <input
                                        value={b.etiqueta}
                                        onChange={e => editar(o.clave, { etiqueta: e.target.value })}
                                        aria-label={`Título de la opción ${o.clave}`}
                                        className="flex-1 min-w-[180px] px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm font-bold outline-none focus:border-stone-900"
                                    />
                                    <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                        o.disponible ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                    }`}>
                                        {o.disponible ? `Se vende a ${precioConSigno(o.precio)}` : `No se vende: ${motivoLegible(o.motivo)}`}
                                    </span>
                                    <label className="flex items-center gap-2 text-[11px] font-bold text-stone-600 dark:text-stone-400">
                                        <input type="checkbox" checked={b.activa} onChange={e => editar(o.clave, { activa: e.target.checked })} />
                                        Ofrecer en la tienda
                                    </label>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                                    <input
                                        type="search"
                                        value={filtro[o.clave] || ""}
                                        onChange={e => setFiltro(prev => ({ ...prev, [o.clave]: e.target.value }))}
                                        placeholder="Buscar producto…"
                                        aria-label={`Buscar producto para ${o.etiqueta}`}
                                        className="px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs outline-none focus:border-stone-900"
                                    />
                                    <select
                                        value={b.productId ?? ""}
                                        onChange={e => editar(o.clave, { productId: e.target.value || null })}
                                        aria-label={`Producto del sistema para ${o.etiqueta}`}
                                        className="px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs outline-none focus:border-stone-900"
                                    >
                                        <option value="">— Sin producto (no se vende) —</option>
                                        {elegido && !visibles.some(c => c.id === elegido.id) && (
                                            <option value={elegido.id}>{nombreCandidato(elegido)}</option>
                                        )}
                                        {!elegido && o.producto && b.productId === o.productId && (
                                            // El vinculado ya no califica (archivado, sin precio): se muestra para que se vea qué hay.
                                            <option value={o.producto.id}>{nombreCandidato(o.producto)} · NO CALIFICA</option>
                                        )}
                                        {visibles.map(c => (
                                            <option key={c.id} value={c.id}>{nombreCandidato(c)}</option>
                                        ))}
                                    </select>
                                </div>

                                {o.avisos.length > 0 && b.productId === o.productId && (
                                    <ul className="text-[12px] text-amber-800 dark:text-amber-400 font-semibold space-y-0.5">
                                        {o.avisos.map(a => <li key={a}>⚠ {a}</li>)}
                                    </ul>
                                )}
                                <p className="text-[10px] text-stone-500">
                                    Clave {o.clave}
                                    {o.updatedBy ? ` · último cambio de ${o.updatedBy}` : ""}
                                </p>
                            </div>
                        );
                    })}
                </section>
            ))}
        </div>
    );
}
