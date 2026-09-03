'use client';

/**
 * "Presupuesto en PDF" desde el buzón de WhatsApp.
 *
 * Sale SIEMPRE como plantilla aprobada (`presupuesto_pdf`, o `venta_confirmada`
 * si el pedido ya es venta) con el PDF del pedido como encabezado, así que
 * funciona aunque el cliente no haya escrito en las últimas 24 h. Antes la
 * única forma de mandar un PDF desde el chat era adjuntarlo a mano, y con la
 * ventana cerrada eso daba error (reporte del 3/9/26: "no permite enviar el
 * presupuesto en PDF a clientes que pasaron más de 23 horas").
 *
 * No genera nada acá: elige un pedido de la ficha del cliente y llama a la
 * misma ruta que el botón "PDF" del presupuesto (`/api/orders/[id]/send-pdf`),
 * que genera el PDF, lo manda y lo deja asentado en la ficha. Una sola
 * implementación del envío, dos puertas.
 */

import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { renderTemplate } from '@/lib/whatsapp/templates';
import { formatDate } from '@/lib/format-date';
import { precioConSigno } from '@/lib/format-precio';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';
import type { Chat } from './types';

interface PedidoDeFicha {
    id: string;
    orderType?: string | null;
    total?: number | null;
    createdAt: string;
    isDeleted?: boolean;
    items?: { product?: { name?: string | null } | null; productNameSnapshot?: string | null }[];
}

interface Props {
    open: boolean;
    chat: Chat;
    onClose: () => void;
    /** Se llama cuando el PDF salió (para refrescar el chat). */
    onSent: () => void;
}

/** Los mismos textos que el botón "PDF" del presupuesto (QuoteSummary). */
function textoDelEnvio(nombre: string, esVenta: boolean, articulos: string) {
    return `Hola ${nombre}, adjunto tu ${esVenta ? 'orden' : 'presupuesto'} por: ${articulos}.\n\nAtelier Óptica, la óptica mejor calificada en Córdoba ⭐⭐⭐⭐⭐.`;
}

export function EnviarPresupuestoModal({ open, chat, onClose, onSent }: Props) {
    const [pedidos, setPedidos] = useState<PedidoDeFicha[] | null>(null);
    const [elegido, setElegido] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clienteId = chat.client?.id || null;
    const nombre = (chat.client?.name || chat.profileName || '').split(' ')[0] || 'cliente';
    const telefono = formatPhoneForWhatsApp(chat.client?.phone || chat.realPhone || chat.waId.replace(/@.*$/, ''));

    useEffect(() => {
        if (!open || !clienteId) return;
        let vivo = true;
        setPedidos(null);
        setError(null);
        fetch(`/api/contacts/${clienteId}`)
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .then(data => {
                if (!vivo) return;
                const lista: PedidoDeFicha[] = (data.orders || [])
                    .filter((o: PedidoDeFicha) => !o.isDeleted)
                    .sort((a: PedidoDeFicha, b: PedidoDeFicha) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 8);
                setPedidos(lista);
                setElegido(lista[0]?.id ?? null);
            })
            .catch(e => { if (vivo) { setPedidos([]); setError(`No se pudo leer la ficha: ${e.message}`); } });
        return () => { vivo = false; };
    }, [open, clienteId]);

    const pedido = useMemo(() => pedidos?.find(p => p.id === elegido) || null, [pedidos, elegido]);
    const esVenta = pedido?.orderType === 'SALE' || pedido?.orderType === 'MAYORISTA';
    const articulos = useMemo(() => {
        const nombres = new Set<string>();
        for (const it of pedido?.items || []) {
            const n = it.product?.name || it.productNameSnapshot;
            if (n) nombres.add(n);
        }
        return [...nombres].join(', ') || 'tus anteojos';
    }, [pedido]);

    if (!open) return null;

    const nro = (id: string) => `#${id.slice(-4).toUpperCase()}`;
    const preview = pedido
        ? (esVenta
            ? renderTemplate('venta_confirmada', [nombre, nro(pedido.id), precioConSigno(pedido.total)])
            : renderTemplate('presupuesto_pdf', [nombre, precioConSigno(pedido.total), '7']))
        : '';

    const enviar = async () => {
        if (!pedido || enviando) return;
        if (!telefono || telefono === '549') { setError('El cliente no tiene un teléfono válido en la ficha.'); return; }
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch(`/api/orders/${pedido.id}/send-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formattedPhone: telefono, text: textoDelEnvio(nombre, esVenta, articulos) }),
                signal: AbortSignal.timeout(110000),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
            onSent();
            onClose();
        } catch (e: any) {
            setError(e?.name === 'TimeoutError' ? 'El envío está tardando demasiado. Fijate en el chat si salió antes de reintentar.' : (e?.message || 'No se pudo enviar.'));
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Enviar presupuesto en PDF">
            <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-2">
                            <FileText size={18} className="text-violet-600" /> Presupuesto en PDF
                        </h2>
                        <p className="text-sm text-stone-500 mt-1">
                            Sale como <strong>plantilla aprobada con el PDF adjunto</strong>, así que llega aunque la conversación esté cerrada.
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"><X size={18} /></button>
                </div>

                {!clienteId ? (
                    <p className="mt-5 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        Este chat no está vinculado a una ficha de cliente. Vinculalo primero (o mandá el PDF desde el presupuesto en la ficha).
                    </p>
                ) : pedidos === null ? (
                    <p className="mt-5 text-sm text-stone-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Buscando los pedidos de la ficha…</p>
                ) : pedidos.length === 0 ? (
                    <p className="mt-5 text-sm text-stone-500">La ficha no tiene presupuestos ni ventas. Armá el presupuesto primero desde la ficha del cliente.</p>
                ) : (
                    <>
                        <label className="block mt-5 text-[10px] font-black uppercase tracking-widest text-stone-400">Qué pedido</label>
                        <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-800">
                            {pedidos.map(p => {
                                const venta = p.orderType === 'SALE' || p.orderType === 'MAYORISTA';
                                const activo = p.id === elegido;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setElegido(p.id)}
                                        aria-pressed={activo}
                                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 ${activo ? 'bg-violet-50 dark:bg-violet-950/40' : 'hover:bg-stone-50 dark:hover:bg-stone-800'}`}
                                    >
                                        <span className="min-w-0">
                                            <span className="font-black text-stone-800 dark:text-white">{nro(p.id)}</span>
                                            <span className="ml-2 text-xs font-bold uppercase tracking-wider text-stone-500">{venta ? 'Venta' : 'Presupuesto'}</span>
                                            <span className="ml-2 text-xs text-stone-400">{formatDate(p.createdAt)}</span>
                                        </span>
                                        <span className="shrink-0 font-bold text-stone-700 dark:text-stone-200">{precioConSigno(p.total)}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {pedido && (
                            <div className="mt-4 rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/40 p-4 text-sm text-stone-700 dark:text-stone-200 whitespace-pre-wrap">
                                <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-white dark:bg-stone-800 border border-violet-200 dark:border-violet-800 px-2 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">
                                    <FileText size={12} /> Pedido {nro(pedido.id)} — Atelier Óptica.pdf
                                </div>
                                <div>{preview}</div>
                                <p className="mt-2 text-[11px] text-stone-400">El importe final lo calcula el sistema al enviar; acá se muestra el total del pedido.</p>
                            </div>
                        )}
                    </>
                )}

                {error && <p className="mt-3 text-xs font-bold text-red-600">{error}</p>}

                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800">Cancelar</button>
                    <button
                        onClick={enviar}
                        disabled={enviando || !pedido}
                        className="px-5 py-2 rounded-xl text-sm font-black bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {enviando ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> : 'Enviar PDF'}
                    </button>
                </div>
            </div>
        </div>
    );
}
