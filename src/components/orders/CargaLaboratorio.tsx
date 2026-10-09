'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Check, X, Loader2, RefreshCw, AlertTriangle, Maximize2, FileText, ChevronDown } from 'lucide-react';
import { formatDate } from '@/lib/format-date';

/**
 * LA CARGA DEL PEDIDO EN EL PORTAL DEL LABORATORIO, igual para todos
 * (regla de Ishtar, 5/10/2026: "tanto en Vitolen como en Grupo Óptico sea
 * exactamente igual la operatoria, siempre se vea el sistema real y desde ahí
 * mismo se dé el OK").
 *
 *   Preparar → el robot arma el pedido en el portal y trae LA PANTALLA REAL →
 *   una persona la mira en grande y, ahí mismo, Aprueba o Rechaza →
 *   el robot carga → nº en la venta y la pantalla del pedido ya cargado.
 *
 * Este componente no sabe de ningún laboratorio: qué elegir al preparar, qué
 * textos y qué datos mostrar los declara cada uno (lab-modules/carga/contrato.ts).
 * El botón Aprobar aparece SOLO con la captura del portal a la vista: nadie
 * aprueba a ciegas.
 */

interface Campo { clave: string; etiqueta: string; tipo: 'select' | 'numero' | 'extra'; advertencia?: string; opciones?: { value: string; label: string }[]; obligatorio: boolean; porDefecto?: string; ayuda?: string; min?: number; max?: number }
interface Par { pair: number; titulo: string | null; faltantes: string[]; avisos: string[]; campos: Campo[]; espera?: string | null; yaCargado?: string | null; rol?: string | null }
interface Vista { textoRevision: string; filas: { titulo: string; valor: string; fuerte?: boolean }[]; avisos: string[]; tituloAvisos?: string; enlacePortal?: string | null; documento?: { url: string; etiqueta: string } | null; pendienteEnPortal?: { id: string; url: string | null } | null; confirmarAntesDeAprobar?: { titulo: string; texto: string } | null }
interface Borrador {
    id: string; pair: number; status: string; screenshotUrl: string | null; screenshotFinalUrl: string | null; portalNumber: string | null;
    preparedBy: string | null; approvedBy: string | null; approvedAt: string | null; loadedAt: string | null; error: string | null; vista: Vista;
}
interface PedidoEspejo { portalNumber: string; status: string; statusRaw: string | null; estimatedAt: string | null; lastSeenAt: string }
interface Datos { lab: string; nombre: string; borradores: Borrador[]; espejo: PedidoEspejo[]; pares: Par[]; puedeCancelarEnPortal: boolean }

const ESTADO: Record<string, { texto: string; clase: string }> = {
    PREPARADO: { texto: 'El robot está armando el pedido', clase: 'bg-stone-100 text-stone-600' },
    EN_REVISION: { texto: 'Para revisar', clase: 'bg-amber-100 text-amber-800' },
    APROBADO: { texto: 'Aprobado · cargando', clase: 'bg-sky-100 text-sky-800' },
    CARGADO: { texto: 'Cargado en el laboratorio', clase: 'bg-emerald-100 text-emerald-800' },
    RECHAZADO: { texto: 'Rechazado', clase: 'bg-rose-100 text-rose-800' },
    ERROR: { texto: 'No se pudo', clase: 'bg-rose-100 text-rose-800' },
};
const ESTADO_PORTAL: Record<string, string> = { INGRESADO: 'Ingresado', EN_PROCESO: 'En proceso', TERMINADO: 'Terminado', DESPACHADO: 'Despachado', ANULADO: 'Anulado', DESCONOCIDO: 'Sin interpretar' };
const VIVOS = ['PREPARADO', 'EN_REVISION', 'APROBADO'];
/** Un APROBADO sin novedades después de esto ya no está "cargando": se ofrece reintentar. */
const APROBADO_DEMORADO_MS = 5 * 60_000;
const esImagen = (url: string | null | undefined) => !!url && !/\.pdf(\?|$|%)/i.test(decodeURIComponent(url));

/** Colores por laboratorio (clases completas: Tailwind no arma nombres dinámicos). */
const TEMA: Record<string, { caja: string; titulo: string; boton: string; borde: string; anillo: string }> = {
    VITOLEN: { caja: 'from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border-red-100 dark:border-red-900/40', titulo: 'text-red-600', boton: 'bg-red-600', borde: 'border-red-100 dark:border-red-900/30', anillo: 'hover:ring-red-400' },
    GRUPO_OPTICO: { caja: 'from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-indigo-100 dark:border-indigo-900/50', titulo: 'text-indigo-600 dark:text-indigo-400', boton: 'bg-indigo-600', borde: 'border-indigo-100 dark:border-indigo-900/40', anillo: 'hover:ring-indigo-400' },
};

export default function CargaLaboratorio({ lab, orderId, onChanged }: { lab: string; orderId: string; onChanged?: () => void }) {
    const [datos, setDatos] = useState<Datos | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [ocupado, setOcupado] = useState<string | null>(null);
    const [valores, setValores] = useState<Record<string, string>>({});
    const [motivo, setMotivo] = useState<Record<string, string>>({});
    /** La captura abierta a pantalla completa: de qué borrador y qué imagen. */
    const [ampliada, setAmpliada] = useState<{ url: string; borradorId: string | null } | null>(null);
    // Capturas que el navegador no pudo mostrar: sin la pantalla del portal a la vista no se aprueba nada.
    const [rotas, setRotas] = useState<Record<string, true>>({});
    const marcarRota = (url: string) => setRotas(r => (r[url] ? r : { ...r, [url]: true }));
    const dialogo = useRef<HTMLDivElement>(null);
    // Aviso previo a aprobar (2x1 / promo del 2º par): el nº de operación del otro par es lo que hace el descuento.
    const [confirmando, setConfirmando] = useState<Borrador | null>(null);
    // Un extra NO cobrado (Essential): "¿estás seguro?" + motivo obligatorio antes de aceptarlo (Ishtar, 8/10/2026).
    const [extraPendiente, setExtraPendiente] = useState<{ pair: number; campo: Campo } | null>(null);
    const [motivoExtra, setMotivoExtra] = useState('');
    // Los carteles toman el foco UNA vez al abrirse (para que Escape los cierre): un
    // ref inline lo robaría en cada tecla y no se podría escribir el motivo.
    const cartelExtra = useRef<HTMLDivElement>(null);
    const cartelConfirmar = useRef<HTMLDivElement>(null);
    useEffect(() => { if (extraPendiente) cartelExtra.current?.focus(); }, [extraPendiente]);
    useEffect(() => { if (confirmando) cartelConfirmar.current?.focus(); }, [confirmando]);
    const aprobar = (b: Borrador) => (b.vista.confirmarAntesDeAprobar ? setConfirmando(b) : decidir(b.id, 'aprobar'));
    // El foco va al diálogo UNA vez al abrirlo (para que Escape lo cierre), no en cada render:
    // si se lo robara en cada render, no se podría escribir el motivo del rechazo.
    useEffect(() => { if (ampliada) dialogo.current?.focus(); }, [ampliada]);
    const tema = TEMA[lab] || TEMA.GRUPO_OPTICO;

    const cargar = useCallback(async () => {
        setCargando(true); setError('');
        try {
            const res = await fetch(`/api/lab-modulos/borradores?lab=${encodeURIComponent(lab)}&orderId=${encodeURIComponent(orderId)}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { setError(json.error || 'No se pudo leer el estado en el laboratorio.'); return; }
            setDatos(json);
        } catch {
            setError('No se pudo leer el estado en el laboratorio.');
        } finally {
            setCargando(false);
        }
    }, [lab, orderId]);
    useEffect(() => { cargar(); }, [cargar]);

    const valorDe = (pair: number, c: Campo) => valores[`${pair}:${c.clave}`] ?? c.porDefecto ?? '';

    const preparar = async (par: Par) => {
        setOcupado(`preparar-${par.pair}`); setError('');
        try {
            const body: Record<string, unknown> = { lab, orderId, pair: par.pair };
            const extras: Record<string, string> = {};
            for (const c of par.campos) {
                if (c.tipo === 'extra') { const m = valorDe(par.pair, c); if (m) extras[c.clave] = m; }
                else body[c.clave] = valorDe(par.pair, c) || null;
            }
            if (Object.keys(extras).length) body.extras = extras;
            const res = await fetch('/api/lab-modulos/borradores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError([json.error, ...(json.faltantes || [])].filter(Boolean).join(' · '));
                if (json.borradorId) await cargar();
                return;
            }
            await cargar(); onChanged?.();
        } finally { setOcupado(null); }
    };

    const decidir = async (id: string, accion: 'aprobar' | 'rechazar' | 'reintentar' | 'cancelar-portal') => {
        setOcupado(`${accion}-${id}`); setError('');
        try {
            const res = await fetch(`/api/lab-modulos/borradores/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, motivo: motivo[id] || '' }) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { setError(json.error || 'No se pudo guardar la decisión.'); if (json.borradorId) await cargar(); return; }
            setAmpliada(null);
            await cargar(); onChanged?.();
        } finally { setOcupado(null); }
    };

    if (cargando && !datos) return <div className="text-[11px] text-stone-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Leyendo el laboratorio…</div>;
    if (!datos) return error ? <p className="text-[11px] text-rose-600">{error}</p> : null;

    const nombre = datos.nombre;
    const input = 'block mt-0.5 text-xs rounded border border-stone-300 bg-white dark:bg-stone-900 px-2 py-1.5';
    const boton = 'inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-lg text-white disabled:opacity-40';
    const borradorAmpliado = ampliada?.borradorId ? datos.borradores.find(b => b.id === ampliada.borradorId && b.status === 'EN_REVISION') : null;
    const bloqueoDe = (b: Borrador) => datos.pares.find(p => p.pair === b.pair)?.yaCargado || null;

    /** Aprobar / Rechazar: los mismos botones debajo de la captura y dentro de la vista ampliada. */
    // Función y no componente: un componente definido acá se remontaría en cada tecla del motivo.
    // `sinPantalla`: la captura del portal no está o no se pudo mostrar → solo se puede rechazar.
    const decision = (b: Borrador, claro = false, sinPantalla = false) => {
        const bloqueo = bloqueoDe(b);
        return (
            <div className="space-y-1.5">
                {bloqueo && <p className={`text-xs font-bold flex items-start gap-1 ${claro ? 'text-rose-200' : 'text-rose-700 dark:text-rose-400'}`}><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {bloqueo} Rechazá este borrador.</p>}
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={ocupado !== null || !!bloqueo || sinPantalla} title={sinPantalla ? 'Sin ver la pantalla del portal no se aprueba' : undefined} onClick={() => aprobar(b)} className={`${boton} bg-emerald-600 px-4`}>
                        {ocupado === `aprobar-${b.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Aprobar y cargar
                    </button>
                    <input value={motivo[b.id] || ''} onChange={e => setMotivo(m => ({ ...m, [b.id]: e.target.value }))} placeholder="Motivo del rechazo"
                        className="flex-1 min-w-[10rem] text-xs rounded border border-stone-300 bg-white text-stone-900 px-2 py-2" />
                    <button type="button" disabled={ocupado !== null || !(motivo[b.id] || '').trim()} onClick={() => decidir(b.id, 'rechazar')} className={`${boton} bg-rose-600`}>
                        <X className="w-3.5 h-3.5" /> Rechazar
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={`bg-gradient-to-br ${tema.caja} rounded-2xl border p-5 shadow-sm`}>
            <div className="flex items-center justify-between mb-4">
                <h4 className={`text-[10px] font-black ${tema.titulo} uppercase tracking-widest flex items-center gap-1.5`}>
                    <Bot className="w-3.5 h-3.5" /> {nombre} · carga del pedido
                </h4>
                <button type="button" onClick={cargar} className="text-stone-400 hover:text-stone-700" title="Actualizar">
                    <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {datos.espejo.length === 0 && <p className="text-[11px] text-stone-500 mb-3">El portal de {nombre} todavía no muestra ningún pedido de esta venta.</p>}
            {datos.espejo.length > 0 && (
                <ul className="space-y-1 mb-4">
                    {datos.espejo.map(p => (
                        <li key={p.portalNumber} className="flex items-center justify-between gap-2 text-[11px] bg-white/70 dark:bg-black/20 rounded-lg px-3 py-2">
                            <span className="font-bold text-stone-800 dark:text-stone-200">Pedido {p.portalNumber}</span>
                            <span className="text-stone-600 dark:text-stone-400 text-right">{p.statusRaw || ESTADO_PORTAL[p.status] || p.status}</span>
                            <span className="text-stone-400 whitespace-nowrap">{p.estimatedAt ? `listo ${formatDate(p.estimatedAt)}` : `visto ${formatDate(p.lastSeenAt)}`}</span>
                        </li>
                    ))}
                </ul>
            )}

            {datos.pares.map(par => {
                const b = datos.borradores.find(x => x.pair === par.pair && VIVOS.includes(x.status));
                const cerrados = datos.borradores.filter(x => x.pair === par.pair && !VIVOS.includes(x.status));
                const cargado = cerrados.find(x => x.status === 'CARGADO');
                const ultimo = cerrados[0];
                const mostrado = b || cargado || ultimo;
                const faltaElegir = par.campos.some(c => c.obligatorio && !valorDe(par.pair, c));
                return (
                    <div key={par.pair} className={`border-t ${tema.borde} pt-3 mt-3 space-y-2`}>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                                {datos.pares.length > 1 ? `Par ${par.pair}` : 'Pedido'}{par.titulo ? ` · ${par.titulo}` : ''}
                                {par.rol && <span className={`ml-1.5 normal-case tracking-normal px-1.5 py-0.5 rounded ${/sin cargo|2º par/i.test(par.rol) ? 'bg-amber-100 text-amber-900' : 'bg-stone-200 text-stone-700'}`}>{par.rol}</span>}
                            </span>
                            {mostrado && (mostrado.status === 'APROBADO' && mostrado.error
                                ? <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded whitespace-nowrap bg-rose-100 text-rose-800">Aprobado · no se cargó</span>
                                : <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded whitespace-nowrap ${ESTADO[mostrado.status]?.clase}`}>{ESTADO[mostrado.status]?.texto}</span>)}
                        </div>

                        {/* ── Ya cargado: nº, la pantalla real del pedido y el documento del laboratorio ── */}
                        {cargado && !b && (
                            <div className="text-xs space-y-2">
                                <p className="text-emerald-700 dark:text-emerald-400 font-bold">Nº {cargado.portalNumber} · aprobado por {cargado.approvedBy}{cargado.loadedAt ? ` · ${formatDate(cargado.loadedAt)}` : ''}</p>
                                {esImagen(cargado.screenshotFinalUrl) && (
                                    <button type="button" onClick={() => setAmpliada({ url: cargado.screenshotFinalUrl!, borradorId: null })} className="block w-full text-left">
                                        <img src={cargado.screenshotFinalUrl!} alt={`El pedido ${cargado.portalNumber} en el portal de ${nombre}`} className={`w-full max-h-56 object-cover object-top rounded-lg border border-stone-200 cursor-zoom-in hover:ring-2 ${tema.anillo}`} />
                                        <span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${tema.titulo}`}><Maximize2 className="w-3 h-3" /> Ver el pedido cargado en el portal</span>
                                    </button>
                                )}
                                {(cargado.vista.documento || (cargado.screenshotFinalUrl && !esImagen(cargado.screenshotFinalUrl))) && (
                                    <a href={cargado.vista.documento?.url || cargado.screenshotFinalUrl!} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 underline font-bold ${tema.titulo}`}>
                                        <FileText className="w-3.5 h-3.5" /> {cargado.vista.documento?.etiqueta || 'Ver el pedido del laboratorio'}
                                    </a>
                                )}
                                {cargado.error && <p className="text-amber-800 dark:text-amber-400 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {cargado.error}</p>}
                            </div>
                        )}

                        {ultimo && !b && !cargado && ultimo.error && (
                            <p className="text-xs text-rose-700 dark:text-rose-400 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {ultimo.error}</p>
                        )}
                        {ultimo && !b && !cargado && ultimo.vista.pendienteEnPortal && datos.puedeCancelarEnPortal && (
                            <div className="text-xs text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 space-y-1">
                                <p><strong>Quedó un pedido sin confirmar en el portal</strong> ({ultimo.vista.pendienteEnPortal.id}{ultimo.vista.pendienteEnPortal.url ? <>, <a href={ultimo.vista.pendienteEnPortal.url} target="_blank" rel="noreferrer" className="underline">verlo</a></> : null}). Hasta cancelarlo no se puede preparar otro.</p>
                                <button type="button" disabled={ocupado !== null} onClick={() => decidir(ultimo.id, 'cancelar-portal')} className={`${boton} bg-amber-600`}>
                                    {ocupado === `cancelar-portal-${ultimo.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Cancelar en el portal
                                </button>
                            </div>
                        )}

                        {/* ── Sin borrador vivo ni cargado: preparar ── */}
                        {!b && !cargado && (
                            par.yaCargado ? <p className="text-xs text-emerald-800 dark:text-emerald-400 font-bold">{par.yaCargado}</p>
                            : par.espera ? <p className="text-xs text-stone-500">{par.espera}</p>
                            : par.faltantes.length > 0 ? (
                                <div className="text-xs text-amber-800 dark:text-amber-400">
                                    <p className="font-bold">Para prepararlo falta, en la venta:</p>
                                    <ul className="list-disc pl-4">{par.faltantes.map(f => <li key={f}>{f}</li>)}</ul>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-end gap-2">
                                    {par.campos.map(c => c.tipo === 'extra' ? (
                                        valorDe(par.pair, c) ? (
                                            <span key={c.clave} className="text-[11px] text-amber-900 bg-amber-100 rounded px-2 py-1.5 inline-flex items-center gap-2">
                                                <AlertTriangle className="w-3 h-3" /> {c.etiqueta.replace(/^Agregar /, '').replace(/\s*\(.*\)\s*$/, '')} agregado SIN COBRAR · "{valorDe(par.pair, c)}"
                                                <button type="button" onClick={() => setValores(v => ({ ...v, [`${par.pair}:${c.clave}`]: '' }))} className="underline">quitar</button>
                                            </span>
                                        ) : (
                                            <button key={c.clave} type="button" onClick={() => { setMotivoExtra(''); setExtraPendiente({ pair: par.pair, campo: c }); }} className="text-[11px] text-stone-600 underline decoration-dotted self-center">
                                                + {c.etiqueta}
                                            </button>
                                        )
                                    ) : (
                                        <label key={c.clave} className="text-[10px] text-stone-500" title={c.ayuda}>{c.etiqueta}
                                            {c.tipo === 'select' ? (
                                                <select value={valorDe(par.pair, c)} onChange={e => setValores(v => ({ ...v, [`${par.pair}:${c.clave}`]: e.target.value }))} className={input}>
                                                    {!c.porDefecto && <option value="">{c.obligatorio ? 'Elegir…' : '—'}</option>}
                                                    {(c.opciones || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                            ) : (
                                                <input type="number" min={c.min} max={c.max} step={1} value={valorDe(par.pair, c)} onChange={e => setValores(v => ({ ...v, [`${par.pair}:${c.clave}`]: e.target.value }))} className={`${input} w-24`} />
                                            )}
                                        </label>
                                    ))}
                                    <button type="button" disabled={ocupado !== null || faltaElegir} onClick={() => preparar(par)} className={`${boton} ${tema.boton}`}>
                                        {ocupado === `preparar-${par.pair}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} Preparar en {nombre}
                                    </button>
                                </div>
                            )
                        )}

                        {b?.status === 'PREPARADO' && <p className="text-xs text-stone-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> El robot está armando el pedido en el portal; en unos segundos trae la pantalla para revisar. Preparado por {b.preparedBy}.</p>}
                        {b?.status === 'APROBADO' && !b.error && (
                            <div className="text-xs text-stone-500 space-y-1">
                                <p className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Aprobado por {b.approvedBy}. El robot está cargando el pedido en el laboratorio.</p>
                                {/* Si el servidor se reinició a mitad de la carga, nadie anota el error: pasados unos minutos se ofrece reintentar (nunca duplica). */}
                                {b.approvedAt && Date.now() - Date.parse(b.approvedAt) > APROBADO_DEMORADO_MS && (
                                    <button type="button" disabled={ocupado !== null} onClick={() => decidir(b.id, 'reintentar')} className={`${boton} bg-emerald-600`}>
                                        {ocupado === `reintentar-${b.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Está tardando: reintentar la carga
                                    </button>
                                )}
                            </div>
                        )}
                        {b?.status === 'APROBADO' && b.error && (
                            <div className="text-xs text-rose-700 dark:text-rose-400 space-y-1">
                                <p className="flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {b.error}</p>
                                <button type="button" disabled={ocupado !== null} onClick={() => decidir(b.id, 'reintentar')} className={`${boton} bg-emerald-600`}>
                                    {ocupado === `reintentar-${b.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Reintentar la carga
                                </button>
                            </div>
                        )}

                        {/* ── Para revisar: la pantalla REAL del portal, y ahí mismo el OK ── */}
                        {b?.status === 'EN_REVISION' && (
                            <div className="space-y-2">
                                <p className="text-xs text-stone-600 dark:text-stone-300">
                                    {b.vista.textoRevision}
                                    {b.vista.enlacePortal ? <> Para corregir algo antes, <a href={b.vista.enlacePortal} target="_blank" rel="noreferrer" className="underline">abrilo en el portal</a>.</> : null}
                                    {b.error ? <span className="block mt-1 text-rose-700 dark:text-rose-400">{b.error}</span> : null}
                                </p>
                                {b.vista.avisos.length > 0 && (
                                    <div className="text-xs text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                                        <p className="font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {b.vista.tituloAvisos || 'Mirá esto antes de aprobar:'}</p>
                                        <ul className="list-disc pl-4">{b.vista.avisos.map(a => <li key={a}>{a}</li>)}</ul>
                                    </div>
                                )}
                                {esImagen(b.screenshotUrl) && rotas[b.screenshotUrl!] ? (
                                    <div className="text-xs text-rose-700 dark:text-rose-400 space-y-1">
                                        <p>La captura del portal no se pudo mostrar (<a href={b.screenshotUrl!} target="_blank" rel="noreferrer" className="underline">abrirla en otra pestaña</a>). Sin verla no se aprueba: rechazá este borrador y volvé a preparar.</p>
                                        {decision(b, false, true)}
                                    </div>
                                ) : esImagen(b.screenshotUrl) ? (
                                    <>
                                        <button type="button" onClick={() => setAmpliada({ url: b.screenshotUrl!, borradorId: b.id })} className="block w-full text-left">
                                            <img src={b.screenshotUrl!} alt={`El pedido en el portal de ${nombre}`} onError={() => marcarRota(b.screenshotUrl!)} className={`w-full rounded-lg border border-stone-200 cursor-zoom-in hover:ring-2 ${tema.anillo}`} />
                                        </button>
                                        <button type="button" onClick={() => setAmpliada({ url: b.screenshotUrl!, borradorId: b.id })} className={`${boton} ${tema.boton} w-full justify-center`}>
                                            <Maximize2 className="w-3.5 h-3.5" /> Ver el portal en grande y decidir
                                        </button>
                                        {decision(b)}
                                    </>
                                ) : (
                                    <div className="text-xs text-rose-700 dark:text-rose-400 space-y-1">
                                        <p>No hay captura del portal para revisar: rechazá este borrador y volvé a preparar.</p>
                                        {decision(b, false, true)}
                                    </div>
                                )}
                                {b.vista.filas.length > 0 && (
                                    <details className="group">
                                        <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-widest text-stone-500 flex items-center gap-1"><ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" /> Los datos, en texto</summary>
                                        <dl className="mt-1 bg-white dark:bg-black/30 rounded-xl px-3 py-2 border border-stone-200 dark:border-stone-800">
                                            {b.vista.filas.map(f => (
                                                <div key={f.titulo} className="grid grid-cols-[7.5rem_1fr] gap-2 py-1 border-b border-stone-100 dark:border-stone-800 last:border-0">
                                                    <dt className="text-[11px] text-stone-500">{f.titulo}</dt>
                                                    <dd className={`text-sm ${f.fuerte ? 'font-black text-stone-900 dark:text-white' : 'text-stone-800 dark:text-stone-200'}`}>{f.valor}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </details>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {error && <p className="mt-3 text-xs text-rose-600 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {error}</p>}

            {/* Un extra que NO está cobrado: avisar, pedir el porqué, y recién ahí aceptarlo. */}
            {extraPendiente && (
                <div role="alertdialog" aria-label={extraPendiente.campo.etiqueta} className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4" onKeyDown={e => { if (e.key === 'Escape') setExtraPendiente(null); }} tabIndex={-1} ref={cartelExtra}>
                    <div role="document" className="bg-white text-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-3">
                        <p className="flex items-center gap-2 text-sm font-black"><AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" /> No está cobrado. ¿Estás seguro?</p>
                        <p className="text-sm leading-relaxed">{extraPendiente.campo.advertencia}</p>
                        <label className="block text-xs text-stone-600">Explicá por qué (le llega a Ishtar tal cual lo escribas)
                            <textarea value={motivoExtra} onChange={e => setMotivoExtra(e.target.value)} rows={3} autoFocus className="mt-1 block w-full text-sm rounded border border-stone-300 bg-white text-stone-900 px-2 py-2" placeholder="Ej.: el cliente ya lo tenía en el par anterior y se lo prometimos" />
                        </label>
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setExtraPendiente(null)} className={`${boton} bg-stone-500`}>No, dejarlo como está</button>
                            <button type="button" disabled={motivoExtra.trim().length < 10} title={motivoExtra.trim().length < 10 ? 'Escribí el motivo (al menos 10 letras)' : undefined}
                                onClick={() => { const { pair, campo } = extraPendiente; setValores(v => ({ ...v, [`${pair}:${campo.clave}`]: motivoExtra.trim() })); setExtraPendiente(null); }} className={`${boton} bg-amber-600 px-4`}>
                                Agregarlo igual
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Antes de aprobar un par de una promo de dos pares: que nadie olvide el nº de operación del otro par. */}
            {confirmando && (
                <div role="alertdialog" aria-label={confirmando.vista.confirmarAntesDeAprobar?.titulo} className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4" onKeyDown={e => { if (e.key === 'Escape') setConfirmando(null); }} tabIndex={-1} ref={cartelConfirmar}>
                    <div role="document" className="bg-white text-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-3">
                        <p className="flex items-center gap-2 text-sm font-black"><AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" /> {confirmando.vista.confirmarAntesDeAprobar?.titulo}</p>
                        <p className="text-sm leading-relaxed">{confirmando.vista.confirmarAntesDeAprobar?.texto}</p>
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                            <button type="button" onClick={() => { setConfirmando(null); dialogo.current?.focus(); }} className={`${boton} bg-stone-500`}>Volver a mirar</button>
                            <button type="button" disabled={ocupado !== null} onClick={() => { const b = confirmando; setConfirmando(null); decidir(b.id, 'aprobar'); }} className={`${boton} bg-emerald-600 px-4`}>
                                <Check className="w-3.5 h-3.5" /> Lo revisé: aprobar y cargar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* El portal a pantalla completa. Si es un pedido para revisar, el OK se da acá mismo. */}
            {ampliada && (
                <div role="dialog" aria-label={`El pedido en el portal de ${nombre}, ampliado`} className="fixed inset-0 z-[200] bg-black/90 flex flex-col"
                    onKeyDown={e => { if (e.key === 'Escape') setAmpliada(null); }} tabIndex={-1} ref={dialogo}>
                    <div className="flex items-center justify-between gap-3 px-4 py-2 text-white bg-stone-950">
                        <span className="text-[11px] font-black uppercase tracking-widest">{nombre} · {borradorAmpliado ? 'así queda el pedido en el portal' : 'el pedido en el portal'}</span>
                        <a href={ampliada.url} target="_blank" rel="noreferrer" className="text-[11px] underline text-stone-300 hover:text-white whitespace-nowrap">Abrir la captura en otra pestaña</a>
                        <button type="button" aria-label="Cerrar" onClick={() => setAmpliada(null)} className="inline-flex items-center gap-1 bg-white text-stone-900 text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-lg">
                            <X className="w-4 h-4" /> Cerrar
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto px-4 pb-4" onClick={() => setAmpliada(null)}>
                        <img src={ampliada.url} alt={`El pedido en el portal de ${nombre}, ampliado`} onClick={e => e.stopPropagation()} onError={() => marcarRota(ampliada.url)} className="mx-auto max-w-[1400px] w-full h-auto rounded-lg shadow-2xl bg-white" />
                    </div>
                    {borradorAmpliado && (
                        <div className="bg-stone-900 border-t border-stone-700 px-4 py-3">
                            <div className="mx-auto max-w-[1400px] space-y-2">
                                {error && <p className="text-xs text-rose-300 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {error}</p>}
                                {decision(borradorAmpliado, true, !!rotas[ampliada.url])}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
