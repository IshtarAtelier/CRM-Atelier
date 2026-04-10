'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Tag, Layers, ArrowUpRight, DollarSign, ShoppingCart, Percent, Calendar, Clock, Calculator, User, ArrowRight } from "lucide-react";
import DashboardActions from "@/components/dashboard/DashboardActions";

interface DashboardData {
  totalSoldMonth: number;
  ordersCountMonth: number;
  ticketPromedioMonth: number;
  trendPct: string | null;
  funnel: { contacts: number; quotes: number; sales: number; quoteRate: string; saleRate: string; etiquetas: string[]; tipos: string[] };
  monthlyBilling: { name: string; total: number }[];
  tagStats: { name: string; total: number; count: number }[];
  typeStats: { name: string; total: number; count: number; cost: number }[];
  targets: { target1: number; target2: number; target3: number } | null;
  totalPendingBalance: number;
  totalQuotesValue: number;
  suggestedFollowUps: any[];
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodLabel, setPeriodLabel] = useState('Este Mes');
  const [funnelEtiqueta, setFunnelEtiqueta] = useState('ALL');
  const [funnelTipo, setFunnelTipo] = useState('ALL');
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();
  const [userRole, setUserRole] = useState('STAFF');
  const [dolarBlue, setDolarBlue] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        setUserRole(u.role || 'STAFF');
      }
    } catch { }
  }, []);

  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    fetchDashboard();
    // Fetch dólar blue venta from ambito.com
    fetch('https://mercados.ambito.com//dolar/informal/variacion')
      .then(r => r.json())
      .then(json => {
        const venta = parseFloat(json.venta.replace('.', '').replace(',', '.'));
        if (!isNaN(venta)) setDolarBlue(venta);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchDashboard(dateFrom, dateTo, funnelEtiqueta, funnelTipo);
  }, [funnelEtiqueta, funnelTipo]);

  const fetchDashboard = async (from?: string, to?: string, etiqueta?: string, tipo?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (etiqueta && etiqueta !== 'ALL') params.set('etiqueta', etiqueta);
      if (tipo && tipo !== 'ALL') params.set('tipo', tipo);
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (error: any) {
      console.error('Error fetching dashboard:', error);
      setData(null); // Reset to fallback state on error
    }
    setLoading(false);
  };

  const handlePeriodChange = (from: string, to: string, label: string) => {
    setPeriodLabel(label);
    setDateFrom(from || undefined);
    setDateTo(to || undefined);
    fetchDashboard(from || undefined, to || undefined, funnelEtiqueta, funnelTipo);
  };

  const d = data && !('error' in data) ? data : {
    totalSoldMonth: 0,
    ordersCountMonth: 0,
    ticketPromedioMonth: 0,
    trendPct: null,
    funnel: { contacts: 0, quotes: 0, sales: 0, quoteRate: '0', saleRate: '0', etiquetas: [], tipos: [] },
    monthlyBilling: [],
    tagStats: [],
    typeStats: [],
    targets: null,
    totalPendingBalance: 0,
    totalQuotesValue: 0,
    suggestedFollowUps: [],
  };

  const currentTotal = d.totalSoldMonth || 0;
  
  // Base USD equivalents: $18M ≈ 12k, $24M ≈ 16k, $30M ≈ 20k (using 1500 as initial ref)
  const refUSD1 = 12000;
  const refUSD2 = 16000;
  const refUSD3 = 20000;

  // Actual targets are the MAX between the base pesos and the current USD equivalent
  const t1 = Math.max(d.targets?.target1 || 18000000, refUSD1 * (dolarBlue || 0));
  const t2 = Math.max(d.targets?.target2 || 24000000, refUSD2 * (dolarBlue || 0));
  const t3 = Math.max(d.targets?.target3 || 30000000, refUSD3 * (dolarBlue || 0));
  
  const progress1 = t1 > 0 ? Math.min((currentTotal / t1) * 100, 100) : 0;
  const progress2 = t2 > 0 ? Math.min((currentTotal / t2) * 100, 100) : 0;
  const progress3 = t3 > 0 ? Math.min((currentTotal / t3) * 100, 100) : 0;

  const toUSD = (ars: number) => (dolarBlue && ars) ? (ars / dolarBlue) : null;

  // Motivation / Pace logic
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = Math.max(now.getDate(), 1);
  const paceTotal = (currentTotal / currentDay) * daysInMonth;
  const isPaceAboveT1 = paceTotal >= t1;
  const isPaceAboveT2 = paceTotal >= t2;
  const isPaceAboveT3 = paceTotal >= t3;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-4xl font-extrabold tracking-tight text-stone-800 dark:text-stone-100 italic">
            Atelier Óptica <span className="text-primary not-italic">CRM</span>
          </h1>
          <p className="text-foreground/50 mt-1 font-medium italic uppercase text-[8px] lg:text-[10px] tracking-widest leading-none">Inteligencia de Negocio y Control Administrativo</p>
        </div>
        <DashboardActions onPeriodChange={handlePeriodChange} />
      </header>

      {/* OBJETIVOS MENSUALES / META DEL MES */}
      <section className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-3xl p-5 lg:p-8 shadow-2xl relative overflow-hidden text-white border border-white/5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-xl">
                <TrendingUp className="text-primary w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Objetivos Mensuales</h2>
                <p className="text-base lg:text-lg font-bold">Progreso {periodLabel}</p>
              </div>
            </div>
            {isAdmin && dolarBlue && (
              <div className="flex items-center justify-between lg:justify-end gap-4 lg:ml-auto bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Dólar Blue Venta</p>
                <p className="text-base lg:text-lg font-black text-emerald-400">${dolarBlue.toLocaleString()}</p>
              </div>
            )}
          </div>

            {/* Motivation / Proyección de fin de mes */}
            <div className="mb-8 p-6 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${paceTotal >= t1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-stone-400">Proyección de Cierre</p>
                    <p className="text-lg lg:text-2xl font-black italic tracking-tighter">
                      Estado: <span className={paceTotal >= t1 ? 'text-emerald-400' : 'text-amber-400'}>{paceTotal >= t1 ? 'RITMO EXCELENTE' : 'A SUBIR EL PROMEDIO'}</span>
                    </p>
                  </div>
                </div>
                <div className="max-w-md">
                  <p className="text-xs font-bold text-stone-300 leading-relaxed">
                    {paceTotal >= t3 ? '🚀 ¡ESTÁN EN NIVEL ELITE! Si mantienen este ritmo, van a pulverizar todos los records este mes.' :
                     paceTotal >= t2 ? '⭐ Excelente ritmo. Están camino a superar el Objetivo Ideal. ¡Sigan así!' :
                     paceTotal >= t1 ? '✅ Van por buen camino para cumplir el objetivo del mes. ¡Fuerza en el tramo final!' :
                     '💪 ¡A meterle pilas! Necesitan subir un poco el promedio diario para alcanzar la primera meta.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Objetivo 1 (Always shown but simplified for STAFF) */}
              <div className="space-y-4 max-w-4xl mx-auto">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
                      {isAdmin ? 'Primer Objetivo' : 'Meta del Mes'}
                    </p>
                    {isAdmin ? (
                      <h3 className="text-2xl font-black italic">${t1.toLocaleString()}</h3>
                    ) : (
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-primary">Camino al Objetivo</h3>
                    )}
                    {isAdmin && toUSD(t1) && <p className="text-[11px] font-bold text-emerald-400/70 mt-0.5">≈ USD {Math.round(toUSD(t1)!).toLocaleString()}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`text-4xl font-black ${progress1 >= 100 ? 'text-emerald-400' : 'text-primary'}`}>
                      {progress1.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-6 bg-white/5 rounded-full overflow-hidden p-1.5 backdrop-blur-sm border border-white/10">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(var(--primary),0.5)] ${progress1 >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                    style={{ width: `${progress1}%` }}
                  />
                </div>
                {!isAdmin && (
                  <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest text-center">
                    {progress1 >= 100 ? '¡Objetivo Principal alcanzado! 🏆' : '¡Seguí sumando ventas para alcanzar la meta!'}
                  </p>
                )}
                {isAdmin && (
                  <p className="text-[9px] font-bold text-stone-500 uppercase tracking-tighter">
                    {progress1 >= 100 ? '¡Objetivo Alcanzado!' : `Faltan $${Math.max(t1 - currentTotal, 0).toLocaleString()} para la meta.`}
                    {toUSD(currentTotal) && <span className="ml-2 text-emerald-400/50">· Facturado: USD {Math.round(toUSD(currentTotal)!).toLocaleString()}</span>}
                  </p>
                )}
              </div>

              {/* Objetivos 2 & 3 only for Admin to keep Staff dashboard clean and avoid reveal */}
              {isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/5">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Segundo Objetivo (Stretch)</p>
                        <h3 className="text-2xl font-black italic text-stone-200">${t2.toLocaleString()}</h3>
                        {toUSD(t2) && <p className="text-[11px] font-bold text-emerald-400/70 mt-0.5">≈ USD {Math.round(toUSD(t2)!).toLocaleString()}</p>}
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-black ${progress2 >= 100 ? 'text-emerald-400' : 'text-stone-400'}`}>
                          {progress2.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden p-1 backdrop-blur-sm border border-white/10">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(34,197,94,0.3)] ${progress2 >= 100 ? 'bg-emerald-500' : 'bg-stone-600'}`}
                        style={{ width: `${progress2}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Tercer Objetivo (Elite)</p>
                        <h3 className="text-2xl font-black italic text-stone-300">${t3.toLocaleString()}</h3>
                        {toUSD(t3) && <p className="text-[11px] font-bold text-emerald-400/70 mt-0.5">≈ USD {Math.round(toUSD(t3)!).toLocaleString()}</p>}
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-black ${progress3 >= 100 ? 'text-emerald-400' : 'text-stone-500'}`}>
                          {progress3.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden p-1 backdrop-blur-sm border border-white/10">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(168,85,247,0.3)] ${progress3 >= 100 ? 'bg-emerald-500' : 'bg-purple-500/70'}`}
                        style={{ width: `${progress3}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
        </div>
      </section>


      {/* FACTURACIÓN FUTURA Y PIPELINE — Only for Admin */}
      {isAdmin && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-xl border border-stone-100 dark:border-stone-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Saldo por Cobrar</h3>
            </div>
            <p className="text-3xl font-black tracking-tighter text-stone-800 dark:text-white">${d.totalPendingBalance.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-stone-500 mt-2 uppercase tracking-tight">Cobros pendientes de ventas confirmadas</p>
          </div>

          <div className="md:col-span-1 bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-xl border border-stone-100 dark:border-stone-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <Calculator className="w-5 h-5" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Presupuestos en Curso</h3>
            </div>
            <p className="text-3xl font-black tracking-tighter text-stone-800 dark:text-white">${d.totalQuotesValue.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-stone-500 mt-2 uppercase tracking-tight">Valor total de presupuestos abiertos</p>
          </div>

          <div className="md:col-span-1 bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 shadow-xl shadow-primary/20 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-colors" />
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white/20 p-2 rounded-xl">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/70">Potencial Total</h3>
            </div>
            <p className="text-3xl font-black tracking-tighter">${(d.totalPendingBalance + d.totalQuotesValue).toLocaleString()}</p>
            <p className="text-[9px] font-bold text-white/50 mt-2 uppercase tracking-tight">Saldos + Presupuestos abiertos</p>
          </div>
        </section>
      )}


      {/* 1. Reporte General de Ventas / Métricas — Only for Admin */}
      {isAdmin && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary w-5 h-5" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">
              Métricas — {periodLabel}
            </h2>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
            <StatsCard
              title="Total Facturado"
              value={`$${d.totalSoldMonth.toLocaleString()}`}
              icon={DollarSign}
              trend={d.trendPct ? `${Number(d.trendPct) >= 0 ? '+' : ''}${d.trendPct}%` : '+0%'}
              sub="Vs período anterior"
            />
            <StatsCard
              title="Cantidad de Pedidos"
              value={d.ordersCountMonth}
              icon={ShoppingCart}
              trend={`${d.ordersCountMonth}`}
              sub="Operaciones"
            />
            <StatsCard
              title="Ticket Promedio"
              value={`$${Math.round(d.ticketPromedioMonth).toLocaleString()}`}
              icon={Percent}
              trend={d.ticketPromedioMonth > 0 ? 'Activo' : '—'}
              sub="Por operación"
            />
          </div>
        </section>
      )}


      {/* TAREAS DE SEGUIMIENTO (Multifocales) */}
      {d.suggestedFollowUps.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="text-primary w-5 h-5" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Seguimiento Sugerido (Multifocales)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {d.suggestedFollowUps.map(o => (
              <a 
                key={o.id}
                href={`/contactos?search=${encodeURIComponent(o.client.name)}`}
                className="bg-white dark:bg-stone-900 border-2 border-primary/10 hover:border-primary/40 rounded-3xl p-5 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full -mr-8 -mt-8 blur-xl group-hover:bg-primary/10 transition-colors" />
                <div className="flex justify-between items-start mb-3 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{o.client.name.split(' ')[0]}</p>
                      <p className="text-xs font-bold text-stone-800 dark:text-white truncate max-w-[120px]">{o.client.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
                      Hace {Math.ceil((now.getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24))}d
                    </span>
                  </div>
                </div>
                <div className="space-y-2 relative z-10">
                  <p className="text-[10px] font-bold text-stone-500">
                    {o.items.map((it: any) => `${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''}`).join(', ')}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-50 dark:border-stone-800">
                    <span className="text-sm font-black text-primary">${o.total.toLocaleString()}</span>
                    <span className="text-[9px] font-black uppercase text-stone-400 flex items-center gap-1 group-hover:text-primary transition-colors">
                      VER DETALLE <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        {/* Conversion Funnel */}
        <section className="bg-sidebar border border-sidebar-border rounded-2xl p-7 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <ArrowUpRight className="text-primary w-5 h-5" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Embudo de Conversión</h2>
            <div className="flex items-center gap-2 ml-auto">
              {d.funnel.etiquetas.length > 0 && (
                <select
                  value={funnelEtiqueta}
                  onChange={(e) => setFunnelEtiqueta(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 outline-none focus:border-primary cursor-pointer appearance-none pr-7"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  <option value="ALL">Todas las etiquetas</option>
                  {d.funnel.etiquetas.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              )}
              {d.funnel.tipos.length > 0 && (
                <select
                  value={funnelTipo}
                  onChange={(e) => setFunnelTipo(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 outline-none focus:border-primary cursor-pointer appearance-none pr-7"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  <option value="ALL">Todos los tipos</option>
                  {d.funnel.tipos.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Contactos', value: d.funnel.contacts, color: 'bg-blue-500', width: '100%' },
              { label: 'Presupuestos', value: d.funnel.quotes, color: 'bg-amber-500', width: d.funnel.contacts > 0 ? `${Math.max((d.funnel.quotes / d.funnel.contacts) * 100, 15)}%` : '15%', rate: d.funnel.quoteRate },
              { label: 'Ventas', value: d.funnel.sales, color: 'bg-emerald-500', width: d.funnel.contacts > 0 ? `${Math.max((d.funnel.sales / d.funnel.contacts) * 100, 10)}%` : '10%', rate: d.funnel.saleRate },
            ].map((step) => (
              <div key={step.label} className="flex flex-col items-center gap-2">
                <span className="text-3xl font-black text-stone-800 dark:text-stone-100">{step.value}</span>
                <div className="w-full h-3 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div className={`h-full rounded-full ${step.color} transition-all duration-1000`} style={{ width: step.width }} />
                </div>
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{step.label}</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 border border-primary/10 ${step.rate ? 'text-primary' : 'text-transparent'}`}>
                  {step.rate ? `${step.rate}% conv.` : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Venta por Tipo de Producto — Hide values for Staff */}
        <div className="bg-sidebar border border-sidebar-border rounded-2xl p-7 shadow-sm">
          <div className="flex items-center gap-2 mb-8">
            <Layers className="text-stone-600 w-5 h-5" />
            <h2 className="text-sm font-black uppercase tracking-widest">Ventas por Tipo</h2>
          </div>
          {d.typeStats.length > 0 ? (
            <div className="space-y-3">
              {d.typeStats.map((type) => {
                const rentabilidad = type.total - type.cost;
                const margin = type.total > 0 ? (rentabilidad / type.total) * 100 : 0;
                return (
                  <div key={type.name} className="flex items-center justify-between p-4 rounded-xl bg-stone-50 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all border border-transparent hover:border-sidebar-border group">
                    <div>
                      <h4 className="font-black text-xs uppercase group-hover:text-primary transition-colors tracking-tight">{type.name}</h4>
                      <p className="text-[9px] text-foreground/40 font-bold tracking-widest">{type.count} UNIDADES</p>
                    </div>
                    {isAdmin && (
                      <div className="text-right">
                        <div className="font-black text-sm text-stone-800 dark:text-stone-200 tracking-tight">${type.total.toLocaleString()}</div>
                        <div className={`text-[9px] font-black tracking-[0.1em] ${margin > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`}>
                          {margin.toFixed(1)}% RENTAB.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="Sin movimientos de productos." />
          )}
        </div>

      </div>

      {/* REPORTE HISTÓRICO MES A MES — Only for Admin */}
      {isAdmin && (
        <section className={`bg-sidebar border border-sidebar-border rounded-2xl p-8 shadow-sm relative overflow-hidden transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Calendar className="w-32 h-32 text-primary" />
          </div>

          <div className="flex items-center gap-2 mb-10">
            <Calendar className="text-primary w-5 h-5" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em]">Facturación Histórica (Mes a Mes)</h2>
          </div>

          {d.monthlyBilling.length > 0 ? (
            <div className="flex items-end gap-4 h-56 px-2">
              {d.monthlyBilling.map((month) => {
                const maxTotal = Math.max(...d.monthlyBilling.map(m => m.total));
                const height = maxTotal > 0 ? (month.total / maxTotal) * 100 : 0;
                return (
                  <div key={month.name} className="flex-1 flex flex-col items-center gap-4 group h-full">
                    <div className="relative w-full flex justify-center flex-1 items-end h-full">
                      <div className="absolute bottom-full mb-3 bg-stone-900 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 whitespace-nowrap z-20 shadow-xl border border-white/10">
                        ${month.total.toLocaleString()}
                      </div>
                      <div
                        className="w-full max-w-[50px] bg-primary/10 group-hover:bg-primary/50 rounded-t-xl transition-all duration-700 cursor-pointer hover:shadow-[0_-5px_20px_rgba(var(--primary),0.2)]"
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest group-hover:text-primary transition-colors">{month.name}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No hay datos históricos suficientes para el gráfico." />
          )}
        </section>
      )}

    </div>
  );
}

function StatsCard({ title, value, icon: Icon, trend, sub }: any) {
  return (
    <div className="bg-sidebar border border-sidebar-border rounded-2xl p-7 shadow-sm group hover:shadow-lg hover:border-primary/20 transition-all flex justify-between items-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
      <div className="relative z-10">
        <p className="text-stone-400 font-black text-[10px] uppercase tracking-[0.2em] mb-2">{title}</p>
        <h3 className="text-4xl font-black text-stone-800 dark:text-stone-100 tracking-tight">{value}</h3>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-primary border border-primary/10 uppercase tracking-tighter">
            {trend}
          </span>
          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.1em]">{sub}</span>
        </div>
      </div>
      <div className="relative z-10 bg-stone-50 dark:bg-stone-800 p-4 rounded-2xl group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all shadow-inner border border-sidebar-border group-hover:border-primary">
        <Icon className="w-6 h-6 text-primary transition-colors group-hover:text-white" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-sidebar-border rounded-3xl bg-stone-50/30 dark:bg-stone-900/10">
      <div className="p-5 bg-white dark:bg-stone-800 rounded-3xl mb-4 shadow-sm border border-sidebar-border">
        <ArrowUpRight className="w-7 h-7 text-stone-200" />
      </div>
      <p className="text-stone-300 text-[10px] font-black uppercase tracking-[0.25em] text-center px-4">{message}</p>
    </div>
  );
}
