'use client';

/**
 * Solapa "Vacaciones" (Ishtar, 15/10/2026): fecha de ingreso, antigüedad y
 * los períodos de 14 días por año de cada persona, y un calendario donde se
 * marcan las fechas elegidas tocando el primer y el último día. Las vacaciones
 * son novedades tipo VACACIONES (mismo flujo: el vendedor las pide y quedan
 * pendientes; un admin las carga aprobadas). La cuenta vive en
 * src/lib/vacaciones.ts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Palmtree, X } from 'lucide-react';
import { INGRESOS_EQUIPO } from '@/lib/constants/equipo-ingresos';
import { periodosVacaciones, antiguedad, diasCorridos, sumar, type VacacionRango } from '@/lib/vacaciones';
import { formatDate } from '@/lib/format-date';
import type { Novedad, Persona, Yo } from './CalendarioClient';

const TZ = 'America/Argentina/Cordoba';
const claveDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fecha = (k: string) => formatDate(`${k}T12:00:00-03:00`);
const pad = (n: number) => String(n).padStart(2, '0');
/** Un color por persona, en el orden del equipo: el color refuerza, el nombre va escrito en la leyenda. */
const COLORES = [
    { lleno: 'bg-sky-600 text-white', suave: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100', punto: 'bg-sky-600' },
    { lleno: 'bg-rose-600 text-white', suave: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100', punto: 'bg-rose-600' },
    { lleno: 'bg-emerald-600 text-white', suave: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100', punto: 'bg-emerald-600' },
];

export default function Vacaciones({ yo, version, onGuardado, onVerNovedad }: {
    yo: Yo; version: number; onGuardado: () => void; onVerNovedad: (n: Novedad) => void;
}) {
    const hoy = claveDia.format(new Date());
    const [equipo, setEquipo] = useState<Persona[]>([]);
    const [novedades, setNovedades] = useState<Novedad[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Mes desde el que se muestran los 6 del calendario.
    const [inicio, setInicio] = useState(() => hoy.slice(0, 7));
    const [para, setPara] = useState<string>('');
    const [sel, setSel] = useState<{ desde: string; hasta?: string } | null>(null);
    const [notas, setNotas] = useState('');
    const [guardando, setGuardando] = useState(false);

    const desdeTodo = useMemo(() => Object.values(INGRESOS_EQUIPO).map(i => i.ingreso).sort()[0] ?? hoy, [hoy]);
    const cargar = useCallback(async () => {
        try {
            const r = await fetch(`/api/equipo/novedades?desde=${desdeTodo}&hasta=${sumar(hoy, { anios: 2 })}`);
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            const d = await r.json();
            setEquipo(d.equipo); setNovedades(d.novedades.filter((n: Novedad) => n.type === 'VACACIONES'));
        } catch (e: any) { setError(e.message); }
        finally { setCargando(false); }
    }, [desdeTodo, hoy]);
    useEffect(() => { cargar(); }, [cargar, version]);

    // Solo la gente con ingreso cargado; un vendedor ve solo lo suyo.
    const personas = equipo.filter(p => INGRESOS_EQUIPO[p.id] && (yo.esAdmin || p.id === yo.id));
    useEffect(() => { if (!para && personas.length) setPara(yo.esAdmin ? personas[0].id : yo.id); }, [personas, para, yo]);
    const color = (id: string) => COLORES[Math.max(0, personas.findIndex(p => p.id === id)) % COLORES.length];

    const rangoDe = (n: Novedad): VacacionRango => ({ desde: claveDia.format(new Date(n.startsAt)), hasta: claveDia.format(new Date(n.endsAt)), status: n.status });
    const vivas = novedades.filter(n => n.status !== 'RECHAZADO');

    /** Día → vacaciones que lo tocan. */
    const porDia = useMemo(() => {
        const m = new Map<string, Novedad[]>();
        for (const n of vivas) {
            const r = rangoDe(n);
            for (let k = r.desde; k <= r.hasta; k = sumar(k, { dias: 1 })) m.set(k, [...(m.get(k) ?? []), n]);
        }
        return m;
    }, [novedades]);

    const tocar = (k: string) => {
        const ya = porDia.get(k)?.find(n => !para || n.userId === para);
        if (!sel && ya) { onVerNovedad(ya); return; }
        if (!sel || sel.hasta) { setSel({ desde: k }); return; }
        setSel(k < sel.desde ? { desde: k, hasta: sel.desde } : { desde: sel.desde, hasta: k });
    };
    const enSel = (k: string) => !!sel && k >= sel.desde && k <= (sel.hasta ?? sel.desde);

    const guardar = async () => {
        if (!sel?.hasta || !para) return;
        setGuardando(true);
        try {
            const r = await fetch('/api/equipo/novedades', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: para, type: 'VACACIONES', desde: sel.desde, hasta: sel.hasta, notes: notas || null }),
            });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            setSel(null); setNotas(''); onGuardado(); cargar();
        } catch (e: any) { alert(e.message); }
        finally { setGuardando(false); }
    };

    const meses = Array.from({ length: 6 }, (_, i) => {
        const [a, m] = inicio.split('-').map(Number);
        const d = new Date(Date.UTC(a, m - 1 + i, 1));
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
    });
    const moverMeses = (n: number) => { const [a, m] = inicio.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); setInicio(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`); };
    const nombre = (id: string) => personas.find(p => p.id === id)?.name.split(' ')[0] ?? '';
    const diasSel = sel ? diasCorridos(sel.desde, sel.hasta ?? sel.desde) : 0;
    const periodoParaSel = para && sel ? periodosVacaciones(INGRESOS_EQUIPO[para], novedades.filter(n => n.userId === para).map(rangoDe), hoy).find(p => p.desde <= sel.desde && sel.desde <= p.hasta) : undefined;

    return (
        <div className="space-y-5">
            {error && <p className="text-red-700 dark:text-red-300 font-bold">No se pudo cargar: {error}</p>}
            {cargando && <Loader2 className="w-5 h-5 animate-spin text-stone-400" />}

            {/* Una tarjeta por persona */}
            <div className="grid gap-3 sm:grid-cols-2">
                {personas.map(p => {
                    const dato = INGRESOS_EQUIPO[p.id];
                    const periodos = periodosVacaciones(dato, novedades.filter(n => n.userId === p.id).map(rangoDe), hoy);
                    const actual = periodos.find(x => x.actual);
                    return (
                        <section key={p.id} className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
                            <div className="flex items-baseline justify-between gap-2">
                                <h3 className="text-lg font-black flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${color(p.id).punto}`} aria-hidden />{p.name.split(' ')[0]}</h3>
                                {actual && <span className={`text-sm font-black ${actual.restantes > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-500'}`}>{actual.restantes > 0 ? `Le quedan ${actual.restantes} días` : 'Sin días disponibles'}</span>}
                            </div>
                            <p className="text-xs text-stone-500 mt-0.5">Ingresó el {fecha(dato.ingreso)} · {antiguedad(dato.ingreso, hoy)}</p>
                            <table className="w-full text-xs mt-3">
                                <thead><tr className="text-left text-stone-500 uppercase tracking-wider text-[10px]"><th className="py-1 font-bold">Período</th><th className="py-1 font-bold text-right">Tomó</th><th className="py-1 font-bold text-right">Pedidos</th><th className="py-1 font-bold text-right">Quedan</th></tr></thead>
                                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                                    {periodos.map(x => (
                                        <tr key={x.desde} className={x.actual ? 'font-bold' : x.futuro ? 'text-stone-500' : ''}>
                                            <td className="py-1.5">{fecha(x.desde)} al {fecha(x.hasta)}{x.actual && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-white">actual</span>}</td>
                                            <td className="py-1.5 text-right tabular-nums">{x.tomados} de {x.dias}</td>
                                            <td className="py-1.5 text-right tabular-nums">{x.pendientes || '—'}</td>
                                            <td className="py-1.5 text-right tabular-nums">{x.restantes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    );
                })}
            </div>

            {/* Calendario */}
            <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-stone-200 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black flex items-center gap-2"><Palmtree className="w-5 h-5 text-primary" /> Elegir vacaciones</h2>
                        {yo.esAdmin ? (
                            <select value={para} onChange={e => { setPara(e.target.value); setSel(null); }} className="text-sm rounded-lg border border-stone-300 dark:border-stone-600 bg-transparent px-2 py-1.5 font-bold" aria-label="Para quién">
                                {personas.map(p => <option key={p.id} value={p.id}>{p.name.split(' ')[0]}</option>)}
                            </select>
                        ) : <span className="text-sm font-bold">{nombre(yo.id)}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => moverMeses(-3)} aria-label="Meses anteriores" className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"><ChevronLeft className="w-5 h-5" /></button>
                        <button onClick={() => setInicio(hoy.slice(0, 7))} className="text-xs font-bold px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-600">Hoy</button>
                        <button onClick={() => moverMeses(3)} aria-label="Meses siguientes" className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className={`px-3 py-2 text-sm border-b border-stone-100 dark:border-stone-800 ${sel ? 'bg-amber-50 dark:bg-amber-950/40' : ''}`}>
                    {!sel && <span className="text-stone-600 dark:text-stone-300">Tocá el <strong>primer día</strong> y después el <strong>último</strong>. Tocá unas vacaciones ya cargadas para verlas, aprobarlas o borrarlas.</span>}
                    {sel && !sel.hasta && <span>Desde el <strong>{fecha(sel.desde)}</strong>. Ahora tocá el último día.</span>}
                    {sel?.hasta && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span><strong>{nombre(para)}</strong>: del {fecha(sel.desde)} al {fecha(sel.hasta)} · <strong>{diasSel} día{diasSel === 1 ? '' : 's'}</strong></span>
                            {periodoParaSel && <span className={`text-xs font-bold ${diasSel > periodoParaSel.restantes ? 'text-red-700 dark:text-red-300' : 'text-stone-500'}`}>({diasSel > periodoParaSel.restantes ? `se pasa: le quedan ${periodoParaSel.restantes}` : `le quedarían ${periodoParaSel.restantes - diasSel}`} en el período)</span>}
                            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="notas (opcional)" maxLength={200} className="flex-1 min-w-[8rem] rounded-md border border-stone-300 dark:border-stone-600 bg-transparent px-2 py-1 text-sm" />
                            <button onClick={guardar} disabled={guardando} className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-60">{guardando ? 'Guardando…' : yo.esAdmin ? 'Guardar' : 'Pedir'}</button>
                        </div>
                    )}
                    {sel && <button onClick={() => setSel(null)} className="ml-2 text-xs underline text-stone-500 inline-flex items-center gap-0.5"><X className="w-3 h-3" />Cancelar</button>}
                </div>

                <div className="grid gap-4 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    {meses.map(ym => {
                        const [a, m] = ym.split('-').map(Number);
                        const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
                        const blanco = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7;
                        return (
                            <div key={ym}>
                                <h3 className="text-sm font-black mb-1">{(t => t[0].toUpperCase() + t.slice(1))(fmtMes.format(new Date(Date.UTC(a, m - 1, 15))))}</h3>
                                <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-stone-500 mb-0.5">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}</div>
                                <div className="grid grid-cols-7 gap-0.5">
                                    {Array.from({ length: blanco }, (_, i) => <span key={`b${i}`} />)}
                                    {Array.from({ length: dias }, (_, i) => {
                                        const k = `${ym}-${pad(i + 1)}`;
                                        const quien = porDia.get(k) ?? [];
                                        const domingo = (blanco + i) % 7 === 6;
                                        const n = quien[0];
                                        const c = n ? color(n.userId) : null;
                                        return (
                                            <button key={k} onClick={() => tocar(k)}
                                                title={quien.map(q => `${nombre(q.userId)}: vacaciones${q.status === 'PENDIENTE' ? ' (pendiente de OK)' : ''}`).join(' · ') || undefined}
                                                className={`relative h-8 rounded text-xs tabular-nums
                                                    ${enSel(k) ? 'bg-amber-400 text-stone-900 font-black' : c ? (n.status === 'PENDIENTE' ? `${c.suave} border border-dashed border-current` : `${c.lleno} font-bold`) : domingo ? 'text-stone-400' : 'hover:bg-stone-100 dark:hover:bg-stone-800'}
                                                    ${k === hoy ? 'ring-2 ring-primary' : ''}`}>
                                                {i + 1}
                                                {quien.length > 1 && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-white" aria-hidden />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex flex-wrap gap-3 px-3 pb-3 text-xs text-stone-600 dark:text-stone-300">
                    {personas.map(p => <span key={p.id} className="inline-flex items-center gap-1"><span className={`w-3 h-3 rounded ${color(p.id).punto}`} aria-hidden />{p.name.split(' ')[0]}</span>)}
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded border border-dashed border-stone-500" aria-hidden />pendiente de OK</span>
                    <span>Se cuentan días corridos.</span>
                </div>
            </section>
        </div>
    );
}
