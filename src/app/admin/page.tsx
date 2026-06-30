'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Tag, Layers, ArrowUpRight, DollarSign, ShoppingCart, Percent, Calendar, Clock, User, ArrowRight, CheckCircle2 } from "lucide-react";
import DashboardActions from "@/components/dashboard/DashboardActions";
import DashboardObjectives from "@/components/dashboard/DashboardObjectives";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

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
  personalSoldMonth?: number;
  personalConfirmedCount?: number;
  todaySold?: number;
  weekSold?: number;
}

interface PieChart3DProps {
  data: { name: string; count: number; total?: number }[];
  showValues?: boolean;
}

function PieChart3D({ data, showValues = false }: PieChart3DProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return <div className="text-center py-16 text-[10px] uppercase font-bold text-stone-400">Sin datos</div>;

  const COLORS = [
    '#a38067', // primary warm brown
    '#8c6d58', // dark chocolate
    '#bfa08a', // light sand
    '#6b7280', // grey
    '#3b82f6', // blue
    '#10b981', // emerald
  ];

  let accumulatedPercent = 0;
  const slices = data.map((item, idx) => {
    const percent = item.count / total;
    const startPercent = accumulatedPercent;
    accumulatedPercent += percent;
    return {
      name: item.name,
      percent: percent * 100,
      startPercent,
      endPercent: accumulatedPercent,
      color: COLORS[idx % COLORS.length],
      total: item.total
    };
  });

  const getCoordinatesForPercent = (percent: number, radius = 80) => {
    const angle = (percent - 0.25) * 2 * Math.PI;
    const x = 100 + radius * Math.cos(angle);
    const y = 100 + radius * Math.sin(angle);
    return [x, y];
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4 animate-in fade-in duration-500">
      {/* 3D Viewport container */}
      <div 
        className="relative w-44 h-28 flex items-center justify-center select-none" 
        style={{ perspective: '800px' }}
      >
        <div 
          className="relative w-44 h-44 transition-all duration-700 hover:scale-[1.03]" 
          style={{ 
            transform: 'rotateX(58deg) rotateZ(-15deg)', 
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Render 15 layers for 3D extrusion */}
          {[...Array(15)].map((_, layerIdx) => {
            const isTop = layerIdx === 0;
            const brightness = isTop ? 1 : 0.65 - (layerIdx * 0.02);
            return (
              <div 
                key={layerIdx}
                className="absolute inset-0 w-full h-full"
                style={{ 
                  transform: `translate3d(0, 0, ${-layerIdx * 1.5}px)`, 
                  transformStyle: 'preserve-3d',
                  pointerEvents: isTop ? 'auto' : 'none',
                }}
              >
                <svg 
                  viewBox="0 0 200 200" 
                  className="w-full h-full"
                >
                  {slices.map((slice, idx) => {
                    const percent = slice.percent / 100;
                    const largeArcFlag = percent > 0.5 ? 1 : 0;
                    
                    let pathData = '';
                    if (percent >= 0.999) {
                      return (
                        <circle
                          key={idx}
                          cx="100"
                          cy="100"
                          r="80"
                          fill={slice.color}
                          style={{
                            filter: !isTop ? `brightness(${brightness}) contrast(1.1)` : 'none',
                          }}
                        />
                      );
                    } else {
                      const [startX, startY] = getCoordinatesForPercent(slice.startPercent);
                      const [endX, endY] = getCoordinatesForPercent(slice.endPercent);
                      pathData = `M 100 100 L ${startX} ${startY} A 80 80 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
                    }

                    return (
                      <path
                        key={idx}
                        d={pathData}
                        fill={slice.color}
                        className="transition-all duration-300 hover:opacity-95 cursor-pointer"
                        style={{
                          filter: !isTop ? `brightness(${brightness}) contrast(1.1)` : 'none',
                        }}
                      />
                    );
                  })}
                </svg>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legends wrapped with clean alignment */}
      <div className="flex flex-wrap gap-x-3 gap-y-2 justify-center max-w-sm px-2">
        {slices.map((slice, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/40 px-2.5 py-1.5 rounded-xl border border-stone-100 dark:border-stone-800/80 shadow-sm transition-all hover:scale-[1.02]">
            <div 
              className="w-2.5 h-2.5 rounded-full shadow-inner shrink-0" 
              style={{ backgroundColor: slice.color }} 
            />
            <span className="text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-tight truncate max-w-[100px]">{slice.name}</span>
            {showValues && slice.total !== undefined ? (
              <>
                <span className="text-[10px] font-bold text-stone-500 ml-auto">{slice.percent.toFixed(1)}%</span>
                <span className="text-[10px] font-black text-[#a38067] ml-1">${slice.total.toLocaleString()}</span>
              </>
            ) : (
              <span className="text-[10px] font-bold text-stone-500 ml-auto">{slice.percent.toFixed(1)}%</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
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
  const [userId, setUserId] = useState<string | undefined>();
  const [dolarBlue, setDolarBlue] = useState<number | null>(null);
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [emailSending, setEmailSending] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<Set<string>>(new Set());
  const [ventasView, setVentasView] = useState<'list' | 'chart'>('chart');
  const [canalView, setCanalView] = useState<'list' | 'chart'>('chart');
  const [etiquetaView, setEtiquetaView] = useState<'list' | 'chart'>('chart');
  const now = new Date();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        setUserRole(u.role || 'STAFF');
        setUserId(u.id || undefined);
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
  }, [dateFrom, dateTo, funnelEtiqueta, funnelTipo, userId]);

  const fetchDashboard = async (from?: string, to?: string, etiqueta?: string, tipo?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (etiqueta && etiqueta !== 'ALL') params.set('etiqueta', etiqueta);
      if (tipo && tipo !== 'ALL') params.set('tipo', tipo);
      if (userId) params.set('userId', userId);
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
    personalSoldMonth: 0,
    personalConfirmedCount: 0,
    todaySold: 0,
    weekSold: 0,
  };

  const currentTotal = d.totalSoldMonth || 0;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Theme Mode Pill Switcher - Dashboard Only */}
      <div className="fixed top-4 right-4 z-[70] lg:absolute lg:top-6 lg:right-8">
        <ThemeToggle />
      </div>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-4xl font-extrabold tracking-tight text-stone-800 dark:text-stone-100 italic">
            Atelier Óptica <span className="text-primary not-italic">CRM</span>
          </h1>
          <p className="text-foreground/50 mt-1 font-medium italic uppercase text-[8px] lg:text-[10px] tracking-widest leading-none">Inteligencia de Negocio y Control Administrativo</p>
        </div>
        {isAdmin && <DashboardActions onPeriodChange={handlePeriodChange} />}
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
                trend={`${d.confirmedCount}`}
                sub="Confirmados"
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

      {/* Salesperson Stats Section */}
      {!isAdmin && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary w-5 h-5" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">
              Mis Métricas del Mes
            </h2>
          </div>
          <div className={`flex gap-6 overflow-x-auto pb-4 no-scrollbar transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
            <div className="min-w-[260px] flex-1">
              <StatsCard
                title="Pedidos del Mes"
                value={`${d.ordersCountMonth || 0}`}
                icon={ShoppingCart}
                trend="Este Mes"
                sub="Pedidos totales de la empresa"
                highlight={true}
              />
            </div>
            <div className="min-w-[260px] flex-1">
              <StatsCard
                title="Presupuestos Confirmados"
                value={`${d.confirmedCount || 0}`}
                icon={CheckCircle2}
                trend="Activos"
                sub="Totales de la empresa"
                highlight={false}
              />
            </div>
            <div className="min-w-[260px] flex-1">
              <StatsCard
                title="Clientes Atendidos"
                value={`${d.funnel.contacts || 0}`}
                icon={User}
                trend="Nuevos"
                sub="Contactos del período"
                highlight={false}
              />
            </div>
            <div className="min-w-[260px] flex-1">
              <StatsCard
                title="Ticket Promedio"
                value={`$${Math.round(d.ticketPromedioMonth || 0).toLocaleString()}`}
                icon={Percent}
                trend={d.ticketPromedioMonth > 0 ? 'Activo' : '—'}
                sub="Por operación"
                highlight={false}
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
        todaySold={d.todaySold || 0}
        weekSold={d.weekSold || 0}
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
          <div className="flex items-center justify-between gap-2 mb-8">
            <div className="flex items-center gap-2">
              <Layers className="text-stone-600 w-5 h-5" />
              <h2 className="text-sm font-black uppercase tracking-widest">Ventas por Tipo</h2>
            </div>
            {isAdmin && (
              <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg border border-stone-200/50 dark:border-stone-700/80">
                <button
                  onClick={() => setVentasView('chart')}
                  className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    ventasView === 'chart'
                      ? 'bg-white dark:bg-stone-900 text-primary shadow-sm'
                      : 'text-stone-450 hover:text-stone-600 dark:hover:text-stone-300'
                  }`}
                >
                  Gráfico
                </button>
                <button
                  onClick={() => setVentasView('list')}
                  className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    ventasView === 'list'
                      ? 'bg-white dark:bg-stone-900 text-primary shadow-sm'
                      : 'text-stone-450 hover:text-stone-600 dark:hover:text-stone-300'
                  }`}
                >
                  Lista
                </button>
              </div>
            )}
          </div>
          {d.typeStats.length > 0 ? (
            (isAdmin && ventasView === 'list') ? (
              <div className="space-y-3">
                {d.typeStats.map((type) => {
                  const rentabilidad = type.total - type.cost;
                  const margin = type.total > 0 ? (rentabilidad / type.total) * 100 : 0;
                  return (
                    <div key={type.name} className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl bg-stone-50 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all border border-transparent hover:border-sidebar-border group">
                      <div>
                        <h4 className="font-black text-xs uppercase group-hover:text-primary transition-colors tracking-tight">{type.name}</h4>
                        <p className="text-[9px] text-foreground/40 font-bold tracking-widest">
                          {type.count} {
                            (type.name.toLowerCase().includes('cristal') || ['monofocal', 'multifocal', 'bifocal', 'ocupacional'].includes(type.name.toLowerCase()))
                              ? (type.count === 1 ? 'PAR' : 'PARES')
                              : (type.count === 1 ? 'UNIDAD' : 'UNIDADES')
                          }
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm text-stone-800 dark:text-stone-200 tracking-tight">${type.total.toLocaleString()}</div>
                        <div className={`text-[9px] font-black tracking-[0.1em] ${margin > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`}>
                          {margin.toFixed(1)}% RENTAB.
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <PieChart3D data={d.typeStats} showValues={isAdmin} />
            )
          ) : (
            <EmptyState message="Sin movimientos de productos." />
          )}
        </div>

        {/* 3.5 Venta por Origen (Local vs Online) */}
        <div className="bg-sidebar border border-sidebar-border rounded-2xl p-7 shadow-sm md:col-span-1 lg:col-span-1">
          <div className="flex items-center justify-between gap-2 mb-8">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-stone-600 w-5 h-5" />
              <h2 className="text-sm font-black uppercase tracking-widest">Tráfico por Canal</h2>
            </div>
            {isAdmin && (
              <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg border border-stone-200/50 dark:border-stone-700/80">
                <button
                  onClick={() => setCanalView('chart')}
                  className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    canalView === 'chart'
                      ? 'bg-white dark:bg-stone-900 text-primary shadow-sm'
                      : 'text-stone-450 hover:text-stone-600 dark:hover:text-stone-300'
                  }`}
                >
                  Gráfico
                </button>
                <button
                  onClick={() => setCanalView('list')}
                  className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    canalView === 'list'
                      ? 'bg-white dark:bg-stone-900 text-primary shadow-sm'
                      : 'text-stone-450 hover:text-stone-600 dark:hover:text-stone-300'
                  }`}
                >
                  Lista
                </button>
              </div>
            )}
          </div>
          {d.locationStats && d.locationStats.length > 0 ? (
            (isAdmin && canalView === 'list') ? (
              <div className="space-y-3">
                {d.locationStats.sort((a, b) => b.count - a.count).map((loc) => {
                  const totalCount = d.locationStats.reduce((sum, item) => sum + item.count, 0);
                  const pct = totalCount > 0 ? (loc.count / totalCount) * 100 : 0;
                  return (
                    <div key={loc.name} className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl bg-stone-50 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all border border-transparent hover:border-sidebar-border group">
                      <div>
                        <h4 className="font-black text-xs uppercase group-hover:text-primary transition-colors tracking-tight">{loc.name}</h4>
                        <p className="text-[9px] text-foreground/40 font-bold tracking-widest">
                          {loc.count} VENTAS
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm text-stone-800 dark:text-stone-200 tracking-tight">${loc.total.toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <PieChart3D data={d.locationStats} showValues={isAdmin} />
            )
          ) : (
            <EmptyState message="Sin datos de canales." />
          )}
        </div>

        {/* 4. Venta por Etiquetas — Hide values for Staff */}
        <div className="bg-sidebar border border-sidebar-border rounded-2xl p-7 shadow-sm md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between gap-2 mb-8">
            <div className="flex items-center gap-2">
              <Tag className="text-stone-600 w-5 h-5" />
              <h2 className="text-sm font-black uppercase tracking-widest">Desempeño por Etiqueta</h2>
            </div>
            <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg border border-stone-200/50 dark:border-stone-700/80">
              <button
                onClick={() => setEtiquetaView('chart')}
                className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  etiquetaView === 'chart'
                    ? 'bg-white dark:bg-stone-900 text-primary shadow-sm'
                    : 'text-stone-450 hover:text-stone-600 dark:hover:text-stone-300'
                }`}
              >
                Gráfico
              </button>
              <button
                onClick={() => setEtiquetaView('list')}
                className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  etiquetaView === 'list'
                    ? 'bg-white dark:bg-stone-900 text-primary shadow-sm'
                    : 'text-stone-450 hover:text-stone-600 dark:hover:text-stone-300'
                }`}
              >
                Lista
              </button>
            </div>
          </div>
          {d.tagStats.length > 0 ? (
            etiquetaView === 'list' ? (
              <div className="space-y-3">
                {[...d.tagStats].sort((a, b) => b.count - a.count).slice(0, 5).map((tag) => {
                  const totalCount = d.tagStats.reduce((sum, item) => sum + item.count, 0);
                  const pct = totalCount > 0 ? (tag.count / totalCount) * 100 : 0;
                  return (
                    <div key={tag.name} className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl bg-stone-50 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all border border-transparent hover:border-sidebar-border group">
                      <div>
                        <h4 className="font-black text-xs uppercase group-hover:text-primary transition-colors tracking-tight">{tag.name}</h4>
                        <p className="text-[9px] text-foreground/40 font-bold tracking-widest">
                          {isAdmin ? `${tag.count} VENTAS` : `${pct.toFixed(1)}% DEL TOTAL`}
                        </p>
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
              <PieChart3D data={[...d.tagStats].sort((a, b) => b.count - a.count)} showValues={isAdmin} />
            )
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
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, trend, sub, highlight }: any) {
  return (
    <div className={`relative p-7 rounded-[2rem] overflow-hidden transition-all duration-500 border group ${
      highlight 
        ? 'bg-gradient-to-br from-[#8c6d58] via-[#a38067] to-[#bfa08a] text-white shadow-[0_20px_50px_rgba(140,109,88,0.25)] border-white/10 hover:shadow-[0_25px_60px_rgba(140,109,88,0.4)] hover:scale-[1.02]' 
        : 'bg-white dark:bg-stone-900/60 backdrop-blur-xl border-stone-200/60 dark:border-stone-800/60 shadow-md hover:shadow-xl dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:border-[#a38067]/40 dark:hover:border-[#a38067]/40 hover:scale-[1.02]'
    }`}>
      {/* Dynamic light reflection effect */}
      <div className={`absolute -inset-px rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-tr ${
        highlight 
          ? 'from-white/10 via-transparent to-white/20' 
          : 'from-[#a38067]/5 via-transparent to-[#a38067]/15'
      }`} />

      {/* Decorative blurred background aura */}
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl transition-all duration-700 ${
        highlight 
          ? 'bg-white/20 group-hover:scale-125' 
          : 'bg-[#a38067]/10 dark:bg-[#a38067]/5 group-hover:scale-125 group-hover:bg-[#a38067]/20 dark:group-hover:bg-[#a38067]/10'
      }`} />

      <div className="flex justify-between items-start gap-4 relative z-10">
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2.5 transition-colors duration-300 ${
            highlight ? 'text-white/80' : 'text-stone-400 dark:text-stone-500 group-hover:text-[#a38067]'
          }`}>
            {title}
          </p>
          <h3 className={`text-2xl md:text-3xl font-black tracking-tight truncate ${
            highlight ? 'text-white drop-shadow-sm' : 'text-stone-900 dark:text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-stone-900 group-hover:to-[#a38067] dark:group-hover:from-white dark:group-hover:to-[#bfa08a]'
          }`}>
            {value}
          </h3>
          
          <div className="flex items-center gap-2.5 mt-4">
            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border transition-all duration-300 ${
              highlight 
                ? 'bg-white/15 text-white border-white/20' 
                : 'bg-stone-50 dark:bg-stone-800 text-[#a38067] dark:text-[#bfa08a] border-[#a38067]/10 dark:border-[#a38067]/20 group-hover:bg-[#a38067]/10'
            }`}>
              {trend}
            </span>
            <span className={`text-[9px] font-bold uppercase tracking-[0.1em] transition-colors duration-300 ${
              highlight ? 'text-white/70' : 'text-stone-400 dark:text-stone-450'
            }`}>
              {sub}
            </span>
          </div>
        </div>

        <div className={`p-4 rounded-2.5xl transition-all duration-500 shadow-inner border shrink-0 ${
          highlight 
            ? 'bg-white/10 border-white/10 text-white shadow-inner' 
            : 'bg-stone-100 dark:bg-stone-800 text-[#a38067] dark:text-[#bfa08a] border-stone-200/40 dark:border-stone-700/50 group-hover:scale-110 group-hover:bg-[#a38067] group-hover:text-white group-hover:border-transparent group-hover:shadow-[0_10px_20px_rgba(163,128,103,0.3)]'
        }`}>
          <Icon className="w-5.5 h-5.5 stroke-[2.5]" />
        </div>
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
