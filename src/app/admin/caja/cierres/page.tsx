'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Loader2, ArrowLeft, HandCoins, ClipboardCheck, CheckCircle2,
    AlertCircle, ChevronDown, ChevronUp, Scale, X, BookOpen, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const money = (n: number | null | undefined) =>
    `$${Math.round(n ?? 0).toLocaleString('es-AR')}`;

type Handover = {
    id: string;
    vendorName: string;
    status: string;
    expectedAmount: number;
    declaredAmount: number;
    countedAmount: number | null;
    difference: number | null;
    periodFrom: string;
    periodTo: string;
    payments: { id: string; amount: number; date: string; client: string }[];
    notes: string | null;
    confirmedByName: string | null;
    confirmedAt: string | null;
    createdAt: string;
};

type CashCount = {
    id: string;
    theoreticalTotal: number;
    countedAmount: number;
    difference: number;
    periodFrom: string;
    periodTo: string;
    summary: { paymentsTotal: number; manualIn: number; manualOut: number; movementsCount: number };
    notes: string | null;
    closedByName: string | null;
    createdAt: string;
};

export default function CierresCajaPage() {
    const [loading, setLoading] = useState(true);
    const [canManage, setCanManage] = useState(false);
    const [pending, setPending] = useState<any>(null);
    const [handovers, setHandovers] = useState<Handover[]>([]);
    const [counts, setCounts] = useState<CashCount[]>([]);
    const [theoretical, setTheoretical] = useState<number | null>(null);

    const [showPendingDetail, setShowPendingDetail] = useState(false);
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [declaredAmount, setDeclaredAmount] = useState('');
    const [handoverNotes, setHandoverNotes] = useState('');
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [countedInput, setCountedInput] = useState('');
    const [arqueoInput, setArqueoInput] = useState('');
    const [arqueoNotes, setArqueoNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
    const [showGuide, setShowGuide] = useState(false);

    // Capacitación integrada: la guía se abre sola la primera vez que el
    // usuario entra a esta pantalla; después queda en el botón "Guía".
    useEffect(() => {
        try {
            if (!localStorage.getItem('cierres-guia-vista')) {
                setShowGuide(true);
                localStorage.setItem('cierres-guia-vista', '1');
            }
        } catch { }
    }, []);

    const notify = (type: 'ok' | 'error', text: string) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchAll = useCallback(async () => {
        try {
            const hRes = await fetch('/api/cash/handovers');
            const h = await hRes.json();
            if (hRes.ok) {
                setCanManage(!!h.canManage);
                setPending(h.pending);
                setHandovers(h.handovers || []);
                if (h.canManage) {
                    const cRes = await fetch('/api/cash/counts');
                    const c = await cRes.json();
                    if (cRes.ok) {
                        setCounts(c.counts || []);
                        setTheoretical(c.theoretical);
                    }
                }
            }
        } catch (e) {
            console.error('Error cargando cierres:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const submitHandover = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/cash/handovers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ declaredAmount: parseFloat(declaredAmount), notes: handoverNotes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setShowHandoverModal(false);
            setDeclaredAmount('');
            setHandoverNotes('');
            notify('ok', '✅ Entrega registrada. Queda pendiente de confirmación.');
            fetchAll();
        } catch (e: any) {
            notify('error', e.message || 'Error al registrar la entrega');
        }
        setSaving(false);
    };

    const confirmHandover = async (id: string) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/cash/handovers/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ countedAmount: parseFloat(countedInput) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setConfirmingId(null);
            setCountedInput('');
            notify('ok', '✅ Rendición confirmada');
            fetchAll();
        } catch (e: any) {
            notify('error', e.message || 'Error al confirmar');
        }
        setSaving(false);
    };

    const submitArqueo = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/cash/counts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ countedAmount: parseFloat(arqueoInput), notes: arqueoNotes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setArqueoInput('');
            setArqueoNotes('');
            notify('ok', '✅ Arqueo cerrado');
            fetchAll();
        } catch (e: any) {
            notify('error', e.message || 'Error al cerrar el arqueo');
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <main className="p-4 lg:p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </main>
        );
    }

    const diffBadge = (diff: number | null | undefined) => {
        if (diff == null) return null;
        const rounded = Math.round(diff);
        if (rounded === 0) return <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full uppercase tracking-widest">Coincide ✓</span>;
        return <span className="text-[10px] font-black text-red-600 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full uppercase tracking-widest">Dif. {rounded > 0 ? '+' : ''}{money(rounded)}</span>;
    };

    return (
        <main className="p-4 lg:p-8 max-w-4xl mx-auto animate-in fade-in duration-500 pb-20 space-y-8">
            {toast && (
                <div className={`fixed top-6 right-6 z-[200] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${toast.type === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {toast.type === 'ok' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <span className="text-sm font-black">{toast.text}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-6 sm:p-8 rounded-[2rem] border border-stone-100 dark:border-stone-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href="/admin/caja" className="p-3 bg-stone-50 dark:bg-stone-800 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-stone-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                <Scale className="w-5 h-5" />
                            </div>
                            Rendición y Arqueo
                        </h1>
                        <p className="text-stone-400 text-xs mt-1.5 font-medium">
                            Entregas de efectivo a la encargada de caja y cierres de lote
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowGuide(true)}
                    className="px-5 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-black uppercase tracking-widest text-stone-600 dark:text-stone-300 hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2 shrink-0"
                >
                    <BookOpen size={15} /> Guía
                </button>
            </div>

            {/* Mi pendiente de rendición */}
            {pending && (
                <section className="bg-white dark:bg-stone-900 rounded-[2rem] border border-stone-100 dark:border-stone-800 shadow-sm p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <HandCoins className="w-5 h-5 text-primary" />
                            <div>
                                <h2 className="text-base font-black text-stone-800 dark:text-white tracking-tight">Mi efectivo pendiente de rendición</h2>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">
                                    {pending.payments.length} cobro{pending.payments.length === 1 ? '' : 's'} desde {format(new Date(pending.periodFrom), 'dd MMM HH:mm', { locale: es })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <p className="text-2xl font-black tracking-tight text-stone-800 dark:text-white">{money(pending.total)}</p>
                            {pending.pendingHandover ? (
                                <span className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950 px-3 py-2 rounded-xl uppercase tracking-widest">⏳ Entrega esperando confirmación</span>
                            ) : (
                                <button
                                    onClick={() => { setDeclaredAmount(String(pending.total || '')); setShowHandoverModal(true); }}
                                    disabled={pending.payments.length === 0}
                                    className="px-5 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.03] active:scale-95 transition-all shadow-lg disabled:opacity-40 disabled:scale-100"
                                >
                                    Registrar Entrega
                                </button>
                            )}
                        </div>
                    </div>

                    {pending.payments.length > 0 && (
                        <div className="mt-5">
                            <button onClick={() => setShowPendingDetail(!showPendingDetail)} className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1 hover:text-stone-600">
                                {showPendingDetail ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Ver detalle
                            </button>
                            {showPendingDetail && (
                                <div className="mt-3 divide-y divide-stone-50 dark:divide-stone-800 border border-stone-100 dark:border-stone-800 rounded-xl overflow-hidden">
                                    {pending.payments.map((p: any) => (
                                        <div key={p.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                                            <span className="font-bold text-stone-700 dark:text-stone-300 truncate">{p.client}</span>
                                            <span className="flex items-center gap-4 shrink-0">
                                                <span className="text-[10px] font-bold text-stone-400">{format(new Date(p.date), 'dd MMM HH:mm', { locale: es })}</span>
                                                <span className="font-black text-emerald-600">{money(p.amount)}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* Rendiciones */}
            <section className="bg-white dark:bg-stone-900 rounded-[2rem] border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-stone-50 dark:border-stone-800 flex items-center gap-3">
                    <ClipboardCheck className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-black text-stone-800 dark:text-white tracking-tight">
                        {canManage ? 'Rendiciones del equipo' : 'Mis rendiciones'}
                    </h2>
                </div>
                {handovers.length === 0 ? (
                    <p className="p-8 text-center text-[10px] font-black uppercase tracking-[0.2em] text-stone-300 dark:text-stone-700">Sin rendiciones registradas</p>
                ) : (
                    <div className="divide-y divide-stone-50 dark:divide-stone-800">
                        {handovers.map(h => (
                            <div key={h.id} className="px-6 sm:px-8 py-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-black text-stone-800 dark:text-white">{h.vendorName}</p>
                                            {h.status === 'PENDING' ? (
                                                <span className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full uppercase tracking-widest">Pendiente</span>
                                            ) : (
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full uppercase tracking-widest">Confirmada</span>
                                            )}
                                            {h.status === 'CONFIRMED' && diffBadge(h.difference)}
                                        </div>
                                        <p className="text-[10px] font-bold text-stone-400 mt-1">
                                            {format(new Date(h.createdAt), 'dd MMM, HH:mm', { locale: es })} · {h.payments?.length ?? 0} cobros ·
                                            {' '}Sistema: <b>{money(h.expectedAmount)}</b> · Declarado: <b>{money(h.declaredAmount)}</b>
                                            {h.countedAmount != null && <> · Contado: <b>{money(h.countedAmount)}</b></>}
                                            {h.confirmedByName && <> · Recibió {h.confirmedByName}</>}
                                        </p>
                                        {h.notes && <p className="text-[11px] text-stone-400 mt-1 whitespace-pre-line">{h.notes}</p>}
                                    </div>

                                    {canManage && h.status === 'PENDING' && (
                                        confirmingId === h.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    autoFocus
                                                    value={countedInput}
                                                    onChange={e => setCountedInput(e.target.value)}
                                                    placeholder="Monto contado"
                                                    className="w-36 bg-stone-50 dark:bg-stone-800 border-2 border-primary rounded-xl py-2.5 px-3 text-sm font-black outline-none"
                                                />
                                                <button
                                                    onClick={() => confirmHandover(h.id)}
                                                    disabled={saving || countedInput === ''}
                                                    className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                                >
                                                    {saving ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar'}
                                                </button>
                                                <button onClick={() => { setConfirmingId(null); setCountedInput(''); }} className="p-2 text-stone-400 hover:text-stone-600">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setConfirmingId(h.id); setCountedInput(''); }}
                                                className="px-4 py-2.5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shrink-0"
                                            >
                                                Contar y Confirmar
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Arqueo (solo encargada/admin) */}
            {canManage && (
                <section className="bg-white dark:bg-stone-900 rounded-[2rem] border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden">
                    <div className="p-6 sm:p-8 border-b border-stone-50 dark:border-stone-800 flex items-center gap-3">
                        <Scale className="w-5 h-5 text-primary" />
                        <h2 className="text-base font-black text-stone-800 dark:text-white tracking-tight">Arqueo de caja</h2>
                    </div>

                    <div className="p-6 sm:p-8 bg-stone-50/50 dark:bg-stone-800/20 border-b border-stone-50 dark:border-stone-800">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Saldo teórico actual</p>
                        <p className="text-3xl font-black tracking-tight text-stone-800 dark:text-white mb-4">{theoretical != null ? money(theoretical) : '—'}</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="number"
                                value={arqueoInput}
                                onChange={e => setArqueoInput(e.target.value)}
                                placeholder="Efectivo contado ($)"
                                className="flex-1 bg-white dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-700 rounded-xl py-3.5 px-4 text-sm font-black outline-none focus:border-primary transition-all"
                            />
                            <input
                                type="text"
                                value={arqueoNotes}
                                onChange={e => setArqueoNotes(e.target.value)}
                                placeholder="Nota (opcional)"
                                className="flex-1 bg-white dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-700 rounded-xl py-3.5 px-4 text-sm font-bold outline-none focus:border-primary transition-all"
                            />
                            <button
                                onClick={submitArqueo}
                                disabled={saving || arqueoInput === ''}
                                className="px-6 py-3.5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.03] active:scale-95 transition-all shadow-lg disabled:opacity-40 disabled:scale-100"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : 'Cerrar Arqueo'}
                            </button>
                        </div>
                        {arqueoInput !== '' && theoretical != null && (
                            <p className="mt-3 text-xs font-bold text-stone-500">
                                Diferencia: <b className={Math.round(parseFloat(arqueoInput) - theoretical) === 0 ? 'text-emerald-600' : 'text-red-600'}>
                                    {money(parseFloat(arqueoInput) - theoretical)}
                                </b>
                            </p>
                        )}
                    </div>

                    {counts.length === 0 ? (
                        <p className="p-8 text-center text-[10px] font-black uppercase tracking-[0.2em] text-stone-300 dark:text-stone-700">Sin arqueos cerrados</p>
                    ) : (
                        <div className="divide-y divide-stone-50 dark:divide-stone-800">
                            {counts.map(c => (
                                <div key={c.id} className="px-6 sm:px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-black text-stone-800 dark:text-white">
                                                {format(new Date(c.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })}
                                            </p>
                                            {diffBadge(c.difference)}
                                        </div>
                                        <p className="text-[10px] font-bold text-stone-400 mt-1">
                                            Teórico: <b>{money(c.theoreticalTotal)}</b> · Contado: <b>{money(c.countedAmount)}</b>
                                            {c.closedByName && <> · Cerró {c.closedByName}</>}
                                            {' '}· Período: {c.summary?.movementsCount ?? 0} mov. manuales, cobros {money(c.summary?.paymentsTotal)}
                                        </p>
                                        {c.notes && <p className="text-[11px] text-stone-400 mt-1">{c.notes}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Guía de capacitación integrada */}
            {showGuide && (
                <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setShowGuide(false)}>
                    <div className="bg-white dark:bg-stone-800 rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300 max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 sm:p-8">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-stone-800 dark:text-white tracking-tight">Cómo funciona esta pantalla</h3>
                                        <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Guía paso a paso</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowGuide(false)} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <p className="text-xs text-stone-500 font-medium mt-4 mb-5 leading-relaxed">
                                Cada cobro en efectivo queda anotado a nombre de quien lo recibió. La plata se entrega
                                con una <b>rendición</b> (doble confirmación: uno entrega, otro cuenta) y la caja se
                                controla con <b>arqueos</b>. Nada queda sin registrar.
                            </p>

                            {/* Pasos del vendedor */}
                            <div className="mb-5">
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">💵 Para entregar tu efectivo (vendedores)</p>
                                <div className="space-y-3">
                                    {[
                                        ['Mirá tu pendiente', 'Arriba ves "Mi efectivo pendiente de rendición": el total y, en "Ver detalle", cada cobro con cliente, fecha y monto.'],
                                        ['Contá la plata física', 'Antes de tocar nada, contá los billetes que vas a entregar. Debería dar igual a lo que dice el sistema.'],
                                        ['Registrá la entrega', 'Botón "Registrar Entrega". Poné el monto REAL que entregás; si no coincide con el sistema, explicalo en la nota — nunca acomodes el número.'],
                                        ['Entregá la plata en mano', 'Tu entrega queda PENDIENTE hasta que la encargada la cuente y confirme. Si dio bien vas a ver "Coincide ✓".'],
                                    ].map(([t, d], i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className="w-7 h-7 rounded-full bg-stone-900 dark:bg-white text-primary dark:text-stone-900 font-black text-sm flex items-center justify-center shrink-0">{i + 1}</div>
                                            <div>
                                                <p className="text-sm font-black text-stone-800 dark:text-white leading-tight">{t}</p>
                                                <p className="text-xs text-stone-500 font-medium leading-relaxed">{d}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                                    <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                                        <b>Reglas:</b> una entrega pendiente a la vez · nadie confirma su propia entrega ·
                                        rendí el mismo día que cobraste, apenas esté la encargada.
                                    </p>
                                </div>
                            </div>

                            {/* Pasos de la encargada */}
                            {canManage && (
                                <div className="mb-5">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">💰 Para la encargada de caja</p>
                                    <div className="space-y-3">
                                        {[
                                            ['Contá ANTES de mirar los números', 'Recibí el efectivo y contalo sin mirar cuánto dice el sistema ni cuánto declaró el vendedor. Tu conteo independiente es el valor del doble control.'],
                                            ['"Contar y Confirmar"', 'Ingresá lo que contaste. El sistema compara solo contra lo cobrado según registros y lo declarado. Si difiere, queda sellado y administración recibe un email al instante.'],
                                            ['Arqueo al cierre del día', 'Contá TODO el efectivo del local, ingresalo en "Arqueo de caja" y cerrá. Queda teórico, contado, diferencia y quién cerró. Hacelo a diario y antes/después de cada retiro grande.'],
                                        ].map(([t, d], i) => (
                                            <div key={i} className="flex gap-3">
                                                <div className="w-7 h-7 rounded-full bg-primary text-white font-black text-sm flex items-center justify-center shrink-0">{i + 1}</div>
                                                <div>
                                                    <p className="text-sm font-black text-stone-800 dark:text-white leading-tight">{t}</p>
                                                    <p className="text-xs text-stone-500 font-medium leading-relaxed">{d}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="p-3.5 bg-stone-50 dark:bg-stone-900 rounded-xl mb-5">
                                <p className="text-[11px] font-medium text-stone-500 leading-relaxed">
                                    <b className="text-stone-700 dark:text-stone-300">Regla de oro:</b> las diferencias se
                                    registran, no se tapan. Una diferencia declarada a tiempo es un ajuste; una escondida
                                    es un problema. Ante cualquier cosa rara, usá el campo de nota y avisá.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <a
                                    href="/manuales/capacitacion-caja-rendicion-arqueo.pdf"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 py-4 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300 hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2"
                                >
                                    <Download size={14} /> Manual completo (PDF)
                                </a>
                                <button
                                    onClick={() => setShowGuide(false)}
                                    className="flex-1 py-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                                >
                                    Entendido
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal registrar entrega */}
            {showHandoverModal && pending && (
                <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-stone-800 rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 p-6 sm:p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-black text-stone-800 dark:text-white tracking-tight">Registrar Entrega</h3>
                                <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Efectivo a la encargada de caja</p>
                            </div>
                            <button onClick={() => setShowHandoverModal(false)} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 bg-stone-50 dark:bg-stone-900 rounded-xl mb-5">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Según el sistema cobraste</p>
                            <p className="text-2xl font-black text-stone-800 dark:text-white">{money(pending.total)}</p>
                            <p className="text-[10px] font-bold text-stone-400 mt-0.5">{pending.payments.length} cobro{pending.payments.length === 1 ? '' : 's'} en efectivo en el período</p>
                        </div>

                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Monto que entregás</label>
                        <input
                            type="number"
                            value={declaredAmount}
                            onChange={e => setDeclaredAmount(e.target.value)}
                            className="w-full bg-stone-50 dark:bg-stone-900 border-none rounded-xl py-4 px-5 text-xl font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all mb-4"
                        />

                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Nota (opcional)</label>
                        <textarea
                            value={handoverNotes}
                            onChange={e => setHandoverNotes(e.target.value)}
                            rows={2}
                            placeholder="Ej: entregado en mano a Mile"
                            className="w-full bg-stone-50 dark:bg-stone-900 border-none rounded-xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all resize-none mb-6"
                        />

                        <button
                            onClick={submitHandover}
                            disabled={saving || !declaredAmount}
                            className="w-full py-5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:scale-100"
                        >
                            {saving ? <Loader2 className="animate-spin" /> : 'Confirmar Entrega'}
                        </button>
                        <p className="text-[10px] text-stone-400 font-medium mt-3 text-center">
                            La entrega queda pendiente hasta que la encargada cuente el efectivo y la confirme.
                        </p>
                    </div>
                </div>
            )}
        </main>
    );
}
