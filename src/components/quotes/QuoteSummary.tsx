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
                            <span className="font-bold text-stone-900 dark:text-stone-300">${safePrice(item.price).toLocaleString()}</span>
                        </div>
                    ))}
                </div>

                {showActions && (
                    <div className="flex gap-2 pt-2 border-t border-stone-100 dark:border-stone-700">
                        <button 
                            onClick={onToggleExpand}
                            className="flex-1 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-700 text-[9px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 transition-colors"
                        >
                            Ver Detalles
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Usar PricingService para obtener los financieros reales
    const financials = PricingService.calculateOrderFinancials(order);

    const shareOnWhatsApp = () => {
        let msg = `Hola ${contact.name}! Te adjunto el presupuesto solicitado en Atelier Óptica: \n\n`;
        order.items.forEach((item: any) => {
            msg += `• ${item.product.brand || ''} ${item.product.model || item.product.name} | $${safePrice(item.price).toLocaleString()}\n`;
        });
        msg += `\n💰 *Opciones de Pago:* \n`;
        msg += `• *Efectivo (-${financials.discountCash}%): $${financials.totalCash.toLocaleString()}*\n`;
        msg += `• *Transferencia (-${financials.discountTransfer}%): $${financials.totalTransfer.toLocaleString()}*\n`;
        msg += `• *O lista en cuotas: $${financials.totalCard.toLocaleString()}*\n`;
        
        if (financials.hasBalance) {
            msg += `\n💳 *Saldo Pendiente:* \n`;
            msg += `• *Si pagás en efectivo: $${financials.remainingCash.toLocaleString()}*\n`;
            msg += `• *Con transferencia: $${financials.remainingTransfer.toLocaleString()}*\n`;
            msg += `• *Con tarjeta/cuotas: $${financials.remainingCard.toLocaleString()}*\n`;
        }

        msg += `\n📍 Av. Siempre Viva 123 | Atelier Óptica`;
        
        const cleanPhone = contact.phone?.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const handleDownloadPDF = async () => {
        try {
            const response = await fetch(`/api/orders/${order.id}/pdf`);
            if (!response.ok) throw new Error('Error al generar PDF');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Presupuesto_${contact.name.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error:', error);
            alert('No se pudo generar el PDF');
        }
    };

    return (
        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500">
            {/* Cabecera */}
            <div className="p-6 lg:p-8 bg-stone-50/50 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-700">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 rotate-3">
                            <Receipt className="w-7 h-7 text-amber-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-xl font-black text-stone-900 dark:text-white tracking-tight">#{order.id.slice(-6).toUpperCase()}</h3>
                                <div className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                    {order.orderType === 'SALE' ? 'VENTA' : 'PRESUPUESTO'}
                                </div>
                            </div>
                            <p className="text-sm font-bold text-stone-400 capitalize">{format(new Date(order.createdAt), "EEEE d 'de' MMMM", { locale: es })}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {order.orderType === 'QUOTE' && (
                            <button 
                                onClick={() => onConvert?.(order.id)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Convertir a Venta
                            </button>
                        )}
                        <button 
                            onClick={shareOnWhatsApp}
                            className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all hover:scale-110 active:rotate-12 shadow-lg"
                        >
                            <MessageCircle className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={handleDownloadPDF}
                            className="p-3 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-xl hover:bg-stone-200 transition-all shadow-md active:scale-90"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Contenido Principal */}
            <div className="p-6 lg:p-8 space-y-8">
                {/* Items de la orden */}
                <QuoteLineItems items={order.items} markup={order.markup} />

                {/* Resumen Financiero Triple Columna */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Efectivo', amount: financials.totalCash, color: 'emerald', discount: financials.discountCash },
                        { label: 'Transf.', amount: financials.totalTransfer, color: 'violet', discount: financials.discountTransfer },
                        { label: 'Cuotas', amount: financials.totalCard, color: 'orange', discount: 0 }
                    ].map((item) => (
                        <div key={item.label} className={`relative p-5 rounded-3xl border-2 transition-all group overflow-hidden ${item.color === 'emerald' ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : item.color === 'violet' ? 'bg-violet-50/50 dark:bg-violet-900/10 border-violet-100 dark:border-violet-900/30' : 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30'}`}>
                            <div className="relative z-10">
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${item.color === 'emerald' ? 'text-emerald-600' : item.color === 'violet' ? 'text-violet-600' : 'text-orange-600'}`}>
                                    {item.label} {item.discount > 0 && `(-${item.discount}%)`}
                                </p>
                                <p className="text-2xl font-black text-stone-900 dark:text-white">${item.amount.toLocaleString()}</p>
                            </div>
                            <div className={`absolute -right-4 -bottom-4 w-16 h-16 opacity-5 group-hover:scale-125 group-hover:opacity-10 transition-all ${item.color === 'emerald' ? 'text-emerald-600' : item.color === 'violet' ? 'text-violet-600' : 'text-orange-600'}`}>
                                {item.label === 'Efectivo' ? <Banknote className="w-full h-full" /> : item.label === 'Transf.' ? <ArrowRightLeft className="w-full h-full" /> : <CreditCard className="w-full h-full" />}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Barra de Progreso y Saldos Pendientes (Solo si hay saldo) */}
                {financials.hasBalance && (
                    <div className="p-6 bg-stone-50 dark:bg-stone-900/40 rounded-3xl border border-stone-100 dark:border-stone-700/50">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                            <div>
                                <h4 className="text-sm font-black text-stone-800 dark:text-white uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-amber-500" /> Saldos Pendientes
                                </h4>
                                <p className="text-xs font-bold text-stone-400">Desglose según tu preferencia de pago de saldo</p>
                            </div>
                            <div className="flex gap-4">
                                {[
                                    { label: 'Efectivo', amount: financials.remainingCash, color: 'emerald', icon: Banknote },
                                    { label: 'Transf.', amount: financials.remainingTransfer, color: 'violet', icon: ArrowRightLeft },
                                    { label: 'Cuotas', amount: financials.remainingCard, color: 'orange', icon: CreditCard }
                                ].map((s) => (
                                    <div key={s.label} className="text-right">
                                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-0.5">{s.label}</p>
                                        <p className={`text-lg font-black ${s.color === 'emerald' ? 'text-emerald-500' : s.color === 'violet' ? 'text-violet-500' : 'text-orange-500'}`}>
                                            ${s.amount.toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Barra de progreso visual */}
                        <div className="relative pt-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Pagado: ${financials.paidReal.toLocaleString()}</span>
                                <span className={`text-[10px] font-black uppercase ${financials.progress >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{Math.round(financials.progress)}% Completado</span>
                            </div>
                            <div className="h-3 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden p-0.5">
                                <div 
                                    className={`h-full transition-all duration-700 rounded-full ${financials.progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                    style={{ width: `${Math.min(financials.progress, 100)}%` }} 
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Botón de Pago SI hay saldo */}
                {financials.hasBalance && (
                    <button
                        onClick={() => setShowPayment(true)}
                        className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 group"
                    >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> 
                        Abonar Pago / Cargar Pago
                    </button>
                )}
            </div>

            {/* Modal de Pago */}
            {showPayment && (
                <AddPaymentModal
                    orderId={order.id}
                    totalAmount={order.total}
                    paidAmount={order.paid}
                    onClose={() => setShowPayment(false)}
                    onSuccess={() => {
                        setShowPayment(false);
                        onRefreshContact?.();
                    }}
                />
            )}
        </div>
    );
}
