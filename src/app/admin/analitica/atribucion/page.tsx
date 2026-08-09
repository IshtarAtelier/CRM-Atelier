'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Megaphone, RefreshCw, Route, Target } from 'lucide-react';
import { formatDate } from '@/lib/format-date';

/**
 * Pantalla de atribución: qué anuncio y qué canal trae a los clientes, y qué
 * devolvió cada uno. Es la misma cuenta que sale por email todas las mañanas
 * (`/api/cron/ads-report`), servida por `AttributionService` — si acá dice 3,2×,
 * el mail dice 3,2×.
 *
 * Todo el contenido viene de `/api/admin/analytics/atribucion`; este archivo
 * solo dibuja. Vive junto a su ruta porque no lo usa ninguna otra pantalla.
 */

type Anuncio = {
    tag: string;
    gasto: number;
    chats: number;
    clientesNuevos: number;
    presupuestados: number;
    presupuestado: number;
    cierres: number;
    facturadoReal: number;
    cobrado: number;
    costoPorChat: number | null;
    roas: number | null;
};

type Canal = {
    canal: string;
    clientesNuevos: number;
    ventasCobradas: number;
    cobrado: number;
    /** Desglose de la fila de arriba (Meta sin anuncio), no un canal aparte. */
    esSubfila?: boolean;
    /** false = texto libre de una ficha vieja, no un canal del vocabulario. */
    esCanonico: boolean;
};

type Atribucion = {
    rango: { dias: number; desde: string; hasta: string };
    anuncios: Anuncio[];
    totales: Omit<Anuncio, 'tag'>;
    canales: Canal[];
    metaSinAnuncio: Canal;
    gasto: { disponible: boolean; aviso: string | null };
};

const RANGOS = [7, 30, 90] as const;

const fmt = (n: number) => n.toLocaleString('es-AR');
const money = (n: number) => '$' + Math.round(n).toLocaleString('es-AR');
const roasTxt = (x: number | null) => (x != null ? `${x.toFixed(1).replace('.', ',')}×` : '—');
const oGuion = (n: number) => (n > 0 ? fmt(n) : '—');
const plataOGuion = (n: number) => (n > 0 ? money(n) : '—');

/** El rango termina a la medianoche de hoy: el último día completo es ayer. */
function ultimoDia(hastaIso: string): string {
    return formatDate(new Date(new Date(hastaIso).getTime() - 864e5));
}

export default function AtribucionPage() {
    const [dias, setDias] = useState<number>(30);
    const [data, setData] = useState<Atribucion | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/analytics/atribucion?dias=${dias}`);
            if (!res.ok) throw new Error('No se pudo cargar la atribución');
            setData(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error');
        } finally {
            setLoading(false);
        }
    }, [dias]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Target className="w-6 h-6 text-primary" /> Atribución
                    </h1>
                    <p className="text-sm text-stone-700 dark:text-stone-300">
                        Qué anuncio y qué canal trajo a cada cliente, y qué devolvió. La venta se
                        cuenta cuando hay plata cobrada o pedido en el laboratorio.
                    </p>
                    {data && (
                        <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                            Del {formatDate(data.rango.desde)} al {ultimoDia(data.rango.hasta)} (el día
                            de hoy no se cuenta: está incompleto).
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {RANGOS.map((d) => (
                        <button
                            key={d}
                            onClick={() => setDias(d)}
                            aria-pressed={dias === d}
                            className={`px-3 py-1.5 rounded-md text-sm font-semibold border transition ${
                                dias === d
                                    ? 'bg-stone-800 text-white border-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100'
                                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-600 dark:hover:bg-stone-700'
                            }`}
                        >
                            {d} días
                        </button>
                    ))}
                    <button
                        onClick={load}
                        title="Actualizar"
                        className="p-2 rounded-md border border-stone-300 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-lg border border-red-400 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800 text-sm">
                    {error}
                </div>
            )}

            {!data && loading && (
                <p className="text-sm text-stone-700 dark:text-stone-300">Cruzando anuncios, chats y ventas…</p>
            )}

            {data && (
                <>
                    {data.gasto.aviso && (
                        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 text-sm text-amber-900 dark:text-amber-100">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{data.gasto.aviso}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <Kpi label="Gasto en anuncios" value={money(data.totales.gasto)} />
                        <Kpi label="Chats" value={fmt(data.totales.chats)} />
                        <Kpi label="Costo por chat" value={data.totales.costoPorChat != null ? money(data.totales.costoPorChat) : '—'} />
                        <Kpi label="Clientes nuevos" value={fmt(data.totales.clientesNuevos)} hint="fichas con etiqueta de anuncio" />
                        <Kpi label="Ventas cobradas" value={fmt(data.totales.cierres)} hint={plataOGuion(data.totales.facturadoReal)} />
                        <Kpi label="Retorno" value={roasTxt(data.totales.roas)} hint="facturado / gastado" />
                    </div>

                    <Panel
                        icon={<Megaphone className="w-4 h-4" />}
                        titulo="Qué devolvió cada anuncio"
                        bajada="El puente es la etiqueta del anuncio: el texto que llega por WhatsApp trae el apodo entre corchetes, y por ahí se sabe qué compró después ese cliente."
                    >
                        {data.anuncios.length === 0 ? (
                            <Vacio texto="Ningún anuncio con gasto ni conversaciones en este período." />
                        ) : (
                            <Tabla
                                columnas={[
                                    'Anuncio',
                                    'Gasto',
                                    'Chats',
                                    'Costo/chat',
                                    'Clientes nuevos',
                                    'Ventas cobradas',
                                    'Facturado',
                                    'Cobrado',
                                    'Retorno',
                                ]}
                            >
                                {data.anuncios.map((a) => {
                                    const gastoSinChats = a.gasto > 0 && a.chats === 0;
                                    return (
                                        <tr
                                            key={a.tag}
                                            className={`border-b border-stone-200 dark:border-stone-700 ${
                                                gastoSinChats ? 'bg-amber-50 dark:bg-amber-950/30' : ''
                                            }`}
                                        >
                                            <Td className="font-semibold text-stone-900 dark:text-stone-50">
                                                {a.tag}
                                                {gastoSinChats && (
                                                    <span
                                                        className="ml-1.5 text-amber-800 dark:text-amber-300"
                                                        title="Gastó sin traer una sola conversación"
                                                    >
                                                        ⚠
                                                    </span>
                                                )}
                                            </Td>
                                            <Td num>{plataOGuion(a.gasto)}</Td>
                                            <Td num>{oGuion(a.chats)}</Td>
                                            <Td num>{a.costoPorChat != null ? money(a.costoPorChat) : '—'}</Td>
                                            <Td num>{oGuion(a.clientesNuevos)}</Td>
                                            <Td num>{oGuion(a.cierres)}</Td>
                                            <Td num className="font-semibold text-stone-900 dark:text-stone-50">
                                                {plataOGuion(a.facturadoReal)}
                                            </Td>
                                            <Td num>{plataOGuion(a.cobrado)}</Td>
                                            <Td num className={`font-bold ${colorRoas(a.roas)}`}>
                                                {roasTxt(a.roas)}
                                            </Td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-t-2 border-stone-400 dark:border-stone-500 font-bold">
                                    <Td>Total</Td>
                                    <Td num>{money(data.totales.gasto)}</Td>
                                    <Td num>{fmt(data.totales.chats)}</Td>
                                    <Td num>{data.totales.costoPorChat != null ? money(data.totales.costoPorChat) : '—'}</Td>
                                    <Td num>{fmt(data.totales.clientesNuevos)}</Td>
                                    <Td num>{fmt(data.totales.cierres)}</Td>
                                    <Td num>{money(data.totales.facturadoReal)}</Td>
                                    <Td num>{money(data.totales.cobrado)}</Td>
                                    <Td num className={colorRoas(data.totales.roas)}>{roasTxt(data.totales.roas)}</Td>
                                </tr>
                            </Tabla>
                        )}
                        <Nota>
                            <b>Ventas cobradas</b> = clientes de ese anuncio con una venta real (plata
                            cobrada o pedido en laboratorio); <b>Facturado</b> es lo que suman esas
                            ventas y <b>Cobrado</b> lo que entró hasta hoy — ninguno de los dos es
                            ganancia. <b>Retorno</b> = facturado ÷ gasto. La fila resaltada con ⚠ gastó
                            sin traer una sola conversación.
                        </Nota>
                    </Panel>

                    <Panel
                        icon={<Route className="w-4 h-4" />}
                        titulo="De dónde viene la gente"
                        bajada="Canal cargado en la ficha del cliente. Las fichas sin canal aparecen como “Sin origen”: no se mezclan con orgánico, porque el pendiente de carga no es un canal."
                    >
                        {data.canales.length === 0 ? (
                            <Vacio texto="Sin clientes nuevos ni cobros en este período." />
                        ) : (
                            <Tabla columnas={['Canal', 'Clientes nuevos', 'Ventas cobradas', 'Cobrado']}>
                                {data.canales.map((c, i) => (
                                    <FilaCanal
                                        key={c.canal}
                                        canal={c}
                                        // El texto libre arranca acá: se separa con un título
                                        // para que no parezca un canal más de la lista.
                                        abreHistoricos={!c.esCanonico && (data.canales[i - 1]?.esCanonico ?? true)}
                                    />
                                ))}
                            </Tabla>
                        )}
                        <Nota>
                            <b>Clientes nuevos</b> = fichas creadas en el período. <b>Ventas cobradas</b>{' '}
                            = pagos registrados en el período, imputados al canal del cliente de esa
                            venta (puede ser un cliente de antes). La fila indentada es la pauta de Meta
                            que llegó sin etiqueta de anuncio: se sabe que vino de Meta, pero no de cuál.
                            Lo de abajo de todo se escribió a mano antes de que existiera el desplegable
                            y se muestra tal cual: nada se mezcla con un canal que no le corresponde.
                        </Nota>
                    </Panel>
                </>
            )}
        </div>
    );
}

/**
 * Un canal. La subfila (Meta sin anuncio identificado) va indentada y con un
 * guión de pertenencia: es un pedazo de la fila de arriba, no otro canal.
 */
function FilaCanal({ canal, abreHistoricos }: { canal: Canal; abreHistoricos?: boolean }) {
    return (
        <>
            {abreHistoricos && (
                <tr>
                    <td
                        colSpan={4}
                        className="pt-5 pb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-stone-700 dark:text-stone-300"
                    >
                        Escrito a mano en fichas viejas (no son canales del desplegable)
                    </td>
                </tr>
            )}
            <tr className="border-b border-stone-200 dark:border-stone-700">
                <Td
                    className={
                        canal.esSubfila
                            ? 'pl-6 text-stone-700 dark:text-stone-300'
                            : 'font-semibold text-stone-900 dark:text-stone-50'
                    }
                >
                    {canal.esSubfila ? `↳ ${canal.canal}` : canal.canal}
                </Td>
                <Td num>{oGuion(canal.clientesNuevos)}</Td>
                <Td num>{oGuion(canal.ventasCobradas)}</Td>
                <Td num className={canal.esSubfila ? '' : 'font-semibold text-stone-900 dark:text-stone-50'}>
                    {plataOGuion(canal.cobrado)}
                </Td>
            </tr>
        </>
    );
}

function colorRoas(x: number | null): string {
    if (x == null) return 'text-stone-700 dark:text-stone-300';
    if (x >= 3) return 'text-green-800 dark:text-green-300';
    if (x >= 1) return 'text-stone-800 dark:text-stone-100';
    return 'text-amber-800 dark:text-amber-300';
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-3">
            <div className="text-xs text-stone-700 dark:text-stone-300 mb-1">{label}</div>
            <div className="text-xl font-bold text-stone-900 dark:text-stone-50">{value}</div>
            {hint && <div className="text-[11px] text-stone-600 dark:text-stone-400 mt-0.5">{hint}</div>}
        </div>
    );
}

function Panel({
    icon,
    titulo,
    bajada,
    children,
}: {
    icon: React.ReactNode;
    titulo: string;
    bajada: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4">
            <h2 className="font-semibold flex items-center gap-2 text-sm text-stone-900 dark:text-stone-50">
                {icon}
                {titulo}
            </h2>
            <p className="text-xs text-stone-700 dark:text-stone-300 mt-1 mb-3">{bajada}</p>
            {children}
        </div>
    );
}

/** Tabla ancha: en el teléfono se desplaza sola en horizontal, no se apreta. */
function Tabla({ columnas, children }: { columnas: string[]; children: React.ReactNode }) {
    return (
        <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                    <tr className="border-b-2 border-stone-300 dark:border-stone-600">
                        {columnas.map((c, i) => (
                            <th
                                key={c}
                                className={`py-2 px-2 text-[11px] font-bold uppercase tracking-wide text-stone-700 dark:text-stone-300 whitespace-nowrap ${
                                    i === 0 ? 'text-left' : 'text-right'
                                }`}
                            >
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

function Td({
    children,
    num,
    className = '',
}: {
    children: React.ReactNode;
    num?: boolean;
    className?: string;
}) {
    return (
        <td
            className={`py-2 px-2 whitespace-nowrap text-stone-800 dark:text-stone-200 ${
                num ? 'text-right tabular-nums' : ''
            } ${className}`}
        >
            {children}
        </td>
    );
}

function Nota({ children }: { children: React.ReactNode }) {
    return <p className="text-xs text-stone-700 dark:text-stone-300 mt-3 leading-relaxed">{children}</p>;
}

function Vacio({ texto }: { texto: string }) {
    return <p className="text-sm text-stone-700 dark:text-stone-300">{texto}</p>;
}
