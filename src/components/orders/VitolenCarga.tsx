'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Check, X, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/format-date';

/**
 * Bloque "Vitolen" de la venta: lo que el portal muestra de ella (espejo) y la
 * carga asistida con OK humano.
 *
 *   Preparar → el robot llena el portal y deja la captura → EN REVISIÓN →
 *   una persona mira la captura y Aprueba (o Rechaza) → el robot confirma →
 *   CARGADO, con el nº de pedido escrito en la venta.
 *
 * El botón Aprobar aparece SOLO cuando hay captura para mirar: nadie aprueba
 * a ciegas (regla de Ishtar, 30/9/2026).
 */

interface Borrador {
    id: string; pair: number; status: string; payload: any; screenshotUrl: string | null;
    resumenPortal: { pasos?: { campo: string; valor: string }[]; pendientes?: string[] } | null;
    screenshotFinalUrl: string | null; portalNumber: string | null; preparedBy: string | null;
    approvedBy: string | null; approvedAt: string | null; loadedAt: string | null; error: string | null; createdAt: string;
}
interface PedidoEspejo { portalNumber: string; status: string; statusRaw: string | null; estimatedAt: string | null; finishedAt: string | null; lastSeenAt: string }
interface ParAnalisis { pair: number; diseno: string | null; variantes: string[]; faltantes: string[]; avisos: string[] }

const ESTADO_BORRADOR: Record<string, { texto: string; clase: string }> = {
    PREPARADO: { texto: 'Preparado · esperando al robot', clase: 'bg-stone-100 text-stone-600' },
    EN_REVISION: { texto: 'Para revisar', clase: 'bg-amber-100 text-amber-800' },
    APROBADO: { texto: 'Aprobado · el robot confirma', clase: 'bg-sky-100 text-sky-800' },
    CARGADO: { texto: 'Cargado en el portal', clase: 'bg-emerald-100 text-emerald-800' },
    RECHAZADO: { texto: 'Rechazado', clase: 'bg-rose-100 text-rose-800' },
    ERROR: { texto: 'Falló', clase: 'bg-rose-100 text-rose-800' },
};
const ESTADO_PORTAL: Record<string, string> = {
    INGRESADO: 'Ingresado', EN_PROCESO: 'En proceso', TERMINADO: 'Terminado', DESPACHADO: 'Despachado', ANULADO: 'Anulado', DESCONOCIDO: 'Sin interpretar',
};

export default function VitolenCarga({ orderId, onChanged }: { orderId: string; onChanged?: () => void }) {
    const [datos, setDatos] = useState<{ borradores: Borrador[]; espejo: PedidoEspejo[]; pares: ParAnalisis[]; formas: string[] } | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [ocupado, setOcupado] = useState<string | null>(null);
    const [forma, setForma] = useState<Record<number, string>>({});
    const [variante, setVariante] = useState<Record<number, string>>({});
    const [motivo, setMotivo] = useState<Record<string, string>>({});

    const cargar = useCallback(async () => {
        setCargando(true); setError('');
        try {
            const res = await fetch(`/api/lab-modulos/borradores?orderId=${encodeURIComponent(orderId)}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { setError(json.error || 'No se pudo leer el estado en Vitolen.'); return; }
            setDatos(json);
        } catch {
            setError('No se pudo leer el estado en Vitolen.');
        } finally {
            setCargando(false);
        }
    }, [orderId]);

    useEffect(() => { cargar(); }, [cargar]);

    const preparar = async (pair: number) => {
        setOcupado(`preparar-${pair}`); setError('');
        try {
            const primero = datos?.borradores.find(b => b.pair === 1 && b.status === 'CARGADO')?.portalNumber || null;
            const res = await fetch('/api/lab-modulos/borradores', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, pair, forma: forma[pair] || null, variante: variante[pair] || null, pedidoOrigen: pair === 2 ? primero : null }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError([json.error, ...(json.faltantes || [])].filter(Boolean).join(' · '));
                if (json.borradorId) await cargar(); // el robot falló: el borrador quedó en ERROR y se muestra
                return;
            }
            await cargar(); onChanged?.();
        } finally { setOcupado(null); }
    };

    const decidir = async (id: string, accion: 'aprobar' | 'rechazar') => {
        setOcupado(`${accion}-${id}`); setError('');
        try {
            const res = await fetch(`/api/lab-modulos/borradores/${id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion, motivo: motivo[id] || '' }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { setError(json.error || 'No se pudo guardar la decisión.'); return; }
            await cargar(); onChanged?.();
        } finally { setOcupado(null); }
    };

    if (cargando && !datos) {
        return <div className="text-[11px] text-stone-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Leyendo Vitolen…</div>;
    }
    if (!datos) return error ? <p className="text-[11px] text-rose-600">{error}</p> : null;

    const vivo = (pair: number) => datos.borradores.find(b => b.pair === pair && ['PREPARADO', 'EN_REVISION', 'APROBADO'].includes(b.status));

    return (
        <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 rounded-2xl border border-red-100 dark:border-red-900/40 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" /> Vitolen · pedido en el portal
                </h4>
                <button type="button" onClick={cargar} className="text-stone-400 hover:text-red-600" title="Actualizar">
                    <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {datos.espejo.length > 0 ? (
                <ul className="space-y-1 mb-4">
                    {datos.espejo.map(p => (
                        <li key={p.portalNumber} className="flex items-center justify-between text-[11px] bg-white/70 dark:bg-black/20 rounded-lg px-3 py-2">
                            <span className="font-bold text-stone-800 dark:text-stone-200">Pedido {p.portalNumber}</span>
                            <span className="text-stone-600 dark:text-stone-400">{ESTADO_PORTAL[p.status] || p.status}{p.statusRaw && p.status === 'DESCONOCIDO' ? ` (${p.statusRaw})` : ''}</span>
                            <span className="text-stone-400">{p.estimatedAt ? `listo ${formatDate(p.estimatedAt)}` : `visto ${formatDate(p.lastSeenAt)}`}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-[11px] text-stone-500 mb-4">El portal de Vitolen todavía no muestra un pedido de esta venta.</p>
            )}

            {datos.pares.map(par => {
                const b = vivo(par.pair);
                const cerrados = datos.borradores.filter(x => x.pair === par.pair && !['PREPARADO', 'EN_REVISION', 'APROBADO'].includes(x.status));
                const ultimo = cerrados[0];
                const cargado = cerrados.find(x => x.status === 'CARGADO');
                return (
                    <div key={par.pair} className="border-t border-red-100 dark:border-red-900/30 pt-3 mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{datos.pares.length > 1 ? `Par ${par.pair}` : 'Pedido'}{par.diseno ? ` · ${par.diseno}` : ''}</span>
                            {(b || ultimo) && (
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${ESTADO_BORRADOR[(b || ultimo)!.status]?.clase}`}>
                                    {ESTADO_BORRADOR[(b || ultimo)!.status]?.texto}
                                </span>
                            )}
                        </div>

                        {cargado && !b && (
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">Nº {cargado.portalNumber} · aprobado por {cargado.approvedBy} · {cargado.loadedAt ? formatDate(cargado.loadedAt) : ''}</p>
                        )}
                        {ultimo && !b && ultimo.status !== 'CARGADO' && ultimo.error && (
                            <p className="text-[11px] text-rose-700 dark:text-rose-400 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {ultimo.error}</p>
                        )}

                        {!b && !cargado && (
                            par.faltantes.length > 0 ? (
                                <div className="text-[11px] text-amber-800 dark:text-amber-400">
                                    <p className="font-bold">Para prepararlo falta:</p>
                                    <ul className="list-disc pl-4">{par.faltantes.map(f => <li key={f}>{f}</li>)}</ul>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-end gap-2">
                                    {par.variantes.length > 1 && (
                                        <label className="text-[10px] text-stone-500">Variante
                                            <select value={variante[par.pair] || ''} onChange={e => setVariante(v => ({ ...v, [par.pair]: e.target.value }))} className="block mt-0.5 text-[11px] rounded border border-stone-300 bg-white dark:bg-stone-900 px-2 py-1">
                                                <option value="">Elegir…</option>
                                                {par.variantes.map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </label>
                                    )}
                                    <label className="text-[10px] text-stone-500">Forma del armazón (portal)
                                        <select value={forma[par.pair] || ''} onChange={e => setForma(v => ({ ...v, [par.pair]: e.target.value }))} className="block mt-0.5 text-[11px] rounded border border-stone-300 bg-white dark:bg-stone-900 px-2 py-1">
                                            <option value="">Elegir…</option>
                                            {datos.formas.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    </label>
                                    <button type="button" disabled={ocupado !== null || !forma[par.pair] || (par.variantes.length > 1 && !variante[par.pair])}
                                        onClick={() => preparar(par.pair)}
                                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-red-600 text-white disabled:opacity-40">
                                        {ocupado === `preparar-${par.pair}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} Preparar en Vitolen
                                    </button>
                                </div>
                            )
                        )}

                        {b && (
                            <div className="space-y-2">
                                {b.status === 'PREPARADO' && <p className="text-[11px] text-stone-500">El robot está llenando el portal; en unos segundos deja la captura para revisar. Preparado por {b.preparedBy}.</p>}
                                {b.status === 'APROBADO' && <p className="text-[11px] text-stone-500">Aprobado por {b.approvedBy}. Por ahora el pedido se confirma a mano en el portal (el robot todavía no aprieta &quot;Crear&quot;); el nº de pedido lo trae el seguimiento solo.</p>}
                                {b.status === 'EN_REVISION' && (
                                    <>
                                        <p className="text-[11px] text-stone-600 dark:text-stone-300">Así quedó el formulario en el portal, <strong>antes de &quot;Crear&quot;</strong>. Revisá que coincida con la venta y aprobá o rechazá.</p>
                                        {b.screenshotUrl && (
                                            <a href={b.screenshotUrl} target="_blank" rel="noreferrer" className="block">
                                                <img src={b.screenshotUrl} alt="Formulario del pedido llenado en el portal de Vitolen" className="w-full rounded-lg border border-stone-200" />
                                            </a>
                                        )}
                                        {!!b.resumenPortal?.pendientes?.length && (
                                            <div className="text-[11px] text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                                                <p className="font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Quedó para hacer a mano en el portal:</p>
                                                <ul className="list-disc pl-4">{b.resumenPortal.pendientes.map(p => <li key={p}>{p}</li>)}</ul>
                                            </div>
                                        )}
                                        <ResumenPayload payload={b.payload} />
                                        <div className="flex items-center gap-2">
                                            <button type="button" disabled={ocupado !== null} onClick={() => decidir(b.id, 'aprobar')}
                                                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40">
                                                {ocupado === `aprobar-${b.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Aprobar
                                            </button>
                                            <input value={motivo[b.id] || ''} onChange={e => setMotivo(m => ({ ...m, [b.id]: e.target.value }))} placeholder="Motivo del rechazo"
                                                className="flex-1 text-[11px] rounded border border-stone-300 bg-white dark:bg-stone-900 px-2 py-1" />
                                            <button type="button" disabled={ocupado !== null || !(motivo[b.id] || '').trim()} onClick={() => decidir(b.id, 'rechazar')}
                                                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-rose-600 text-white disabled:opacity-40">
                                                <X className="w-3 h-3" /> Rechazar
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {error && <p className="mt-3 text-[11px] text-rose-600 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {error}</p>}
        </div>
    );
}

/** Lo que se carga, campo por campo, para que la persona compare con la captura. */
function ResumenPayload({ payload }: { payload: any }) {
    if (!payload) return null;
    const ojo = (g: any) => g ? `${g.esferico > 0 ? '+' : ''}${g.esferico} ${g.cilindrico != null ? `${g.cilindrico > 0 ? '+' : ''}${g.cilindrico} × ${g.eje ?? '—'}` : ''}${g.adicion != null ? ` add ${g.adicion}` : ''} · DNP ${g.dnp ?? '—'} · alt ${g.altura ?? '—'} · ${g.material} (${g.codigo})` : '—';
    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] bg-white/70 dark:bg-black/20 rounded-lg px-3 py-2">
            <dt className="text-stone-400">Caso</dt><dd className="font-bold">{payload.nroCasoInterno} · {payload.paciente}</dd>
            <dt className="text-stone-400">Diseño</dt><dd>{payload.tipoReceta} · {payload.diseno}{payload.variante ? ` ${payload.variante}` : ''}</dd>
            <dt className="text-stone-400">OD</dt><dd>{ojo(payload.od)}</dd>
            <dt className="text-stone-400">OI</dt><dd>{ojo(payload.oi)}</dd>
            <dt className="text-stone-400">Armazón</dt><dd>{payload.armazon?.forma} · A {payload.armazon?.largo} B {payload.armazon?.alto} DBL {payload.armazon?.puente} ED {payload.armazon?.diagonalMayor ?? '—'} · {payload.armazon?.caracteristicas}</dd>
            <dt className="text-stone-400">Trabajos</dt><dd>{payload.tratamientos?.antirreflejo ? 'AR' : 'sin AR'} · {payload.montajes?.calibrado ? 'calibrado' : 'sin calibrar'}{payload.pedidoOrigen ? ` · 2º par de ${payload.pedidoOrigen}` : ''}</dd>
        </dl>
    );
}
