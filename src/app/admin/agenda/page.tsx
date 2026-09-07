'use client';

/**
 * Agenda de turnos.
 *
 * Qué es un turno: un `ClientTask` con `type: 'TURNO'` y `dueDate` = fecha y
 * hora (ver `wa-service/shared/turnos.js`). Los agenda el bot con la tool
 * `agendar_turno`, o una persona desde la ficha del cliente.
 *
 * Por qué es una lista por día y no un calendario de grilla: son pocos turnos
 * por día y lo que hace falta es "qué me toca hoy y qué viene", no arrastrar
 * bloques. Una grilla mensual con dos turnos por día es más adorno que
 * herramienta.
 *
 * Accesibilidad: el estado del recordatorio no se comunica solo con color —
 * cada fila lleva la palabra ("avisado" / "sin avisar"), y el turno pasado se
 * marca con texto, no solo en gris.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarClock, Loader2, Phone, Check, AlertCircle } from 'lucide-react';

interface Turno {
    id: string;
    descripcion: string;
    cuando: string;
    estado: string;
    avisadoCliente: boolean;
    cliente: { id: string; nombre: string | null; telefono: string | null } | null;
}

const TZ = 'America/Argentina/Cordoba';
const fmtHora = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDia = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' });
const claveDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Las franjas con dos profesionales, para que se vea de un vistazo. */
function enFranjaPreferida(iso: string) {
    const h = Number(fmtHora.format(new Date(iso)).slice(0, 2));
    return (h >= 9 && h < 11) || (h >= 16 && h < 20);
}

export default function AgendaPage() {
    const [turnos, setTurnos] = useState<Turno[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/turnos?dias=21')
            .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then(d => setTurnos(d.turnos || []))
            .catch(e => setError(e.message))
            .finally(() => setCargando(false));
    }, []);

    const porDia = useMemo(() => {
        const mapa = new Map<string, Turno[]>();
        for (const t of turnos) {
            const k = claveDia.format(new Date(t.cuando));
            mapa.set(k, [...(mapa.get(k) || []), t]);
        }
        return [...mapa.entries()];
    }, [turnos]);

    const hoyKey = claveDia.format(new Date());
    const ahora = Date.now();

    return (
        <main className="min-h-screen bg-stone-100 dark:bg-stone-950 p-4 lg:p-8">
            <div className="max-w-3xl mx-auto">
                <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white mb-6">
                    <ArrowLeft className="w-4 h-4" /> Volver
                </Link>

                <header className="mb-8">
                    <h1 className="text-2xl font-black text-stone-900 dark:text-white tracking-tight flex items-center gap-2.5">
                        <CalendarClock className="w-6 h-6 text-violet-700 dark:text-violet-400" aria-hidden />
                        Agenda de turnos
                    </h1>
                    <p className="text-sm font-medium text-stone-600 dark:text-stone-400 mt-1.5">
                        Las próximas tres semanas. Las franjas de 9 a 11 y de 16 a 20 tienen dos profesionales.
                    </p>
                </header>

                {cargando && (
                    <p className="flex items-center gap-2 text-sm font-bold text-stone-600 dark:text-stone-400">
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Cargando la agenda…
                    </p>
                )}

                {error && (
                    <p className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400">
                        <AlertCircle className="w-4 h-4" aria-hidden /> No se pudo cargar la agenda: {error}
                    </p>
                )}

                {!cargando && !error && porDia.length === 0 && (
                    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-8 text-center">
                        <p className="font-bold text-stone-800 dark:text-stone-200">No hay turnos agendados.</p>
                        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1.5">
                            Aparecen acá apenas el asistente o alguien del equipo tome uno.
                        </p>
                    </div>
                )}

                <div className="space-y-6">
                    {porDia.map(([dia, delDia]) => (
                        <section key={dia}>
                            <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400 mb-2.5">
                                {fmtDia.format(new Date(delDia[0].cuando))}
                                {dia === hoyKey && <span className="ml-2 text-violet-700 dark:text-violet-400">· hoy</span>}
                            </h2>

                            <ul className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 divide-y divide-stone-200 dark:divide-stone-800 overflow-hidden">
                                {delDia.map(t => {
                                    const paso = new Date(t.cuando).getTime() < ahora;
                                    return (
                                        <li key={t.id} className="flex items-start gap-4 p-4">
                                            <div className="flex flex-col items-center w-14 flex-shrink-0">
                                                <span className={`text-base font-black tabular-nums ${paso ? 'text-stone-500 dark:text-stone-500' : 'text-stone-900 dark:text-white'}`}>
                                                    {fmtHora.format(new Date(t.cuando))}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${enFranjaPreferida(t.cuando) ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-400'}`}>
                                                    {enFranjaPreferida(t.cuando) ? '2 prof.' : '1 prof.'}
                                                </span>
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-stone-900 dark:text-white truncate">
                                                    {t.cliente?.nombre || 'Sin ficha'}
                                                    {paso && <span className="ml-2 text-[11px] font-bold text-stone-500 dark:text-stone-400">· ya pasó</span>}
                                                </p>
                                                <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5 break-words">{t.descripcion}</p>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                                                    {t.cliente?.telefono && (
                                                        <a href={`tel:${t.cliente.telefono}`} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-stone-700 dark:text-stone-300 hover:underline">
                                                            <Phone className="w-3 h-3" aria-hidden /> {t.cliente.telefono}
                                                        </a>
                                                    )}
                                                    <span className={`inline-flex items-center gap-1.5 text-[12px] font-bold ${t.avisadoCliente ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-600 dark:text-stone-400'}`}>
                                                        {t.avisadoCliente ? <><Check className="w-3 h-3" aria-hidden /> avisado</> : 'sin avisar'}
                                                    </span>
                                                    {t.cliente?.id && (
                                                        <Link href={`/admin/contactos?id=${t.cliente.id}`} className="text-[12px] font-bold text-violet-700 dark:text-violet-400 hover:underline">
                                                            Ver ficha
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}
