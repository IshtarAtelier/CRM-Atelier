'use client';

/**
 * Tabla de feriados con quién lo cubrió y quién no, desde que empezó Milena
 * (`DESDE_COBERTURA_FERIADOS`) hasta hoy, y aparte los PRÓXIMOS para dejar
 * programado quién cubre (Ishtar, 8/10/2026). Por cada feriado,
 * una fila por persona del equipo con tres estados: Cubrió (con horario),
 * No vino, o Sin cargar. Solo un ADMIN edita; el resto la ve. Debajo de cada
 * feriado se listan los pedidos del equipo para ese día (novedades de
 * /api/equipo/novedades) y un botón para anotar uno nuevo.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flag, Loader2, Check, X, Minus, Plus } from 'lucide-react';
import { NOVEDAD_INFO, ESTADO_INFO } from '@/lib/constants/novedades-equipo';
import { rangoNovedad, type Novedad, type Yo } from './CalendarioClient';
import { formatDate } from '@/lib/format-date';
import { DESDE_COBERTURA_FERIADOS, type Feriado } from '@/lib/constants/feriados-argentina';

interface Persona { id: string; name: string }
interface Cobertura {
    id: string; fecha: string; userId: string; worked: boolean;
    startTime: string | null; endTime: string | null; notes: string | null; createdByName: string;
}

const TZ = 'America/Argentina/Cordoba';
const claveDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtDiaSemana = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'long' });
const diaSemana = (k: string) => fmtDiaSemana.format(new Date(`${k}T12:00:00-03:00`));

/** "09:00"→"20:00" = 11 h. Devuelve null si falta una punta. */
function horas(desde: string | null, hasta: string | null): number | null {
    if (!desde || !hasta) return null;
    const [h1, m1] = desde.split(':').map(Number), [h2, m2] = hasta.split(':').map(Number);
    return Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 6) / 10;
}
const ETIQUETA_TIPO = {
    FERIADO:            { texto: 'Feriado',               clase: 'border-sky-400 text-sky-800 dark:text-sky-200' },
    NO_LABORABLE:       { texto: 'No laborable',          clase: 'border-violet-400 text-violet-800 dark:text-violet-200' },
    EMPLEADOS_COMERCIO: { texto: 'Empleados de comercio', clase: 'border-orange-400 text-orange-800 dark:text-orange-200' },
} as const;
const fmtHoras = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`;

/** Hasta cuántos meses adelante se muestran los próximos feriados. */
const MESES_ADELANTE = 6;

export default function FeriadosCobertura({ yo, version, onAnotar, onVerNovedad }: {
    yo: Yo; version: number; onAnotar: (dia: string, tipo: 'PEDIDO_ESPECIAL') => void; onVerNovedad: (n: Novedad) => void;
}) {
    const esAdmin = yo.esAdmin;
    const [feriados, setFeriados] = useState<Feriado[]>([]);
    const [coberturas, setCoberturas] = useState<Cobertura[]>([]);
    const [equipo, setEquipo] = useState<Persona[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [novedades, setNovedades] = useState<Novedad[]>([]);
    const hoyK = claveDia.format(new Date());
    const hasta = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + MESES_ADELANTE); return claveDia.format(d); }, []);

    const cargar = useCallback(async () => {
        try {
            const [r, rn] = await Promise.all([
                fetch(`/api/equipo/feriados?desde=${DESDE_COBERTURA_FERIADOS}&hasta=${hasta}`),
                fetch(`/api/equipo/novedades?desde=${DESDE_COBERTURA_FERIADOS}&hasta=${hasta}`),
            ]);
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            const d = await r.json();
            setFeriados(d.feriados); setCoberturas(d.coberturas); setEquipo(d.equipo);
            if (rn.ok) setNovedades((await rn.json()).novedades);
        } catch (e: any) { setError(e.message); }
        finally { setCargando(false); }
    }, [hasta]);
    useEffect(() => { cargar(); }, [cargar, version]);

    const porClave = useMemo(() => {
        const m = new Map<string, Cobertura>();
        for (const c of coberturas) m.set(`${claveDia.format(new Date(c.fecha))}|${c.userId}`, c);
        return m;
    }, [coberturas]);

    const pasados = feriados.filter(f => f.fecha <= hoyK);
    const proximos = feriados.filter(f => f.fecha > hoyK);
    /** Las novedades (pedidos, francos, etc.) que tocan un día dado. */
    const novedadesDe = (k: string) => novedades.filter(n => claveDia.format(new Date(n.startsAt)) <= k && claveDia.format(new Date(n.endsAt)) >= k);

    const guardar = async (body: Record<string, unknown>) => {
        const r = await fetch('/api/equipo/feriados', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) { alert((await r.json().catch(() => ({}))).error || 'No se pudo'); return; }
        cargar();
    };
    const limpiar = async (fecha: string, userId: string) => {
        const r = await fetch(`/api/equipo/feriados?fecha=${fecha}&userId=${userId}`, { method: 'DELETE' });
        if (!r.ok) { alert('No se pudo'); return; }
        cargar();
    };

    /** Totales desde que arrancó la cobertura: feriados cubiertos y horas por persona. */
    const totales = useMemo(() => equipo.map(p => {
        let cubiertos = 0, noVino = 0, hs = 0;
        for (const f of pasados) {
            const c = porClave.get(`${f.fecha}|${p.id}`);
            if (!c) continue;
            if (c.worked) { cubiertos++; hs += horas(c.startTime, c.endTime) ?? 0; } else noVino++;
        }
        return { ...p, cubiertos, noVino, hs };
    }), [equipo, pasados, porClave]);

    const Tabla = ({ lista, futuro }: { lista: Feriado[]; futuro: boolean }) => (
        <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {lista.map(f => {
                const sinCargar = !futuro && equipo.some(p => !porClave.has(`${f.fecha}|${p.id}`));
                return (
                    <div key={f.fecha} className="p-3 sm:p-4">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                            <span className="font-mono text-sm text-stone-500">{formatDate(f.fecha + 'T12:00:00-03:00')}</span>
                            <span className="capitalize text-sm text-stone-600 dark:text-stone-300">{diaSemana(f.fecha)}</span>
                            <span className="font-black flex items-center gap-1.5"><Flag className="w-4 h-4 text-primary" aria-hidden />{f.nombre}</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ETIQUETA_TIPO[f.tipo ?? 'FERIADO'].clase}`}>
                                {ETIQUETA_TIPO[f.tipo ?? 'FERIADO'].texto}
                            </span>
                            {sinCargar && <span className="text-xs text-amber-700 dark:text-amber-300 font-bold">Sin cargar quién cubrió</span>}
                            {futuro && equipo.every(p => !porClave.has(`${f.fecha}|${p.id}`)) && <span className="text-xs text-stone-500">Sin programar</span>}
                        </div>
                        <table className="w-full text-sm">
                            <thead className="sr-only"><tr><th>Persona</th><th>Cubrió</th><th>Desde</th><th>Hasta</th><th>Total</th><th>Notas</th></tr></thead>
                            <tbody>
                                {equipo.map(p => (
                                    <FilaPersona key={p.id} persona={p} fecha={f.fecha} c={porClave.get(`${f.fecha}|${p.id}`)} esAdmin={esAdmin} futuro={futuro} onGuardar={guardar} onLimpiar={limpiar} />
                                ))}
                            </tbody>
                        </table>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {novedadesDe(f.fecha).map(n => (
                                <button key={n.id} onClick={() => onVerNovedad(n)}
                                    className={`text-xs px-2 py-1 rounded-lg border ${NOVEDAD_INFO[n.type].clase} ${n.status === 'RECHAZADO' ? 'line-through opacity-60' : ''} ${n.status === 'PENDIENTE' ? 'border-dashed' : ''}`}
                                    title={`${rangoNovedad(n)} · ${ESTADO_INFO[n.status].etiqueta}`}>
                                    <strong>{n.user.name.split(' ')[0]}</strong> pidió: {NOVEDAD_INFO[n.type].etiqueta.toLowerCase()}{n.notes ? ` — ${n.notes}` : ''}{n.status === 'PENDIENTE' ? ' (pendiente de OK)' : ''}
                                </button>
                            ))}
                            <button onClick={() => onAnotar(f.fecha, 'PEDIDO_ESPECIAL')} className="text-xs font-bold px-2 py-1 rounded-lg border border-dashed border-stone-400 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Alguien pidió algo para este día
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-lg font-black">Feriados: quién cubrió</h2>
                    <p className="text-xs text-stone-500">Desde el {formatDate(DESDE_COBERTURA_FERIADOS + 'T12:00:00-03:00')} (cuando empezó Milena). {esAdmin ? 'Tocá Cubrió / No vino en cada persona y cargá el horario.' : 'La carga un administrador.'}</p>
                </div>
                {cargando && <Loader2 className="w-4 h-4 animate-spin text-stone-400" />}
            </div>
            {error && <p className="p-4 text-red-700 dark:text-red-300 font-bold">No se pudo cargar: {error}</p>}

            {!cargando && totales.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 sm:p-4 border-b border-stone-100 dark:border-stone-800 text-xs">
                    {totales.map(t => (
                        <span key={t.id} className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800">
                            <strong>{t.name}</strong>: cubrió {t.cubiertos}{t.hs ? ` (${fmtHoras(t.hs)})` : ''} · no vino {t.noVino}
                        </span>
                    ))}
                </div>
            )}

            {!cargando && pasados.length === 0 && <p className="p-6 text-center text-sm text-stone-500">Todavía no pasó ningún feriado desde esa fecha.</p>}
            <Tabla lista={[...pasados].reverse()} futuro={false} />

            <div className="p-3 sm:p-4 border-t-4 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950/40">
                <h3 className="font-black">Próximos feriados: programar quién cubre</h3>
                <p className="text-xs text-stone-500">Los próximos {MESES_ADELANTE} meses. {esAdmin ? 'Marcá quién cubre y en qué horario, y quién no viene.' : 'Si necesitás algo para uno de estos días, pedilo con el botón de ese feriado.'}</p>
            </div>
            {!cargando && proximos.length === 0 && <p className="p-6 text-center text-sm text-stone-500">No hay feriados en los próximos {MESES_ADELANTE} meses.</p>}
            <Tabla lista={proximos} futuro />

        </section>
    );
}

function FilaPersona({ persona, fecha, c, esAdmin, futuro, onGuardar, onLimpiar }: {
    persona: Persona; fecha: string; c: Cobertura | undefined; esAdmin: boolean; futuro: boolean;
    onGuardar: (b: Record<string, unknown>) => Promise<void>; onLimpiar: (fecha: string, userId: string) => Promise<void>;
}) {
    const [desde, setDesde] = useState(c?.startTime ?? '');
    const [hasta, setHasta] = useState(c?.endTime ?? '');
    const [notas, setNotas] = useState(c?.notes ?? '');
    useEffect(() => { setDesde(c?.startTime ?? ''); setHasta(c?.endTime ?? ''); setNotas(c?.notes ?? ''); }, [c]);
    const total = horas(c?.startTime ?? null, c?.endTime ?? null);
    const sucio = c?.worked && (desde !== (c.startTime ?? '') || hasta !== (c.endTime ?? '') || notas !== (c.notes ?? ''));
    const [txtSi, txtNo] = futuro ? ['Cubre', 'No viene'] : ['Cubrió', 'No vino'];
    const estado = c === undefined ? (futuro ? 'sin programar' : 'sin cargar') : c.worked ? txtSi.toLowerCase() : txtNo.toLowerCase();
    const input = 'rounded-md border border-stone-300 dark:border-stone-600 bg-transparent px-1.5 py-0.5 text-sm w-[5.5rem]';

    return (
        <tr className="align-middle">
            <td className="py-1 pr-2 font-bold whitespace-nowrap">{persona.name.split(' ')[0]}</td>
            <td className="py-1 pr-2">
                {esAdmin ? (
                    <span className="inline-flex rounded-lg border border-stone-300 dark:border-stone-600 overflow-hidden text-xs font-bold">
                        <button onClick={() => onGuardar({ fecha, userId: persona.id, worked: true, startTime: desde || null, endTime: hasta || null, notes: notas || null })}
                            className={`px-2 py-1 inline-flex items-center gap-1 ${c?.worked ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 dark:hover:bg-stone-800'}`} aria-pressed={!!c?.worked}><Check className="w-3 h-3" />{txtSi}</button>
                        <button onClick={() => onGuardar({ fecha, userId: persona.id, worked: false, notes: notas || null })}
                            className={`px-2 py-1 inline-flex items-center gap-1 border-l border-stone-300 dark:border-stone-600 ${c && !c.worked ? 'bg-red-600 text-white' : 'hover:bg-stone-100 dark:hover:bg-stone-800'}`} aria-pressed={!!c && !c.worked}><X className="w-3 h-3" />{txtNo}</button>
                        <button onClick={() => onLimpiar(fecha, persona.id)} title="Volver a sin cargar"
                            className={`px-2 py-1 border-l border-stone-300 dark:border-stone-600 ${c === undefined ? 'bg-stone-200 dark:bg-stone-700' : 'hover:bg-stone-100 dark:hover:bg-stone-800'}`} aria-label="Sin cargar"><Minus className="w-3 h-3" /></button>
                    </span>
                ) : (
                    <span className={`text-xs font-bold ${c?.worked ? 'text-emerald-700 dark:text-emerald-300' : c ? 'text-red-700 dark:text-red-300' : 'text-stone-400'}`}>{estado}</span>
                )}
            </td>
            {c?.worked ? (<>
                <td className="py-1 pr-2">{esAdmin ? <input type="time" value={desde} onChange={e => setDesde(e.target.value)} className={input} aria-label="Desde" /> : (c.startTime ?? '—')}</td>
                <td className="py-1 pr-2">{esAdmin ? <input type="time" value={hasta} onChange={e => setHasta(e.target.value)} className={input} aria-label="Hasta" /> : (c.endTime ?? '—')}</td>
                <td className="py-1 pr-2 tabular-nums whitespace-nowrap">{total !== null ? fmtHoras(total) : '—'}</td>
                <td className="py-1 w-full">
                    <div className="flex items-center gap-1">
                        {esAdmin ? <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="notas" maxLength={200} className="rounded-md border border-stone-300 dark:border-stone-600 bg-transparent px-1.5 py-0.5 text-sm w-full min-w-[6rem]" aria-label="Notas" /> : <span className="text-xs text-stone-500">{c.notes}</span>}
                        {sucio && <button onClick={() => onGuardar({ fecha, userId: persona.id, worked: true, startTime: desde || null, endTime: hasta || null, notes: notas || null })} className="text-xs font-bold px-2 py-1 rounded-md bg-primary text-white whitespace-nowrap">Guardar</button>}
                    </div>
                </td>
            </>) : (
                <td colSpan={4} className="py-1 text-xs text-stone-500">{c?.notes ?? ''}</td>
            )}
        </tr>
    );
}
