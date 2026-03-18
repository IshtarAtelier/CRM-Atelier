'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Tag, Layers, ArrowUpRight, DollarSign, ShoppingCart, Percent, Calendar } from "lucide-react";
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
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
    setLoading(false);
  };

  const handlePeriodChange = (from: string, to: string, label: string) => {
    setPeriodLabel(label);
    setDateFrom(from || undefined);
    setDateTo(to || undefined);
    fetchDashboard(from || undefined, to || undefined, funnelEtiqueta, funnelTipo);
  };

  const d = data || {
    totalSoldMonth: 0,
    ordersCountMonth: 0,
    ticketPromedioMonth: 0,
    trendPct: null,
    funnel: { contacts: 0, quotes: 0, sales: 0, quoteRate: '0', saleRate: '0', etiquetas: [], tipos: [] },
    monthlyBilling: [],
    tagStats: [],
    typeStats: [],
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-stone-800 dark:text-stone-100 italic">
            Atelier Óptica <span className="text-primary not-italic">CRM</span>
          </h1>
          <p className="text-foreground/50 mt-1 font-medium italic uppercase text-[10px] tracking-widest">Inteligencia de Negocio y Control Administrativo</p>
        </div>
        <DashboardActions onPeriodChange={handlePeriodChange} />
      </header>

      {/* 1. Reporte General de Ventas */}
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

        {/* 3. Venta por Tipo de Producto */}
        <div className="bg-sidebar border border-sidebar-border rounded-2xl p-7 shadow-sm">
          <div className="flex items-center gap-2 mb-8">
            <Layers className="text-stone-600 w-5 h-5" />
            <h2 className="text-sm font-black uppercase tracking-widest">Facturación por Tipo</h2>
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
                    <div className="text-right">
                      <div className="font-black text-sm text-stone-800 dark:text-stone-200 tracking-tight">${type.total.toLocaleString()}</div>
                      {isAdmin && (
                        <div className={`text-[9px] font-black tracking-[0.1em] ${margin > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`}>
                          {margin.toFixed(1)}% RENTAB.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="Sin movimientos de productos." />
          )}
        </div>
      </div>

      {/* REPORTE HISTÓRICO MES A MES */}
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
