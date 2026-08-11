'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * El globo de diagnóstico de la tienda.
 *
 * Contesta una sola pregunta —"¿está lista para que le pongamos plata en
 * publicidad?"— y la contesta con un semáforo, una frase, y como mucho cuatro
 * cosas para hacer.
 *
 * Los números los mide el servidor (`lib/tienda/salud.ts`); la IA solo los
 * interpreta. Por eso el panel muestra SIEMPRE los datos crudos junto al
 * veredicto: si algo suena raro, se puede contrastar sin creerle a nadie.
 */

type Sugerencia = {
  titulo: string;
  porQue: string;
  esfuerzo: string;
  impacto: 'alto' | 'medio' | 'bajo';
};

type Datos = {
  salud: {
    medidoEl: string;
    catalogo: {
      activos: number;
      conUnaSolaFoto: number;
      sinFoto: number;
      conTresOMasFotos: number;
      sinDescripcionUtil: number;
      publicadosSinStock: number;
      sinGenero: number;
      sinMaterial: number;
    };
    precios: { concentracionMayorBanda: number; enOferta: number; bandas: { precio: number; productos: number }[] };
    demanda: { checkoutsIniciados30d: number; ventasWeb30d: number; resenasDeProducto: number };
  };
  veredicto: {
    semaforo: 'verde' | 'amarillo' | 'rojo';
    veredicto: string;
    porQue: string;
    sugerencias: Sugerencia[];
  } | null;
  motivo?: string;
};

const COLOR = {
  verde: { borde: 'border-emerald-300', fondo: 'bg-emerald-50', texto: 'text-emerald-900', punto: 'bg-emerald-500' },
  amarillo: { borde: 'border-amber-300', fondo: 'bg-amber-50', texto: 'text-amber-900', punto: 'bg-amber-500' },
  rojo: { borde: 'border-rose-300', fondo: 'bg-rose-50', texto: 'text-rose-900', punto: 'bg-rose-500' },
} as const;

export default function VeredictoTienda() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verNumeros, setVerNumeros] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tienda/veredicto');
      if (!res.ok) throw new Error('No se pudo analizar la tienda');
      setDatos(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const v = datos?.veredicto;
  const c = COLOR[v?.semaforo ?? 'amarillo'];
  const cat = datos?.salud.catalogo;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-stone-500">
          Diagnóstico de la tienda
        </span>
        <button
          onClick={cargar}
          disabled={cargando}
          className="ml-auto flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          Volver a analizar
        </button>
      </div>

      {/* El globo. La colita de la izquierda lo ata al ícono de arriba: se lee
          como algo que alguien te está diciendo, no como otro cartel del panel. */}
      <div className={`relative rounded-2xl border-2 ${c.borde} ${c.fondo} p-5 ml-4`}>
        <div
          className={`absolute -top-2 left-6 w-4 h-4 rotate-45 border-l-2 border-t-2 ${c.borde} ${c.fondo}`}
          aria-hidden
        />

        {cargando && !datos && (
          <p className="text-sm text-stone-600">Mirando el catálogo, los precios y las fichas…</p>
        )}

        {error && <p className="text-sm text-rose-700">{error}</p>}

        {datos && (
          <>
            {v ? (
              <>
                <div className="flex items-start gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${c.punto} mt-1.5 shrink-0`} />
                  <div>
                    <p className={`text-base font-bold ${c.texto} leading-snug`}>{v.veredicto}</p>
                    <p className="text-sm text-stone-700 mt-1.5 leading-relaxed">{v.porQue}</p>
                  </div>
                </div>

                {v.sugerencias?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {v.sugerencias.map((s, i) => (
                      <div key={i} className="rounded-lg bg-white/70 border border-stone-200 p-3">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-stone-900">{s.titulo}</span>
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              s.impacto === 'alto'
                                ? 'bg-stone-900 text-white'
                                : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {s.impacto}
                          </span>
                          <span className="text-[11px] text-stone-500">· {s.esfuerzo}</span>
                        </div>
                        <p className="text-[13px] text-stone-600 mt-1 leading-relaxed">{s.porQue}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-stone-700">
                No se pudo redactar el veredicto{datos.motivo ? ` (${datos.motivo})` : ''}, pero los
                números de abajo están medidos igual.
              </p>
            )}

            {/* Los números crudos, siempre disponibles. Es lo que permite
                discutirle al veredicto en vez de tener que creerle. */}
            {cat && (
              <>
                <button
                  onClick={() => setVerNumeros((s) => !s)}
                  className="mt-4 flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-900"
                >
                  {verNumeros ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {verNumeros ? 'Ocultar los números' : 'Ver los números en los que se basa'}
                </button>

                {verNumeros && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Dato label="Productos publicados" valor={cat.activos} />
                    <Dato label="Con UNA sola foto" valor={cat.conUnaSolaFoto} alerta={cat.conUnaSolaFoto > cat.activos / 2} />
                    <Dato label="Con 3 fotos o más" valor={cat.conTresOMasFotos} />
                    <Dato label="Publicados sin stock" valor={cat.publicadosSinStock} alerta={cat.publicadosSinStock > 0} />
                    <Dato label="Descripción corta" valor={cat.sinDescripcionUtil} />
                    <Dato
                      label="Al mismo precio"
                      valor={`${datos.salud.precios.concentracionMayorBanda}%`}
                      alerta={datos.salud.precios.concentracionMayorBanda > 60}
                    />
                    <Dato label="En oferta" valor={datos.salud.precios.enOferta} />
                    <Dato label="Compras empezadas (30d)" valor={datos.salud.demanda.checkoutsIniciados30d} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Dato({ label, valor, alerta }: { label: string; valor: number | string; alerta?: boolean }) {
  return (
    <div className={`rounded-lg border p-2.5 bg-white ${alerta ? 'border-amber-300' : 'border-stone-200'}`}>
      <div className="text-[10px] uppercase tracking-wide text-stone-500 leading-tight">{label}</div>
      <div className={`text-lg font-black ${alerta ? 'text-amber-700' : 'text-stone-900'}`}>{valor}</div>
    </div>
  );
}
