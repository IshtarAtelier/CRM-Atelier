'use client';

import Link from 'next/link';
import { Receipt, ArrowRight } from 'lucide-react';
import { formatearPrecio } from '@/lib/format-precio';
import { formatDate } from '@/lib/format-date';

export interface VentaDelPeriodo {
    id: string;
    fecha: string;
    cliente: string;
    clienteId: string | null;
    resumen: string;
    vendedor: string;
    labStatus: string;
    /** Valor de la venta sin costo financiero (misma regla que "Total Facturado"). */
    valor: number;
    modo: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'SIN_PAGOS';
    cobrado: number;
    saldo: number;
    origen: string;
}

// Mismas etiquetas que /admin/ventas, para que una venta se llame igual en las dos pantallas.
const ESTADO: Record<string, { label: string; cls: string }> = {
    NONE: { label: 'Sin enviar', cls: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400' },
    SENT: { label: 'Falta procesar', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400' },
    IN_PROGRESS: { label: 'Procesado', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
    FINISHED: { label: 'Finalizado (Lab)', cls: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-400' },
    READY: { label: 'Listo p/ Retirar', cls: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400' },
    DELIVERED: { label: 'Entregado', cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400' },
};

const MODO: Record<VentaDelPeriodo['modo'], string> = {
    EFECTIVO: 'Efectivo',
    TRANSFERENCIA: 'Transferencia',
    TARJETA: 'Tarjeta',
    SIN_PAGOS: 'Sin pagos',
};

export function VentasDelPeriodo({ ventas, loading }: { ventas: VentaDelPeriodo[]; loading: boolean }) {
    return (
        <section className={`bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-xl overflow-hidden transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
            <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-xl text-primary">
                        <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Ventas del período</h3>
                        <p className="text-xs font-bold text-stone-500 dark:text-stone-400">{ventas.length} ventas · valor sin costo financiero, cobrado y saldo</p>
                    </div>
                </div>
                <Link href="/admin/ventas" className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                    Ver todas <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>

            {ventas.length === 0 ? (
                <p className="px-6 pb-8 text-[10px] uppercase font-bold text-stone-400">Sin ventas en el período</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[9px] font-black uppercase tracking-widest text-stone-400 border-y border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40">
                                <th className="text-left px-6 py-2.5">Fecha</th>
                                <th className="text-left px-3 py-2.5">Cliente</th>
                                <th className="text-left px-3 py-2.5">Qué compró</th>
                                <th className="text-left px-3 py-2.5">Vendedor</th>
                                <th className="text-left px-3 py-2.5">Estado</th>
                                <th className="text-right px-3 py-2.5">Valor</th>
                                <th className="text-right px-6 py-2.5">Cobrado / Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ventas.map((v) => {
                                const estado = ESTADO[v.labStatus] || ESTADO.NONE;
                                const conSaldo = v.saldo > 1000;
                                return (
                                    <tr key={v.id} className="border-b border-stone-50 dark:border-stone-800/60 hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors">
                                        <td className="px-6 py-3 whitespace-nowrap text-xs font-bold text-stone-500">{formatDate(v.fecha)}</td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <Link href={`/admin/ventas?id=${v.id}`} className="font-black text-stone-800 dark:text-white hover:text-primary">
                                                {v.cliente}
                                            </Link>
                                            <p className="text-[10px] text-stone-400 font-bold">{v.origen}</p>
                                        </td>
                                        <td className="px-3 py-3 max-w-[320px]">
                                            <p className="text-xs text-stone-700 dark:text-stone-300 truncate" title={v.resumen}>{v.resumen}</p>
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-xs font-bold text-stone-500">{v.vendedor}</td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${estado.cls}`}>{estado.label}</span>
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-right">
                                            <p className="font-black text-stone-800 dark:text-white">${formatearPrecio(v.valor)}</p>
                                            <p className="text-[10px] text-stone-400 font-bold">{MODO[v.modo]}</p>
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-right">
                                            <p className="text-xs font-bold text-stone-600 dark:text-stone-300">${formatearPrecio(v.cobrado)}</p>
                                            {conSaldo
                                                ? <p className="text-[10px] font-black text-red-500">Saldo ${formatearPrecio(v.saldo)}</p>
                                                : <p className="text-[10px] font-black text-emerald-600">Pagado</p>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
