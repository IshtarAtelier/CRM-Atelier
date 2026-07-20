'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Eye, Users, ShoppingCart, CreditCard, TrendingUp, MapPin,
  Package, Radio, RefreshCw, DollarSign,
} from 'lucide-react';

type Analytics = {
  range: { from: string; to: string };
  traffic: { visits: number; uniqueVisitors: number; series: { day: string; visits: number; visitors: number }[] };
  funnel: {
    visitors: number; viewedProduct: number; addedToCart: number;
    beganCheckout: number; addedContact: number; purchased: number;
    totals: Record<string, number>;
  };
  revenue: { orders: number; total: number };
  zones: { zone: string; views: number }[];
  topProducts: { productId: string; productName: string; views: number }[];
  sources: { source: string; visitors: number }[];
  carts: { total: number; pending: number; emailSent: number; recovered: number; completed: number };
};

const PRESETS = [
  { label: 'Hoy', days: 1 },
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
];

const fmt = (n: number) => n.toLocaleString('es-AR');
const money = (n: number) => '$' + Math.round(n).toLocaleString('es-AR');
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      const res = await fetch(`/api/admin/analytics?from=${iso(from)}&to=${iso(to)}`);
      if (!res.ok) throw new Error('No se pudo cargar la analítica');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const f = data?.funnel;
  const maxTraffic = Math.max(1, ...(data?.traffic.series.map((s) => s.visits) || [1]));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Analítica de la tienda
          </h1>
          <p className="text-sm text-muted-foreground">
            Embudo web con datos propios: tráfico, navegación, carritos y ventas.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 rounded-md text-sm border transition ${
                days === p.days
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button onClick={load} className="p-2 rounded-md border border-border hover:bg-muted" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {!data && loading && <div className="text-muted-foreground">Cargando…</div>}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi icon={<Eye />} label="Visitas" value={fmt(data.traffic.visits)} />
            <Kpi icon={<Users />} label="Visitantes únicos" value={fmt(data.traffic.uniqueVisitors)} />
            <Kpi icon={<ShoppingCart />} label="Carritos" value={fmt(data.carts.total)} />
            <Kpi icon={<CreditCard />} label="Compras" value={fmt(data.revenue.orders)} />
            <Kpi icon={<DollarSign />} label="Ingresos" value={money(data.revenue.total)} />
            <Kpi
              icon={<TrendingUp />}
              label="Conversión"
              value={`${pct(f!.purchased, f!.visitors)}%`}
              hint="compras / visitantes"
            />
          </div>

          {/* Embudo */}
          <Section title="Embudo de conversión" icon={<TrendingUp className="w-4 h-4" />}>
            <div className="space-y-2">
              <FunnelBar label="Visitantes" value={f!.visitors} base={f!.visitors} />
              <FunnelBar label="Vieron un producto" value={f!.viewedProduct} base={f!.visitors} />
              <FunnelBar label="Agregaron al carrito" value={f!.addedToCart} base={f!.visitors} />
              <FunnelBar label="Iniciaron checkout" value={f!.beganCheckout} base={f!.visitors} />
              <FunnelBar label="Dejaron contacto" value={f!.addedContact} base={f!.visitors} />
              <FunnelBar label="Compraron" value={f!.purchased} base={f!.visitors} highlight />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Cada barra = visitantes únicos que llegaron a esa etapa. El % es respecto del total de visitantes.
            </p>
          </Section>

          {/* Tráfico en el tiempo */}
          <Section title="Tráfico por día" icon={<Eye className="w-4 h-4" />}>
            {data.traffic.series.length === 0 ? (
              <Empty />
            ) : (
              <div className="flex items-end gap-1 h-32">
                {data.traffic.series.map((s) => (
                  <div key={s.day} className="flex-1 flex flex-col items-center justify-end group" title={`${new Date(s.day).toLocaleDateString('es-AR')}: ${s.visits} visitas`}>
                    <div
                      className="w-full bg-primary/70 group-hover:bg-primary rounded-t"
                      style={{ height: `${(s.visits / maxTraffic) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Zonas */}
            <Section title="Zonas más exploradas" icon={<MapPin className="w-4 h-4" />}>
              <RankList items={data.zones.map((z) => ({ label: z.zone, value: z.views }))} unit="vistas" />
            </Section>

            {/* Productos */}
            <Section title="Productos más vistos" icon={<Package className="w-4 h-4" />}>
              <RankList items={data.topProducts.map((p) => ({ label: p.productName, value: p.views }))} unit="vistas" />
            </Section>

            {/* Fuentes */}
            <Section title="Fuentes de tráfico" icon={<Radio className="w-4 h-4" />}>
              <RankList items={data.sources.map((s) => ({ label: s.source, value: s.visitors }))} unit="visitantes" />
            </Section>

            {/* Carritos */}
            <Section title="Carritos" icon={<ShoppingCart className="w-4 h-4" />}>
              <div className="space-y-2 text-sm">
                <CartRow label="Pendientes (abandonados)" value={data.carts.pending} tone="amber" />
                <CartRow label="Con email de recupero enviado" value={data.carts.emailSent} tone="blue" />
                <CartRow label="Recuperados" value={data.carts.recovered} tone="green" />
                <CartRow label="Completados (compra)" value={data.carts.completed} tone="green" />
                <div className="pt-2 border-t border-border flex justify-between font-medium">
                  <span>Tasa de abandono</span>
                  <span>{pct(data.carts.pending + data.carts.emailSent, data.carts.total)}%</span>
                </div>
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
        <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
        {label}
      </div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold mb-3 flex items-center gap-2 text-sm">{icon}{title}</h2>
      {children}
    </div>
  );
}

function FunnelBar({ label, value, base, highlight }: { label: string; value: number; base: number; highlight?: boolean }) {
  const width = base > 0 ? Math.max(2, (value / base) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span>{label}</span>
        <span className="text-muted-foreground">{fmt(value)} · {pct(value, base)}%</span>
      </div>
      <div className="h-5 rounded bg-muted overflow-hidden">
        <div className={`h-full ${highlight ? 'bg-green-500' : 'bg-primary/70'}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function RankList({ items, unit }: { items: { label: string; value: number }[]; unit: string }) {
  if (!items.length) return <Empty />;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-1.5">
      {items.map((i, idx) => (
        <div key={idx} className="text-sm">
          <div className="flex justify-between mb-0.5">
            <span className="truncate pr-2">{i.label}</span>
            <span className="text-muted-foreground shrink-0">{fmt(i.value)} {unit}</span>
          </div>
          <div className="h-1.5 rounded bg-muted overflow-hidden">
            <div className="h-full bg-primary/60" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CartRow({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'blue' | 'green' }) {
  const dot = tone === 'amber' ? 'bg-amber-500' : tone === 'blue' ? 'bg-blue-500' : 'bg-green-500';
  return (
    <div className="flex justify-between items-center">
      <span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dot}`} />{label}</span>
      <span className="font-medium">{fmt(value)}</span>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">Sin datos en este período todavía.</p>;
}
