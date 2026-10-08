'use client';

/**
 * Calendario compartido del equipo: faltas, llegadas tarde, francos,
 * vacaciones, cambios de turno y pedidos especiales, de TODOS, en una grilla
 * mensual. Todo el mundo ve todo; quién puede anotar qué lo decide el service
 * (src/services/team-events.service.ts) y acá solo se esconden los botones que
 * igual fallarían.
 *
 * Accesibilidad: cada chip lleva el nombre y el tipo escritos (el color es un
 * refuerzo), y el estado "pendiente" se dice con texto, no solo con opacidad.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Loader2, CalendarDays } from 'lucide-react';
import { formatDate } from '@/lib/format-date';
import {
    TIPOS_NOVEDAD, TIPOS_QUE_SE_PIDEN, TIPOS_SOLO_ADMIN, NOVEDAD_INFO, ESTADO_INFO,
    type TipoNovedad, type EstadoNovedad,
} from '@/lib/constants/novedades-equipo';

interface Persona { id: string; name: string; role?: string }
interface Novedad {
    id: string; userId: string; type: TipoNovedad; startsAt: string; endsAt: string;
    horario: string | null; status: EstadoNovedad; justificada: boolean | null;
    swapWithUserId: string | null; notes: string | null; createdByName: string;
    decidedByName: string | null; decidedAt: string | null; createdAt: string;
    user: Persona; swapWith: Persona | null;
}
interface Yo { id: string; nombre: string; esAdmin: boolean }

const TZ = 'America/Argentina/Cordoba';
const claveDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtMes = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, month: 'long', year: 'numeric' });
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const pad = (n: number) => String(n).padStart(2, '0');
const clave = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const hoyClave = () => claveDia.format(new Date());

/** Los días de la grilla del mes (lunes a domingo, con los bordes del mes vecino). */
function diasDelMes(y: number, m: number) {
    const primero = new Date(y, m, 1);
    const desplazamiento = (primero.getDay() + 6) % 7; // lunes = 0
    const inicio = new Date(y, m, 1 - desplazamiento);
    const celdas: { clave: string; dia: number; delMes: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
        celdas.push({ clave: clave(d.getFullYear(), d.getMonth(), d.getDate()), dia: d.getDate(), delMes: d.getMonth() === m });
        if (i >= 34 && d.getMonth() !== m && d.getDay() === 0) break;
    }
    return celdas;
}

/** Todos los días (clave) que cubre una novedad. */
function diasDe(n: Novedad): string[] {
    const out: string[] = [];
    const fin = claveDia.format(new Date(n.endsAt));
    const cur = new Date(n.startsAt);
    for (let i = 0; i < 366; i++) {
        const k = claveDia.format(cur);
        out.push(k);
        if (k === fin) break;
        cur.setDate(cur.getDate() + 1);
    }
    return out;
}

export default function CalendarioClient({ yo }: { yo: Yo }) {
    const hoy = new Date();
    const [anio, setAnio] = useState(hoy.getFullYear());
    const [mes, setMes] = useState(hoy.getMonth());
    const [novedades, setNovedades] = useState<Novedad[]>([]);
    const [equipo, setEquipo] = useState<Persona[]>([]);
    const [pendientes, setPendientes] = useState<Novedad[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtroPersona, setFiltroPersona] = useState<string>('');
    const [formulario, setFormulario] = useState<{ dia: string } | null>(null);
    const [detalle, setDetalle] = useState<Novedad | null>(null);

    const celdas = useMemo(() => diasDelMes(anio, mes), [anio, mes]);

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const desde = celdas[0].clave;
            const hasta = celdas[celdas.length - 1].clave;
            const r = await fetch(`/api/equipo/novedades?desde=${desde}&hasta=${hasta}`);
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            const d = await r.json();
            setNovedades(d.novedades); setEquipo(d.equipo); setPendientes(d.pendientes);
        } catch (e: any) { setError(e.message); }
        finally { setCargando(false); }
    }, [celdas]);

    useEffect(() => { cargar(); }, [cargar]);

    const visibles = useMemo(
        () => novedades.filter(n => !filtroPersona || n.userId === filtroPersona || n.swapWithUserId === filtroPersona),
        [novedades, filtroPersona],
    );

    const porDia = useMemo(() => {
        const mapa = new Map<string, Novedad[]>();
        for (const n of visibles) for (const k of diasDe(n)) {
            if (!mapa.has(k)) mapa.set(k, []);
            mapa.get(k)!.push(n);
        }
        return mapa;
    }, [visibles]);

    /** Resumen del mes por persona: cuántas de cada tipo (sin rechazadas). */
    const resumen = useMemo(() => {
        const prefijo = `${anio}-${pad(mes + 1)}`;
        const m = new Map<string, { nombre: string; conteo: Partial<Record<TipoNovedad, number>> }>();
        for (const n of novedades) {
            if (n.status === 'RECHAZADO') continue;
            const dias = diasDe(n).filter(k => k.startsWith(prefijo)).length;
            if (!dias) continue;
            const fila = m.get(n.userId) ?? { nombre: n.user.name, conteo: {} };
            fila.conteo[n.type] = (fila.conteo[n.type] ?? 0) + (n.type === 'VACACIONES' || n.type === 'FRANCO' ? dias : 1);
            m.set(n.userId, fila);
        }
        return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [novedades, anio, mes]);

    const mover = (delta: number) => {
        const d = new Date(anio, mes + delta, 1);
        setAnio(d.getFullYear()); setMes(d.getMonth()); setCargando(true);
    };

    const decidir = async (id: string, decision: 'APROBADO' | 'RECHAZADO') => {
        const r = await fetch(`/api/equipo/novedades/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }) });
        if (!r.ok) { alert((await r.json().catch(() => ({}))).error || 'No se pudo'); return; }
        setDetalle(null); cargar();
    };

    const borrar = async (n: Novedad) => {
        if (!confirm(`¿Borrar "${NOVEDAD_INFO[n.type].etiqueta}" de ${n.user.name}?`)) return;
        const r = await fetch(`/api/equipo/novedades/${n.id}`, { method: 'DELETE' });
        if (!r.ok) { alert((await r.json().catch(() => ({}))).error || 'No se pudo'); return; }
        setDetalle(null); cargar();
    };

    const puedeTocar = (n: Novedad) => yo.esAdmin || (n.userId === yo.id && n.status === 'PENDIENTE');
    const misPendientes = pendientes.filter(p => yo.esAdmin || p.userId === yo.id);
    const hoyK = hoyClave();

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2"><CalendarDays className="w-6 h-6 text-primary" /> Equipo: faltas, turnos y pedidos</h1>
                    <p className="text-sm text-stone-500 dark:text-stone-400">Calendario compartido. {yo.esAdmin ? 'Anotás faltas y aprobás pedidos.' : 'Pedí francos, cambios de turno o algo especial; un administrador lo aprueba.'}</p>
                </div>
                <button onClick={() => setFormulario({ dia: hoyK })} className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold shadow hover:opacity-90">
                    <Plus className="w-4 h-4" /> Anotar
                </button>
            </header>

            {misPendientes.length > 0 && (
                <section className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-4">
                    <h2 className="font-black text-amber-900 dark:text-amber-100 mb-2">{yo.esAdmin ? `Pedidos esperando tu OK (${misPendientes.length})` : `Tus pedidos pendientes (${misPendientes.length})`}</h2>
                    <ul className="space-y-1.5">
                        {misPendientes.map(p => (
                            <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                                <button onClick={() => setDetalle(p)} className="font-bold underline-offset-2 hover:underline text-stone-900 dark:text-stone-100">{p.user.name}</button>
                                <span>· {NOVEDAD_INFO[p.type].etiqueta} · {rango(p)}{p.swapWith ? ` con ${p.swapWith.name}` : ''}</span>
                                {p.notes && <span className="text-stone-600 dark:text-stone-300">— {p.notes}</span>}
                                {yo.esAdmin && (
                                    <span className="ml-auto flex gap-1">
                                        <button onClick={() => decidir(p.id, 'APROBADO')} className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold">Aprobar</button>
                                        <button onClick={() => decidir(p.id, 'RECHAZADO')} className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-bold">Rechazar</button>
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-stone-200 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                        <button onClick={() => mover(-1)} aria-label="Mes anterior" className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"><ChevronLeft className="w-5 h-5" /></button>
                        <h2 className="text-lg font-black capitalize min-w-[11rem] text-center">{fmtMes.format(new Date(anio, mes, 15))}</h2>
                        <button onClick={() => mover(1)} aria-label="Mes siguiente" className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"><ChevronRight className="w-5 h-5" /></button>
                        <button onClick={() => { setAnio(hoy.getFullYear()); setMes(hoy.getMonth()); }} className="text-xs font-bold px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-600">Hoy</button>
                        {cargando && <Loader2 className="w-4 h-4 animate-spin text-stone-400" />}
                    </div>
                    <select value={filtroPersona} onChange={e => setFiltroPersona(e.target.value)} className="text-sm rounded-lg border border-stone-300 dark:border-stone-600 bg-transparent px-2 py-1.5">
                        <option value="">Todo el equipo</option>
                        {equipo.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                {error && <p className="p-4 text-red-700 dark:text-red-300 font-bold">No se pudo cargar: {error}</p>}

                <div className="grid grid-cols-7 text-center text-xs font-black uppercase tracking-wider text-stone-500 border-b border-stone-200 dark:border-stone-700">
                    {DIAS_SEMANA.map(d => <div key={d} className="py-2">{d}</div>)}
                </div>
                <div className="grid grid-cols-7">
                    {celdas.map(c => {
                        const lista = porDia.get(c.clave) ?? [];
                        const esHoy = c.clave === hoyK;
                        return (
                            <div key={c.clave} className={`min-h-[6.5rem] border-b border-r border-stone-100 dark:border-stone-800 p-1 flex flex-col gap-0.5 ${c.delMes ? '' : 'bg-stone-50/70 dark:bg-stone-950/40 text-stone-400'}`}>
                                <button onClick={() => setFormulario({ dia: c.clave })} title="Anotar en este día"
                                    className={`self-start text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-700 ${esHoy ? 'bg-primary text-white' : ''}`}>
                                    {c.dia}
                                </button>
                                {lista.map(n => (
                                    <button key={n.id} onClick={() => setDetalle(n)}
                                        className={`text-left text-[11px] leading-tight px-1.5 py-0.5 rounded border truncate ${NOVEDAD_INFO[n.type].clase} ${n.status === 'RECHAZADO' ? 'line-through opacity-60' : ''} ${n.status === 'PENDIENTE' ? 'border-dashed' : ''}`}
                                        title={`${n.user.name} · ${NOVEDAD_INFO[n.type].etiqueta} · ${ESTADO_INFO[n.status].etiqueta}${n.notes ? ` · ${n.notes}` : ''}`}>
                                        <span className="font-black">{n.user.name.split(' ')[0]}</span> · {NOVEDAD_INFO[n.type].corta}{n.horario ? ` ${n.horario}` : ''}{n.status === 'PENDIENTE' ? ' (?)' : ''}
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 p-3 text-xs text-stone-600 dark:text-stone-300">
                    {TIPOS_NOVEDAD.map(t => (
                        <span key={t} className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${NOVEDAD_INFO[t].punto}`} />{NOVEDAD_INFO[t].etiqueta}</span>
                    ))}
                    <span className="inline-flex items-center gap-1.5"><span className="w-5 h-3 rounded border border-dashed border-stone-500" /> pendiente de OK (?)</span>
                </div>
            </section>

            {resumen.length > 0 && (
                <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
                    <h2 className="font-black mb-2">Resumen del mes por persona</h2>
                    <div className="overflow-x-auto">
                        <table className="text-sm w-full">
                            <thead><tr className="text-left text-xs uppercase tracking-wider text-stone-500">
                                <th className="py-1 pr-3">Persona</th>
                                {TIPOS_NOVEDAD.map(t => <th key={t} className="py-1 px-2 font-bold">{NOVEDAD_INFO[t].corta}</th>)}
                            </tr></thead>
                            <tbody>
                                {resumen.map(f => (
                                    <tr key={f.nombre} className="border-t border-stone-100 dark:border-stone-800">
                                        <td className="py-1.5 pr-3 font-bold">{f.nombre}</td>
                                        {TIPOS_NOVEDAD.map(t => <td key={t} className="py-1.5 px-2 tabular-nums">{f.conteo[t] ?? '—'}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-stone-500 mt-2">Francos y vacaciones se cuentan en días; el resto, en veces. No se cuentan los rechazados.</p>
                </section>
            )}

            {formulario && (
                <Formulario yo={yo} equipo={equipo} dia={formulario.dia} onCerrar={() => setFormulario(null)} onGuardado={() => { setFormulario(null); cargar(); }} />
            )}
            {detalle && (
                <Detalle n={detalle} yo={yo} puedeTocar={puedeTocar(detalle)} onCerrar={() => setDetalle(null)} onDecidir={decidir} onBorrar={borrar} />
            )}
        </div>
    );
}

function rango(n: Novedad) {
    const a = formatDate(n.startsAt), b = formatDate(n.endsAt);
    return a === b ? a : `${a} al ${b}`;
}

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
    // Escape cierra: el clic en el fondo es solo un atajo con el mouse.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCerrar]);
    return (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div className="fixed inset-0 z-[150] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCerrar}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-stone-900 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black">{titulo}</h3>
                    <button onClick={onCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"><X className="w-5 h-5" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

const campo = 'w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-transparent px-3 py-2 text-sm';
const etiqueta = 'block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1';

function Formulario({ yo, equipo, dia, onCerrar, onGuardado }: { yo: Yo; equipo: Persona[]; dia: string; onCerrar: () => void; onGuardado: () => void }) {
    const tiposPermitidos = TIPOS_NOVEDAD.filter(t => yo.esAdmin || !TIPOS_SOLO_ADMIN.includes(t));
    const [userId, setUserId] = useState(yo.id);
    const [type, setType] = useState<TipoNovedad>(yo.esAdmin ? 'FALTA' : 'CAMBIO_TURNO');
    const [desde, setDesde] = useState(dia);
    const [hasta, setHasta] = useState(dia);
    const [horario, setHorario] = useState('');
    const [swapWithUserId, setSwap] = useState('');
    const [justificada, setJustificada] = useState<'' | 'si' | 'no'>('');
    const [notes, setNotes] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault(); setGuardando(true); setError(null);
        try {
            const r = await fetch('/api/equipo/novedades', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId, type, desde, hasta: hasta || desde, horario: horario || null,
                    swapWithUserId: type === 'CAMBIO_TURNO' ? swapWithUserId || null : null,
                    justificada: justificada === '' ? null : justificada === 'si',
                    notes: notes || null,
                }),
            });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            onGuardado();
        } catch (e: any) { setError(e.message); }
        finally { setGuardando(false); }
    };

    const esPedido = TIPOS_QUE_SE_PIDEN.includes(type);
    return (
        <Modal titulo="Anotar novedad" onCerrar={onCerrar}>
            <form onSubmit={guardar} className="space-y-3">
                <div>
                    <label className={etiqueta}>Persona</label>
                    {yo.esAdmin
                        ? <select value={userId} onChange={e => setUserId(e.target.value)} className={campo} required>
                            {equipo.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        : <p className="text-sm font-bold">{yo.nombre}</p>}
                </div>
                <div>
                    <label className={etiqueta}>Qué pasa</label>
                    <div className="flex flex-wrap gap-1.5">
                        {tiposPermitidos.map(t => (
                            <button type="button" key={t} onClick={() => setType(t)}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${NOVEDAD_INFO[t].clase} ${type === t ? 'ring-2 ring-primary' : 'opacity-70'}`}>
                                {NOVEDAD_INFO[t].etiqueta}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={etiqueta}>Desde</label><input type="date" value={desde} onChange={e => { setDesde(e.target.value); if (hasta < e.target.value) setHasta(e.target.value); }} className={campo} required /></div>
                    <div><label className={etiqueta}>Hasta</label><input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} className={campo} required /></div>
                </div>
                <div>
                    <label className={etiqueta}>Horario (opcional)</label>
                    <input value={horario} onChange={e => setHorario(e.target.value)} placeholder={type === 'LLEGADA_TARDE' ? 'ej. llegó 10:40' : type === 'CAMBIO_TURNO' ? 'ej. hace la tarde en vez de la mañana' : 'ej. se va 17:00'} className={campo} maxLength={80} />
                </div>
                {type === 'CAMBIO_TURNO' && (
                    <div>
                        <label className={etiqueta}>Con quién cambia</label>
                        <select value={swapWithUserId} onChange={e => setSwap(e.target.value)} className={campo}>
                            <option value="">— sin especificar —</option>
                            {equipo.filter(p => p.id !== userId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                )}
                {yo.esAdmin && TIPOS_SOLO_ADMIN.includes(type) && (
                    <div>
                        <label className={etiqueta}>¿Justificada?</label>
                        <div className="flex gap-2 text-sm">
                            {(['', 'si', 'no'] as const).map(v => (
                                <label key={v} className="inline-flex items-center gap-1"><input type="radio" name="just" checked={justificada === v} onChange={() => setJustificada(v)} /> {v === '' ? 'Sin definir' : v === 'si' ? 'Sí' : 'No'}</label>
                            ))}
                        </div>
                    </div>
                )}
                <div>
                    <label className={etiqueta}>Notas</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={campo} maxLength={500} placeholder="Motivo, detalle, lo que haga falta saber" />
                </div>
                {esPedido && !yo.esAdmin && <p className="text-xs text-amber-700 dark:text-amber-300">Queda <strong>pendiente</strong> hasta que un administrador lo apruebe.</p>}
                {error && <p className="text-sm text-red-700 dark:text-red-300 font-bold">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-xl text-sm font-bold border border-stone-300 dark:border-stone-600">Cancelar</button>
                    <button type="submit" disabled={guardando} className="px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white inline-flex items-center gap-2 disabled:opacity-60">
                        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
                    </button>
                </div>
            </form>
        </Modal>
    );
}

function Detalle({ n, yo, puedeTocar, onCerrar, onDecidir, onBorrar }: {
    n: Novedad; yo: Yo; puedeTocar: boolean; onCerrar: () => void;
    onDecidir: (id: string, d: 'APROBADO' | 'RECHAZADO') => void; onBorrar: (n: Novedad) => void;
}) {
    const info = NOVEDAD_INFO[n.type];
    return (
        <Modal titulo={`${n.user.name} · ${info.etiqueta}`} onCerrar={onCerrar}>
            <dl className="text-sm space-y-2">
                <div><dt className={etiqueta}>Cuándo</dt><dd className="font-bold">{rango(n)}{n.horario ? ` · ${n.horario}` : ''}</dd></div>
                <div><dt className={etiqueta}>Estado</dt><dd className={ESTADO_INFO[n.status].clase}>{ESTADO_INFO[n.status].etiqueta}{n.decidedByName ? ` por ${n.decidedByName}${n.decidedAt ? ` el ${formatDate(n.decidedAt)}` : ''}` : ''}</dd></div>
                {n.swapWith && <div><dt className={etiqueta}>Cambia con</dt><dd>{n.swapWith.name}</dd></div>}
                {n.justificada !== null && <div><dt className={etiqueta}>Justificada</dt><dd>{n.justificada ? 'Sí' : 'No'}</dd></div>}
                {n.notes && <div><dt className={etiqueta}>Notas</dt><dd className="whitespace-pre-wrap">{n.notes}</dd></div>}
                <div><dt className={etiqueta}>Anotado por</dt><dd>{n.createdByName} el {formatDate(n.createdAt)}</dd></div>
            </dl>
            <div className="flex flex-wrap justify-end gap-2 pt-4">
                {yo.esAdmin && n.status === 'PENDIENTE' && (<>
                    <button onClick={() => onDecidir(n.id, 'RECHAZADO')} className="px-3 py-2 rounded-xl text-sm font-bold bg-red-600 text-white">Rechazar</button>
                    <button onClick={() => onDecidir(n.id, 'APROBADO')} className="px-3 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white">Aprobar</button>
                </>)}
                {yo.esAdmin && n.status === 'RECHAZADO' && <button onClick={() => onDecidir(n.id, 'APROBADO')} className="px-3 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white">Aprobar igual</button>}
                {yo.esAdmin && n.status === 'APROBADO' && <button onClick={() => onDecidir(n.id, 'RECHAZADO')} className="px-3 py-2 rounded-xl text-sm font-bold border border-red-600 text-red-700 dark:text-red-300">Deshacer (rechazar)</button>}
                {puedeTocar && <button onClick={() => onBorrar(n)} className="px-3 py-2 rounded-xl text-sm font-bold border border-stone-300 dark:border-stone-600 inline-flex items-center gap-1"><Trash2 className="w-4 h-4" /> Borrar</button>}
            </div>
        </Modal>
    );
}
