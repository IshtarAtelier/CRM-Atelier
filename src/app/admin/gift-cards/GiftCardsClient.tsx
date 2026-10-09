'use client';

/**
 * Gift cards: el equipo carga los datos, emite la tarjeta (el código lo da el
 * servidor), la descarga o la comparte por WhatsApp, y en el registro de abajo
 * la marca como usada cuando la vienen a canjear.
 *
 * Primero se EMITE y recién después se puede descargar o mandar: así no sale
 * del local ninguna tarjeta que no esté anotada con su código.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gift, Download, Share2, Copy, Plus, Loader2, Search, RotateCcw, Ban, Check, Eye } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { formatDate } from '@/lib/format-date';
import { formatearPrecio, precioConSigno } from '@/lib/format-precio';
import { mensajeWhatsAppGiftCard, linkWhatsAppGiftCard } from '@/lib/gift-card-mensaje';
import {
    ESTADO_GIFT_CARD_INFO, MONTO_MAXIMO_GIFT_CARD, VIGENCIA_SUGERIDA_MESES,
    diaCordoba, estadoVisible, hoyCordoba, type EstadoGiftCard,
} from '@/lib/constants/gift-cards';
import { ANCHO_GIFT_CARD, ALTO_GIFT_CARD, dibujarGiftCard } from './dibujar-gift-card';

export interface GiftCardFila {
    id: string; code: string; para: string; de: string | null; monto: number;
    validaHasta: string | null; telefono: string | null; estado: EstadoGiftCard;
    usadaAt: string | null; usadaPorName: string | null; notas: string | null;
    createdByName: string; createdAt: string;
}

interface Props {
    esAdmin: boolean;
    fuenteSerif: string;
    /** Aplicada al título: asegura que la serifa se cargue antes de dibujar. */
    claseSerif: string;
    resenas: { rating: number; cantidad: number };
}

const IMAGEN_GIOCONDA = '/images/editorial/monalisa.webp';

function vigenciaSugerida(): string {
    const [a, m, d] = hoyCordoba().split('-').map(Number);
    const f = new Date(Date.UTC(a, m - 1 + VIGENCIA_SUGERIDA_MESES, d));
    return f.toISOString().slice(0, 10);
}

const FORM_VACIO = () => ({ para: '', de: '', monto: '', validaHasta: vigenciaSugerida(), telefono: '', notas: '' });

export default function GiftCardsClient({ esAdmin, fuenteSerif, claseSerif, resenas }: Props) {
    const [form, setForm] = useState(FORM_VACIO);
    const [emitida, setEmitida] = useState<GiftCardFila | null>(null);
    const [emitiendo, setEmitiendo] = useState(false);
    const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'error' | 'info' } | null>(null);

    const [cards, setCards] = useState<GiftCardFila[]>([]);
    const [q, setQ] = useState('');
    const [cargando, setCargando] = useState(true);
    const [errorLista, setErrorLista] = useState<string | null>(null);
    const [confirmando, setConfirmando] = useState<{ id: string; estado: EstadoGiftCard } | null>(null);
    const [cambiando, setCambiando] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imagenRef = useRef<HTMLImageElement | null>(null);
    const [listo, setListo] = useState(0); // sube cuando cargan la imagen o las fuentes, para redibujar
    const [puedeCompartir, setPuedeCompartir] = useState(false);

    const montoNum = Number(form.monto.replace(/\D/g, '')) || 0;
    const datos = emitida
        ? { para: emitida.para, de: emitida.de || '', monto: emitida.monto, code: emitida.code, validaHasta: emitida.validaHasta ? diaCordoba(emitida.validaHasta) : '' }
        : { para: form.para, de: form.de, monto: montoNum, code: null, validaHasta: form.validaHasta };

    const mensaje = useMemo(() => emitida ? mensajeWhatsAppGiftCard({
        para: emitida.para, de: emitida.de, monto: emitida.monto, code: emitida.code,
        validaHasta: emitida.validaHasta ? diaCordoba(emitida.validaHasta) : null,
    }) : '', [emitida]);

    // ---- imagen, fuentes y dibujo ----
    useEffect(() => {
        const img = new Image();
        img.onload = () => setListo(n => n + 1);
        img.src = IMAGEN_GIOCONDA;
        imagenRef.current = img;
        const sans = getComputedStyle(document.body).getPropertyValue('--font-geist-sans').trim() || 'system-ui, sans-serif';
        Promise.all([
            document.fonts.load(`500 60px ${fuenteSerif}`), document.fonts.load(`italic 500 50px ${fuenteSerif}`),
            document.fonts.load(`400 20px ${sans}`), document.fonts.load(`700 20px ${sans}`), document.fonts.load(`800 20px ${sans}`),
        ]).catch(() => {}).finally(() => setListo(n => n + 1));
        setPuedeCompartir(typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
            && navigator.canShare({ files: [new File([new Blob()], 'x.png', { type: 'image/png' })] }));
    }, [fuenteSerif]);

    useEffect(() => {
        const c = canvasRef.current;
        const ctx = c?.getContext('2d');
        if (!c || !ctx) return;
        const sans = getComputedStyle(document.body).getPropertyValue('--font-geist-sans').trim() || 'system-ui, sans-serif';
        const id = requestAnimationFrame(() => dibujarGiftCard(
            ctx,
            { ...datos, rating: resenas.rating, cantidadResenas: resenas.cantidad },
            { serif: fuenteSerif, sans },
            imagenRef.current,
        ));
        return () => cancelAnimationFrame(id);
    }, [datos.para, datos.de, datos.monto, datos.code, datos.validaHasta, listo, fuenteSerif, resenas.rating, resenas.cantidad]);

    // ---- registro ----
    const cargar = useCallback(async (busqueda: string) => {
        setCargando(true); setErrorLista(null);
        try {
            const r = await fetch(`/api/gift-cards${busqueda ? `?q=${encodeURIComponent(busqueda)}` : ''}`, { cache: 'no-store' });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Error');
            setCards(j.cards);
        } catch (e) {
            setErrorLista(e instanceof Error ? e.message : 'Error');
        } finally { setCargando(false); }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => cargar(q.trim()), 250);
        return () => clearTimeout(t);
    }, [q, cargar]);

    // ---- acciones ----
    async function emitir(e: React.FormEvent) {
        e.preventDefault();
        if (!form.para.trim()) { setAviso({ texto: 'Falta el nombre de quien recibe la tarjeta.', tipo: 'error' }); return; }
        if (!montoNum) { setAviso({ texto: 'Falta el monto.', tipo: 'error' }); return; }
        if (montoNum > MONTO_MAXIMO_GIFT_CARD) { setAviso({ texto: 'El monto parece demasiado alto: revisalo.', tipo: 'error' }); return; }
        setEmitiendo(true); setAviso(null);
        try {
            const r = await fetch('/api/gift-cards', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, monto: montoNum, validaHasta: form.validaHasta || null }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'No se pudo emitir');
            setEmitida(j);
            setAviso({ texto: `Gift card ${j.code} emitida y anotada en el registro. Ahora descargala o mandala por WhatsApp.`, tipo: 'ok' });
            cargar(q.trim());
        } catch (err) {
            setAviso({ texto: err instanceof Error ? err.message : 'No se pudo emitir', tipo: 'error' });
        } finally { setEmitiendo(false); }
    }

    function nueva() {
        setEmitida(null); setForm(FORM_VACIO()); setAviso(null);
    }

    function verTarjeta(c: GiftCardFila) {
        setEmitida(c);
        setAviso({ texto: `Mostrando la gift card ${c.code}. Podés volver a descargarla o mandarla.`, tipo: 'info' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function imagen(): Promise<Blob | null> {
        return new Promise(res => canvasRef.current ? canvasRef.current.toBlob(res, 'image/png') : res(null));
    }

    async function descargar() {
        if (!emitida) return;
        const blob = await imagen();
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `GiftCard-Atelier-${emitida.code}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    async function compartir() {
        if (!emitida) return;
        const blob = await imagen();
        if (!blob) return;
        const archivo = new File([blob], `GiftCard-Atelier-${emitida.code}.png`, { type: 'image/png' });
        try { await navigator.share({ files: [archivo], text: mensaje }); }
        catch { /* el usuario cerró el menú de compartir */ }
    }

    async function copiar() {
        try { await navigator.clipboard.writeText(mensaje); setAviso({ texto: 'Mensaje copiado.', tipo: 'ok' }); }
        catch { setAviso({ texto: 'No se pudo copiar: seleccioná el texto del mensaje y copialo a mano.', tipo: 'error' }); }
    }

    async function cambiarEstado(id: string, estado: EstadoGiftCard) {
        setCambiando(id); setConfirmando(null);
        try {
            const r = await fetch(`/api/gift-cards/${id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'No se pudo actualizar');
            setCards(cs => cs.map(c => c.id === id ? j : c));
            if (emitida?.id === id) setEmitida(j);
        } catch (err) {
            setAviso({ texto: err instanceof Error ? err.message : 'No se pudo actualizar', tipo: 'error' });
        } finally { setCambiando(null); }
    }

    const campo = 'w-full rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-3 py-2.5 text-base disabled:opacity-60';
    const etiqueta = 'block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1';
    const boton = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-stone-300 dark:border-stone-600 hover:border-primary disabled:opacity-50 disabled:pointer-events-none';

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
            <header className="space-y-1">
                <h1 className="text-3xl tracking-tight flex items-center gap-2"><Gift className="w-6 h-6 text-primary" /> <span className={claseSerif}>Gift Cards</span></h1>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                    Cuando el cliente ya pagó: cargá los datos y emitila. Queda anotada con su código y la podés descargar o mandar por WhatsApp. Cuando la vengan a usar, buscala abajo y marcala como usada.
                </p>
            </header>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] items-start">
                <form onSubmit={emitir} className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 sm:p-5 space-y-4 min-w-0">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="gc-para" className={etiqueta}>Para</label>
                            <input id="gc-para" className={campo} value={emitida ? emitida.para : form.para} disabled={!!emitida}
                                onChange={e => setForm(f => ({ ...f, para: e.target.value }))} placeholder="Quien la recibe" maxLength={80} autoComplete="off" />
                        </div>
                        <div>
                            <label htmlFor="gc-de" className={etiqueta}>De</label>
                            <input id="gc-de" className={campo} value={emitida ? (emitida.de || '') : form.de} disabled={!!emitida}
                                onChange={e => setForm(f => ({ ...f, de: e.target.value }))} placeholder="Quien la regala" maxLength={80} autoComplete="off" />
                        </div>
                        <div>
                            <label htmlFor="gc-monto" className={etiqueta}>Monto</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">$</span>
                                <input id="gc-monto" inputMode="numeric" className={`${campo} pl-7 tabular-nums`} disabled={!!emitida}
                                    value={emitida ? formatearPrecio(emitida.monto) : form.monto}
                                    onChange={e => { const n = Number(e.target.value.replace(/\D/g, '')) || 0; setForm(f => ({ ...f, monto: n ? formatearPrecio(n) : '' })); }}
                                    placeholder="50.000" autoComplete="off" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="gc-vence" className={etiqueta}>Válida hasta</label>
                            <input id="gc-vence" type="date" className={campo} min={hoyCordoba()} disabled={!!emitida}
                                value={emitida ? (emitida.validaHasta ? diaCordoba(emitida.validaHasta) : '') : form.validaHasta}
                                onChange={e => setForm(f => ({ ...f, validaHasta: e.target.value }))} />
                        </div>
                        <div>
                            <label htmlFor="gc-tel" className={etiqueta}>WhatsApp de quien la recibe (opcional)</label>
                            <input id="gc-tel" inputMode="tel" className={campo} disabled={!!emitida}
                                value={emitida ? (emitida.telefono || '') : form.telefono}
                                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="351 555-1234" autoComplete="off" />
                            <p className="text-xs text-stone-500 mt-1">Con código de área, sin 0 ni 15.</p>
                        </div>
                        <div>
                            <label htmlFor="gc-notas" className={etiqueta}>Notas internas (opcional)</label>
                            <input id="gc-notas" className={campo} disabled={!!emitida}
                                value={emitida ? (emitida.notas || '') : form.notas}
                                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Cómo pagó, para qué es…" maxLength={500} autoComplete="off" />
                        </div>
                    </div>

                    {!emitida ? (
                        <button type="submit" disabled={emitiendo} className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold shadow hover:opacity-90 disabled:opacity-60">
                            {emitiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />} Emitir gift card
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={descargar} className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow hover:opacity-90">
                                    <Download className="w-4 h-4" /> Descargar imagen
                                </button>
                                {puedeCompartir && (
                                    <button type="button" onClick={compartir} className={boton}><Share2 className="w-4 h-4" /> Compartir</button>
                                )}
                                <a href={linkWhatsAppGiftCard(mensaje, emitida.telefono)} target="_blank" rel="noopener noreferrer" className={boton}>
                                    <WhatsAppIcon className="w-4 h-4" /> Abrir WhatsApp
                                </a>
                                <button type="button" onClick={copiar} className={boton}><Copy className="w-4 h-4" /> Copiar mensaje</button>
                                <button type="button" onClick={nueva} className={boton}><Plus className="w-4 h-4" /> Nueva gift card</button>
                            </div>
                            <ol className="text-sm text-stone-500 dark:text-stone-400 list-decimal pl-5 space-y-0.5">
                                <li>Descargá la imagen{puedeCompartir ? ' o tocá Compartir y elegí WhatsApp' : ''}.</li>
                                <li>Abrí WhatsApp: el mensaje ya va escrito.</li>
                                <li>Adjuntá la imagen y enviá.</li>
                            </ol>
                            <pre className="whitespace-pre-wrap break-words text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 p-3 font-sans">{mensaje}</pre>
                        </div>
                    )}

                    {aviso && (
                        <p role="status" className={`text-sm font-bold ${aviso.tipo === 'error' ? 'text-red-700 dark:text-red-300' : aviso.tipo === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-600 dark:text-stone-300'}`}>
                            {aviso.texto}
                        </p>
                    )}
                </form>

                <div className="space-y-2 min-w-0 lg:sticky lg:top-4">
                    <canvas ref={canvasRef} width={ANCHO_GIFT_CARD} height={ALTO_GIFT_CARD}
                        className="block w-full h-auto max-w-full rounded-2xl border border-stone-200 dark:border-stone-700 bg-black"
                        aria-label="Vista previa de la gift card" role="img" />
                    <p className="text-xs text-stone-500">Así queda la imagen que se descarga (1080 × 1350, para WhatsApp e Instagram).</p>
                </div>
            </div>

            <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
                <div className="flex flex-wrap items-end justify-between gap-3 p-4 border-b border-stone-200 dark:border-stone-700">
                    <div>
                        <h2 className="text-lg font-black">Registro de gift cards</h2>
                        <p className="text-xs text-stone-500">Las vencidas se marcan solas. Reactivar o anular lo hace un administrador.</p>
                    </div>
                    <label className="relative block w-full sm:w-72">
                        <span className="sr-only">Buscar por código o nombre</span>
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Código o nombre" className={`${campo} pl-9`} />
                    </label>
                </div>

                {errorLista && <p className="p-4 text-red-700 dark:text-red-300 font-bold">No se pudo cargar: {errorLista}</p>}
                {cargando && !cards.length && <p className="p-6 text-sm text-stone-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>}
                {!cargando && !errorLista && !cards.length && (
                    <p className="p-6 text-sm text-stone-500">{q ? 'Ninguna gift card coincide con la búsqueda.' : 'Todavía no se emitió ninguna gift card. La primera aparece acá apenas la emitas.'}</p>
                )}

                {cards.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[760px]">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wider text-stone-500">
                                    <th className="px-4 py-2.5">Código</th>
                                    <th className="px-4 py-2.5">Para</th>
                                    <th className="px-4 py-2.5">De</th>
                                    <th className="px-4 py-2.5 text-right">Monto</th>
                                    <th className="px-4 py-2.5">Emitida</th>
                                    <th className="px-4 py-2.5">Vence</th>
                                    <th className="px-4 py-2.5">Estado</th>
                                    <th className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                                {cards.map(c => {
                                    const ev = estadoVisible(c);
                                    const info = ESTADO_GIFT_CARD_INFO[ev];
                                    const pidiendo = confirmando?.id === c.id ? confirmando.estado : null;
                                    return (
                                        <tr key={c.id} className="align-middle">
                                            <td className="px-4 py-3 font-bold tabular-nums tracking-wide whitespace-nowrap">{c.code}</td>
                                            <td className="px-4 py-3">{c.para}</td>
                                            <td className="px-4 py-3 text-stone-600 dark:text-stone-300">{c.de || ''}</td>
                                            <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{precioConSigno(c.monto)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.createdAt)}<span className="block text-xs text-stone-500">{c.createdByName}</span></td>
                                            <td className="px-4 py-3 whitespace-nowrap">{c.validaHasta ? formatDate(diaCordoba(c.validaHasta)) : 'Sin vencimiento'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${info.clase}`}>{info.etiqueta}</span>
                                                {c.estado === 'USADA' && c.usadaAt && <span className="block text-xs text-stone-500 mt-0.5">{formatDate(c.usadaAt)}{c.usadaPorName ? ` · ${c.usadaPorName}` : ''}</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap justify-end gap-1.5">
                                                    {cambiando === c.id ? <Loader2 className="w-4 h-4 animate-spin text-stone-400" /> : pidiendo ? (
                                                        <>
                                                            <span className="text-xs font-bold self-center">{pidiendo === 'USADA' ? '¿Marcar como usada?' : pidiendo === 'ANULADA' ? '¿Anularla?' : '¿Volver a activarla?'}</span>
                                                            <button onClick={() => cambiarEstado(c.id, pidiendo)} className="px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-bold">Sí</button>
                                                            <button onClick={() => setConfirmando(null)} className="px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-600 text-xs font-bold">No</button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => verTarjeta(c)} title="Ver y volver a mandar" className="px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-600 text-xs font-bold inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Ver</button>
                                                            {ev === 'ACTIVA' && (
                                                                <button onClick={() => setConfirmando({ id: c.id, estado: 'USADA' })} className="px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-600 text-xs font-bold inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Marcar usada</button>
                                                            )}
                                                            {esAdmin && (c.estado === 'USADA' || c.estado === 'ANULADA') && (
                                                                <button onClick={() => setConfirmando({ id: c.id, estado: 'ACTIVA' })} className="px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-600 text-xs font-bold inline-flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Reactivar</button>
                                                            )}
                                                            {esAdmin && c.estado === 'ACTIVA' && (
                                                                <button onClick={() => setConfirmando({ id: c.id, estado: 'ANULADA' })} className="px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-600 text-xs font-bold inline-flex items-center gap-1 text-red-700 dark:text-red-300"><Ban className="w-3.5 h-3.5" /> Anular</button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
