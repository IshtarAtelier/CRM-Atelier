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
import { Flag, Loader2, Check, Minus, Plus } from 'lucide-react';
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
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
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
        <div className="space-y-3 p-3 sm:p-4">
            {lista.map(f => {
                const normal = f.tipo === 'NO_LABORABLE';
                const cargadas = equipo.filter(p => porClave.has(`${f.fecha}|${p.id}`)).length;
                const aviso = normal ? null
                    : cargadas === equipo.length ? null
                    : futuro ? (cargadas === 0 ? 'Sin programar' : 'Programado a medias')
                    : 'Falta cargar quién cubrió';
                const [, mm, dd] = f.fecha.split('-');
                return (
                    <article key={f.fecha} className={`rounded-xl border ${aviso && !futuro ? 'border-amber-300 dark:border-amber-800' : 'border-stone-200 dark:border-stone-700'} ${normal ? 'bg-stone-50 dark:bg-stone-950/40' : ''}`}>
                        <header className="flex items-center gap-3 p-3">
                            <div className="shrink-0 w-14 text-center rounded-xl py-1 bg-stone-100 dark:bg-stone-800">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">{diaSemana(f.fecha).slice(0, 3)}</span>
                                <span className="block text-xl font-black leading-none">{Number(dd)}</span>
                                <span className="block text-[10px] text-stone-500">{MESES_CORTOS[Number(mm) - 1]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black flex items-center gap-1.5"><Flag className="w-4 h-4 text-primary shrink-0" aria-hidden /><span className="truncate">{f.nombre}</span></p>
                                <p className="text-xs text-stone-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className={`font-bold px-2 py-0.5 rounded-full border ${ETIQUETA_TIPO[f.tipo ?? 'FERIADO'].clase}`}>{ETIQUETA_TIPO[f.tipo ?? 'FERIADO'].texto}</span>
                                    <span className="capitalize">{diaSemana(f.fecha)} {formatDate(f.fecha + 'T12:00:00-03:00')}</span>
                                </p>
                            </div>
                            {aviso && <span className={`text-xs font-bold px-2 py-1 rounded-lg ${futuro ? 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}>{aviso}</span>}
                        </header>
                        {normal ? (
                            <p className="px-3 pb-3 text-sm text-stone-700 dark:text-stone-300">
                                <Check className="inline w-4 h-4 text-emerald-600 mr-1" aria-hidden />
                                Se trabaja con normalidad: <strong>{equipo.map(p => p.name.split(' ')[0]).join(' y ') || 'todo el equipo'}</strong>, horario de siempre. No suma horas.
                            </p>
                        ) : (
                            <div className="divide-y divide-stone-100 dark:divide-stone-800 border-t border-stone-100 dark:border-stone-800">
                                {equipo.map(p => (
                                    <FilaPersona key={p.id} persona={p} fecha={f.fecha} c={porClave.get(`${f.fecha}|${p.id}`)} esAdmin={esAdmin} futuro={futuro} onGuardar={guardar} onLimpiar={limpiar} />
                                ))}
                            </div>
                        )}
                        <div className="px-3 pb-3 pt-2 flex flex-wrap items-center gap-1.5">
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
                    </article>
                );
            })}
        </div>
    );

    return (
        <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-lg font-black">Feriados: quién cubrió</h2>
                    <p className="text-xs text-stone-500">Desde el {formatDate(DESDE_COBERTURA_FERIADOS + 'T12:00:00-03:00')} (cuando empezó Milena). {esAdmin ? 'Tocá Cubrió en quien trabajó y cargá el horario. Los no laborables se trabajan normal y no suman horas.' : 'La carga un administrador.'}</p>
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
                <p className="text-xs text-stone-500">Los próximos {MESES_ADELANTE} meses. {esAdmin ? 'Marcá quién cubre y en qué horario. Los no laborables se trabajan normal y no se programan.' : 'Si necesitás algo para uno de estos días, pedilo con el botón de ese feriado.'}</p>
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
    // El que no trabaja el feriado se marca con un guion, no con "no vino":
    // no es una falta, simplemente no le tocó (Ishtar, 8/10/2026).
    const txtSi = futuro ? 'Cubre' : 'Cubrió';
    const estado = c === undefined ? (futuro ? 'sin programar' : 'sin cargar') : c.worked ? txtSi.toLowerCase() : '— —';
    const input = 'rounded-md border border-stone-300 dark:border-stone-600 bg-transparent px-1.5 py-0.5 text-sm w-[5.5rem]';

    const seg = (activo: boolean, colorActivo: string) => `px-3 py-1.5 inline-flex items-center gap-1 ${activo ? colorActivo : 'hover:bg-stone-100 dark:hover:bg-stone-800'}`;
    const guardarSi = () => onGuardar({ fecha, userId: persona.id, worked: true, startTime: desde || null, endTime: hasta || null, notes: notas || null });

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm">
            <span className="w-20 font-bold">{persona.name.split(' ')[0]}</span>
            {esAdmin ? (
                <span className="inline-flex rounded-lg border border-stone-300 dark:border-stone-600 overflow-hidden text-xs font-bold">
                    <button onClick={guardarSi} className={seg(!!c?.worked, 'bg-emerald-600 text-white')} aria-pressed={!!c?.worked}><Check className="w-3 h-3" />{txtSi}</button>
                    <button onClick={() => onGuardar({ fecha, userId: persona.id, worked: false, notes: notas || null })}
                        className={`${seg(!!c && !c.worked, 'bg-stone-600 text-white')} border-l border-stone-300 dark:border-stone-600`} aria-pressed={!!c && !c.worked} aria-label="No le toca" title="No le toca (no trabaja este feriado)"><span aria-hidden>— —</span></button>
                    <button onClick={() => onLimpiar(fecha, persona.id)} title="Volver a sin cargar"
                        className={`${seg(c === undefined, 'bg-stone-200 dark:bg-stone-700')} border-l border-stone-300 dark:border-stone-600`} aria-label="Sin cargar"><Minus className="w-3 h-3" /></button>
                </span>
            ) : (
                <span className={`text-xs font-bold ${c?.worked ? 'text-emerald-700 dark:text-emerald-300' : c ? 'text-stone-500' : 'text-stone-400'}`}>{estado}</span>
            )}
            {c?.worked && (<>
                <span className="inline-flex items-center gap-1.5">
                    {esAdmin ? <input type="time" value={desde} onChange={e => setDesde(e.target.value)} className={input} aria-label="Desde" /> : (c.startTime ?? '—')}
                    <span className="text-stone-400">a</span>
                    {esAdmin ? <input type="time" value={hasta} onChange={e => setHasta(e.target.value)} className={input} aria-label="Hasta" /> : (c.endTime ?? '—')}
                    <span className="tabular-nums font-bold whitespace-nowrap ml-1">{total !== null ? fmtHoras(total) : <span className="text-amber-700 dark:text-amber-300">sin horario</span>}</span>
                </span>
                {esAdmin ? <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="notas" maxLength={200} className="flex-1 min-w-[8rem] rounded-md border border-stone-300 dark:border-stone-600 bg-transparent px-1.5 py-0.5 text-sm" aria-label="Notas" /> : c.notes && <span className="text-xs text-stone-500">{c.notes}</span>}
                {sucio && <button onClick={guardarSi} className="text-xs font-bold px-2.5 py-1 rounded-md bg-primary text-white whitespace-nowrap">Guardar</button>}
            </>)}
            {c && !c.worked && c.notes && <span className="text-xs text-stone-500">{c.notes}</span>}
        </div>
    );
}
