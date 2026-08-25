'use client';

/**
 * AUMENTAR PRECIOS — la pantalla desde donde se sube la lista.
 *
 * Antes esto se hacía con un script suelto, que solo cubría un laboratorio y no
 * dejaba rastro. Acá se elige qué subir, se VE producto por producto cómo
 * quedaría, y recién ahí se aplica. Cada aumento queda firmado y aparece en el
 * historial de abajo.
 *
 * Texto grande y contraste alto a propósito: esta pantalla se usa mirando una
 * lista de precios al lado.
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, TrendingUp, AlertTriangle, Check, History } from 'lucide-react';

interface Fila {
    id: string; name: string | null; brand: string | null; category: string;
    laboratory: string | null; price: number; nuevo: number;
}
interface Opcion { valor: string; productos: number }

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const fecha = (d: string) => new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
});

export default function AumentarPreciosPage() {
    const [opciones, setOpciones] = useState<{ laboratorios: Opcion[]; categorias: Opcion[]; marcas: Opcion[] } | null>(null);
    const [historial, setHistorial] = useState<any[]>([]);
    const [laboratorio, setLaboratorio] = useState('');
    const [categoria, setCategoria] = useState('');
    const [marca, setMarca] = useState('');
    const [pct, setPct] = useState('7');
    const [filas, setFilas] = useState<Fila[] | null>(null);
    const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
    const [cargando, setCargando] = useState(false);
    const [aplicando, setAplicando] = useState(false);
    const [confirmando, setConfirmando] = useState(false);
    const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

    const cargarBase = useCallback(async () => {
        const r = await fetch('/api/products/aumento-precios');
        if (!r.ok) { setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los productos.' }); return; }
        const d = await r.json();
        setOpciones(d.opciones);
        setHistorial(d.historial || []);
    }, []);

    useEffect(() => { cargarBase(); }, [cargarBase]);

    const verPrevia = async () => {
        setCargando(true); setMensaje(null); setConfirmando(false);
        const q = new URLSearchParams({ pct });
        if (laboratorio) q.set('laboratorio', laboratorio);
        if (categoria) q.set('categoria', categoria);
        if (marca) q.set('marca', marca);
        const r = await fetch(`/api/products/aumento-precios?${q}`);
        const d = await r.json();
        setCargando(false);
        if (!r.ok) { setMensaje({ tipo: 'error', texto: d.error || 'No se pudo calcular.' }); return; }
        setFilas(d.filas);
        setExcluidos(new Set());
    };

    const incluidos = (filas || []).filter(f => !excluidos.has(f.id));

    const aplicar = async () => {
        setAplicando(true); setMensaje(null);
        const r = await fetch('/api/products/aumento-precios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pct: Number(pct),
                laboratorio: laboratorio || null,
                categoria: categoria || null,
                marca: marca || null,
                ids: incluidos.map(f => f.id),
            }),
        });
        const d = await r.json();
        setAplicando(false); setConfirmando(false);
        if (!r.ok) { setMensaje({ tipo: 'error', texto: d.error || 'No se pudo aplicar.' }); return; }
        setMensaje({ tipo: 'ok', texto: `Listo: ${d.actualizados} precio(s) actualizados. Las ventas ya hechas no cambian.` });
        setFilas(null);
        cargarBase();
    };

    const totalViejo = incluidos.reduce((a, f) => a + f.price, 0);
    const totalNuevo = incluidos.reduce((a, f) => a + f.nuevo, 0);

    return (
        <div className="p-6 max-w-6xl mx-auto text-stone-900">
            <h1 className="text-3xl font-bold flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-emerald-700" /> Aumentar precios
            </h1>
            <p className="mt-2 text-stone-700 text-lg">
                Elegí qué productos subir y cuánto. Vas a ver la lista antes de aplicar nada.
            </p>
            <p className="mt-1 text-stone-600">
                Solo cambia el <strong>precio de lista</strong>. El costo no se toca, y las
                ventas que ya hiciste <strong>no se modifican</strong>.
            </p>

            {/* ── Filtros ─────────────────────────────────────────────── */}
            <div className="mt-6 grid gap-4 sm:grid-cols-4 bg-stone-50 border border-stone-300 rounded-xl p-5">
                <Selector etiqueta="Laboratorio" valor={laboratorio} setValor={setLaboratorio} opciones={opciones?.laboratorios} />
                <Selector etiqueta="Categoría" valor={categoria} setValor={setCategoria} opciones={opciones?.categorias} />
                <Selector etiqueta="Marca" valor={marca} setValor={setMarca} opciones={opciones?.marcas} />
                <div>
                    <label className="block text-base font-semibold mb-1" htmlFor="pct">Aumento (%)</label>
                    <input
                        id="pct" type="number" min="1" max="100" step="0.5" value={pct}
                        onChange={e => setPct(e.target.value)}
                        className="w-full border border-stone-400 rounded-lg px-3 py-2 text-lg"
                    />
                </div>
            </div>

            <button
                onClick={verPrevia}
                disabled={cargando || !Number(pct)}
                className="mt-4 px-6 py-3 rounded-lg bg-stone-900 text-white text-lg font-semibold disabled:opacity-50 inline-flex items-center gap-2"
            >
                {cargando ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Ver cómo quedaría
            </button>

            {mensaje && (
                <div className={`mt-4 p-4 rounded-lg text-lg border ${mensaje.tipo === 'ok'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                    : 'bg-red-50 border-red-400 text-red-900'}`}>
                    {mensaje.texto}
                </div>
            )}

            {/* ── Vista previa ────────────────────────────────────────── */}
            {filas && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold">
                        {incluidos.length} producto(s) subirían {pct}%
                    </h2>
                    <p className="text-stone-700 mt-1">
                        Destildá el que no quieras subir. La lista pasaría de{' '}
                        <strong>{pesos(totalViejo)}</strong> a <strong>{pesos(totalNuevo)}</strong> en total.
                    </p>

                    {filas.length === 0 && (
                        <p className="mt-4 p-4 bg-amber-50 border border-amber-400 rounded-lg text-lg">
                            No hay ningún producto con precio que coincida con esos filtros.
                        </p>
                    )}

                    {filas.length > 0 && (
                        <div className="mt-4 border border-stone-300 rounded-xl overflow-x-auto">
                            <table className="w-full text-base">
                                <thead className="bg-stone-900 text-white">
                                    <tr>
                                        <th className="p-3 text-left">Subir</th>
                                        <th className="p-3 text-left">Producto</th>
                                        <th className="p-3 text-right">Ahora</th>
                                        <th className="p-3 text-right">Quedaría</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filas.map(f => {
                                        const incluido = !excluidos.has(f.id);
                                        return (
                                            <tr key={f.id} className={`border-t border-stone-200 ${incluido ? '' : 'opacity-45'}`}>
                                                <td className="p-3">
                                                    <input
                                                        type="checkbox" checked={incluido}
                                                        aria-label={`Subir el precio de ${f.name}`}
                                                        onChange={() => setExcluidos(prev => {
                                                            const s = new Set(prev);
                                                            if (s.has(f.id)) s.delete(f.id); else s.add(f.id);
                                                            return s;
                                                        })}
                                                        className="w-5 h-5"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-medium">{f.brand ? `${f.brand} · ` : ''}{f.name}</div>
                                                    <div className="text-sm text-stone-600">{f.laboratory || 'sin laboratorio'} · {f.category}</div>
                                                </td>
                                                <td className="p-3 text-right whitespace-nowrap">{pesos(f.price)}</td>
                                                <td className="p-3 text-right whitespace-nowrap font-semibold text-emerald-800">{pesos(f.nuevo)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {incluidos.length > 0 && (
                        <div className="mt-5">
                            {!confirmando ? (
                                <button
                                    onClick={() => setConfirmando(true)}
                                    className="px-6 py-3 rounded-lg bg-emerald-700 text-white text-lg font-semibold"
                                >
                                    Aplicar el aumento
                                </button>
                            ) : (
                                <div className="p-5 bg-amber-50 border-2 border-amber-500 rounded-xl">
                                    <p className="text-lg font-semibold flex items-center gap-2">
                                        <AlertTriangle className="w-6 h-6 text-amber-700" />
                                        Vas a subir {incluidos.length} precio(s) un {pct}%. Esto cambia la lista de verdad.
                                    </p>
                                    <p className="text-stone-700 mt-1">
                                        Las ventas ya hechas no se tocan. Queda registrado con tu nombre.
                                    </p>
                                    <div className="mt-4 flex gap-3">
                                        <button
                                            onClick={aplicar} disabled={aplicando}
                                            className="px-6 py-3 rounded-lg bg-emerald-700 text-white text-lg font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {aplicando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                            Sí, aplicar
                                        </button>
                                        <button
                                            onClick={() => setConfirmando(false)}
                                            className="px-6 py-3 rounded-lg border border-stone-400 text-lg"
                                        >
                                            No, volver
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Historial ───────────────────────────────────────────── */}
            <div className="mt-12">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <History className="w-6 h-6" /> Historial de aumentos
                </h2>
                {historial.length === 0 ? (
                    <p className="mt-2 text-stone-700 text-lg">
                        Todavía no hay ningún aumento registrado. Los que se hicieron antes del
                        25/8/2026 no dejaban rastro y no se pueden reconstruir.
                    </p>
                ) : (
                    <div className="mt-3 border border-stone-300 rounded-xl overflow-x-auto">
                        <table className="w-full text-base">
                            <thead className="bg-stone-900 text-white">
                                <tr>
                                    <th className="p-3 text-left">Fecha</th>
                                    <th className="p-3 text-left">Alcance</th>
                                    <th className="p-3 text-right">Aumento</th>
                                    <th className="p-3 text-right">Productos</th>
                                    <th className="p-3 text-left">Lo hizo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historial.map((h, i) => (
                                    <tr key={i} className="border-t border-stone-200">
                                        <td className="p-3 whitespace-nowrap">{fecha(h.fecha)}</td>
                                        <td className="p-3">{h.laboratorio || 'varios'}</td>
                                        <td className="p-3 text-right font-semibold">+{h.pct}%</td>
                                        <td className="p-3 text-right">{h.productos}</td>
                                        <td className="p-3">{h.quien}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function Selector({ etiqueta, valor, setValor, opciones }: {
    etiqueta: string; valor: string; setValor: (v: string) => void; opciones?: Opcion[];
}) {
    const id = `sel-${etiqueta.toLowerCase()}`;
    return (
        <div>
            <label className="block text-base font-semibold mb-1" htmlFor={id}>{etiqueta}</label>
            <select
                id={id} value={valor} onChange={e => setValor(e.target.value)}
                className="w-full border border-stone-400 rounded-lg px-3 py-2 text-lg bg-white"
            >
                <option value="">Todos</option>
                {(opciones || []).map(o => (
                    <option key={o.valor} value={o.valor}>{o.valor} ({o.productos})</option>
                ))}
            </select>
        </div>
    );
}
