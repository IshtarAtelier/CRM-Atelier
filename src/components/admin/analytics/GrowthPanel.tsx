'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Mes = {
  mes: string;
  cobrado: number;
  ordenesCobradas: number;
  visitantes: number;
  pageViews: number;
  whatsappClicks: number;
  comprasWeb: number;
  ingresosWeb: number;
  clientesNuevos: number;
};

const fmt = (n: number) => n.toLocaleString('es-AR');
const money = (n: number) => '$' + Math.round(n).toLocaleString('es-AR');

const NOMBRE_MES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function etiquetaMes(mes: string) {
  const [anio, m] = mes.split('-');
  return `${NOMBRE_MES[Number(m) - 1]} ${anio.slice(2)}`;
}

function variacion(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

/**
 * Crecimiento mes a mes: cobrado real (filas de Payment — la única prueba de
 * venta), tráfico web, clics a WhatsApp y clientes nuevos, con variación
 * intermensual para ver la tendencia de un vistazo.
 */
type Techo = {
  techoArs: number;
  gastadoArs: number | null;
  meta: number | null;
  google: number | null;
  sinLeer: string[];
  diaDelMes: number;
  diasDelMes: number;
  proyeccionArs: number | null;
  estado: 'ok' | 'atencion' | 'excedido' | 'sin_datos';
  mensaje: string;
};

export default function GrowthPanel() {
  const [meses, setMeses] = useState<Mes[] | null>(null);
  const [techo, setTecho] = useState<Techo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/analytics/crecimiento?meses=12');
        if (!res.ok) throw new Error('No se pudo calcular el crecimiento');
        const json = await res.json();
        setMeses(json.meses);
        setTecho(json.techo ?? null);
      } catch (e: any) {
        setError(e.message || 'Error');
      }
    })();
  }, []);

  if (error)
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm p-4">{error}</div>
    );
  if (!meses) return null;

  // El mes en curso está incompleto: la comparación honesta es entre los dos
  // últimos meses CERRADOS; el actual se muestra aparte como parcial.
  const cerrados = meses.slice(0, -1);
  const actual = meses[meses.length - 1];
  const ultimo = cerrados[cerrados.length - 1];
  const anteultimo = cerrados[cerrados.length - 2];
  const maxCobrado = Math.max(1, ...meses.map((m) => m.cobrado));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold mb-1 flex items-center gap-2 text-sm">
        <TrendingUp className="w-4 h-4" /> Crecimiento mes a mes
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        Cobrado real (pagos registrados), tráfico y contactos. El mes en curso es parcial.
      </p>

      {/* Techo de inversión publicitaria del mes. Va acá porque se lee junto al
          crecimiento: cuánto creciste y cuánto estás gastando para lograrlo. */}
      {techo && (
        <div
          className={`mb-4 rounded-lg border p-3 ${
            techo.estado === 'excedido'
              ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
              : techo.estado === 'ok'
                ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide">
              Techo publicitario del mes · {money(techo.techoArs)}
            </span>
            <span className="text-xs text-muted-foreground">
              día {techo.diaDelMes} de {techo.diasDelMes}
            </span>
          </div>
          <p className="text-sm font-medium mt-1">{techo.mensaje}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Van {money(techo.gastadoArs ?? 0)} — Meta{' '}
            {techo.meta !== null ? money(techo.meta) : 'sin leer'} · Google{' '}
            {techo.google !== null ? money(techo.google) : 'sin leer'}
          </p>
        </div>
      )}

      {ultimo && anteultimo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Comparativa
            label={`Cobrado (${etiquetaMes(ultimo.mes)})`}
            valor={money(ultimo.cobrado)}
            delta={variacion(ultimo.cobrado, anteultimo.cobrado)}
          />
          <Comparativa
            label={`Órdenes cobradas (${etiquetaMes(ultimo.mes)})`}
            valor={fmt(ultimo.ordenesCobradas)}
            delta={variacion(ultimo.ordenesCobradas, anteultimo.ordenesCobradas)}
          />
          <Comparativa
            label={`Visitantes web (${etiquetaMes(ultimo.mes)})`}
            valor={fmt(ultimo.visitantes)}
            delta={variacion(ultimo.visitantes, anteultimo.visitantes)}
          />
          <Comparativa
            label={`Clientes nuevos (${etiquetaMes(ultimo.mes)})`}
            valor={fmt(ultimo.clientesNuevos)}
            delta={variacion(ultimo.clientesNuevos, anteultimo.clientesNuevos)}
          />
        </div>
      )}

      {/* Tabla mensual completa */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-1.5 pr-2 font-medium">Mes</th>
              <th className="py-1.5 pr-2 font-medium text-right">Cobrado</th>
              <th className="py-1.5 pr-2 font-medium text-right">Órdenes</th>
              <th className="py-1.5 pr-2 font-medium text-right">Visitantes</th>
              <th className="py-1.5 pr-2 font-medium text-right">WhatsApp</th>
              <th className="py-1.5 pr-2 font-medium text-right">Compras web</th>
              <th className="py-1.5 pr-2 font-medium text-right">Clientes nuevos</th>
              <th className="py-1.5 font-medium w-1/4">Tendencia</th>
            </tr>
          </thead>
          <tbody>
            {[...meses].reverse().map((m) => (
              <tr key={m.mes} className="border-b border-border/50 last:border-0">
                <td className="py-1.5 pr-2 whitespace-nowrap">
                  {etiquetaMes(m.mes)}
                  {m.mes === actual?.mes && (
                    <span className="text-xs text-muted-foreground"> (parcial)</span>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right whitespace-nowrap font-medium">{money(m.cobrado)}</td>
                <td className="py-1.5 pr-2 text-right">{fmt(m.ordenesCobradas)}</td>
                <td className="py-1.5 pr-2 text-right">{fmt(m.visitantes)}</td>
                <td className="py-1.5 pr-2 text-right">{fmt(m.whatsappClicks)}</td>
                <td className="py-1.5 pr-2 text-right">{fmt(m.comprasWeb)}</td>
                <td className="py-1.5 pr-2 text-right">{fmt(m.clientesNuevos)}</td>
                <td className="py-1.5">
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary/70"
                      style={{ width: `${(m.cobrado / maxCobrado) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Comparativa({ label, valor, delta }: { label: string; valor: string; delta: number | null }) {
  const Icono = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const color =
    delta === null || delta === 0
      ? 'text-muted-foreground'
      : delta > 0
        ? 'text-green-700 dark:text-green-400'
        : 'text-red-700 dark:text-red-400';
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-bold">{valor}</div>
      <div className={`text-xs flex items-center gap-1 ${color}`}>
        <Icono className="w-3.5 h-3.5" />
        {delta === null ? 'sin base de comparación' : `${delta > 0 ? '+' : ''}${delta}% vs mes anterior`}
      </div>
    </div>
  );
}
