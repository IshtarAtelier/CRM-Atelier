'use client';

/**
 * Tabla de feriados con quién lo cubrió y quién no, desde que empezó Milena
 * (`DESDE_COBERTURA_FERIADOS`) hasta fin del año que viene. Por cada feriado,
 * una fila por persona del equipo con tres estados: Cubrió (con horario),
 * No vino, o Sin cargar. Solo un ADMIN edita; el resto la ve.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flag, Loader2, Check, X, Minus } from 'lucide-react';
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
const fmtHoras = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`;

export default function FeriadosCobertura({ esAdmin }: { esAdmin: boolean }) {
    const [feriados, setFeriados] = useState<Feriado[]>([]);
    const [coberturas, setCoberturas] = useState<Cobertura[]>([]);
    const [equipo, setEquipo] = useState<Persona[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mostrarFuturos, setMostrarFuturos] = useState(false);
    const hoyK = claveDia.format(new Date());
    const hasta = `${new Date().getFullYear() + 1}-12-31`;

    const cargar = useCallback(async () => {
        try {
            const r = await fetch(`/api/equipo/feriados?desde=${DESDE_COBERTURA_FERIADOS}&hasta=${hasta}`);
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            const d = await r.json();
            setFeriados(d.feriados); setCoberturas(d.coberturas); setEquipo(d.equipo);
        } catch (e: any) { setError(e.message); }
        finally { setCargando(false); }
    }, [hasta]);
    useEffect(() => { cargar(); }, [cargar]);

    const porClave = useMemo(() => {
        const m = new Map<string, Cobertura>();
        for (const c of coberturas) m.set(`${claveDia.format(new Date(c.fecha))}|${c.userId}`, c);
        return m;
    }, [coberturas]);

    const pasados = feriados.filter(f => f.fecha <= hoyK);
    const futuros = feriados.filter(f => f.fecha > hoyK);

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

    const Tabla = ({ lista }: { lista: Feriado[] }) => (
        <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {lista.map(f => {
                const sinCargar = f.fecha <= hoyK && equipo.some(p => !porClave.has(`${f.fecha}|${p.id}`));
                return (
                    <div key={f.fecha} className="p-3 sm:p-4">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                            <span className="font-mono text-sm text-stone-500">{formatDate(f.fecha + 'T12:00:00-03:00')}</span>
                            <span className="capitalize text-sm text-stone-600 dark:text-stone-300">{diaSemana(f.fecha)}</span>
                            <span className="font-black flex items-center gap-1.5"><Flag className="w-4 h-4 text-primary" aria-hidden />{f.nombre}</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${f.tipo === 'NO_LABORABLE' ? 'border-violet-400 text-violet-800 dark:text-violet-200' : 'border-sky-400 text-sky-800 dark:text-sky-200'}`}>
                                {f.tipo === 'NO_LABORABLE' ? 'No laborable' : 'Feriado'}
                            </span>
                            {sinCargar && <span className="text-xs text-amber-700 dark:text-amber-300 font-bold">Sin cargar quién cubrió</span>}
                        </div>
                        <table className="w-full text-sm">
                            <thead className="sr-only"><tr><th>Persona</th><th>Cubrió</th><th>Desde</th><th>Hasta</th><th>Total</th><th>Notas</th></tr></thead>
                            <tbody>
                                {equipo.map(p => (
                                    <FilaPersona key={p.id} persona={p} fecha={f.fecha} c={porClave.get(`${f.fecha}|${p.id}`)} esAdmin={esAdmin} onGuardar={guardar} onLimpiar={limpiar} />
                                ))}
                            </tbody>
                        </table>
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
            <Tabla lista={[...pasados].reverse()} />

            {futuros.length > 0 && (
                <div className="border-t border-stone-200 dark:border-stone-700">
                    <button onClick={() => setMostrarFuturos(v => !v)} className="w-full text-left p-3 sm:p-4 text-sm font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800">
                        {mostrarFuturos ? 'Ocultar' : 'Ver'} los que vienen ({futuros.length}) — el próximo: {futuros[0].nombre}, {formatDate(futuros[0].fecha + 'T12:00:00-03:00')}
                    </button>
                    {mostrarFuturos && <Tabla lista={futuros} />}
                </div>
            )}
        </section>
    );
}

function FilaPersona({ persona, fecha, c, esAdmin, onGuardar, onLimpiar }: {
    persona: Persona; fecha: string; c: Cobertura | undefined; esAdmin: boolean;
    onGuardar: (b: Record<string, unknown>) => Promise<void>; onLimpiar: (fecha: string, userId: string) => Promise<void>;
}) {
    const [desde, setDesde] = useState(c?.startTime ?? '');
    const [hasta, setHasta] = useState(c?.endTime ?? '');
    const [notas, setNotas] = useState(c?.notes ?? '');
    useEffect(() => { setDesde(c?.startTime ?? ''); setHasta(c?.endTime ?? ''); setNotas(c?.notes ?? ''); }, [c]);
    const total = horas(c?.startTime ?? null, c?.endTime ?? null);
    const sucio = c?.worked && (desde !== (c.startTime ?? '') || hasta !== (c.endTime ?? '') || notas !== (c.notes ?? ''));
    const estado = c === undefined ? 'sin cargar' : c.worked ? 'cubrió' : 'no vino';
    const input = 'rounded-md border border-stone-300 dark:border-stone-600 bg-transparent px-1.5 py-0.5 text-sm w-[5.5rem]';

    return (
        <tr className="align-middle">
            <td className="py-1 pr-2 font-bold whitespace-nowrap">{persona.name.split(' ')[0]}</td>
            <td className="py-1 pr-2">
                {esAdmin ? (
                    <span className="inline-flex rounded-lg border border-stone-300 dark:border-stone-600 overflow-hidden text-xs font-bold">
                        <button onClick={() => onGuardar({ fecha, userId: persona.id, worked: true, startTime: desde || null, endTime: hasta || null, notes: notas || null })}
                            className={`px-2 py-1 inline-flex items-center gap-1 ${c?.worked ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 dark:hover:bg-stone-800'}`} aria-pressed={!!c?.worked}><Check className="w-3 h-3" />Cubrió</button>
                        <button onClick={() => onGuardar({ fecha, userId: persona.id, worked: false, notes: notas || null })}
                            className={`px-2 py-1 inline-flex items-center gap-1 border-l border-stone-300 dark:border-stone-600 ${c && !c.worked ? 'bg-red-600 text-white' : 'hover:bg-stone-100 dark:hover:bg-stone-800'}`} aria-pressed={!!c && !c.worked}><X className="w-3 h-3" />No vino</button>
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
