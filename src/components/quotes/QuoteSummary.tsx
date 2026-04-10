'use client';

import React from 'react';
import { 
    Calculator, Receipt, Download, MessageCircle, 
    CheckCircle2, X, Plus, Clock, Glasses, 
    Banknote, ArrowRightLeft, CreditCard,
    Lock, ChevronRight, ChevronUp, Pencil
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { safePrice } from '@/lib/promo-utils';

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
        status?: string;
    };
    currentUserRole?: 'ADMIN' | 'STAFF';
    onConvert?: (orderId: string) => Promise<void>;
    onDelete?: (orderId: string) => void;
    onAddPayment?: (orderId: string) => void;
    onStatusChange?: (orderId: string, nextStatus: string) => Promise<void>;
    onCloseSale?: () => Promise<void>;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    showActions?: boolean;
    compact?: boolean;
    onEdit?: (order: any) => void;
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
    onEdit
}: QuoteSummaryProps) {
    const [showCheckout, setShowCheckout] = React.useState(false);
    const [showPayment, setShowPayment] = React.useState(false);

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
    const progress = (order.paid / (order.total || 1)) * 100;
    const minRequired = (order.total || 0) * 0.4;

    const effectiveSubtotalWithMarkup = (() => {
        if (order.subtotalWithMarkup && order.subtotalWithMarkup > 0) return order.subtotalWithMarkup;
        const itemsSubtotal = (order.items || []).reduce((s: number, it: any) => s + (safePrice(it.price) * it.quantity), 0);
        return itemsSubtotal * (1 + (order.markup || 0) / 100);
    })();

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
            'GO_CUOTAS': 'Go Cuotas', 'EFECTIVO': 'Efectivo', 'TRANSFERENCIA_ISHTAR': 'Transf. Ishtar',
            'TRANSFERENCIA_LUCIA': 'Transf. Lucía', 'TRANSFERENCIA_ALTERNATIVA': 'Transf. Alt.'
        };
        return labels[method] || method;
    };

    const handleWhatsApp = () => {
        const items = order.items || [];
        const subtotalBase = items.reduce((s: number, it: any) => s + (safePrice(it.price) * it.quantity), 0);
        const listPrice = subtotalBase * (1 + (order.markup || 0) / 100);
        const discountCash = order.discountCash || 20;
        const discountTransfer = order.discountTransfer || 15;

        const amtCash = Math.round(listPrice * (1 - discountCash / 100));
        const amtTransfer = Math.round(listPrice * (1 - discountTransfer / 100));
        
        const itemLines = items.map((it: any) => `• ${it.product?.brand || ''} ${it.product?.model || it.product?.name || 'Producto'} x${it.quantity}`).join('%0A');
        
        let text = `✨ *${isSale ? 'VENTA' : 'PRESUPUESTO'} — ATELIER ÓPTICA* ✨%0A`;
        text += `👤 *Cliente:* ${contact.name}%0A%0A`;
        text += `${itemLines}%0A%0A`;
        text += `*Precio Lista: $${Math.round(listPrice).toLocaleString()}*%0A`;
        text += `🏦 *Transf. (-${discountTransfer}%): $${amtTransfer.toLocaleString()}*%0A`;
        text += `💵 *Efectivo (-${discountCash}%): $${amtCash.toLocaleString()}*%0A`;

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
                        <span className="text-xs font-black text-stone-700 dark:text-stone-200 block">
                            #{order.id.slice(-4).toUpperCase()} · ${(order.total || 0).toLocaleString()}
                        </span>
                        <span className="text-[9px] font-bold text-stone-400 block">
                            {format(new Date(order.createdAt), "d MMM yy", { locale: es })}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    {isSale && (
                        <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${labInfo.color}`}>
                            {labInfo.label}
                        </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-primary" />
                </div>
            </button>
        );
    }

    return (
        <div className={`bg-white dark:bg-stone-800 border-2 ${isSale ? 'border-emerald-200 shadow-xl' : 'border-amber-200 shadow-lg'} rounded-[2.5rem] p-6 sm:p-8 transition-all relative overflow-hidden group`}>
            
            {/* Header */}
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
                            ${(order.total || 0).toLocaleString()}
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
                         {order.paid < order.total && (
                            <div className="text-right sr-only sm:not-sr-only">
                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Saldo</span>
                                <span className="text-lg font-black text-stone-900 dark:text-stone-100">${(order.total - order.paid).toLocaleString()}</span>
                            </div>
                        )}
                        {onToggleExpand && (
                            <button onClick={onToggleExpand} className="p-2 hover:bg-stone-50 dark:hover:bg-stone-900 rounded-xl transition-colors">
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { label: 'Efectivo', value: 1 - (order.discountCash || 0)/100, color: 'emerald', discount: order.discountCash },
                        { label: 'Transf.', value: 1 - (order.discountTransfer || 0)/100, color: 'violet', discount: order.discountTransfer },
                        { label: 'Cuotas', value: 1, color: 'orange', discount: 0 }
                    ].map(tier => (
                        <div key={tier.label} className={`bg-${tier.color}-50/50 dark:bg-${tier.color}-950/20 p-4 rounded-3xl border-2 border-${tier.color}-100/50`}>
                            <p className={`text-[10px] font-black text-${tier.color}-600 uppercase tracking-widest mb-1`}>{tier.label} {tier.discount > 0 && `-${tier.discount}%`}</p>
                            <p className={`text-xl font-black text-${tier.color}-600`}>${Math.round(effectiveSubtotalWithMarkup * tier.value).toLocaleString()}</p>
                        </div>
                    ))}
                </div>

                {order.paid > 0 && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Pago: ${order.paid.toLocaleString()}</span>
                            <span className={`text-[10px] font-black uppercase ${progress >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-stone-100 dark:bg-stone-900 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700">
                            <div className={`h-full transition-all duration-700 ${progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                        </div>
                    </div>
                )}

                {showActions && !order.isDeleted && (
                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
                        {isQuote ? (
                            <button 
                                onClick={() => setShowPayment(true)} 
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
                            className="py-3 bg-stone-100 dark:bg-stone-800 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-all"
                        >
                            PDF
                        </button>
                        <button 
                            onClick={handleWhatsApp} 
                            className="py-3 bg-emerald-50 dark:bg-emerald-900 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest"
                        >
                            WhatsApp
                        </button>
                        <button 
                            onClick={() => setShowPayment(true)}
                            className="py-3 bg-amber-50 text-amber-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all"
                        >
                            Abonar
                        </button>
                        <button 
                            onClick={() => onDelete?.(order.id)} 
                            disabled={isLockedSale} 
                            className="py-3 bg-red-50 text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50"
                        >
                            Eliminar
                        </button>
                    </div>
                )}
            </main>

            {showPayment && (
                <AddPaymentModal
                    orderId={order.id}
                    totalAmount={order.total || 0}
                    paidAmount={order.paid || 0}
                    onClose={() => setShowPayment(false)}
                    onSuccess={async () => {
                        if (onRefreshContact) {
                            await onRefreshContact();
                        }
                        setShowPayment(false);
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
                    onRefreshContact={onCloseSale || (async () => {})}
                />
            )}
        </div>
    );
}
