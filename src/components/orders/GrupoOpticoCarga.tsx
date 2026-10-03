'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Check, X, Loader2, RefreshCw, AlertTriangle, FileText } from 'lucide-react';
import { formatDate } from '@/lib/format-date';

/**
 * Bloque "Grupo Óptico" de la venta: la carga asistida del pedido en SmartLab
 * con OK humano (src/services/lab-modules/grupo-optico).
 *
 *   Preparar → el robot lee el portal y arma el pedido exacto → PARA REVISAR →
 *   una persona compara con la venta y Aprueba (o Rechaza) → el robot lo crea
 *   en el portal → CARGADO, con el nº en la venta y el PDF del laboratorio.
 *
 * En SmartLab guardar es crear y la óptica no puede anular: por eso lo que se
 * revisa es exactamente lo que se va a mandar, con los nombres del portal.
 */

interface Etiquetas { tipoLente: string; material: string; color: string; marca: string; articuloOD: string | null; articuloOI: string | null; aro: string; tenido: string | null }
interface Ojo { esferico: string; cilindrico: string | null; eje: string; adicion: number; dnp: string | null; altura: string | null }
interface Borrador {
    id: string; pair: number; status: string; screenshotFinalUrl: string | null; portalNumber: string | null;
    preparedBy: string | null; approvedBy: string | null; loadedAt: string | null; error: string | null; createdAt: string;
    payload: { plan?: { producto: string; od: Ojo | null; oi: Ojo | null; codigoOptica: string; observacion: string; armazon: { tipo: string; aro: string; forma: number | null; a: string | null; b: string | null; ed: string | null; puente: string | null; modelo: string } }; avisos?: string[] } | null;
    resumenPortal: { etiquetas?: Etiquetas; pdfUrl?: string; diferencias?: string[] } | null;
}
interface PedidoEspejo { portalNumber: string; status: string; statusRaw: string | null; lastSeenAt: string }
interface ParAnalisis { pair: number; producto: string | null; faltantes: string[]; avisos: string[]; esperaPrimerPar: boolean; pedidoOrigen: string | null }
interface Datos { borradores: Borrador[]; espejo: PedidoEspejo[]; pares: ParAnalisis[]; es2x1: boolean; tiposArmazon: { value: string; label: string }[]; tiposAro: { value: string; label: string }[] }

const ESTADO: Record<string, { texto: string; clase: string }> = {
    PREPARADO: { texto: 'El robot está armando el pedido', clase: 'bg-stone-100 text-stone-600' },
    EN_REVISION: { texto: 'Para revisar', clase: 'bg-amber-100 text-amber-800' },
    APROBADO: { texto: 'Aprobado · cargando', clase: 'bg-sky-100 text-sky-800' },
    CARGADO: { texto: 'Cargado en el laboratorio', clase: 'bg-emerald-100 text-emerald-800' },
    RECHAZADO: { texto: 'Rechazado', clase: 'bg-rose-100 text-rose-800' },
    ERROR: { texto: 'No se pudo preparar', clase: 'bg-rose-100 text-rose-800' },
};
const VIVOS = ['PREPARADO', 'EN_REVISION', 'APROBADO'];

export default function GrupoOpticoCarga({ orderId, onChanged }: { orderId: string; onChanged?: () => void }) {
    const [datos, setDatos] = useState<Datos | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [ocupado, setOcupado] = useState<string | null>(null);
    const [tipoArmazon, setTipoArmazon] = useState<Record<number, string>>({});
    const [tipoAro, setTipoAro] = useState<Record<number, string>>({});
    const [forma, setForma] = useState<Record<number, string>>({});
    const [motivo, setMotivo] = useState<Record<string, string>>({});

    const cargar = useCallback(async () => {
        setCargando(true); setError('');
        try {
            const res = await fetch(`/api/lab-modulos/borradores?lab=GRUPO_OPTICO&orderId=${encodeURIComponent(orderId)}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { setError(json.error || 'No se pudo leer el estado en Grupo Óptico.'); return; }
            setDatos(json);
        } catch {
            setError('No se pudo leer el estado en Grupo Óptico.');
        } finally {
            setCargando(false);
        }
    }, [orderId]);
    useEffect(() => { cargar(); }, [cargar]);

    const preparar = async (pair: number) => {
        setOcupado(`preparar-${pair}`); setError('');
        try {
            const res = await fetch('/api/lab-modulos/borradores', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lab: 'GRUPO_OPTICO', orderId, pair, tipoArmazon: tipoArmazon[pair] || null, tipoAro: tipoAro[pair] || 'ENTERO', forma: forma[pair] || null }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError([json.error, ...(json.faltantes || [])].filter(Boolean).join(' · '));
                if (json.borradorId) await cargar();
                return;
            }
            await cargar(); onChanged?.();
        } finally { setOcupado(null); }
    };

    const decidir = async (id: string, accion: 'aprobar' | 'rechazar' | 'reintentar') => {
        setOcupado(`${accion}-${id}`); setError('');
        try {
            const res = await fetch(`/api/lab-modulos/borradores/${id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion, motivo: motivo[id] || '' }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { setError(json.error || 'No se pudo guardar la decisión.'); if (json.borradorId) await cargar(); return; }
            await cargar(); onChanged?.();
        } finally { setOcupado(null); }
    };

    if (cargando && !datos) return <div className="text-[11px] text-stone-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Leyendo Grupo Óptico…</div>;
    if (!datos) return error ? <p className="text-[11px] text-rose-600">{error}</p> : null;

    const vivo = (pair: number) => datos.borradores.find(b => b.pair === pair && VIVOS.includes(b.status));
    const select = 'block mt-0.5 text-xs rounded border border-stone-300 bg-white dark:bg-stone-900 px-2 py-1.5';

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" /> Grupo Óptico · carga del pedido
                </h4>
                <button type="button" onClick={cargar} className="text-stone-400 hover:text-indigo-600" title="Actualizar">
                    <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {datos.espejo.length > 0 && (
                <ul className="space-y-1 mb-4">
                    {datos.espejo.map(p => (
                        <li key={p.portalNumber} className="flex items-center justify-between text-[11px] bg-white/70 dark:bg-black/20 rounded-lg px-3 py-2">
                            <span className="font-bold text-stone-800 dark:text-stone-200">Pedido {p.portalNumber}</span>
                            <span className="text-stone-600 dark:text-stone-400">{p.statusRaw || p.status}</span>
                            <span className="text-stone-400">visto {formatDate(p.lastSeenAt)}</span>
                        </li>
                    ))}
                </ul>
            )}

            {datos.pares.map(par => {
                const b = vivo(par.pair);
                const cerrados = datos.borradores.filter(x => x.pair === par.pair && !VIVOS.includes(x.status));
                const cargado = cerrados.find(x => x.status === 'CARGADO');
                const ultimo = cerrados[0];
                const mostrado = b || ultimo;
                return (
                    <div key={par.pair} className="border-t border-indigo-100 dark:border-indigo-900/40 pt-3 mt-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                                {datos.pares.length > 1 ? `Par ${par.pair}` : 'Pedido'}{par.producto ? ` · ${par.producto}` : ''}
                            </span>
                            {mostrado && (mostrado.status === 'APROBADO' && mostrado.error
                                ? <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded whitespace-nowrap bg-rose-100 text-rose-800">Aprobado · no se cargó</span>
                                : <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded whitespace-nowrap ${ESTADO[mostrado.status]?.clase}`}>{ESTADO[mostrado.status]?.texto}</span>)}
                        </div>

                        {cargado && !b && (
                            <div className="text-xs space-y-1">
                                <p className="text-emerald-700 dark:text-emerald-400 font-bold">Nº {cargado.portalNumber} · aprobado por {cargado.approvedBy}{cargado.loadedAt ? ` · ${formatDate(cargado.loadedAt)}` : ''}</p>
                                {(cargado.resumenPortal?.pdfUrl || cargado.screenshotFinalUrl) && (
                                    <a href={cargado.resumenPortal?.pdfUrl || cargado.screenshotFinalUrl || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300 underline font-bold">
                                        <FileText className="w-3.5 h-3.5" /> Ver el pedido del laboratorio (PDF)
                                    </a>
                                )}
                                {cargado.error && <p className="text-amber-800 dark:text-amber-400 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {cargado.error}</p>}
                            </div>
                        )}
                        {ultimo && !b && !cargado && ultimo.error && (
                            <p className="text-xs text-rose-700 dark:text-rose-400 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {ultimo.error}</p>
                        )}

                        {!b && !cargado && (
                            par.esperaPrimerPar ? (
                                <p className="text-xs text-stone-500">Es el 2º par del 2x1: se prepara cuando el 1er par esté cargado (lleva su nº en la observación, para que el laboratorio no lo cobre).</p>
                            ) : par.faltantes.length > 0 ? (
                                <div className="text-xs text-amber-800 dark:text-amber-400">
                                    <p className="font-bold">Para prepararlo falta, en la venta:</p>
                                    <ul className="list-disc pl-4">{par.faltantes.map(f => <li key={f}>{f}</li>)}</ul>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-end gap-2">
                                    <label className="text-[10px] text-stone-500">Tipo de armazón
                                        <select value={tipoArmazon[par.pair] || ''} onChange={e => setTipoArmazon(v => ({ ...v, [par.pair]: e.target.value }))} className={select}>
                                            <option value="">Elegir…</option>
                                            {datos.tiposArmazon.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </label>
                                    <label className="text-[10px] text-stone-500">Tipo de aro
                                        <select value={tipoAro[par.pair] || 'ENTERO'} onChange={e => setTipoAro(v => ({ ...v, [par.pair]: e.target.value }))} className={select}>
                                            {datos.tiposAro.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </label>
                                    <label className="text-[10px] text-stone-500">Forma (opcional)
                                        <select value={forma[par.pair] || ''} onChange={e => setForma(v => ({ ...v, [par.pair]: e.target.value }))} className={select}>
                                            <option value="">Sin forma</option>
                                            {Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>Forma {i + 1}</option>)}
                                        </select>
                                    </label>
                                    <button type="button" disabled={ocupado !== null || !tipoArmazon[par.pair]} onClick={() => preparar(par.pair)}
                                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-40">
                                        {ocupado === `preparar-${par.pair}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} Preparar en Grupo Óptico
                                    </button>
                                </div>
                            )
                        )}

                        {b?.status === 'PREPARADO' && <p className="text-xs text-stone-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> El robot está leyendo el portal y armando el pedido. Preparado por {b.preparedBy}.</p>}
                        {b?.status === 'APROBADO' && !b.error && <p className="text-xs text-stone-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Aprobado por {b.approvedBy}. El robot está creando el pedido en el laboratorio.</p>}
                        {b?.status === 'APROBADO' && b.error && (
                            <div className="text-xs text-rose-700 dark:text-rose-400 space-y-1">
                                <p className="flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {b.error}</p>
                                <button type="button" disabled={ocupado !== null} onClick={() => decidir(b.id, 'reintentar')}
                                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40">
                                    {ocupado === `reintentar-${b.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Reintentar la carga
                                </button>
                            </div>
                        )}
                        {b?.status === 'EN_REVISION' && (
                            <Revision borrador={b} ocupado={ocupado} motivo={motivo[b.id] || ''}
                                onMotivo={m => setMotivo(x => ({ ...x, [b.id]: m }))}
                                onAprobar={() => decidir(b.id, 'aprobar')} onRechazar={() => decidir(b.id, 'rechazar')} />
                        )}
                    </div>
                );
            })}

            {error && <p className="mt-3 text-xs text-rose-600 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {error}</p>}
        </div>
    );
}

/** Lo que se va a mandar, renglón por renglón, con los nombres del portal. Letra grande: se compara con la venta. */
function Revision({ borrador, ocupado, motivo, onMotivo, onAprobar, onRechazar }: {
    borrador: Borrador; ocupado: string | null; motivo: string;
    onMotivo: (m: string) => void; onAprobar: () => void; onRechazar: () => void;
}) {
    const e = borrador.resumenPortal?.etiquetas;
    const plan = borrador.payload?.plan;
    const avisos = borrador.payload?.avisos || [];
    const grad = (o: Ojo | null | undefined) => o ? `${o.esferico}${o.cilindrico ? ` ${o.cilindrico} × ${o.eje}°` : ''}${o.adicion ? ` · add +${o.adicion.toFixed(2)}` : ''}` : '—';
    const medidas = (o: Ojo | null | undefined) => o ? `DNP ${o.dnp ?? '—'} · altura ${o.altura ?? '—'}` : '';
    const fila = (titulo: string, valor: React.ReactNode, fuerte = false) => (
        <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1 border-b border-stone-100 dark:border-stone-800 last:border-0">
            <dt className="text-[11px] text-stone-500">{titulo}</dt>
            <dd className={`text-sm ${fuerte ? 'font-black text-stone-900 dark:text-white' : 'text-stone-800 dark:text-stone-200'}`}>{valor}</dd>
        </div>
    );
    return (
        <div className="space-y-2">
            <p className="text-xs text-stone-600 dark:text-stone-300">
                Esto es <strong>exactamente</strong> lo que se va a cargar en SmartLab. Comparalo con la venta: <strong>Aprobar crea el pedido en el laboratorio</strong> (después no se puede anular desde la óptica, solo pidiéndoselo a Grupo Óptico). Si algo no coincide, rechazá con el motivo y corregí la venta.
                {borrador.error ? <span className="block mt-1 text-rose-700 dark:text-rose-400">{borrador.error}</span> : null}
            </p>
            {avisos.length > 0 && (
                <div className="text-xs text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                    <p className="font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Mirá esto antes de aprobar:</p>
                    <ul className="list-disc pl-4">{avisos.map(a => <li key={a}>{a}</li>)}</ul>
                </div>
            )}
            <dl className="bg-white dark:bg-black/30 rounded-xl px-3 py-2 border border-indigo-100 dark:border-indigo-900/40">
                {fila('Vendido', plan?.producto ?? '—')}
                {fila('Artículo OD', e?.articuloOD ?? '—', true)}
                {fila('Artículo OI', e?.articuloOI ?? '—', true)}
                {fila('Tipo · material', `${e?.tipoLente ?? '—'} · ${e?.material ?? '—'} · ${e?.color ?? '—'}`)}
                {e?.tenido ? fila('Teñido', e.tenido, true) : null}
                {fila('Graduación OD', <>{grad(plan?.od)} <span className="text-[11px] text-stone-500">{medidas(plan?.od)}</span></>)}
                {fila('Graduación OI', <>{grad(plan?.oi)} <span className="text-[11px] text-stone-500">{medidas(plan?.oi)}</span></>)}
                {fila('Armazón', plan ? `${plan.armazon.tipo === 'METALICO' ? 'Metálico' : 'Plástico'} · ${e?.aro ?? ''} · A ${plan.armazon.a ?? '—'} B ${plan.armazon.b ?? '—'} ED ${plan.armazon.ed ?? '—'} Pte ${plan.armazon.puente ?? '—'}${plan.armazon.forma ? ` · forma ${plan.armazon.forma}` : ''}` : '—')}
                {fila('Modelo', plan?.armazon.modelo || '—')}
                {fila('Código interno', plan?.codigoOptica ?? '—')}
                {fila('Observación', plan?.observacion || '—')}
            </dl>
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={ocupado !== null} onClick={onAprobar}
                    className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-40">
                    {ocupado === `aprobar-${borrador.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Aprobar y cargar
                </button>
                <input value={motivo} onChange={ev => onMotivo(ev.target.value)} placeholder="Motivo del rechazo"
                    className="flex-1 min-w-[10rem] text-xs rounded border border-stone-300 bg-white dark:bg-stone-900 px-2 py-2" />
                <button type="button" disabled={ocupado !== null || !motivo.trim()} onClick={onRechazar}
                    className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-rose-600 text-white disabled:opacity-40">
                    <X className="w-3.5 h-3.5" /> Rechazar
                </button>
            </div>
        </div>
    );
}
