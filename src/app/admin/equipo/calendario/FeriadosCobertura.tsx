'use client';

/**
 * Tabla de feriados con quién lo cubrió y quién no, desde que empezó Milena
 * (`DESDE_COBERTURA_FERIADOS`) hasta hoy, y aparte los PRÓXIMOS para dejar
 * programado quién cubre (Ishtar, 8/10/2026). Por cada feriado,
 * una fila por persona del equipo con tres estados: Cubrió (con horario),
 * No vino, o Sin cargar. Solo un ADMIN edita; el resto la ve. Debajo de cada
 * feriado se listan los pedidos del equipo para ese día (novedades de
 * /api/equipo/novedades) y un botón para anotar uno nuevo.
 *
 * Los NO LABORABLES (puentes) se trabajan con normalidad y van siempre con
 * todo el equipo (Ishtar, 10/10/2026): no se programan, no piden carga y no
 * suman horas a favor — son un día común.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { NOVEDAD_INFO, ESTADO_INFO, TIPO_QUE_DESCUENTA_FERIADO, TIPO_QUE_SUMA_HORAS, horasDeRango } from '@/lib/constants/novedades-equipo';
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

    // Los no laborables se trabajan normal: no entran en la cobertura ni en el saldo.
    const pasados = feriados.filter(f => f.fecha <= hoyK);
    const pasadosQueSeCubren = pasados.filter(f => f.tipo !== 'NO_LABORABLE');
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

    /**
     * Saldo adeudado por persona, EN HORAS (Ishtar, 8/10/2026: "se cubren
     * entre ellos siempre a las horas"): las horas de cada feriado cubierto
     * suman a favor; las horas de cada franco compensatorio aprobado (hasta
     * hoy) las descuentan; las horas extra (anotadas por un admin) suman.
     * Un vendedor ve solo su saldo (la API ya le da solo sus novedades).
     * Un feriado cubierto sin horario cargado suma cero,
     * y se avisa.
     */
    const totales = useMemo(() => equipo.map(p => {
        let cubiertos = 0, noVino = 0, hs = 0, sinHoras = 0, hsCompensadas = 0, hsExtra = 0;
        for (const f of pasadosQueSeCubren) {
            const c = porClave.get(`${f.fecha}|${p.id}`);
            if (!c) continue;
            if (c.worked) {
                cubiertos++;
                const h = horas(c.startTime, c.endTime);
                if (h === null) sinHoras++; else hs += h;
            } else noVino++;
        }
        for (const n of novedades) {
            if (n.userId !== p.id || claveDia.format(new Date(n.startsAt)) > hoyK) continue;
            // Solo lo APROBADO mueve el saldo: una hora extra pedida y todavía sin OK no cuenta.
            if (n.type === TIPO_QUE_SUMA_HORAS && n.status === 'APROBADO') hsExtra += horasDeRango(n.horario) ?? 0;
            if (n.type === TIPO_QUE_DESCUENTA_FERIADO && n.status === 'APROBADO') hsCompensadas += horasDeRango(n.horario) ?? 0;
        }
        return { ...p, cubiertos, noVino, hs, sinHoras, hsCompensadas, hsExtra, saldo: Math.round((hs + hsExtra - hsCompensadas) * 10) / 10 };
    }), [equipo, pasadosQueSeCubren, porClave, novedades, hoyK]);

    const Tabla = ({ lista, futuro }: { lista: Feriado[]; futuro: boolean }) => (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-stone-500 border-b border-stone-200 dark:border-stone-700">
                        <th className="py-2 pl-3 sm:pl-4 pr-2 font-bold">Fecha</th>
                        <th className="py-2 px-2 font-bold">Feriado</th>
                        <th className="py-2 px-2 font-bold">{futuro ? 'Cubre' : 'Cubrió'}</th>
                        <th className="py-2 px-2 font-bold">Horario</th>
                        <th className="py-2 px-2 font-bold">Notas y pedidos</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {lista.map(f => (
                        <FilaFeriado key={f.fecha} f={f} futuro={futuro} equipo={equipo} esAdmin={esAdmin}
                            coberturas={equipo.map(p => porClave.get(`${f.fecha}|${p.id}`))}
                            novedades={novedadesDe(f.fecha)} onGuardar={guardar} onLimpiar={limpiar}
                            onAnotar={() => onAnotar(f.fecha, 'PEDIDO_ESPECIAL')} onVerNovedad={onVerNovedad} />
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-lg font-black">Feriados: quién cubrió</h2>
                    <p className="text-xs text-stone-500">Desde el {formatDate(DESDE_COBERTURA_FERIADOS + 'T12:00:00-03:00')} (cuando empezó Milena). {esAdmin ? 'Elegí quién cubrió y cargá el horario. Los no laborables se trabajan normal y no suman horas.' : 'La carga un administrador.'}</p>
                </div>
                {cargando && <Loader2 className="w-4 h-4 animate-spin text-stone-400" />}
            </div>
            {error && <p className="p-4 text-red-700 dark:text-red-300 font-bold">No se pudo cargar: {error}</p>}

            {!cargando && totales.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 p-3 sm:p-4 border-b border-stone-100 dark:border-stone-800">
                    {totales.filter(t => esAdmin || t.id === yo.id).map(t => (
                        <div key={t.id} className="rounded-xl border border-stone-200 dark:border-stone-700 p-3">
                            <div className="flex items-baseline justify-between gap-2">
                                <strong className="text-base">{t.name.split(' ')[0]}</strong>
                                <span className={`text-sm font-black ${t.saldo > 0 ? 'text-amber-700 dark:text-amber-300' : t.saldo < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                                    {t.saldo > 0 ? `Se le deben ${fmtHoras(t.saldo)}` : t.saldo < 0 ? `Se tomó ${fmtHoras(-t.saldo)} de más` : 'Al día'}
                                </span>
                            </div>
                            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs text-stone-600 dark:text-stone-300">
                                <dt>Feriados cubiertos ({t.cubiertos})</dt><dd className="tabular-nums text-right">+ {fmtHoras(t.hs)}</dd>
                                <dt>Horas extra</dt><dd className="tabular-nums text-right">+ {fmtHoras(t.hsExtra)}</dd>
                                <dt>Francos que se tomó</dt><dd className="tabular-nums text-right">− {fmtHoras(t.hsCompensadas)}</dd>
                                <dt className="text-stone-500">Feriados que no le tocaron</dt><dd className="tabular-nums text-right text-stone-500">{t.noVino}</dd>
                            </dl>
                            {t.sinHoras > 0 && <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">{t.sinHoras} feriado{t.sinHoras === 1 ? '' : 's'} cubierto{t.sinHoras === 1 ? '' : 's'} sin horario: no suma</p>}
                        </div>
                    ))}
                </div>
            )}

            {!cargando && pasados.length === 0 && <p className="p-6 text-center text-sm text-stone-500">Todavía no pasó ningún feriado desde esa fecha.</p>}
            <Tabla lista={[...pasados].reverse()} futuro={false} />

            <div className="p-3 sm:p-4 border-t-4 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950/40">
                <h3 className="font-black">Próximos feriados: programar quién cubre</h3>
                <p className="text-xs text-stone-500">Los próximos {MESES_ADELANTE} meses. {esAdmin ? 'Elegí quién cubre y en qué horario. Los no laborables se trabajan normal y no se programan.' : 'Si necesitás algo para uno de estos días, pedilo con el + de ese feriado.'}</p>
            </div>
            {!cargando && proximos.length === 0 && <p className="p-6 text-center text-sm text-stone-500">No hay feriados en los próximos {MESES_ADELANTE} meses.</p>}
            <Tabla lista={proximos} futuro />

        </section>
    );
}

/**
 * Un renglón por feriado. Quién cubre se elige en UN selector (una persona,
 * "Ambos" o nadie cargado) y el horario es uno solo para quien cubre; por
 * debajo se sigue guardando una cobertura por persona (Ishtar, 10/10/2026:
 * "que se pueda seleccionar el nombre de uno y listo").
 */
function FilaFeriado({ f, futuro, equipo, esAdmin, coberturas, novedades, onGuardar, onLimpiar, onAnotar, onVerNovedad }: {
    f: Feriado; futuro: boolean; equipo: Persona[]; esAdmin: boolean; coberturas: (Cobertura | undefined)[];
    novedades: Novedad[]; onGuardar: (b: Record<string, unknown>) => Promise<void>; onLimpiar: (fecha: string, userId: string) => Promise<void>;
    onAnotar: () => void; onVerNovedad: (n: Novedad) => void;
}) {
    const normal = f.tipo === 'NO_LABORABLE';
    const cubren = equipo.filter((_, i) => coberturas[i]?.worked);
    const cargado = coberturas.some(Boolean);
    const valor = !cargado ? '' : cubren.length === equipo.length ? 'AMBOS' : cubren.length === 0 ? 'NADIE' : cubren[0].id;
    const ref = coberturas.find(c => c?.worked);
    const [desde, setDesde] = useState(ref?.startTime ?? '');
    const [hasta, setHasta] = useState(ref?.endTime ?? '');
    const [notas, setNotas] = useState(ref?.notes ?? coberturas.find(Boolean)?.notes ?? '');
    // Se resetea solo cuando cambia lo guardado (el array se arma nuevo en cada render).
    const guardado = JSON.stringify([ref?.startTime ?? '', ref?.endTime ?? '', ref?.notes ?? coberturas.find(Boolean)?.notes ?? '']);
    useEffect(() => {
        const [d, h, n] = JSON.parse(guardado) as string[];
        setDesde(d); setHasta(h); setNotas(n);
    }, [guardado]);
    const total = horas(ref?.startTime ?? null, ref?.endTime ?? null);
    const sucio = !!ref && (desde !== (ref.startTime ?? '') || hasta !== (ref.endTime ?? '') || notas !== (ref.notes ?? ''));

    /** Guarda la elección para todo el equipo: quien cubre con el horario, el resto "no le toca". */
    const aplicar = async (v: string, d = desde, h = hasta, n = notas) => {
        if (v === '') { for (const p of equipo) await onLimpiar(f.fecha, p.id); return; }
        for (const p of equipo) {
            const trabaja = v === 'AMBOS' || v === p.id;
            await onGuardar(trabaja
                ? { fecha: f.fecha, userId: p.id, worked: true, startTime: d || null, endTime: h || null, notes: n || null }
                : { fecha: f.fecha, userId: p.id, worked: false, notes: null });
        }
    };

    const [, mm, dd] = f.fecha.split('-');
    const nombres = (ps: Persona[]) => ps.map(p => p.name.split(' ')[0]).join(' y ');
    const textoQuien = valor === '' ? (futuro ? 'Sin programar' : 'Sin cargar') : valor === 'NADIE' ? 'Nadie' : valor === 'AMBOS' ? 'Ambos' : nombres(cubren);
    const pendiente = !normal && valor === '';
    const input = 'rounded-md border border-stone-300 dark:border-stone-600 bg-transparent px-1.5 py-0.5 text-sm w-[5rem]';

    return (
        <tr className={`align-middle ${normal ? 'bg-stone-50 dark:bg-stone-950/40' : ''}`}>
            <td className="py-2 pl-3 sm:pl-4 pr-2 whitespace-nowrap">
                <span className="font-black tabular-nums">{dd}/{mm}</span>{' '}
                <span className="text-xs text-stone-500 capitalize">{diaSemana(f.fecha).slice(0, 3)}</span>
            </td>
            <td className="py-2 px-2">
                <span className="font-bold">{f.nombre}</span>
                {f.tipo && f.tipo !== 'FERIADO' && <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${ETIQUETA_TIPO[f.tipo].clase}`}>{ETIQUETA_TIPO[f.tipo].texto}</span>}
            </td>
            <td className="py-2 px-2 whitespace-nowrap">
                {normal ? <span className="text-stone-600 dark:text-stone-300">Ambos <span className="text-xs text-stone-500">(día normal)</span></span>
                : esAdmin ? (
                    <select value={valor} onChange={e => aplicar(e.target.value)} aria-label={`Quién cubre ${f.nombre}`}
                        className={`rounded-md border px-1.5 py-1 text-sm font-bold bg-transparent ${pendiente ? (futuro ? 'border-stone-300 text-stone-500 dark:border-stone-600' : 'border-amber-400 text-amber-800 dark:text-amber-300') : 'border-stone-300 dark:border-stone-600'}`}>
                        <option value="">{futuro ? 'Sin programar' : 'Sin cargar'}</option>
                        {equipo.map(p => <option key={p.id} value={p.id}>{p.name.split(' ')[0]}</option>)}
                        {equipo.length > 1 && <option value="AMBOS">Ambos</option>}
                        <option value="NADIE">Nadie (cerrado)</option>
                    </select>
                ) : <span className={`font-bold ${pendiente && !futuro ? 'text-amber-700 dark:text-amber-300' : ''}`}>{textoQuien}</span>}
            </td>
            <td className="py-2 px-2 whitespace-nowrap">
                {normal ? <span className="text-xs text-stone-500">el de siempre · no suma</span>
                : ref ? (
                    <span className="inline-flex items-center gap-1.5">
                        {esAdmin ? <input type="time" value={desde} onChange={e => setDesde(e.target.value)} className={input} aria-label="Desde" /> : (ref.startTime ?? '—')}
                        <span className="text-stone-400">a</span>
                        {esAdmin ? <input type="time" value={hasta} onChange={e => setHasta(e.target.value)} className={input} aria-label="Hasta" /> : (ref.endTime ?? '—')}
                        <span className="tabular-nums font-bold ml-1">{total !== null ? fmtHoras(total) : <span className="text-amber-700 dark:text-amber-300 text-xs">sin horario</span>}</span>
                    </span>
                ) : <span className="text-stone-400">—</span>}
            </td>
            <td className="py-2 px-2 pr-3 sm:pr-4">
                <div className="flex flex-wrap items-center gap-1">
                    {!normal && esAdmin && ref && <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="notas" maxLength={200} className="w-24 flex-1 rounded-md border border-stone-300 dark:border-stone-600 bg-transparent px-1.5 py-0.5 text-sm" aria-label="Notas" />}
                    {!esAdmin && ref?.notes && <span className="text-xs text-stone-500">{ref.notes}</span>}
                    {sucio && <button onClick={() => aplicar(valor)} className="text-xs font-bold px-2 py-1 rounded-md bg-primary text-white">Guardar</button>}
                    {novedades.map(n => (
                        <button key={n.id} onClick={() => onVerNovedad(n)}
                            className={`text-xs px-1.5 py-0.5 rounded-md border ${NOVEDAD_INFO[n.type].clase} ${n.status === 'RECHAZADO' ? 'line-through opacity-60' : ''} ${n.status === 'PENDIENTE' ? 'border-dashed' : ''}`}
                            title={`${rangoNovedad(n)} · ${ESTADO_INFO[n.status].etiqueta}${n.notes ? ` — ${n.notes}` : ''}`}>
                            <strong>{n.user.name.split(' ')[0]}</strong>: {NOVEDAD_INFO[n.type].etiqueta.toLowerCase()}{n.status === 'PENDIENTE' ? ' (pend.)' : ''}
                        </button>
                    ))}
                    <button onClick={onAnotar} title="Alguien pidió algo para este día" aria-label="Alguien pidió algo para este día"
                        className="p-1 rounded-md border border-dashed border-stone-300 text-stone-500 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"><Plus className="w-3 h-3" /></button>
                </div>
            </td>
        </tr>
    );
}
