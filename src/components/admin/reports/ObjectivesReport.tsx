import React from 'react';
import Link from 'next/link';
import { Target, Zap, Trophy, Settings, Users, CircleDashed } from 'lucide-react';

export interface MonthObjective {
    key: string;
    label: string;
    year: number;
    month: number;
    billed: number;
    collected: number;
    orders: number;
    grossProfit: number;
    netProfit: number;
    targets: {
        target1: number; target2: number; target3: number;
        usd1: number | null; usd2: number | null; usd3: number | null;
        currency: string; rate: number | null; isCustom: boolean;
    };
    reachedLevel: 0 | 1 | 2 | 3;
    vendors: { name: string; billed: number; orders: number }[];
}

const LEVELS = [
    {
        label: 'Sin alcanzar',
        icon: CircleDashed,
        badge: 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700',
    },
    {
        label: 'Base',
        icon: Target,
        badge: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50',
    },
    {
        label: 'Stretch',
        icon: Zap,
        badge: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50',
    },
    {
        label: 'Elite',
        icon: Trophy,
        badge: 'bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-950/60 dark:to-yellow-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700/50 shadow-sm shadow-amber-200/50 dark:shadow-none',
    },
];

const fmtARS = (val: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);

const fmtUSD = (val: number) =>
    `USD ${Math.round(val).toLocaleString('es-AR')}`;

export function ObjectivesReport({ data, dolarBlue }: { data: MonthObjective[]; dolarBlue: number | null }) {
    if (!data || data.length === 0) return null;

    const toUSD = (ars: number) => (dolarBlue && dolarBlue > 0 ? ars / dolarBlue : null);

    return (
        <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border border-stone-200/60 dark:border-stone-700/60 rounded-3xl p-6 lg:p-8 shadow-xl shadow-stone-200/20 dark:shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-500">
                        <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Objetivos</h2>
                        <p className="text-xl font-black text-stone-800 dark:text-white tracking-tight">Cumplimiento Mensual</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {dolarBlue && (
                        <div className="px-4 py-2 rounded-xl bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700">
                            <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Dólar Blue (hoy)</p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">${dolarBlue.toLocaleString('es-AR')}</p>
                        </div>
                    )}
                    <Link
                        href="/admin/configuracion/objetivos"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors text-xs font-black uppercase tracking-widest text-stone-600 dark:text-stone-300"
                    >
                        <Settings className="w-4 h-4" />
                        Configurar
                    </Link>
                </div>
            </div>

            <div className="space-y-6">
                {data.map((m) => {
                    const level = LEVELS[m.reachedLevel];
                    const LevelIcon = level.icon;
                    const { target1, target2, target3, usd1, usd2, usd3, isCustom } = m.targets;
                    const scale = Math.max(target3, m.billed, 1);
                    const barPct = Math.min((m.billed / scale) * 100, 100);
                    const billedUSD = toUSD(m.billed);
                    const profitUSD = toUSD(m.netProfit);
                    const nextTarget = m.reachedLevel === 0 ? target1 : m.reachedLevel === 1 ? target2 : m.reachedLevel === 2 ? target3 : null;

                    return (
                        <div key={m.key} className="bg-white dark:bg-stone-900/50 rounded-2xl border border-stone-100 dark:border-stone-800 p-5 lg:p-6">
                            {/* Header row: month + badge */}
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                                <div className="flex items-center gap-3">
                                    <p className="text-lg font-black text-stone-800 dark:text-white tracking-tight">{m.label}</p>
                                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${level.badge}`}>
                                        <LevelIcon className="w-3.5 h-3.5" />
                                        {m.reachedLevel > 0 ? `Objetivo ${level.label}` : 'Sin objetivo alcanzado'}
                                    </span>
                                    {isCustom && (
                                        <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-lg">
                                            Personalizado
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{m.orders} ventas</p>
                            </div>

                            {/* Metrics grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                                <div className="bg-stone-50 dark:bg-stone-800/40 rounded-xl p-3.5">
                                    <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Facturado</p>
                                    <p className="text-base font-black text-stone-800 dark:text-white">{fmtARS(m.billed)}</p>
                                    {billedUSD !== null && <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">≈ {fmtUSD(billedUSD)}</p>}
                                </div>
                                <div className="bg-stone-50 dark:bg-stone-800/40 rounded-xl p-3.5">
                                    <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Cobrado</p>
                                    <p className="text-base font-black text-stone-800 dark:text-white">{fmtARS(m.collected)}</p>
                                </div>
                                <div className="bg-stone-50 dark:bg-stone-800/40 rounded-xl p-3.5">
                                    <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Ganancia del Mes</p>
                                    <p className={`text-base font-black ${m.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{fmtARS(m.netProfit)}</p>
                                    {profitUSD !== null && <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">≈ {fmtUSD(profitUSD)}</p>}
                                </div>
                                <div className="bg-stone-50 dark:bg-stone-800/40 rounded-xl p-3.5">
                                    <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1">Próximo Objetivo</p>
                                    {nextTarget ? (
                                        <>
                                            <p className="text-base font-black text-stone-800 dark:text-white">{fmtARS(nextTarget)}</p>
                                            <p className="text-[11px] font-bold text-stone-400 mt-0.5">Faltan {fmtARS(Math.max(nextTarget - m.billed, 0))}</p>
                                        </>
                                    ) : (
                                        <p className="text-base font-black text-amber-500">Elite superado 🏆</p>
                                    )}
                                </div>
                            </div>

                            {/* Progress bar with the 3 target markers */}
                            <div className="mb-2">
                                <div className="relative h-3.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-visible">
                                    <div
                                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                                            m.reachedLevel === 3 ? 'bg-gradient-to-r from-amber-400 to-yellow-500' :
                                            m.reachedLevel === 2 ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
                                            m.reachedLevel === 1 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                                            'bg-gradient-to-r from-stone-300 to-stone-400 dark:from-stone-600 dark:to-stone-500'
                                        }`}
                                        style={{ width: `${barPct}%` }}
                                    />
                                    {[
                                        { val: target1, label: 'Base' },
                                        { val: target2, label: 'Stretch' },
                                        { val: target3, label: 'Elite' },
                                    ].map((t) => (
                                        <div
                                            key={t.label}
                                            className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-stone-400 dark:bg-stone-500 rounded-full"
                                            style={{ left: `${Math.min((t.val / scale) * 100, 100)}%` }}
                                            title={`${t.label}: ${fmtARS(t.val)}`}
                                        />
                                    ))}
                                </div>
                                <div className="flex justify-between mt-2 text-[9px] font-bold text-stone-400 uppercase tracking-widest">
                                    <span>Base {usd1 ? `${fmtUSD(usd1)} · ` : ''}{fmtARS(target1)}</span>
                                    <span>Stretch {usd2 ? `${fmtUSD(usd2)} · ` : ''}{fmtARS(target2)}</span>
                                    <span>Elite {usd3 ? `${fmtUSD(usd3)} · ` : ''}{fmtARS(target3)}</span>
                                </div>
                            </div>

                            {/* Vendors breakdown */}
                            <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800">
                                <div className="flex items-center gap-2 mb-3">
                                    <Users className="w-3.5 h-3.5 text-stone-400" />
                                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Ventas por Vendedor</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {m.vendors.map((v) => {
                                        const share = m.billed > 0 ? (v.billed / m.billed) * 100 : 0;
                                        return (
                                            <div key={v.name} className="bg-stone-50 dark:bg-stone-800/40 rounded-xl p-3">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-sm font-black text-stone-700 dark:text-stone-200">{v.name}</span>
                                                    <span className="text-[10px] font-bold text-stone-400">{v.orders} ventas · {share.toFixed(0)}%</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-500 rounded-full" style={{ width: `${share}%` }} />
                                                    </div>
                                                    <span className="text-sm font-black text-violet-600 dark:text-violet-400 whitespace-nowrap">{fmtARS(v.billed)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="mt-6 text-[10px] font-medium text-stone-400 leading-relaxed">
                Los objetivos están configurados <strong>en dólares</strong> y se convierten a pesos con el blue del día; el cumplimiento se mide contra lo <strong>facturado</strong> del mes (mismo criterio que el dashboard). La ganancia descuenta CMV, descuentos, comisiones y los costos fijos/marketing cargados para ese mes.
            </p>
        </div>
    );
}
