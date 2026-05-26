'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Tag, Layers, ArrowUpRight, DollarSign, ShoppingCart, Percent, Calendar, Clock, Calculator, User, ArrowRight, Megaphone, MessageCircle, ExternalLink, Mail, Loader2, CheckCircle2 } from "lucide-react";
import DashboardActions from "@/components/dashboard/DashboardActions";
import DashboardObjectives from "@/components/dashboard/DashboardObjectives";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface AbandonedCart {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cartData: any[];
  total: number;
  status: string;
  updatedAt: string;
}

interface DashboardData {
  totalSoldMonth: number;
  totalPaidMonth: number;
  ordersCountMonth: number;
  ticketPromedioMonth: number;
  trendPct: string | null;
  funnel: { contacts: number; quotes: number; sales: number; quoteRate: string; saleRate: string; etiquetas: string[]; tipos: string[] };
  monthlyBilling: { name: string; total: number }[];
  tagStats: { name: string; total: number; count: number }[];
  locationStats: { name: string; total: number; count: number }[];
  typeStats: { name: string; total: number; count: number; cost: number }[];
  targets: { target1: number; target2: number; target3: number } | null;
  totalPendingBalance: number;
  totalQuotesValue: number;
  confirmedCount: number;
  confirmedTotal: number;
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
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [emailSending, setEmailSending] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<Set<string>>(new Set());
  const now = new Date();

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
    // Fetch dólar blue venta from ambito.com (only on mount)
    fetch('https://mercados.ambito.com//dolar/informal/variacion')
      .then(r => r.json())
      .then(json => {
        const venta = parseFloat(json.venta.replace('.', '').replace(',', '.'));
        if (!isNaN(venta)) setDolarBlue(venta);
      })
      .catch(() => {});

    // Fetch abandoned carts
    fetch('/api/checkout/session')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAbandonedCarts(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchDashboard(dateFrom, dateTo, funnelEtiqueta, funnelTipo);
  }, [dateFrom, dateTo, funnelEtiqueta, funnelTipo]);

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
  };

  const d = data && !('error' in data) ? data : {
    totalSoldMonth: 0,
    totalPaidMonth: 0,
    ordersCountMonth: 0,
    ticketPromedioMonth: 0,
    trendPct: null,
    funnel: { contacts: 0, quotes: 0, sales: 0, quoteRate: '0', saleRate: '0', etiquetas: [], tipos: [] },
    monthlyBilling: [],
    tagStats: [],
    locationStats: [],
    typeStats: [],
    targets: null,
    totalPendingBalance: 0,
    totalQuotesValue: 0,
    confirmedCount: 0,
    confirmedTotal: 0,
    suggestedFollowUps: [],
  };

  const currentTotal = d.totalSoldMonth || 0;

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

      {/* 1. Reporte General de Ventas / Métricas — Only for Admin */}
      {isAdmin && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary w-5 h-5" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">
              Métricas — {periodLabel}
            </h2>
          </div>
          <div className={`flex gap-6 overflow-x-auto pb-4 no-scrollbar transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
            <div className="min-w-[260px] flex-1">
              <StatsCard
                title="Total Facturado"
                value={`$${d.totalSoldMonth.toLocaleString()}`}
                icon={DollarSign}
                trend={d.trendPct ? `${Number(d.trendPct) >= 0 ? '+' : ''}${d.trendPct}%` : '+0%'}
                sub="Monto total pactado"
                highlight={true}
              />
            </div>
            <div className="min-w-[260px] flex-1">
              <StatsCard
                title="Total Cobrado"
                value={`$${(d.totalPaidMonth || 0).toLocaleString()}`}
                icon={DollarSign}
                trend={`${Math.round(((d.totalPaidMonth || 0) / (d.totalSoldMonth || 1)) * 100)}%`}
                sub="Efectivo en caja"
                highlight={false}
              />
            </div>
            <div className="min-w-[260px] flex-1">
              <StatsCard
                title="Cantidad de Pedidos"
                value={d.ordersCountMonth}
                icon={ShoppingCart}
                trend={`${d.ordersCountMonth}`}
                sub="Operaciones"
              />
            </div>
            <div className="min-w-[260px] flex-1">
              <StatsCard
                title="Ticket Promedio"
                value={`$${Math.round(d.ticketPromedioMonth).toLocaleString()}`}
                icon={Percent}
                trend={d.ticketPromedioMonth > 0 ? 'Activo' : '—'}
                sub="Por operación"
              />
            </div>
            <div className="min-w-[260px] flex-1">
              <StatsCard
                title="Nuevos Contactos"
                value={d.funnel.contacts}
                icon={User}
                trend={`${d.funnel.contacts}`}
                sub="Ingresados en período"
              />
            </div>
          </div>
        </section>
      )}

      {/* OBJETIVOS MENSUALES / META DEL MES */}
      <DashboardObjectives 
        currentTotal={currentTotal}
        targets={d.targets}
        dolarBlue={dolarBlue}
        isAdmin={isAdmin}
        periodLabel={periodLabel}
      />



      {/* FINANZAS Y PROYECCIONES — Only for Admin */}
      {isAdmin && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Saldos por Cobrar */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-xl border border-stone-100 dark:border-stone-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-red-500/10 transition-colors" />
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-500/10 p-2 rounded-xl text-red-500">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Saldos por Cobrar</h3>
            </div>
            <p className="text-xl md:text-2xl font-black tracking-tighter text-stone-800 dark:text-white truncate">${d.totalPendingBalance.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-stone-500 mt-2 uppercase tracking-tight">Deuda pendiente global</p>
          </div>

          {/* Confirmados */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-xl border border-stone-100 dark:border-stone-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Confirmados</h3>
            </div>
            <p className="text-xl md:text-2xl font-black tracking-tighter text-stone-800 dark:text-white truncate">${d.confirmedTotal.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-stone-500 mt-2 uppercase tracking-tight">{d.confirmedCount} Presupuestos aprobados</p>
          </div>

          {/* Presupuestos Abiertos */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-xl border border-stone-100 dark:border-stone-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-amber-500/10 transition-colors" />
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Presupuestos Abiertos</h3>
            </div>
            <p className="text-xl md:text-2xl font-black tracking-tighter text-stone-800 dark:text-white truncate">${d.totalQuotesValue.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-stone-500 mt-2 uppercase tracking-tight">Potencial de ventas del mes</p>
          </div>
        </section>
      )}


      {/* TAREAS DE SEGUIMIENTO (Multifocales) */}
      {d.suggestedFollowUps.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="text-primary w-5 h-5" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Seguimiento Sugerido (Multifocales / Alta Gama)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {d.suggestedFollowUps.map(o => (
              <a 
                key={o.id}
                href={`/admin/contactos?id=${o.client?.id}`}
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
                  <p className="text-[10px] font-bold text-stone-500 line-clamp-2">
                    {Array.from(new Set(o.items.map((it: any) => `${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}`.trim()).filter(Boolean))).join(' + ')}
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

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        {/* Conversion Funnel */}
        <section className="bg-sidebar border border-sidebar-border rounded-2xl p-7 shadow-sm md:col-span-1 lg:col-span-1">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <ArrowUpRight className="text-primary w-5 h-5" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Embudo de Conversión</h2>
            <div className="flex items-center gap-2 ml-auto">
              {d.funnel.etiquetas.length > 0 && (
                <select
                  value={funnelEtiqueta}
                  onChange={(e) => setFunnelEtiqueta(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 outline-none focus:border-primary cursor-pointer appearance-none pr-7"
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
                  className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 outline-none focus:border-primary cursor-pointer appearance-none pr-7"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4">
            {[
              { label: 'Contactos', value: d.funnel.contacts, color: 'bg-blue-500', width: '100%' },
              { label: 'Presupuestos', value: d.funnel.quotes, color: 'bg-amber-500', width: d.funnel.contacts > 0 ? `${Math.max((d.funnel.quotes / d.funnel.contacts) * 100, 15)}%` : '15%', rate: d.funnel.quoteRate },
              { label: 'Ventas', value: d.funnel.sales, color: 'bg-emerald-500', width: d.funnel.contacts > 0 ? `${Math.max((d.funnel.sales / d.funnel.contacts) * 100, 10)}%` : '10%', rate: d.funnel.saleRate },
            ].map((step) => (
              <div key={step.label} className="flex flex-col items-center gap-2">
                <span className="text-xl md:text-2xl font-black text-stone-800 dark:text-stone-100">{step.value}</span>
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
        <div className="bg-sidebar border border-sidebar-border rounded-2xl p-7 shadow-sm md:col-span-1 lg:col-span-1">
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
                  <div key={type.name} className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl bg-stone-50 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all border border-transparent hover:border-sidebar-border group">
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

        {/* 3.5 Venta por Origen (Local vs Online) */}
        <div className="bg-sidebar border border-sidebar-border rounded-2xl p-7 shadow-sm md:col-span-1 lg:col-span-1">
          <div className="flex items-center gap-2 mb-8">
            <ShoppingCart className="text-stone-600 w-5 h-5" />
            <h2 className="text-sm font-black uppercase tracking-widest">Tráfico por Canal</h2>
          </div>
          {d.locationStats && d.locationStats.length > 0 ? (
            <div className="space-y-3">
              {d.locationStats.sort((a, b) => b.total - a.total).map((loc) => {
                return (
                  <div key={loc.name} className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl bg-stone-50 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all border border-transparent hover:border-sidebar-border group">
                    <div>
                      <h4 className="font-black text-xs uppercase group-hover:text-primary transition-colors tracking-tight">{loc.name}</h4>
                      <p className="text-[9px] text-foreground/40 font-bold tracking-widest">{loc.count} VENTAS</p>
                    </div>
                    {isAdmin && (
                      <div className="text-right">
                        <div className="font-black text-sm text-stone-800 dark:text-stone-200 tracking-tight">${loc.total.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="Sin datos de canales." />
          )}
        </div>

        {/* 4. Venta por Etiquetas — Hide values for Staff */}
        <div className="bg-sidebar border border-sidebar-border rounded-2xl p-7 shadow-sm md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-8">
            <Tag className="text-stone-600 w-5 h-5" />
            <h2 className="text-sm font-black uppercase tracking-widest">Desempeño por Etiqueta</h2>
          </div>
          {d.tagStats.length > 0 ? (
            <div className="space-y-3">
              {d.tagStats.sort((a, b) => b.total - a.total).slice(0, 5).map((tag) => {
                return (
                  <div key={tag.name} className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl bg-stone-50 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all border border-transparent hover:border-sidebar-border group">
                    <div>
                      <h4 className="font-black text-xs uppercase group-hover:text-primary transition-colors tracking-tight">{tag.name}</h4>
                      <p className="text-[9px] text-foreground/40 font-bold tracking-widest">{tag.count} VENTAS</p>
                    </div>
                    {isAdmin && (
                      <div className="text-right">
                        <div className="font-black text-sm text-stone-800 dark:text-stone-200 tracking-tight">${tag.total.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="Sin datos de etiquetas en los pedidos." />
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

      {/* CARRITOS ABANDONADOS + SOCIAL MEDIA */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Carritos Abandonados */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-xl border border-stone-100 dark:border-stone-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-500">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Carritos Abandonados</h3>
                <p className="text-[9px] text-stone-400 font-bold mt-0.5">Ventas pendientes de recuperación</p>
              </div>
            </div>
            <a href="/admin/carritos" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all">
              Ver todos <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {abandonedCarts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-stone-100 dark:border-stone-800 rounded-2xl bg-stone-50/30 dark:bg-stone-900/10">
              <ShoppingCart className="w-8 h-8 text-stone-200 dark:text-stone-700 mb-3" />
              <p className="text-stone-300 dark:text-stone-600 text-[10px] font-black uppercase tracking-widest">Sin carritos abandonados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Summary counters */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 text-center border border-amber-100 dark:border-amber-900/30">
                  <p className="text-lg font-black text-amber-600 dark:text-amber-400">{abandonedCarts.length}</p>
                  <p className="text-[9px] font-black text-amber-500/70 uppercase tracking-widest">Pendientes</p>
                </div>
                <div className="flex-1 bg-red-50 dark:bg-red-950/20 rounded-xl p-3 text-center border border-red-100 dark:border-red-900/30">
                  <p className="text-lg font-black text-red-600 dark:text-red-400">${abandonedCarts.reduce((sum, c) => sum + (c.total || 0), 0).toLocaleString()}</p>
                  <p className="text-[9px] font-black text-red-500/70 uppercase tracking-widest">Valor Total</p>
                </div>
              </div>

              {/* Last 3 carts */}
              {abandonedCarts.slice(0, 3).map((cart) => (
                <div key={cart.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all border border-transparent hover:border-stone-200 dark:hover:border-stone-700 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-stone-800 dark:text-stone-100 truncate">{cart.firstName} {cart.lastName}</p>
                      <p className="text-[9px] text-stone-400 font-bold truncate">
                        {cart.cartData && Array.isArray(cart.cartData) ? cart.cartData.map((item: any) => item.model).join(', ') : 'Sin items'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-black text-stone-800 dark:text-white">${(cart.total || 0).toLocaleString()}</p>
                      <p className="text-[9px] text-stone-400 font-bold">{formatDistanceToNow(new Date(cart.updatedAt), { addSuffix: true, locale: es })}</p>
                    </div>
                    {cart.phone && (
                      <button
                        onClick={() => {
                          const phone = cart.phone.replace(/\D/g, '');
                          const name = cart.firstName || 'Hola';
                          const items = cart.cartData ? cart.cartData.map((item: any) => item.model).join(', ') : 'los anteojos';
                          const message = `¡Hola ${name}! Somos de Atelier Óptica. Vimos que dejaste en tu carrito ${items}. ¿Tuviste algún problema con el pago o necesitás ayuda con algo? ¡Avisanos y te damos una mano!`;
                          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                        }}
                        className="p-2 bg-[#25D366]/10 text-[#25D366] rounded-xl hover:bg-[#25D366] hover:text-white transition-all hover:scale-110"
                        title="Retomar por WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    {cart.email && (
                      <button
                        onClick={async () => {
                          setEmailSending(cart.id);
                          try {
                            const res = await fetch('/api/checkout/recovery-email', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ sessionId: cart.id })
                            });
                            const data = await res.json();
                            if (data.success) {
                              setEmailSent(prev => new Set(prev).add(cart.id));
                            }
                          } catch (e) { console.error(e); }
                          setEmailSending(null);
                        }}
                        disabled={emailSending === cart.id || emailSent.has(cart.id)}
                        className={`p-2 rounded-xl transition-all hover:scale-110 ${
                          emailSent.has(cart.id)
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white'
                        } disabled:cursor-not-allowed`}
                        title="Enviar email de recuperación"
                      >
                        {emailSending === cart.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : emailSent.has(cart.id) ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {abandonedCarts.length > 3 && (
                <a href="/admin/carritos" className="block text-center py-2 text-[10px] font-black text-amber-600 uppercase tracking-widest hover:text-amber-500 transition-colors">
                  + {abandonedCarts.length - 3} más →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Social Media Studio Quick Access */}
        <a href="/admin/social" className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-xl border border-stone-100 dark:border-stone-800 relative overflow-hidden group hover:border-primary/30 transition-all block">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-pink-500/5 via-purple-500/5 to-indigo-500/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:from-pink-500/10 group-hover:via-purple-500/10 group-hover:to-indigo-500/10 transition-colors" />
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 p-2.5 rounded-xl text-pink-500">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Social Media Studio</h3>
                <p className="text-[9px] text-stone-400 font-bold mt-0.5">Generá campañas con IA</p>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-400 group-hover:bg-primary group-hover:text-white transition-all group-hover:scale-110">
              <ExternalLink className="w-4 h-4" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950/20 dark:to-pink-900/10 rounded-xl p-4 text-center border border-pink-100 dark:border-pink-900/20 group-hover:shadow-md transition-all">
              <div className="text-2xl mb-1">📱</div>
              <p className="text-[9px] font-black text-pink-600 dark:text-pink-400 uppercase tracking-widest">Stories</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/10 rounded-xl p-4 text-center border border-purple-100 dark:border-purple-900/20 group-hover:shadow-md transition-all">
              <div className="text-2xl mb-1">🎬</div>
              <p className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Reels</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/20 dark:to-indigo-900/10 rounded-xl p-4 text-center border border-indigo-100 dark:border-indigo-900/20 group-hover:shadow-md transition-all">
              <div className="text-2xl mb-1">📑</div>
              <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Carruseles</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/10 rounded-xl p-4 text-center border border-amber-100 dark:border-amber-900/20 group-hover:shadow-md transition-all">
              <div className="text-2xl mb-1">🖼️</div>
              <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Posts</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
            Abrir Studio <ArrowRight className="w-3 h-3" />
          </div>
        </a>
      </section>

    </div>
  );
}

function StatsCard({ title, value, icon: Icon, trend, sub, highlight }: any) {
  return (
    <div className={`${highlight ? 'bg-gradient-to-br from-primary to-primary/80 text-white shadow-xl shadow-primary/20 border-transparent' : 'bg-sidebar border border-sidebar-border shadow-sm group hover:shadow-lg hover:border-primary/20'} rounded-2xl p-7 transition-all flex flex-wrap justify-between items-center gap-4 relative overflow-hidden group`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 blur-2xl transition-colors ${highlight ? 'bg-white/10 group-hover:bg-white/20' : 'bg-primary/5 group-hover:bg-primary/10'}`} />
      <div className="relative z-10">
        <p className={`${highlight ? 'text-white/70' : 'text-stone-400'} font-black text-[10px] uppercase tracking-[0.2em] mb-2`}>{title}</p>
        <h3 className={`text-xl md:text-2xl lg:text-3xl font-black tracking-tight truncate min-w-0 ${highlight ? '' : 'text-stone-800 dark:text-stone-100'}`}>{value}</h3>
        <div className="flex items-center gap-2 mt-3">
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter ${highlight ? 'bg-white/20 text-white border-white/10' : 'bg-stone-100 dark:bg-stone-800 text-primary border-primary/10'}`}>
            {trend}
          </span>
          <span className={`text-[9px] font-bold uppercase tracking-[0.1em] ${highlight ? 'text-white/50' : 'text-stone-400'}`}>{sub}</span>
        </div>
      </div>
      <div className={`relative z-10 p-4 rounded-2xl transition-all shadow-inner border ${highlight ? 'bg-white/20 border-white/10' : 'bg-stone-50 dark:bg-stone-800 group-hover:scale-110 group-hover:bg-primary group-hover:text-white border-sidebar-border group-hover:border-primary'}`}>
        <Icon className={`w-6 h-6 stroke-[2.5] transition-colors ${highlight ? 'text-white' : 'text-primary group-hover:text-white'}`} />
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
