'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Target, Zap, Trophy, ChevronLeft, ChevronRight, ArrowLeft,
    Loader2, Save, X, Users, CheckCircle2
} from 'lucide-react';
import { DEFAULT_MONTHLY_TARGETS } from '@/lib/constants';

interface MonthlyTarget {
    id: string;
    month: number;
    year: number;
    target1: number;
    target2: number;
    target3: number | null;
}

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MULTIPLIERS = [
    { factor: 1, label: '×1', desc: '1 vendedor (base)' },
    { factor: 1.5, label: '×1.5', desc: '1½ — incorporación a mitad de mes' },
    { factor: 2, label: '×2', desc: '2 vendedores' },
];

const fmtARS = (val: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);

export default function ObjetivosConfigPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [targets, setTargets] = useState<MonthlyTarget[]>([]);
    const [loading, setLoading] = useState(true);
    const [dolarBlue, setDolarBlue] = useState<number | null>(null);

    // Edit modal state
    const [editingMonth, setEditingMonth] = useState<number | null>(null);
    const [editT1, setEditT1] = useState('');
    const [editT2, setEditT2] = useState('');
    const [editT3, setEditT3] = useState('');
    const [applyRestOfYear, setApplyRestOfYear] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedMonth, setSavedMonth] = useState<number | null>(null);

    const fetchTargets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/targets');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setTargets(data);
            }
        } catch (e) {
            console.error('Error fetching targets', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTargets();
        fetch('https://mercados.ambito.com//dolar/informal/variacion')
            .then(r => r.json())
            .then(json => {
                const venta = parseFloat(json.venta.replace('.', '').replace(',', '.'));
                if (!isNaN(venta)) setDolarBlue(venta);
            })
            .catch(() => { });
    }, [fetchTargets]);

    const getTargetFor = (month: number) => targets.find(t => t.month === month && t.year === year) || null;

    const openEdit = (month: number) => {
        const t = getTargetFor(month);
        setEditT1(String(Math.round(t?.target1 ?? DEFAULT_MONTHLY_TARGETS.target1)));
        setEditT2(String(Math.round(t?.target2 ?? DEFAULT_MONTHLY_TARGETS.target2)));
        setEditT3(String(Math.round(t?.target3 ?? DEFAULT_MONTHLY_TARGETS.target3)));
        setApplyRestOfYear(false);
        setEditingMonth(month);
    };

    const applyMultiplier = (factor: number) => {
        setEditT1(String(Math.round(DEFAULT_MONTHLY_TARGETS.target1 * factor)));
        setEditT2(String(Math.round(DEFAULT_MONTHLY_TARGETS.target2 * factor)));
        setEditT3(String(Math.round(DEFAULT_MONTHLY_TARGETS.target3 * factor)));
    };

    const handleSave = async () => {
        if (editingMonth === null) return;
        setSaving(true);
        try {
            const months = applyRestOfYear
                ? Array.from({ length: 12 - editingMonth + 1 }, (_, i) => editingMonth + i)
                : [editingMonth];

            for (const m of months) {
                await fetch('/api/targets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target1: editT1, target2: editT2, target3: editT3, month: m, year })
                });
            }
            setSavedMonth(editingMonth);
            setTimeout(() => setSavedMonth(null), 2500);
            setEditingMonth(null);
            await fetchTargets();
        } catch (e) {
            console.error('Error saving targets', e);
        }
        setSaving(false);
    };

    const toUSD = (ars: number) => (dolarBlue && dolarBlue > 0 ? Math.round(ars / dolarBlue) : null);

    return (
        <main className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8 pb-32">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <Link href="/admin/reportes" className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors mb-2">
                        <ArrowLeft className="w-3.5 h-3.5" /> Volver a Reportes
                    </Link>
                    <h1 className="text-3xl font-black text-stone-800 dark:text-white tracking-tight">Objetivos Mensuales</h1>
                    <p className="text-stone-500 dark:text-stone-400 mt-2 font-medium">
                        Configurá los 3 objetivos (Base, Stretch, Elite) de cada mes. Con 2 vendedores usá ×2; si alguien se incorpora a mitad de mes, ×1.5.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {dolarBlue && (
                        <div className="px-4 py-2.5 rounded-2xl bg-white/80 dark:bg-stone-800/80 border border-stone-200/60 dark:border-stone-700/60">
                            <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Dólar Blue</p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">${dolarBlue.toLocaleString('es-AR')}</p>
                        </div>
                    )}
                    <div className="flex items-center gap-2 bg-white/80 dark:bg-stone-800/80 p-2 rounded-2xl border border-stone-200/60 dark:border-stone-700/60">
                        <button onClick={() => setYear(y => y - 1)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors text-stone-500">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-lg font-black text-stone-800 dark:text-white px-2">{year}</span>
                        <button onClick={() => setYear(y => y + 1)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors text-stone-500">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Reference base values */}
            <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border border-stone-200/60 dark:border-stone-700/60 rounded-2xl p-5 flex flex-wrap items-center gap-x-8 gap-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Base de referencia (1 vendedor):</p>
                <span className="text-xs font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-emerald-500" /> Base {fmtARS(DEFAULT_MONTHLY_TARGETS.target1)}</span>
                <span className="text-xs font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-blue-500" /> Stretch {fmtARS(DEFAULT_MONTHLY_TARGETS.target2)}</span>
                <span className="text-xs font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-amber-500" /> Elite {fmtARS(DEFAULT_MONTHLY_TARGETS.target3)}</span>
            </div>

            {/* Months grid */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {MONTH_NAMES.map((name, idx) => {
                        const month = idx + 1;
                        const t = getTargetFor(month);
                        const t1 = t?.target1 ?? DEFAULT_MONTHLY_TARGETS.target1;
                        const t2 = t?.target2 ?? DEFAULT_MONTHLY_TARGETS.target2;
                        const t3 = t?.target3 ?? DEFAULT_MONTHLY_TARGETS.target3;
                        const isCurrent = month === now.getMonth() + 1 && year === now.getFullYear();
                        const approxFactor = t ? t.target1 / DEFAULT_MONTHLY_TARGETS.target1 : 1;

                        return (
                            <div
                                key={month}
                                className={`bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border rounded-2xl p-5 transition-all hover:shadow-lg ${
                                    isCurrent
                                        ? 'border-amber-300 dark:border-amber-700/60 ring-2 ring-amber-200/50 dark:ring-amber-800/30'
                                        : 'border-stone-200/60 dark:border-stone-700/60'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <p className="font-black text-stone-800 dark:text-white">{name}</p>
                                        {isCurrent && <span className="text-[8px] font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">Actual</span>}
                                        {savedMonth === month && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                    </div>
                                    {t ? (
                                        <span className="text-[9px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-1 rounded-lg flex items-center gap-1">
                                            <Users className="w-3 h-3" /> ×{Number(approxFactor.toFixed(2))}
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-lg">Default</span>
                                    )}
                                </div>

                                <div className="space-y-2 mb-4">
                                    {[
                                        { icon: Target, color: 'text-emerald-500', label: 'Base', val: t1 },
                                        { icon: Zap, color: 'text-blue-500', label: 'Stretch', val: t2 },
                                        { icon: Trophy, color: 'text-amber-500', label: 'Elite', val: t3 },
                                    ].map(({ icon: Icon, color, label, val }) => (
                                        <div key={label} className="flex items-center justify-between bg-stone-50 dark:bg-stone-900/40 rounded-xl px-3 py-2">
                                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-stone-400">
                                                <Icon className={`w-3.5 h-3.5 ${color}`} /> {label}
                                            </span>
                                            <span className="text-right">
                                                <span className="block text-sm font-black text-stone-800 dark:text-white">{fmtARS(val)}</span>
                                                {toUSD(val) !== null && <span className="block text-[9px] font-bold text-emerald-600 dark:text-emerald-400">≈ USD {toUSD(val)!.toLocaleString('es-AR')}</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => openEdit(month)}
                                    className="w-full py-2.5 rounded-xl bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors text-xs font-black uppercase tracking-widest text-stone-600 dark:text-stone-300"
                                >
                                    Editar
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit Modal */}
            {editingMonth !== null && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 rounded-3xl p-6 lg:p-8 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setEditingMonth(null)}
                            className="absolute top-6 right-6 text-stone-400 hover:text-stone-700 dark:hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-black text-stone-800 dark:text-white mb-1">
                            Objetivos de {MONTH_NAMES[editingMonth - 1]} {year}
                        </h3>
                        <p className="text-xs text-stone-400 font-medium mb-6">Ajuste rápido según cantidad de vendedores:</p>

                        {/* Quick multipliers */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {MULTIPLIERS.map(m => (
                                <button
                                    key={m.factor}
                                    onClick={() => applyMultiplier(m.factor)}
                                    className="p-3 rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all text-center"
                                >
                                    <span className="block text-lg font-black text-stone-800 dark:text-white">{m.label}</span>
                                    <span className="block text-[9px] font-bold text-stone-400 leading-tight mt-1">{m.desc}</span>
                                </button>
                            ))}
                        </div>

                        <div className="space-y-4">
                            {[
                                { label: 'Objetivo Base (ARS)', value: editT1, set: setEditT1 },
                                { label: 'Objetivo Stretch (ARS)', value: editT2, set: setEditT2 },
                                { label: 'Objetivo Elite (ARS)', value: editT3, set: setEditT3 },
                            ].map(f => (
                                <div key={f.label}>
                                    <label className="text-xs font-black uppercase tracking-widest text-stone-400 block mb-2">{f.label}</label>
                                    <input
                                        type="number"
                                        value={f.value}
                                        onChange={e => f.set(e.target.value)}
                                        className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 text-stone-800 dark:text-white font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
                                    />
                                    {dolarBlue && Number(f.value) > 0 && (
                                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                            ≈ USD {Math.round(Number(f.value) / dolarBlue).toLocaleString('es-AR')} · {fmtARS(Number(f.value))}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        <label className="flex items-center gap-3 mt-6 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={applyRestOfYear}
                                onChange={e => setApplyRestOfYear(e.target.checked)}
                                className="w-4 h-4 accent-amber-500"
                            />
                            <span className="text-xs font-bold text-stone-600 dark:text-stone-300">
                                Aplicar también a los meses restantes de {year} ({MONTH_NAMES[editingMonth - 1]} a Diciembre)
                            </span>
                        </label>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingMonth(null)}
                                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-stone-400 hover:text-stone-700 dark:hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
