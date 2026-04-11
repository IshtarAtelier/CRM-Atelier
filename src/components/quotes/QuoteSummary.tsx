'use client';

import React from 'react';
import { 
    Calculator, Receipt, Download, MessageCircle, 
    CheckCircle2, X, Plus, Clock, Glasses, 
    Banknote, ArrowRightLeft, CreditCard,
    Lock, ChevronRight, ChevronUp, Pencil,
    History, Trash2, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { safePrice } from '@/lib/promo-utils';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { PricingService } from '@/services/PricingService';

// Modular Components
import QuoteLineItems from './QuoteLineItems';
import PrescriptionDetails from '../prescriptions/PrescriptionDetails';
import CheckoutModal from './CheckoutModal';
import AddPaymentModal from './AddPaymentModal';

interface QuoteSummaryProps {
    order: any;
    contact: {
        id: string;
        name: string;
        phone?: string | null;
        dni?: string | null;
        address?: string | null;
        status?: string;
        prescriptions?: any[];
    };
    currentUserRole?: 'ADMIN' | 'STAFF';
    onConvert?: (orderId: string, data?: any) => Promise<any> | void;
    onDelete?: (orderId: string, reason?: string, role?: string) => Promise<any> | void;
    onAddPayment?: (orderId: string) => void;
    onStatusChange?: (orderId: string, nextStatus: string) => Promise<void>;
    onCloseSale?: () => Promise<void>;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    showActions?: boolean;
    compact?: boolean;
    onEdit?: (order: any) => void;
    onRefreshContact?: () => Promise<void>;
}

export default function QuoteSummary({
    order,
    contact,
    currentUserRole = 'STAFF',
    onConvert,
    onDelete,
    onAddPayment,
    onStatusChange,
    onCloseSale,
    isExpanded = true,
    onToggleExpand,
    showActions = true,
    compact = false,
    onEdit,
    onRefreshContact
}: QuoteSummaryProps) {
    const [showCheckout, setShowCheckout] = React.useState(false);
    const [showPayment, setShowPayment] = React.useState(false);
    const [showPaymentsList, setShowPaymentsList] = React.useState(false);
    const [isDeletingPayment, setIsDeletingPayment] = React.useState<string | null>(null);

    if (compact) {
        const total = order.total || 0;
        const paid = order.paid || 0;
        const pending = Math.max(0, total - paid);
        const isPaid = paid >= total && total > 0;

        return (
            <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-4 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center">
                            <Receipt className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">#{order.id.slice(-4).toUpperCase()}</p>
                            <p className="text-[10px] font-bold text-stone-500">{format(new Date(order.createdAt), "d MMM", { locale: es })}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-black text-stone-800 dark:text-white">${total.toLocaleString()}</p>
                        <p className={`text-[8px] font-black uppercase tracking-widest ${isPaid ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {isPaid ? 'PAGADO' : `SALDO: $${pending.toLocaleString()}`}
                        </p>
                    </div>
                </div>

                <div className="space-y-1 mb-3">
                    {order.items?.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between text-[10px] font-medium text-stone-600 dark:text-stone-400">
                            <span className="truncate max-w-[120px]">
                                {item.product?.brand || ''} {item.product?.model || item.product?.name || ''}
                            </span>
                            <span>x{item.quantity}</span>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => window.open(`/api/orders/${order.id}/pdf`, '_blank')}
                        className="py-2 bg-stone-50 dark:bg-stone-700/50 hover:bg-primary/10 hover:text-primary rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                        <Download className="w-3 h-3" /> PDF
                    </button>
                    {order.orderType === 'QUOTE' && onEdit && (
                        <button 
                            onClick={() => onEdit(order)}
                            className="py-2 bg-stone-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            <Pencil className="w-3 h-3" /> EDITAR
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const isSale = order.orderType === 'SALE';
    const isQuote = !isSale;
    const isLockedSale = isSale && currentUserRole !== 'ADMIN';
    
    // Integración con PricingService
    const financials = PricingService.calculateOrderFinancials(order);

    const LAB_LABELS: Record<string, { label: string; color: string }> = {
        'NONE': { label: 'Sin enviar', color: 'bg-stone-100 text-stone-500' },
        'SENT': { label: 'Enviado', color: 'bg-blue-100 text-blue-600' },
        'IN_PROGRESS': { label: 'En Lab', color: 'bg-amber-100 text-amber-600' },
        'READY': { label: 'Listo', color: 'bg-emerald-100 text-emerald-600' },
        'DELIVERED': { label: 'Entregado', color: 'bg-indigo-100 text-indigo-600' },
    };
    const labInfo = LAB_LABELS[order.labStatus || 'NONE'] || LAB_LABELS['NONE'];

    const getPaymentLabel = (method: string) => {
        const labels: Record<string, string> = {
            'PAY_WAY_6_ISH': 'Pay Way 6 Ish', 'PAY_WAY_3_ISH': 'Pay Way 3 Ish', 'NARANJA_Z_ISH': 'Naranja Z Ish',
            'PAY_WAY_6_YANI': 'Pay Way 6 Yani', 'PAY_WAY_3_YANI': 'Pay Way 3 Yani', 'NARANJA_Z_YANI': 'Naranja Z Yani',
            'GO_CUOTAS': 'Go Cuotas', 'GO_CUOTAS_ISH': 'Go Cuotas Ish', 'EFECTIVO': 'Efectivo',
            'TRANSFERENCIA_ISHTAR': 'Transf. Ishtar', 'TRANSFERENCIA_LUCIA': 'Transf. Lucía',
            'TRANSFERENCIA_ALTERNATIVA': 'Transf. Alt.',
            'TRANSFER': 'Transferencia', 'DEBIT': 'Débito', 'CASH': 'Efectivo',
            'CREDIT_3': 'Tarjeta 3 cuotas', 'CREDIT_6': 'Tarjeta 6 cuotas', 'PLAN_Z': 'Plan Z',
        };
        return labels[method] || method;
    };

    const handleWhatsApp = () => {
        const items = order.items || [];
        const itemLines = items.map((it: any) => `• ${it.product?.brand || ''} ${it.product?.model || it.product?.name || 'Producto'} x${it.quantity}`).join('%0A');
        
        let text = `✨ *${isSale ? 'VENTA' : 'PRESUPUESTO'} — ATELIER ÓPTICA* ✨%0A`;
        text += `👤 *Cliente:* ${contact.name}%0A%0A`;
        text += `${itemLines}%0A%0A`;
        text += `*Precio Lista: $${Math.round(financials.listPrice).toLocaleString()}*%0A`;
        text += `🏦 *Transf. (-${financials.discountTransfer}%): $${financials.totalTransfer.toLocaleString()}*%0A`;
        text += `💵 *Efectivo (-${financials.discountCash}%): $${financials.totalCash.toLocaleString()}*%0A`;

        window.open(`https://wa.me/${contact.phone?.replace(/\D/g,'')}?text=${text}`, '_blank');
    };

    if (!isExpanded) {
        return (
            <button
                onClick={onToggleExpand}
                className={`w-full flex items-center justify-between bg-white dark:bg-stone-800 border ${order.isDeleted ? 'border-red-100 opacity-50' : 'border-stone-200 dark:border-stone-700 hover:border-primary/40'} rounded-2xl px-5 py-4 transition-all hover:shadow-md group flex-wrap sm:flex-nowrap`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSale ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {isSale ? <Receipt className="w-5 h-5" /> : <Calculator className="w-5 h-5" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                             <span className="text-xs font-black text-stone-700 dark:text-stone-200 block">
                                {contact.name || 'Cliente'} 
                            </span>
                            {isSale && (
                                <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest ${labInfo.color}`}>
                                    {labInfo.label}
                                </span>
                            )}
                        </div>
                        <span className="text-[9px] font-bold text-stone-400 block">
                            Venta #{order.id.slice(-4).toUpperCase()} · {format(new Date(order.createdAt), "d MMM yy", { locale: es })} · {order.items?.length || 0} items
                        </span>
                    </div>
                </div>

                {!financials.hasBalance && (
                    <div className="hidden md:flex items-center gap-2 px-4 border-l border-stone-100 dark:border-stone-700 ml-4">
                         <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">
                            PAGADO
                        </span>
                    </div>
                )}

                {financials.hasBalance && (
                    <div className="hidden md:flex items-center gap-2 px-4 border-l border-stone-100 dark:border-stone-700 ml-4">
                        <div className="flex flex-col text-left mr-2">
                            <span className="text-[7px] font-black text-stone-400 uppercase tracking-widest">Saldo Pendiente</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-lg flex items-center gap-1 border border-emerald-100 dark:border-emerald-900/50">
                                <Banknote className="w-2.5 h-2.5 text-emerald-500" />
                                <span className="text-[9px] font-black text-emerald-600">${financials.remainingCash.toLocaleString()}</span>
                            </div>
                            <div className="bg-violet-50 dark:bg-violet-950/30 px-2 py-1 rounded-lg flex items-center gap-1 border border-violet-100 dark:border-violet-900/50">
                                <ArrowRightLeft className="w-2.5 h-2.5 text-violet-500" />
                                <span className="text-[9px] font-black text-violet-600">${financials.remainingTransfer.toLocaleString()}</span>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-950/30 px-2 py-1 rounded-lg flex items-center gap-1 border border-orange-100 dark:border-orange-900/50">
                                <CreditCard className="w-2.5 h-2.5 text-orange-500" />
                                <span className="text-[9px] font-black text-orange-600">${financials.remainingCard.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-4 mt-2 sm:mt-0">
                    <div className="text-right sr-only sm:not-sr-only">
                        <span className="text-[12px] font-black text-stone-900 dark:text-stone-100">${financials.totalCash.toLocaleString()}</span>
                        <div className="h-1 w-full bg-stone-100 dark:bg-stone-700 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${financials.progress}%` }}></div>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-primary" />
                </div>
            </button>
        );
    }

    return (
        <div className={`bg-white dark:bg-stone-800 border-2 ${isSale ? 'border-emerald-200 shadow-xl' : 'border-amber-200 shadow-lg'} rounded-[2.5rem] p-6 sm:p-8 transition-all relative overflow-hidden group`}>
            
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isSale ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {isSale ? <Receipt className="w-7 h-7" /> : <Calculator className="w-7 h-7" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${isSale ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                {isSale ? 'VENTA' : 'PRESUPUESTO'} #{order.id.slice(-4).toUpperCase()}
                            </span>
                            {order.isDeleted && <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-lg">ELIMINADO</span>}
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black text-stone-800 dark:text-white tracking-tighter">
                            ${financials.totalCash.toLocaleString()}
                        </h3>
                    </div>
                </div>
                
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                    {isSale && (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-2 ${labInfo.color} border-current/10 shadow-sm`}>
                            <span className="text-[10px] font-black uppercase tracking-widest">{labInfo.label}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                         {financials.hasBalance && (
                            <div className="text-right sr-only sm:not-sr-only">
                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Saldo Efectivo</span>
                                <span className="text-lg font-black text-emerald-500">${financials.remainingCash.toLocaleString()}</span>
                            </div>
                        )}
                        {onToggleExpand && (
                            <button onClick={onToggleExpand} className="p-2 hover:bg-stone-50 dark:hover:bg-stone-900 rounded-xl transition-colors" title="Cerrar">
                                <ChevronUp className="w-5 h-5 text-stone-400" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <main className="space-y-8 relative z-10">
                <QuoteLineItems 
                    items={order.items || []}
                    markup={order.markup || 0}
                    appliedPromoName={order.appliedPromoName}
                />

                <PrescriptionDetails prescription={order.prescription} />

                {order.frameSource && (
                    <div className="flex items-center gap-4 p-5 bg-amber-50/50 dark:bg-amber-950/20 border-2 border-amber-200/50 dark:border-amber-900/50 rounded-[2rem]">
                        <Glasses className="w-6 h-6 text-amber-600" />
                        <div>
                            <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">Armazón</p>
                            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                {order.frameSource === 'OPTICA' ? 'De la óptica' : `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}`}
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="flex items-center gap-2 ml-1">
                        <Calculator className="w-4 h-4 text-stone-400" />
                        <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Totales por Método</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { label: 'Efectivo', amount: financials.totalCash, color: 'emerald', discount: financials.discountCash },
                            { label: 'Transf.', amount: financials.totalTransfer, color: 'violet', discount: financials.discountTransfer },
                            { label: 'Cuotas', amount: financials.totalCard, color: 'orange', discount: 0 }
                        ].map(tier => (
                            <div key={tier.label} className={`bg-${tier.color}-50/50 dark:bg-${tier.color}-950/20 p-4 rounded-3xl border-2 border-${tier.color}-100/50`}>
                                <p className={`text-[10px] font-black text-${tier.color}-600 uppercase tracking-widest mb-1`}>{tier.label} {tier.discount > 0 && `-${tier.discount}%`}</p>
                                <p className={`text-xl font-black text-${tier.color}-600`}>${tier.amount.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {financials.hasBalance && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        <div className="flex items-center gap-2 ml-1">
                            <Clock className="w-4 h-4 text-stone-400" />
                            <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Saldo Pendiente (Saldar en...)</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: 'Efectivo', amount: financials.remainingCash, color: 'emerald', icon: Banknote },
                                { label: 'Transf.', amount: financials.remainingTransfer, color: 'violet', icon: ArrowRightLeft },
                                { label: 'Cuotas', amount: financials.remainingCard, color: 'orange', icon: CreditCard }
                            ].map(tier => (
                                <div key={tier.label} className={`bg-${tier.color}-400/10 dark:bg-${tier.color}-400/5 p-4 rounded-3xl border-2 border-${tier.color}-400/30 group/saldo relative overflow-hidden`}>
                                    <tier.icon className={`absolute -right-2 -bottom-2 w-12 h-12 text-${tier.color}-400 opacity-10`} />
                                    <p className={`text-[10px] font-black text-${tier.color}-600 uppercase tracking-widest mb-1`}>Saldo {tier.label}</p>
                                    <p className={`text-xl font-black text-${tier.color}-600`}>${tier.amount.toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {order.paid > 0 && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Abonado Real: ${order.paid.toLocaleString()}</span>
                                <button 
                                    onClick={() => setShowPaymentsList(!showPaymentsList)}
                                    className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded-lg text-[8px] font-black text-stone-500 uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-1"
                                >
                                    <History className="w-2.5 h-2.5" />
                                    {showPaymentsList ? 'Ocultar' : 'Ver Detalles'}
                                </button>
                            </div>
                            <span className={`text-[10px] font-black uppercase ${financials.progress >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{Math.round(financials.progress)}% Completado</span>
                        </div>
                        <div className="h-2 bg-stone-100 dark:bg-stone-900 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700">
                            <div className={`h-full transition-all duration-700 ${financials.progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(financials.progress, 100)}%` }} />
                        </div>

                        {showPaymentsList && (
                            <div className="bg-stone-50 dark:bg-stone-900/50 rounded-3xl p-4 border-2 border-stone-100 dark:border-stone-800 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest px-1">Historial de Abonos</p>
                                <div className="space-y-2">
                                    {order.payments?.length > 0 ? (
                                        order.payments.map((paymentValue: any) => (
                                            <div key={paymentValue.id} className="flex items-center justify-between p-3 bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 group/item">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-stone-50 dark:bg-stone-900 flex items-center justify-center">
                                                        <Banknote className="w-4 h-4 text-stone-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-stone-800 dark:text-white uppercase">${paymentValue.amount.toLocaleString()}</p>
                                                        <p className="text-[8px] font-bold text-stone-400">
                                                            {getPaymentLabel(paymentValue.method)} · {format(new Date(paymentValue.date), "d MMM HH:mm", { locale: es })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {paymentValue.receiptUrl && (
                                                        <button 
                                                            onClick={() => window.open(resolveStorageUrl(paymentValue.receiptUrl), '_blank')}
                                                            className="p-2 hover:bg-primary/5 text-stone-400 hover:text-primary rounded-xl transition-all"
                                                            title="Ver Comprobante"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={async () => {
                                                            if (window.confirm('¿Seguro que querés eliminar este pago? El saldo se actualizará automáticamente.')) {
                                                                setIsDeletingPayment(paymentValue.id);
                                                                try {
                                                                    const res = await fetch(`/api/payments/${paymentValue.id}`, { method: 'DELETE' });
                                                                    if (res.ok && onRefreshContact) {
                                                                        await onRefreshContact();
                                                                    }
                                                                } catch (err) {
                                                                    console.error('Error deleting payment:', err);
                                                                } finally {
                                                                    setIsDeletingPayment(null);
                                                                }
                                                            }
                                                        }}
                                                        disabled={isDeletingPayment === paymentValue.id}
                                                        className="p-2 hover:bg-red-50 text-stone-300 hover:text-red-500 rounded-xl transition-all disabled:opacity-50"
                                                        title="Eliminar Pago"
                                                    >
                                                        <Trash2 className={`w-3.5 h-3.5 ${isDeletingPayment === paymentValue.id ? 'animate-pulse' : ''}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[10px] font-bold text-stone-400 py-2 px-1">No hay detalles de pagos disponibles</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {showActions && !order.isDeleted && (
                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
                        {isQuote ? (
                            <button 
                                onClick={() => {
                                    const hasPayment = (Number(order.paid) || 0) > 0 || (order.payments && order.payments.length > 0);
                                    if (hasPayment) {
                                        setShowCheckout(true);
                                    } else {
                                        setShowPayment(true);
                                    }
                                }} 
                                className="sm:col-span-4 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 className="w-5 h-5" /> CONVERTIR EN VENTA
                            </button>
                        ) : isLockedSale ? (
                            <div className="sm:col-span-4 flex items-center gap-3 p-4 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 rounded-2xl">
                                <Lock className="w-5 h-5 text-stone-400" />
                                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Venta Bloqueada (Solo Admin)</span>
                            </div>
                        ) : null}
                        
                        <button 
                            onClick={() => window.open(`/api/orders/${order.id}/pdf`, '_blank')} 
                            className="py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
                        >
                            <Download className="w-3.5 h-3.5" /> PDF
                        </button>
                        <button 
                            onClick={handleWhatsApp} 
                            disabled={!contact.phone}
                            className="py-3 bg-emerald-50 dark:bg-emerald-900 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-30"
                        >
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                        <button 
                            onClick={() => setShowPayment(true)}
                            className="py-3 bg-amber-50 text-amber-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                        >
                            <Banknote className="w-3.5 h-3.5" /> Abonar
                        </button>
                        <button 
                            onClick={() => {
                                if (window.confirm('¿Seguro que querés eliminar este presupuesto? Esta acción no se puede deshacer.')) {
                                    onDelete?.(order.id);
                                }
                            }}
                            disabled={isLockedSale} 
                            className="py-3 bg-red-50 text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <X className="w-3.5 h-3.5" /> Eliminar
                        </button>

                        {isQuote && onEdit && (
                            <button 
                                onClick={() => onEdit(order)}
                                className="sm:col-span-4 py-4 bg-stone-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 mt-2"
                            >
                                <Pencil className="w-5 h-5" /> EDITAR DETALLES DEL PRESUPUESTO
                            </button>
                        )}
                    </div>
                )}
            </main>

            {showPayment && (
                <AddPaymentModal
                    orderId={order.id}
                    totalAmount={order.total || 0}
                    paidAmount={order.paid || 0}
                    onClose={() => setShowPayment(false)}
                    onSuccess={async (payment: any) => {
                        setShowPayment(false);
                        if (onRefreshContact) {
                            await onRefreshContact();
                        }
                        setShowCheckout(true);
                    }}
                />
            )}

            {showCheckout && (
                <CheckoutModal 
                    order={order}
                    contact={contact as any}
                    onClose={() => setShowCheckout(false)}
                    onComplete={async (data) => {
                        if (onConvert) {
                            await onConvert(order.id, { prescriptionId: data.prescriptionId });
                            setShowCheckout(false);
                        }
                    }}
                    onRefreshContact={onRefreshContact || (async () => {})}
                />
            )}
        </div>
    );
}
