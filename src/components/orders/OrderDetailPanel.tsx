'use client';

import React, { useState } from 'react';
import {
    FlaskConical,
    Eye,
    Package,
    Loader2,
    CheckCircle2,
    Truck,
    Clock,
    Maximize2,
    X,
    Calendar,
    Activity,
    Layers,
    Search
} from 'lucide-react';
import type { Order } from '@/types/orders';

export const LAB_STEPS = [
    { key: 'NONE', label: 'Pendiente', icon: Clock, color: 'stone', bg: 'bg-stone-100 dark:bg-stone-800', text: 'text-stone-500 dark:text-stone-400', ring: 'ring-stone-200 dark:ring-stone-700' },
    { key: 'SENT', label: 'Falta procesar', icon: Clock, color: 'amber', bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-800' },
    { key: 'IN_PROGRESS', label: 'Procesado', icon: Package, color: 'blue', bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-800' },
    { key: 'FINISHED', label: 'Finalizado (Lab)', icon: Package, color: 'fuchsia', bg: 'bg-fuchsia-50 dark:bg-fuchsia-950', text: 'text-fuchsia-600 dark:text-fuchsia-400', ring: 'ring-fuchsia-200 dark:ring-fuchsia-800' },
    { key: 'READY', label: 'Listo p/ Retirar', icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-800' },
    { key: 'DELIVERED', label: 'Entregado', icon: Truck, color: 'indigo', bg: 'bg-indigo-50 dark:bg-indigo-950', text: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-200 dark:ring-indigo-800' },
];

interface OrderDetailPanelProps {
    order: Order;
    context?: 'ventas' | 'pedidos';
    financials?: {
        totalCash: number;
        totalTransfer: number;
        totalCard: number;
        paidReal: number;
    };
    onAutoSubmit?: (order: Order) => void;
    isAutoSubmitting?: boolean;
}

export function OrderDetailPanel({ order, context = 'ventas', financials, onAutoSubmit, isAutoSubmitting }: OrderDetailPanelProps) {
    const [fullImageOpen, setFullImageOpen] = useState(false);

    // Resolve Firebase Storage URL if needed
    const resolveStorageUrl = (url: string | null | undefined) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('images/')) {
            return `https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'atelier-398322'}.appspot.com/o/${encodeURIComponent(url)}?alt=media`;
        }
        return url;
    };

    const imageUrl = resolveStorageUrl(order.prescription?.imageUrl);

    return (
        <div className="border-t-2 border-stone-100 dark:border-stone-700/50 px-4 md:px-6 pb-6 pt-5 bg-stone-50/50 dark:bg-stone-900/30 animate-in slide-in-from-top-2 fade-in duration-200">
            {/* Full Screen Image Modal */}
            {fullImageOpen && imageUrl && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in zoom-in-95 fade-in">
                    <button 
                        onClick={() => setFullImageOpen(false)}
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img 
                        src={imageUrl} 
                        alt="Receta médica" 
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 🔴 COLUMNA IZQUIERDA: SISTEMA ATELIER */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300">
                            <Eye className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] font-black text-stone-500 uppercase tracking-widest">Información del Pedido</span>
                    </div>

                    {/* Receta */}
                    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center bg-stone-50 dark:bg-stone-800/50">
                            <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                <Search className="w-3.5 h-3.5" /> Valores de Receta
                            </h4>
                        </div>
                        <div className="p-4 bg-white dark:bg-stone-800">
                            {order.prescription ? (
                                <div className="space-y-4">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-[8px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 dark:border-stone-700/50">
                                                <th className="text-left py-2">Ojo</th>
                                                <th className="text-center py-2">Esf</th>
                                                <th className="text-center py-2">Cil</th>
                                                <th className="text-center py-2">Eje</th>
                                                <th className="text-center py-2">Add</th>
                                                <th className="text-center py-2 border-l border-stone-100 dark:border-stone-700/50 pl-2 text-emerald-500">DNP</th>
                                                <th className="text-center py-2 text-teal-500">Alt</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-stone-50 dark:border-stone-800/50">
                                                <td className="py-2.5 font-black text-stone-800 dark:text-stone-200">OD</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.sphereOD != null ? (order.prescription.sphereOD > 0 ? '+' : '') + order.prescription.sphereOD.toFixed(2) : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.cylinderOD != null ? order.prescription.cylinderOD.toFixed(2) : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.axisOD != null ? order.prescription.axisOD + '°' : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.additionOD != null ? '+' + order.prescription.additionOD.toFixed(2) : (order.prescription.addition != null ? '+' + order.prescription.addition.toFixed(2) : '—')}</td>
                                                <td className="py-2.5 text-center font-bold text-emerald-600 border-l border-stone-100 dark:border-stone-700/50 pl-2">{order.prescription.distanceOD != null ? order.prescription.distanceOD : (order.labPdOd || '—')}</td>
                                                <td className="py-2.5 text-center font-bold text-teal-600">{order.prescription.heightOD != null ? order.prescription.heightOD : '—'}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-2.5 font-black text-stone-800 dark:text-stone-200">OI</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.sphereOI != null ? (order.prescription.sphereOI > 0 ? '+' : '') + order.prescription.sphereOI.toFixed(2) : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.cylinderOI != null ? order.prescription.cylinderOI.toFixed(2) : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.axisOI != null ? order.prescription.axisOI + '°' : '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-stone-600 dark:text-stone-400">{order.prescription.additionOI != null ? '+' + order.prescription.additionOI.toFixed(2) : (order.prescription.addition != null ? '+' + order.prescription.addition.toFixed(2) : '—')}</td>
                                                <td className="py-2.5 text-center font-bold text-emerald-600 border-l border-stone-100 dark:border-stone-700/50 pl-2">{order.prescription.distanceOI != null ? order.prescription.distanceOI : (order.labPdOi || '—')}</td>
                                                <td className="py-2.5 text-center font-bold text-teal-600">{order.prescription.heightOI != null ? order.prescription.heightOI : '—'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-xs text-stone-400 italic text-center py-4">Sin receta cargada</p>
                            )}
                        </div>

                        {/* Imágen de Receta */}
                        {imageUrl && (
                            <div className="border-t border-stone-100 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/50 p-4 flex flex-col items-center justify-center">
                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-3 block w-full text-left">Foto de la Receta Médica</span>
                                <div 
                                    className="relative group cursor-pointer w-full max-w-sm rounded-xl overflow-hidden border-2 border-stone-200 dark:border-stone-700 shadow-sm transition-all hover:border-indigo-400 hover:shadow-indigo-500/20 hover:shadow-lg"
                                    onClick={() => setFullImageOpen(true)}
                                >
                                    <div className="aspect-[4/3] w-full bg-white dark:bg-black">
                                        <img 
                                            src={imageUrl} 
                                            alt="Receta" 
                                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                        />
                                    </div>
                                    <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/20 transition-all flex items-center justify-center">
                                        <div className="opacity-0 group-hover:opacity-100 bg-white/90 dark:bg-black/80 p-3 rounded-full shadow-xl transform scale-75 group-hover:scale-100 transition-all duration-300 backdrop-blur-sm">
                                            <Maximize2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Productos */}
                    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center bg-stone-50 dark:bg-stone-800/50">
                            <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Productos</h4>
                        </div>
                        <table className="w-full">
                            <tbody>
                                {order.items.map(item => (
                                    <tr key={item.id} className="border-b border-stone-50 dark:border-stone-700/50 last:border-0">
                                        <td className="px-5 py-3 text-sm font-bold text-stone-800 dark:text-white">
                                            {item.product?.brand || item.productBrandSnapshot || '—'} · {item.product?.name || item.productNameSnapshot || '—'}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-stone-500">
                                            {item.product?.type || item.product?.category || item.productCategorySnapshot || '—'}
                                        </td>
                                        <td className="px-5 py-3 text-sm font-bold text-stone-600 dark:text-stone-300 text-center">
                                            {item.quantity}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {/* Frame Info */}
                        {order.frameSource && (
                            <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/50">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">🕶️</span>
                                    <div>
                                        <p className="text-[8px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest">Armazón provisto</p>
                                        <p className="text-xs font-bold text-amber-900 dark:text-amber-300 mt-0.5">
                                            {order.frameSource === 'OPTICA'
                                                ? 'De la óptica (incluido en el pedido)'
                                                : `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}${order.userFrameNotes ? ' · ' + order.userFrameNotes : ''}`
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Lab Measurements and Details */}
                    {(order.frameA || order.frameB || order.frameDbl || order.frameEdc || order.labColor || order.labTreatment || order.labFrameShape || order.labFrameDetails || order.labNotes) && (
                        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 overflow-hidden shadow-sm">
                            <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50">
                                <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                    <FlaskConical className="w-3.5 h-3.5" /> Detalles de Laboratorio
                                </h4>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-4">
                                {order.labFrameShape && (
                                    <div>
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Forma / Aro</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1 uppercase">{order.labFrameShape}</p>
                                    </div>
                                )}
                                {(order.frameA || order.frameB || order.frameEdc || order.frameDbl) && (
                                    <div>
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Medidas del Armazón</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">
                                            {order.frameA && `A: ${order.frameA} `}
                                            {order.frameB && `B: ${order.frameB} `}
                                            {order.frameEdc && `ED: ${order.frameEdc} `}
                                            {order.frameDbl && `Pte: ${order.frameDbl}`}
                                        </p>
                                    </div>
                                )}
                                {(order.labTreatment || order.labColor) && (
                                    <div className="col-span-2">
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Tratamiento / Teñido</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">
                                            {order.labTreatment && `${order.labTreatment} `}
                                            {order.labColor && `- ${order.labColor}`}
                                        </p>
                                    </div>
                                )}
                                {order.labFrameDetails && (
                                    <div className="col-span-2">
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Detalles del Armazón</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">{order.labFrameDetails}</p>
                                    </div>
                                )}
                                {order.labNotes && (
                                    <div className="col-span-2">
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Observaciones Lab</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1">{order.labNotes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Financials (If present) */}
                    {financials && (
                        <div className="p-5 rounded-2xl bg-stone-900 dark:bg-black text-white flex justify-between items-center shadow-md">
                            <div className="flex gap-6">
                                <div>
                                    <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Efectivo</span>
                                    <span className="text-lg font-black text-emerald-400">${financials.totalCash.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-[7px] font-black text-purple-400 uppercase tracking-widest block mb-1">Transferencia</span>
                                    <span className="text-lg font-black text-purple-400">${financials.totalTransfer.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-[7px] font-black text-orange-400 uppercase tracking-widest block mb-1">Tarjeta</span>
                                    <span className="text-lg font-black text-orange-400">${financials.totalCard.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="text-right border-l border-stone-800 pl-6">
                                <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">Abonado Real</span>
                                <span className="text-2xl font-black text-amber-400">${financials.paidReal.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 🔵 COLUMNA DERECHA: LABORATORIO SMARTLAB */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <FlaskConical className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Estado en Laboratorio</span>
                        </div>
                        
                        {onAutoSubmit && (
                            <button
                                onClick={() => onAutoSubmit(order)}
                                disabled={isAutoSubmitting}
                                className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[9px] font-black flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                            >
                                {isAutoSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                                {isAutoSubmitting ? 'Copiando...' : 'Autocompletar Form'}
                            </button>
                        )}
                    </div>

                    {/* Progress Pipeline */}
                    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 p-5 shadow-sm">
                        <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-4">Línea de Tiempo</h4>
                        <div className="flex flex-col gap-2">
                            {LAB_STEPS.map((s, i) => {
                                const currentIdx = LAB_STEPS.findIndex(x => x.key === (order.labStatus || 'NONE'));
                                const isPast = i <= currentIdx;
                                const isCurrent = i === currentIdx;
                                const SIcon = s.icon;
                                
                                return (
                                    <div key={s.key} className="flex items-center gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                isCurrent ? `${s.bg} ${s.text} ring-4 ${s.ring} z-10` : 
                                                isPast ? `${s.bg} ${s.text} opacity-60` : 
                                                'bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600'
                                            }`}>
                                                <SIcon className="w-3.5 h-3.5" />
                                            </div>
                                            {i < LAB_STEPS.length - 1 && (
                                                <div className={`w-0.5 h-4 my-1 ${isPast ? 'bg-indigo-200 dark:bg-indigo-900/50' : 'bg-stone-100 dark:bg-stone-800'}`} />
                                            )}
                                        </div>
                                        <div className={`flex-1 pb-4 ${isCurrent ? 'font-black' : 'font-bold'} ${isPast ? 'text-stone-800 dark:text-stone-200' : 'text-stone-400'}`}>
                                            <span className="text-sm">{s.label}</span>
                                            {isCurrent && s.key === 'FINISHED' && (
                                                <p className="text-[10px] text-fuchsia-500 font-bold mt-1">Esperando recepción física en local.</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SmartLab Live Status */}
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5" /> SmartLab Digital Tracker
                            </h4>
                            {order.labOrderNumber && (
                                <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider">
                                    OP: {order.labOrderNumber}
                                </span>
                            )}
                        </div>

                        {order.smartLabProgress != null ? (
                            <div className="space-y-5">
                                {/* Progress Bar */}
                                <div>
                                    <div className="flex justify-between text-[10px] font-black mb-2 uppercase tracking-widest">
                                        <span className="text-indigo-600 dark:text-indigo-400">Progreso de Fabricación</span>
                                        <span className={order.smartLabProgress === 100 ? 'text-emerald-500' : 'text-indigo-500'}>{order.smartLabProgress}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-indigo-100 dark:bg-indigo-950/50 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${order.smartLabProgress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${order.smartLabProgress}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/60 dark:bg-black/20 p-3 rounded-xl border border-indigo-50 dark:border-indigo-900/30">
                                        <Layers className="w-4 h-4 text-indigo-400 mb-2" />
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Sector Actual</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate mt-0.5" title={order.smartLabSector || 'Desconocido'}>
                                            {order.smartLabSector || '—'}
                                        </p>
                                    </div>
                                    <div className="bg-white/60 dark:bg-black/20 p-3 rounded-xl border border-indigo-50 dark:border-indigo-900/30">
                                        <Calendar className="w-4 h-4 text-indigo-400 mb-2" />
                                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Días en Lab</p>
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-0.5">
                                            {order.smartLabDays != null ? `${order.smartLabDays} días` : '—'}
                                        </p>
                                    </div>
                                </div>

                                {order.smartLabEntryDate && (
                                    <p className="text-[9px] text-stone-500 text-center font-medium">
                                        Ingresado: {order.smartLabEntryDate}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                <div className="w-10 h-10 rounded-full bg-indigo-100/50 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                                    <Activity className="w-4 h-4 text-indigo-300 dark:text-indigo-700" />
                                </div>
                                <p className="text-xs text-stone-400 max-w-[200px]">Sin datos de fabricación sincronizados todavía.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
