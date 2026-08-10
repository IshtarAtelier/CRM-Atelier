'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Cookie } from 'lucide-react';

type Check = {
  id: string;
  label: string;
  estado: 'ok' | 'falta' | 'atencion';
  detalle: string;
  accion?: string;
};

type Salud = {
  checks: Check[];
  pixelVivo: {
    configured: { pixelId: boolean; capiToken: boolean };
    pixel: { name: string; lastFiredTime: string | null; isUnavailable: boolean } | null;
    events7d: { event: string; count: number }[] | null;
    error: string | null;
  } | null;
  propia: {
    ultimoEvento: string | null;
    eventos7d: { tipo: string; count: number }[];
  };
  consentimiento?: {
    vieron: number;
    aceptaron: number;
    rechazaron: number;
    ignoraron: number;
  };
};

const fmt = (n: number) => n.toLocaleString('es-AR');
const pct = (parte: number, total: number) =>
  total > 0 ? `${Math.round((parte / total) * 100)}%` : '—';

/**
 * Salud de la cadena de medición: qué está configurado, qué dispara de verdad
 * (Graph API de Meta) y el checklist de lo que falta para poder pautar.
 */
export default function MeasurementHealth() {
  const [data, setData] = useState<Salud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/analytics/salud');
      if (!res.ok) throw new Error('No se pudo evaluar la medición');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pendientes = data?.checks.filter((c) => c.estado !== 'ok') ?? [];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4" /> Salud de la medición
          </h2>
          {/* Aclaración necesaria: corriendo en local, las variables que solo
              existen en Railway aparecen como "falta" y parecen un problema de
              producción que no es. Lo que vale es este panel en el sitio vivo. */}
          <p className="text-xs text-muted-foreground mt-0.5">
            Mira las variables del servidor donde corre este panel. En local van a
            figurar como faltantes las que solo están cargadas en producción.
          </p>
        </div>
        <button
          onClick={load}
          className="p-1.5 rounded-md border border-border hover:bg-muted"
          title="Volver a chequear"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-md border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>
      )}
      {!data && loading && <p className="text-sm text-muted-foreground">Chequeando píxel, CAPI y etiquetas…</p>}

      {data && (
        <div className="space-y-4">
          {/* Checklist de estado */}
          <div className="grid sm:grid-cols-2 gap-2">
            {data.checks.map((c) => (
              <div key={c.id} className="flex items-start gap-2 rounded-md border border-border p-2.5">
                <EstadoIcon estado={c.estado} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground break-words">{c.detalle}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Qué falta para que explote */}
          {pendientes.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3">
              <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Qué falta para pautar con datos completos
              </div>
              <ul className="space-y-1.5">
                {pendientes.map((c) => (
                  <li key={c.id} className="text-sm">
                    <span className="font-medium">{c.label}:</span>{' '}
                    <span>{c.accion || c.detalle}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pendientes.length === 0 && (
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">
              Toda la cadena de medición está completa: se puede pautar con datos reales.
            </p>
          )}

          {/* Cartel de cookies: cuánta gente deja a Meta afuera */}
          <ConsentimientoLinea datos={data.consentimiento} />

          {/* Eventos que Meta recibió de verdad */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                Meta recibió (últimos 7 días)
              </h3>
              {data.pixelVivo?.events7d?.length ? (
                <EventTable rows={data.pixelVivo.events7d.map((e) => ({ label: e.event, count: e.count }))} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {data.pixelVivo?.error
                    ? `Sin acceso a stats del píxel: ${data.pixelVivo.error}`
                    : 'Sin datos de Meta.'}
                </p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                Analítica propia (últimos 7 días)
              </h3>
              {data.propia.eventos7d.length ? (
                <EventTable rows={data.propia.eventos7d.map((e) => ({ label: e.tipo, count: e.count }))} />
              ) : (
                <p className="text-sm text-muted-foreground">Sin eventos propios esta semana.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Qué se hace con el cartel de cookies, en una línea.
 *
 * El número que se busca acá es "lo ignoró": el Pixel de Meta no carga sin
 * consentimiento, así que esa porción de visitantes es tráfico real que Meta no
 * puede ver ni atribuir. Antes ese punto ciego era una intuición ("algo se
 * pierde"); con los eventos consent_shown / consent_decision es un número.
 */
function ConsentimientoLinea({ datos }: { datos: Salud['consentimiento'] }) {
  // Panel viejo contra API vieja (o respuesta cacheada sin el campo): no
  // inventamos ceros, que se leerían como "nadie acepta".
  if (!datos) return null;

  const { vieron, aceptaron, rechazaron, ignoraron } = datos;

  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs font-semibold mb-1 flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
        <Cookie className="w-3.5 h-3.5" /> Cartel de cookies (últimos 7 días)
      </div>
      {vieron === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ningún visitante nuevo vio el cartel esta semana (solo se muestra a quien todavía no decidió).
        </p>
      ) : (
        <>
          <p className="text-sm">
            <span className="font-medium text-green-700 dark:text-green-400">{pct(aceptaron, vieron)} acepta</span>
            {' · '}
            <span className="font-medium">{pct(rechazaron, vieron)} rechaza</span>
            {' · '}
            <span className="font-medium text-amber-700 dark:text-amber-400">{pct(ignoraron, vieron)} lo ignora</span>
            <span className="text-muted-foreground">
              {' '}
              (sobre {fmt(vieron)} {vieron === 1 ? 'visitante' : 'visitantes'} que lo vieron)
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Los que ignoran el cartel ({fmt(ignoraron)}) más los que rechazan ({fmt(rechazaron)}) son la parte del
            tráfico que Meta no ve: el Pixel no carga sin consentimiento. La analítica propia sí los cuenta.
          </p>
        </>
      )}
    </div>
  );
}

function EstadoIcon({ estado }: { estado: Check['estado'] }) {
  if (estado === 'ok') return <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />;
  if (estado === 'atencion')
    return <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />;
  return <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />;
}

function EventTable({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.label} className="text-sm">
          <div className="flex justify-between mb-0.5">
            <span className="truncate pr-2">{r.label}</span>
            <span className="text-muted-foreground shrink-0">{fmt(r.count)}</span>
          </div>
          <div className="h-1.5 rounded bg-muted overflow-hidden">
            <div className="h-full bg-primary/60" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
