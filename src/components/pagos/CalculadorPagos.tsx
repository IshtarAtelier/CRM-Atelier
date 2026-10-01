'use client';

import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Copy, Check, Calculator } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { PricingService } from '@/services/PricingService';
import { formatearPrecio } from '@/lib/format-precio';
import { GRUPOS_FORMAS_DE_PAGO, etiquetaFormaDePago } from '@/lib/constants/formas-de-pago';
import { esMpCuotasLargas } from '@/lib/payment-card';

// ────────────────────────────────────────────────────────────────────────────
// Calculador de pagos: el vendedor simula cómo pagaría el cliente (una o varias
// formas mezcladas) y ve cuánto le queda en cada forma de pago. NO guarda nada
// y no pide comprobante: registrar sigue siendo "Abonar".
//
// No hay ni una cuenta propia: cada línea simulada entra como si fuera un pago
// real y se le pide el resultado a `PricingService.calculateOrderFinancials`,
// el mismo motor que calcula el saldo verdadero. Si el calculador dice un
// número, el saldo real después de cobrar dice el mismo.
// ────────────────────────────────────────────────────────────────────────────

interface CalculadorPagosProps {
    isOpen: boolean;
    onClose: () => void;
    /** Presupuestos y ventas del cliente para elegir de cuál simular. */
    orders?: any[];
    initialOrderId?: string | null;
    clientName?: string;
}

interface Linea {
    id: number;
    method: string;
    amount: string;
}

const SIN_PEDIDO = '__sin_pedido__';
const FORMA_INICIAL = 'EFECTIVO';

const parseMonto = (texto: string) => Number(String(texto || '').replace(/\D/g, '')) || 0;
const $ = (n: number) => `$${formatearPrecio(Math.max(0, Math.round(n)))}`;

function tituloDelPedido(o: any) {
    const tipo = o.orderType === 'SALE' || o.orderType === 'MAYORISTA' ? 'Venta' : 'Presupuesto';
    const lista = o.subtotalWithMarkup || o.total || 0;
    return `${tipo} #${String(o.id || '').slice(-6).toUpperCase()} · lista ${$(lista)}`;
}

export default function CalculadorPagos({ isOpen, onClose, orders = [], initialOrderId, clientName }: CalculadorPagosProps) {
    const pedidos = useMemo(() => (orders || []).filter(o => o && !o.isDeleted), [orders]);
    const [orderId, setOrderId] = useState<string>(initialOrderId || pedidos[0]?.id || SIN_PEDIDO);
    const [listaManual, setListaManual] = useState('');
    const [lineas, setLineas] = useState<Linea[]>([{ id: 1, method: FORMA_INICIAL, amount: '' }]);
    const [completarCon, setCompletarCon] = useState(FORMA_INICIAL);
    const [copiado, setCopiado] = useState(false);

    const pedido = pedidos.find(o => o.id === orderId) || null;

    // El pedido base: el elegido, o uno sintético con el precio de lista tipeado.
    // Un pedido viejo con `paid` y sin filas de Payment pierde ese pago si se le
    // agregan pagos nuevos (el motor solo cae a `paid` cuando no hay ninguno):
    // se lo representa como un pago nominal, que es lo que el motor asumía.
    const base = useMemo(() => {
        if (!pedido) {
            const lista = parseMonto(listaManual);
            return { total: lista, subtotalWithMarkup: lista, paid: 0, payments: [] as any[] };
        }
        const pagos = [...(pedido.payments || [])];
        if (pagos.length === 0 && (pedido.paid || 0) > 0) pagos.push({ method: 'REGISTRADO', amount: pedido.paid });
        return { ...pedido, payments: pagos };
    }, [pedido, listaManual]);

    const simulados = lineas
        .map(l => ({ method: l.method, amount: parseMonto(l.amount) }))
        .filter(p => p.amount > 0);

    const hoy = PricingService.calculateOrderFinancials(base);
    const despues = PricingService.calculateOrderFinancials({
        ...base,
        payments: [...base.payments, ...simulados],
        paid: (base.paid || 0) + simulados.reduce((a, p) => a + p.amount, 0),
    });
    // Lo que queda, expresado en cada forma de pago: se le pide al motor como
    // si el saldo de lista fuera un pedido nuevo (ahí viven los descuentos y
    // las cuotas; acá no se multiplica nada).
    const resto = PricingService.calculateOrderFinancials({
        total: despues.remainingList,
        subtotalWithMarkup: despues.remainingList,
        discountCash: base.discountCash,
        discountTransfer: base.discountTransfer,
        paid: 0,
        payments: [],
    });
    const saldado = despues.remainingList <= 0;
    const deMas = Math.round(despues.listEquivalentPaid - despues.listPrice);
    const hayLista = despues.listPrice > 0;

    const actualizar = (id: number, cambio: Partial<Linea>) =>
        setLineas(ls => ls.map(l => (l.id === id ? { ...l, ...cambio } : l)));
    const agregar = (method = FORMA_INICIAL, amount = '') =>
        setLineas(ls => [...ls, { id: (ls[ls.length - 1]?.id || 0) + 1, method, amount }]);
    const quitar = (id: number) => setLineas(ls => (ls.length > 1 ? ls.filter(l => l.id !== id) : ls));

    const importeParaCompletar = (method: string) => {
        const m = method.toUpperCase();
        if (m === 'EFECTIVO') return resto.totalCash;
        if (m.includes('TRANSFER')) return resto.totalTransfer;
        if (esMpCuotasLargas(m)) return resto.totalCardFinanced;
        return resto.totalCard;
    };

    const resumen = () => {
        const encabezado = [clientName, pedido ? tituloDelPedido(pedido) : `Precio de lista ${$(despues.listPrice)}`].filter(Boolean).join(' · ');
        const pagos = simulados.map(p => `${etiquetaFormaDePago(p.method)} ${$(p.amount)}`).join(' + ') || 'sin pagos';
        const queda = saldado
            ? 'Queda saldado'
            : `Queda: efectivo ${$(resto.totalCash)} · transferencia ${$(resto.totalTransfer)} · tarjeta ${$(resto.totalCard)} · 12 cuotas de ${$(resto.installment12)}`;
        return `Simulación de pago · ${encabezado}\nPaga: ${pagos}\n${queda}`;
    };

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(resumen());
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch (e) {
            console.error('No se pudo copiar el resumen:', e);
        }
    };

    const selectClase = 'w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm font-bold text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400';
    const inputClase = 'w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm font-black text-right text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400';

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl">
            <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 bg-amber-50/60 dark:bg-amber-900/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow">
                            <Calculator className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-stone-800 dark:text-stone-100">Calculador de pagos</h3>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Simulación · no registra nada</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Sobre qué</label>
                            <select className={selectClase} value={orderId} onChange={e => setOrderId(e.target.value)}>
                                {pedidos.map(o => <option key={o.id} value={o.id}>{tituloDelPedido(o)}</option>)}
                                <option value={SIN_PEDIDO}>Un importe a mano (todavía sin presupuesto)</option>
                            </select>
                        </div>
                        {pedido ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-stone-50 dark:bg-stone-800/60 p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Precio de lista</p>
                                    <p className="text-base font-black text-stone-800 dark:text-stone-100">{$(hoy.listPrice)}</p>
                                </div>
                                <div className="rounded-2xl bg-stone-50 dark:bg-stone-800/60 p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Ya pagó</p>
                                    <p className="text-base font-black text-stone-800 dark:text-stone-100">{$(hoy.paidReal)}</p>
                                    {hoy.paidReal > 0 && <p className="text-[9px] text-stone-400">vale {$(hoy.listEquivalentPaid)} de lista</p>}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Precio de lista</label>
                                <input className={inputClase} inputMode="numeric" placeholder="0" value={listaManual ? formatearPrecio(parseMonto(listaManual)) : ''} onChange={e => setListaManual(e.target.value)} />
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Si paga así…</p>
                        <div className="space-y-2">
                            {lineas.map(l => (
                                <div key={l.id} className="grid grid-cols-[1fr_140px_36px] gap-2 items-center">
                                    <select className={selectClase} value={l.method} onChange={e => actualizar(l.id, { method: e.target.value })}>
                                        {GRUPOS_FORMAS_DE_PAGO.map(g => (
                                            <optgroup key={g.id} label={g.titulo}>
                                                {g.items.map(i => <option key={i.id} value={i.id}>{etiquetaFormaDePago(i.id)}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <input className={inputClase} inputMode="numeric" placeholder="$ 0" value={l.amount ? formatearPrecio(parseMonto(l.amount)) : ''} onChange={e => actualizar(l.id, { amount: e.target.value })} />
                                    <button onClick={() => quitar(l.id)} className="p-2 rounded-xl text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all" aria-label="Quitar" disabled={lineas.length === 1}>
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => agregar()} className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-amber-600 hover:bg-amber-50 transition-all">
                            <Plus className="w-4 h-4" /> Agregar otro pago (mixto)
                        </button>
                    </div>

                    <div className={`rounded-2xl p-4 border ${saldado ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'bg-stone-50 border-stone-200 dark:bg-stone-800/60 dark:border-stone-700'}`}>
                        {!hayLista ? (
                            <p className="text-xs font-bold text-stone-400">Elegí un presupuesto o escribí el precio de lista.</p>
                        ) : saldado ? (
                            <div>
                                <p className="text-sm font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Queda saldado</p>
                                {deMas > 0 && <p className="text-xs font-bold text-amber-600 mt-1">Pagaría {$(deMas)} de más (en precio de lista): bajá el último importe.</p>}
                            </div>
                        ) : (
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Le queda por pagar</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        ['Efectivo', resto.totalCash, `−${resto.discountCash}%`],
                                        ['Transferencia', resto.totalTransfer, `−${resto.discountTransfer}%`],
                                        ['Tarjeta', resto.totalCard, `3 de ${$(resto.installment3)} · 6 de ${$(resto.installment6)}`],
                                        ['12 cuotas fijas', resto.installment12, `por mes · total ${$(resto.totalCardFinanced)}`],
                                    ].map(([titulo, monto, nota]) => (
                                        <div key={String(titulo)} className="rounded-xl bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-700 p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">{titulo}</p>
                                            <p className="text-lg font-black text-stone-800 dark:text-stone-100 leading-tight">{$(Number(monto))}</p>
                                            <p className="text-[9px] font-bold text-stone-400 mt-0.5">{nota}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Completar el resto con</span>
                                    <select className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold" value={completarCon} onChange={e => setCompletarCon(e.target.value)}>
                                        {GRUPOS_FORMAS_DE_PAGO.map(g => (
                                            <optgroup key={g.id} label={g.titulo}>
                                                {g.items.map(i => <option key={i.id} value={i.id}>{etiquetaFormaDePago(i.id)}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <button onClick={() => agregar(completarCon, String(Math.round(importeParaCompletar(completarCon))))} className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                                        Agregar {$(importeParaCompletar(completarCon))}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <button onClick={copiar} disabled={!hayLista} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-all disabled:opacity-40">
                            {copiado ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />} {copiado ? 'Copiado' : 'Copiar resumen'}
                        </button>
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-stone-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-stone-700 transition-all">Cerrar</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
