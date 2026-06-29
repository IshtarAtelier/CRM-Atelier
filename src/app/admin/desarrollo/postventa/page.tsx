'use client';

import { useState, useEffect } from 'react';
import { 
    ShieldAlert, 
    Users, 
    DollarSign, 
    ArrowLeft, 
    Loader2, 
    MessageSquare, 
    Phone, 
    Calendar,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { OrderDetailPanel } from '@/components/orders/OrderDetailPanel';
import type { Order } from '@/types/orders';

export default function PostVentaPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedDetail, setExpandedDetail] = useState<string | null>(null);

    const fetchPostSales = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/orders?hasPostSale=true');
            const data = await res.json();
            // Handle paginate: true payload vs array payload
            if (data && Array.isArray(data.orders)) {
                setOrders(data.orders);
            } else if (Array.isArray(data)) {
                setOrders(data);
            }
        } catch (error) {
            console.error('Error fetching post sale orders:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPostSales();
    }, []);

    const totalCases = orders.length;
    const totalCost = orders.reduce((sum, order) => sum + (order.postSaleCost || 0), 0);
    const averageCost = totalCases > 0 ? totalCost / totalCases : 0;

    return (
        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Link href="/admin/desarrollo" className="p-2 hover:bg-stone-100 dark:hover:bg-stone-850 rounded-xl transition-all text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Zona de Desarrollo</span>
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic">
                        Control de <span className="text-amber-500 not-italic border-b-4 border-amber-500/30">Post Venta</span>
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 mt-1 font-medium text-xs lg:text-sm">
                        Registro histórico de reclamos, garantías, incidencias y costos asociados.
                    </p>
                </div>
            </header>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Cases Card */}
                <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-3xl p-6 shadow-sm flex items-center gap-5">
                    <div className="bg-blue-500/10 p-4 rounded-2xl text-blue-500">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block">Casos Registrados</span>
                        <span className="text-2xl font-black text-stone-800 dark:text-stone-100 mt-1 block">
                            {totalCases}
                        </span>
                    </div>
                </div>

                {/* Total Cost Card */}
                <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-3xl p-6 shadow-sm flex items-center gap-5">
                    <div className="bg-amber-500/10 p-4 rounded-2xl text-amber-500">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block">Costo de Garantías</span>
                        <span className="text-2xl font-black text-stone-800 dark:text-stone-100 mt-1 block">
                            ${totalCost.toLocaleString('es-AR')}
                        </span>
                    </div>
                </div>

                {/* Average Cost Card */}
                <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-3xl p-6 shadow-sm flex items-center gap-5">
                    <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-500">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block">Costo Promedio</span>
                        <span className="text-2xl font-black text-stone-800 dark:text-stone-100 mt-1 block">
                            ${Math.round(averageCost).toLocaleString('es-AR')}
                        </span>
                    </div>
                </div>
            </div>

            {/* List / Table */}
            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 overflow-hidden shadow-sm">
                <div className="hidden lg:block overflow-x-auto">
                    <div className="grid grid-cols-[1.2fr_1.8fr_1.3fr_1.3fr_1fr_2.5fr_100px] gap-4 px-6 py-3 bg-stone-50 dark:bg-stone-800/30 border-b border-stone-100 dark:border-stone-800 items-center">
                        {['Fecha', 'Cliente', 'Responsable', 'Procesar', 'Costo', 'Observación', 'Acción'].map((h, i) => (
                            <div key={i} className="text-[9px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest text-left">
                                {h}
                            </div>
                        ))}
                    </div>

                    <div className="divide-y divide-stone-50 dark:divide-stone-800/50">
                        {loading ? (
                            <div className="py-20 text-center text-stone-400 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                                Cargando casos...
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="py-24 text-center px-4">
                                <ShieldAlert className="w-12 h-12 text-stone-200 dark:text-stone-800 mx-auto mb-4" />
                                <p className="text-stone-400 dark:text-stone-500 font-black uppercase tracking-widest text-[10px]">No se encontraron registros de post-venta</p>
                            </div>
                        ) : (
                            orders.map((order) => (
                                <div key={order.id} className="flex flex-col">
                                    <div className={`grid grid-cols-[1.2fr_1.8fr_1.3fr_1.3fr_1fr_2.5fr_100px] gap-4 px-6 py-4 items-center hover:bg-stone-50/50 dark:hover:bg-stone-800/10 transition-colors ${expandedDetail === order.id ? 'bg-amber-50/20 dark:bg-amber-950/5' : ''}`}>
                                        {/* Date */}
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                                                {format(new Date(order.createdAt), 'dd MMM yyyy', { locale: es })}
                                            </span>
                                            <span className="text-[10px] text-stone-400 font-mono mt-0.5">
                                                #{order.id.slice(-6).toUpperCase()}
                                            </span>
                                        </div>

                                        {/* Client */}
                                        <div className="flex flex-col">
                                            <p className="font-bold text-xs text-stone-800 dark:text-stone-100">
                                                {order.client?.name}
                                            </p>
                                            <p className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                                                <Phone className="w-3 h-3 text-stone-400" /> {order.client?.phone || 'Sin tel'}
                                            </p>
                                        </div>

                                        {/* Responsible */}
                                        <div>
                                            {order.postSaleResponsible ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-bold">
                                                    <Users className="w-3.5 h-3.5 text-stone-400" />
                                                    {order.postSaleResponsible}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-stone-400 italic">No asignado</span>
                                            )}
                                        </div>

                                        {/* Process Option */}
                                        <div className="flex flex-col text-left">
                                            {order.postSaleOrderOption === 'SAME' && (
                                                <>
                                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Mismo número</span>
                                                    <span className="text-[10px] text-stone-400 font-mono">OP: {order.labOrderNumber || '—'}</span>
                                                </>
                                            )}
                                            {order.postSaleOrderOption === 'DIFFERENT' && (
                                                <>
                                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Nro diferente</span>
                                                    <span className="text-[10px] text-stone-400 font-mono">OP: {order.postSaleNewOrderNumber || '—'}</span>
                                                </>
                                            )}
                                            {!order.postSaleOrderOption && (
                                                <span className="text-xs text-stone-400 italic">No requiere</span>
                                            )}
                                        </div>

                                        {/* Cost */}
                                        <div>
                                            <span className={`text-xs font-black ${order.postSaleCost && order.postSaleCost > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400'}`}>
                                                ${(order.postSaleCost || 0).toLocaleString('es-AR')}
                                            </span>
                                        </div>

                                        {/* Notes */}
                                        <div className="flex items-start gap-2 max-w-full">
                                            <MessageSquare className="w-3.5 h-3.5 text-stone-300 dark:text-stone-700 shrink-0 mt-0.5" />
                                            <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2" title={order.postSaleNotes || ''}>
                                                {order.postSaleNotes || <span className="italic text-stone-400">Sin observaciones</span>}
                                            </p>
                                        </div>

                                        {/* Action Button */}
                                        <div>
                                            <button
                                                onClick={() => setExpandedDetail(expandedDetail === order.id ? null : order.id)}
                                                className={`p-2 rounded-xl border flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all w-full ${
                                                    expandedDetail === order.id
                                                        ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20'
                                                        : 'bg-stone-50 border-stone-200 text-stone-600 dark:bg-stone-850 dark:border-stone-750 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                                                }`}
                                            >
                                                {expandedDetail === order.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                Ver
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expandable Order Detail */}
                                    {expandedDetail === order.id && (
                                        <div className="border-t border-stone-100 dark:border-stone-800/80 bg-stone-50/30 dark:bg-stone-900/30">
                                            <OrderDetailPanel 
                                                order={order}
                                                context="pedidos"
                                                onRefresh={fetchPostSales}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Mobile View */}
                <div className="lg:hidden divide-y divide-stone-50 dark:divide-stone-800">
                    {loading ? (
                        <div className="py-12 text-center text-stone-400 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            Cargando...
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="py-16 text-center">
                            <ShieldAlert className="w-10 h-10 text-stone-200 dark:text-stone-800 mx-auto mb-3" />
                            <p className="text-stone-400 font-black uppercase tracking-widest text-[9px]">No hay casos de post-venta</p>
                        </div>
                    ) : (
                        orders.map((order) => (
                            <div key={order.id} className="p-4 space-y-3 bg-white dark:bg-stone-900">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[10px] font-mono text-stone-400">
                                            #{order.id.slice(-6).toUpperCase()}
                                        </span>
                                        <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100">
                                            {order.client?.name}
                                        </h3>
                                    </div>
                                    <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                                        ${(order.postSaleCost || 0).toLocaleString('es-AR')}
                                    </span>
                                </div>

                                <div className="text-xs text-stone-600 dark:text-stone-300">
                                    <p className="font-medium">
                                        {order.postSaleNotes || <span className="italic text-stone-400">Sin observaciones</span>}
                                    </p>
                                </div>

                                <div className="flex flex-wrap justify-between items-center gap-2 text-[10px] text-stone-500 pt-1">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> {format(new Date(order.createdAt), 'dd/MM/yyyy')}
                                    </span>
                                    {order.postSaleOrderOption && (
                                        <span className="font-bold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded text-amber-700 dark:text-amber-400">
                                            {order.postSaleOrderOption === 'SAME' ? `Mismo OP: ${order.labOrderNumber || '—'}` : `Nuevo OP: ${order.postSaleNewOrderNumber || '—'}`}
                                        </span>
                                    )}
                                    {order.postSaleResponsible && (
                                        <span className="font-bold bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded text-stone-600 dark:text-stone-300">
                                            Resp: {order.postSaleResponsible}
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={() => setExpandedDetail(expandedDetail === order.id ? null : order.id)}
                                    className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 border ${
                                        expandedDetail === order.id
                                            ? 'bg-amber-500 border-amber-500 text-white'
                                            : 'bg-stone-50 border-stone-200 text-stone-600 dark:bg-stone-850 dark:border-stone-750 dark:text-stone-300'
                                    }`}
                                >
                                    {expandedDetail === order.id ? 'Cerrar Detalle' : 'Ver Detalle y Editar'}
                                </button>

                                {expandedDetail === order.id && (
                                    <div className="border-t border-stone-100 dark:border-stone-800/80 mt-3 pt-3">
                                        <OrderDetailPanel 
                                            order={order}
                                            context="pedidos"
                                            onRefresh={fetchPostSales}
                                        />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
