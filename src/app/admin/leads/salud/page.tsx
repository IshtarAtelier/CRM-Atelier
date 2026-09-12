'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * /admin/leads/salud — el embudo de un vistazo, últimos 7 días.
 * Lo que muestra lo calcula `src/lib/seguimientos/salud.ts` (mismo dato que
 * el mail diario).
 */
interface Dia { dia: string; corridas: number; horasSinCorrida: number[]; candidatosMax: number; enviados: number; fallidos: number; enEsperaUltimo: number; frenos: number; errores: string[]; vetosPrincipales: { motivo: string; cantidad: number }[]; respuestas: number }
interface Salud { generadoEn: string; hoy: string; dias: Dia[]; olvidados: { nombre: string; paso: string; vencidoHace: string; leadId: string }[]; problemasHoy: string[] }

const fecha = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default function SaludDelEmbudoPage() {
    const [salud, setSalud] = useState<Salud | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        fetch('/api/embudo/salud').then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); setSalud(await r.json()); }).catch(e => setError(e.message));
    }, []);

    if (error) return <div className="p-6 text-red-600">No se pudo cargar: {error}</div>;
    if (!salud) return <div className="p-6 text-stone-500">Cargando…</div>;
    const hoy = salud.dias[salud.dias.length - 1];

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-baseline justify-between gap-4">
                <h1 className="text-2xl font-semibold">Salud del embudo</h1>
                <Link href="/admin/leads" className="text-sm underline">← Volver al embudo</Link>
            </div>

            <section className={`rounded-2xl p-4 border ${salud.problemasHoy.length ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30' : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30'}`}>
                <div className="font-medium">{salud.problemasHoy.length ? `⚠️ Hoy: ${salud.problemasHoy.length} cosa(s) para mirar` : `✅ Hoy: ${hoy.enviados} seguimientos enviados en ${hoy.corridas} corridas, ${hoy.respuestas} respuestas`}</div>
                {salud.problemasHoy.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm space-y-1">{salud.problemasHoy.map((p, i) => <li key={i}>{p}</li>)}</ul>}
            </section>

            <section>
                <h2 className="text-lg font-medium mb-2">Últimos 7 días</h2>
                <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-white/10">
                    <table className="w-full text-sm">
                        <thead className="bg-stone-100 dark:bg-white/5 text-left">
                            <tr><th className="p-2">Día</th><th className="p-2">Corridas</th><th className="p-2">Enviados</th><th className="p-2">Fallidos</th><th className="p-2">En espera</th><th className="p-2">Respuestas</th><th className="p-2">Avisos</th></tr>
                        </thead>
                        <tbody>
                            {salud.dias.map(d => (
                                <tr key={d.dia} className="border-t border-stone-200 dark:border-white/10">
                                    <td className="p-2 font-medium">{fecha(d.dia)}{d.dia === salud.hoy ? ' (hoy)' : ''}</td>
                                    <td className="p-2">{d.corridas}</td>
                                    <td className="p-2">{d.enviados}</td>
                                    <td className="p-2">{d.fallidos}</td>
                                    <td className="p-2">{d.enEsperaUltimo}</td>
                                    <td className="p-2">{d.respuestas}</td>
                                    <td className="p-2 text-xs">
                                        {d.horasSinCorrida.length > 0 && <div>⚠️ no corrió a las {d.horasSinCorrida.join(', ')} hs</div>}
                                        {d.frenos > 0 && <div>⛔ se frenó {d.frenos} vez/veces</div>}
                                        {d.errores.map((e, i) => <div key={i}>❌ {e}</div>)}
                                        {d.corridas === 0 && d.horasSinCorrida.length === 0 && <div className="text-stone-400">sin horas hábiles todavía</div>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {hoy.vetosPrincipales.length > 0 && (
                <section>
                    <h2 className="text-lg font-medium mb-2">Por qué no salieron más hoy</h2>
                    <ul className="text-sm list-disc pl-5 space-y-1">{hoy.vetosPrincipales.map(v => <li key={v.motivo}><b>{v.cantidad}</b> × {v.motivo}</li>)}</ul>
                </section>
            )}

            <section>
                <h2 className="text-lg font-medium mb-2">Olvidados ({salud.olvidados.length})</h2>
                <p className="text-sm text-stone-500 mb-2">Toque vencido hace más de un día y nadie les escribió, ni el motor ni una persona.</p>
                {salud.olvidados.length === 0 ? <div className="text-sm text-emerald-700">Nadie. 🎯</div> : (
                    <ul className="text-sm space-y-1">{salud.olvidados.map(o => <li key={o.leadId}><Link className="underline" href={`/admin/contactos/${o.leadId}`}>{o.nombre}</Link> — {o.paso} (vencido hace {o.vencidoHace})</li>)}</ul>
                )}
            </section>
        </div>
    );
}
