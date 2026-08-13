'use client';

import React from 'react';
import { 
    Calculator, Receipt, Download,
    CheckCircle2, X, Clock, Glasses, 
    Banknote, ArrowRightLeft, CreditCard,
    Lock, Unlock, ChevronRight, ChevronUp, Pencil,
    History, Trash2, Eye, AlertCircle, Factory, Loader2,
    FileText, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';
import { PricingService } from '@/services/PricingService';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';

// Modular Components
import QuoteLineItems from './QuoteLineItems';
import PaymentVoucherInfo from '@/components/admin/PaymentVoucherInfo';
import { describeLabFrameDetails } from '@/lib/lab-frame-summary';
import PrescriptionDetails from '../prescriptions/PrescriptionDetails';
import FrameRecapReadOnly from '@/components/orders/FrameRecapReadOnly';
import { PostSaleServiceForm, postSaleValueFromOrder } from '@/components/orders/PostSaleServiceForm';
import CheckoutModal from './CheckoutModal';
import AddPaymentModal from './AddPaymentModal';
import InvoiceModal from '@/components/billing/InvoiceModal';
import { generateInvoicePDF } from '@/lib/invoice-generator';

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
    onRequestPrescription?: () => void;
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
    onRequestPrescription,
    isExpanded = true,
    onToggleExpand,
    showActions = true,
    compact = false,
    onEdit,
    onRefreshContact
}: QuoteSummaryProps) {
    const [showCheckout, setShowCheckout] = React.useState(false);
    const [showPayment, setShowPayment] = React.useState(false);
    const [showIshAlert, setShowIshAlert] = React.useState(false);
    const [showPaymentsList, setShowPaymentsList] = React.useState(false);
    const [isDeletingPayment, setIsDeletingPayment] = React.useState<string | null>(null);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = React.useState(false);
    const [isSendingPDF, setIsSendingPDF] = React.useState(false);
    const [isUpdatingLock, setIsUpdatingLock] = React.useState(false);

    const [labFrameShape, setLabFrameShape] = React.useState(order.labFrameShape || '');
    const [frameA, setFrameA] = React.useState(order.frameA || '');
    const [frameB, setFrameB] = React.useState(order.frameB || '');
    const [frameDbl, setFrameDbl] = React.useState(order.frameDbl || '');
    const [frameEdc, setFrameEdc] = React.useState(order.frameEdc || '');
    const [labFrameDetails, setLabFrameDetails] = React.useState(order.labFrameDetails || '');
    const [isSavingFrame, setIsSavingFrame] = React.useState(false);


    // Facturación desde la ficha del cliente. Mismas reglas que /admin/ventas:
    // ADMIN emite (abre el modal de ARCA), el vendedor solo puede SOLICITARLA.
    const [invoiceOrder, setInvoiceOrder] = React.useState<any>(null);
    const [isRequestingInvoice, setIsRequestingInvoice] = React.useState(false);

    const isOptovision = order.items?.some((it: any) => {
        const labName = (it.laboratorySnapshot || it.product?.laboratory || '').toUpperCase();
        return labName.includes('OPTOVISION');
    }) || false;

    React.useEffect(() => {
        setLabFrameShape(order.labFrameShape || '');
        setFrameA(order.frameA || '');
        setFrameB(order.frameB || '');
        setFrameDbl(order.frameDbl || '');
        setFrameEdc(order.frameEdc || '');
        setLabFrameDetails(order.labFrameDetails || '');
    }, [order]);

    const handleSaveFrameMeasures = async () => {
        setIsSavingFrame(true);
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    labFrameShape,
                    frameA,
                    frameB,
                    frameDbl,
                    frameEdc,
                    labFrameDetails
                })
            });
            if (res.ok) {
                alert('✓ Medidas y forma del armazón guardadas correctamente.');
                if (onRefreshContact) await onRefreshContact();
            } else {
                const errData = await res.json();
                alert(`⚠️ Error al guardar: ${errData.error || 'Error desconocido'}`);
            }
        } catch (error) {
            console.error('Error saving frame measures:', error);
            alert('⚠️ Error de red al intentar guardar las medidas.');
        } finally {
            setIsSavingFrame(false);
        }
    };

    const handleUnlock = async () => {
        // El motivo es OBLIGATORIO: la reapertura queda en el historial de la
        // ficha con quién, cuándo y por qué (regla del 12/8/2026 — antes
        // reabrir no dejaba rastro en ningún lado).
        const reason = window.prompt('¿Por qué se reabre esta venta? El motivo queda registrado en el historial:');
        if (reason === null) return; // canceló
        if (!reason.trim()) {
            alert('La reapertura necesita un motivo. No se reabrió.');
            return;
        }
        setIsUpdatingLock(true);
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isLocked: false, reopenReason: reason.trim() })
            });
            if (res.ok) {
                if (onRefreshContact) await onRefreshContact();
            } else {
                const errData = await res.json();
                alert(`Error: ${errData.error || 'No se pudo reabrir la venta'}`);
            }
        } catch (err) {
            console.error('Error unlocking order:', err);
        } finally {
            setIsUpdatingLock(false);
        }
    };

    const handleLock = async () => {
        const confirmLock = window.confirm('¿Estás seguro de que querés volver a bloquear/trabar esta venta?');
        if (!confirmLock) return;
        setIsUpdatingLock(true);
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isLocked: true })
            });
            if (res.ok) {
                if (onRefreshContact) await onRefreshContact();
            } else {
                const errData = await res.json();
                alert(`Error: ${errData.error || 'No se pudo bloquear la venta'}`);
            }
        } catch (err) {
            console.error('Error locking order:', err);
        } finally {
            setIsUpdatingLock(false);
        }
    };

    const handleToggleAuth = async (checked: boolean) => {
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ authorizedByAdmin: checked }),
            });
            if (res.ok) {
                if (onRefreshContact) await onRefreshContact();
            } else {
                const data = await res.json();
                alert(`⚠️ ${data.error || 'Error al actualizar autorización'}`);
            }
        } catch (error) {
            console.error('Error toggling admin authorization:', error);
        }
    };

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
                            <p className="text-[10px] font-bold text-stone-500">{format(new Date(order.labSentAt || order.createdAt), "d MMM", { locale: es })}</p>
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
                                {item.product?.brand || ''} · {item.product?.name || ''}
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

    const isSale = order.orderType === 'SALE' || order.orderType === 'MAYORISTA';
    const isQuote = !isSale;
    const isLockedSale = isSale && order.isLocked !== false;

    // La receta tal cual quedó congelada al enviar a fábrica. Las ventas viejas
    // (anteriores al congelado) no tienen snapshot: ahí se sigue mostrando la
    // receta viva, que es lo único que hay.
    // Sin useMemo a propósito: acá arriba hay returns condicionales, y un hook
    // después de un return rompe el orden de hooks. El parseo es un JSON chico.
    const { receta: recetaCongelada, por: congeladaPor, el: congeladaEl } = (() => {
        const vacio = { receta: null, por: null, el: null };
        if (!order.prescriptionSnapshot) return vacio;
        try {
            const snap = JSON.parse(order.prescriptionSnapshot);
            return {
                receta: snap?.rx || null,
                por: snap?.frozenBy || null,
                el: snap?.frozenAt ? format(new Date(snap.frozenAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es }) : null,
            };
        } catch {
            return vacio;
        }
    })();

    // Resumen de lo cargado en el Repaso Final (origen del armazón, medidas de
    // cada par y teñido) — mismo dato que se muestra en "la venta" y en el PDF.
    const labFrame = describeLabFrameDetails(order as any);
    
    // Integración con PricingService
    const financials = PricingService.calculateOrderFinancials(order);

    // ── Facturación (idéntico a /admin/ventas) ──
    // Solo se puede facturar lo efectivamente PAGADO y que todavía no se facturó.
    const isAdmin = currentUserRole === 'ADMIN';
    const completedInvoices = (order.invoices || []).filter((i: any) => i.status === 'COMPLETED');
    const totalInvoiced = completedInvoices.reduce((acc: number, inv: any) => acc + (inv.totalAmount || 0), 0);
    const pendingToInvoice = Math.max(0, financials.paidReal - totalInvoiced);

    const handleInvoiceRequest = async () => {
        const maxInvoiceable = financials.paidReal;
        if (maxInvoiceable <= 0) {
            return alert('No hay pagos registrados para esta venta. No se puede solicitar factura.');
        }

        // ADMIN: emite directo en ARCA con el remanente sin facturar.
        if (isAdmin) {
            setInvoiceOrder({ ...order, client: contact, customAmount: pendingToInvoice || maxInvoiceable });
            return;
        }

        // Vendedor: NO emite — le pide la factura al administrador.
        const amountStr = prompt(
            `Monto a facturar para ${contact.name}:\n(Pago total registrado hasta hoy: $${maxInvoiceable.toLocaleString('es-AR')})`,
            String(pendingToInvoice || maxInvoiceable)
        );
        if (!amountStr) return;

        const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
        if (isNaN(amount)) return alert('Monto inválido');
        if (amount > maxInvoiceable) {
            return alert(`Error: No podés facturar más de lo que el cliente pagó ($${maxInvoiceable.toLocaleString('es-AR')}).`);
        }

        setIsRequestingInvoice(true);
        try {
            const res = await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'INVOICE_REQUEST',
                    message: `Solicitar factura de $${amount.toLocaleString('es-AR')} (Pago total del cliente: $${maxInvoiceable.toLocaleString('es-AR')}) para venta #${order.id.slice(-4).toUpperCase()} (${contact.name})`,
                    orderId: order.id,
                }),
            });
            const data = await res.json();
            alert(res.ok ? '✅ Solicitud de factura enviada al administrador.' : (data.error || 'Error al enviar la solicitud.'));
        } catch {
            alert('Error de conexión al solicitar factura.');
        } finally {
            setIsRequestingInvoice(false);
        }
    };

    const openInvoicePDF = async (invoiceId: string) => {
        try {
            const res = await fetch(`/api/billing/invoice/${invoiceId}/pdf-data`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Error desconocido');
            }
            await generateInvoicePDF(await res.json());
        } catch (e: any) {
            alert('Error abriendo el PDF: ' + e.message);
        }
    };

    const LAB_LABELS: Record<string, { label: string; color: string }> = {
        'NONE': { label: 'Sin enviar', color: 'bg-stone-100 text-stone-500' },
        'SENT': { label: 'Falta procesar', color: 'bg-amber-100 text-amber-600' },
        'IN_PROGRESS': { label: 'Procesado', color: 'bg-blue-100 text-blue-600' },
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

    // El texto ya no se arma acá: lo arma el servidor desde el pedido, así la
    // copia que recibe el cliente y la que queda en la ficha son el mismo string
    // (y el navegador no puede tocar los importes).
    const handleWhatsApp = async () => {
        const formattedPhone = formatPhoneForWhatsApp(contact.phone);
        if (!formattedPhone || formattedPhone === '549') return;

        setIsSendingWhatsApp(true);
        try {
            const res = await fetch(`/api/orders/${order.id}/send-quote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formattedPhone })
            });

            if (res.ok) {
                alert(`✅ ${isSale ? 'Venta' : 'Presupuesto'} enviado por WhatsApp y registrado en la ficha`);
            } else {
                const errData = await res.json().catch(() => ({}));
                console.error('[WhatsApp Text] Error:', res.status, errData);
                alert(`❌ Error al enviar por WhatsApp (${res.status}): ${errData?.error || 'Error desconocido'}`);
            }
        } catch (err: any) {
            console.error('[WhatsApp Text] Network Error:', err);
            alert(`❌ Error de red al intentar enviar por WhatsApp: ${err.message}`);
        } finally {
            setIsSendingWhatsApp(false);
        }
    };

    const handleWhatsAppPDF = async () => {
        const formattedPhone = formatPhoneForWhatsApp(contact.phone);
        if (!formattedPhone || formattedPhone === '549') return;

        setIsSendingPDF(true);
        try {
            const items = order.items || [];
            const summary: Record<string, string> = {};
            items.forEach((it: any) => {
                const name = it.product?.name || it.productNameSnapshot || 'Artículo';
                summary[name] = name;
            });
            const itemNames = Object.values(summary).join(', ');
            
            const clientName = contact.name?.split(' ')[0] || 'Cliente';
            const text = `Hola ${clientName}, adjunto tu ${isSale ? 'orden' : 'presupuesto'} por: ${itemNames}.\n\nAtelier Óptica, la óptica mejor calificada en Córdoba ⭐⭐⭐⭐⭐.`;
            
            // Timeout de seguridad: si el backend no responde en 110s, cortamos
            // para que el botón nunca quede "Enviando..." indefinidamente.
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 110000);

            let sendRes: Response;
            try {
                sendRes = await fetch(`/api/orders/${order.id}/send-pdf`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        formattedPhone,
                        text
                    }),
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timer);
            }

            if (sendRes.ok) {
                alert(`✅ PDF enviado por WhatsApp`);
            } else {
                const errData = await sendRes.json().catch(() => ({}));
                console.error('[WhatsApp PDF] Error:', sendRes.status, errData);
                // 503 = garantía de que no salió nada: no hay que sembrar la duda
                // de "fijate si le llegó", alcanza con reintentar.
                if (sendRes.status === 503) {
                    alert(`⏳ ${errData?.error || 'WhatsApp se está reconectando: NO se envió nada. Esperá unos segundos y reintentá.'}`);
                } else {
                    alert(`❌ Error al enviar PDF (${sendRes.status}): ${errData?.error || 'Error desconocido'}`);
                }
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                console.error('[WhatsApp PDF] Timeout (90s)');
                alert('⏱️ El envío está tardando demasiado. Puede que el bot de WhatsApp esté desconectado o saturado. Revisá el estado del bot e intentá de nuevo.');
            } else {
                console.error('[WhatsApp PDF] Network Error:', err);
                alert(`❌ Error de red al enviar PDF: ${err.message}`);
            }
        } finally {
            setIsSendingPDF(false);
        }
    };


    if (!isExpanded) {
        const dateStr = format(new Date(order.labSentAt || order.createdAt), "d MMM yy", { locale: es });
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
                            Venta #{order.id.slice(-4).toUpperCase()}
                            {order.labOrderNumber ? ` · Pedido: ${order.labOrderNumber}` : ''}
                            {` · ${dateStr} · ${order.items?.length || 0} items`}
                        </span>
                    </div>
                </div>

                {/* Con un descuento especial que cubre todo el presupuesto, el saldo da
                    0 y la fila mostraba "PAGADO" a secas: parecía cobrado cuando en
                    realidad fue bonificado. El aviso va antes del estado, y solo si
                    hubo descuento. */}
                {financials.specialDiscount > 0 && (
                    <div className="hidden md:flex items-center px-4 border-l border-stone-100 dark:border-stone-700 ml-4">
                        <span className="px-3 py-1 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 rounded-lg text-[9px] font-black uppercase tracking-widest border border-rose-200 dark:border-rose-800">
                            Dto. especial −${Math.round(financials.specialDiscount).toLocaleString()}
                        </span>
                    </div>
                )}

                {!financials.hasBalance && (
                    <div className="hidden md:flex items-center gap-2 px-4 border-l border-stone-100 dark:border-stone-700 ml-4">
                         <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">
                            {financials.specialDiscount > 0 && financials.paidReal === 0 ? 'BONIFICADO' : 'PAGADO'}
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

                {/* SmartLab Info - Bloque separado multi-cristal */}
                {isSale && order.smartLabProgress != null && order.smartLabProgress > 0 && (() => {
                    let details: any[] = [];
                    try { details = order.smartLabDetails ? JSON.parse(order.smartLabDetails) : []; } catch {}
                    
                    return (
                        <div className="hidden md:flex items-center px-3 border-l border-stone-100 dark:border-stone-700 ml-2">
                            <div className="bg-blue-50/80 dark:bg-blue-950/30 rounded-xl px-3 py-2 border border-blue-100 dark:border-blue-800/50 min-w-[140px]">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <Factory className="w-3 h-3 text-blue-500" />
                                        <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">SmartLab</span>
                                    </div>
                                    {order.smartLabDays != null && (
                                        <span className="text-[7px] font-black text-amber-500">{order.smartLabDays}d</span>
                                    )}
                                </div>
                                {details.length > 1 ? (
                                    <div className="space-y-1.5">
                                        {details.map((d: any, i: number) => (
                                            <div key={i}>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[7px] font-bold text-stone-500">🔹 {d.num?.slice(-5)}</span>
                                                    <span className={`text-[8px] font-black ${d.progress >= 100 ? 'text-emerald-500' : 'text-blue-600'}`}>{d.progress}%</span>
                                                </div>
                                                <div className="h-1 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${d.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, d.progress)}%` }} />
                                                </div>
                                                <span className="text-[6px] font-bold text-stone-400 truncate block max-w-[120px]">{d.sector}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[7px] font-bold text-stone-500 truncate max-w-[80px]">{order.smartLabSector || '\u2014'}</span>
                                            <span className={`text-[9px] font-black ${order.smartLabProgress >= 100 ? 'text-emerald-500' : 'text-blue-600'}`}>{order.smartLabProgress}%</span>
                                        </div>
                                        <div className="h-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${order.smartLabProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, order.smartLabProgress)}%` }} />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })()}

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
                            {isSale && order.labOrderNumber && (
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                    Pedido: {order.labOrderNumber}
                                </span>
                            )}
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
                         {!financials.hasBalance ? (
                            <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 shadow-sm flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">ORDEN PAGADA</span>
                            </div>
                        ) : (
                            <div className="text-right sr-only sm:not-sr-only">
                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Saldo Efectivo Pendiente</span>
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
                    specialDiscount={order.specialDiscount}
                />

                {/* En una venta enviada la receta que vale es la CONGELADA al enviarla a
                    fábrica, no la viva de la ficha: si alguien corrige la receta del
                    cliente más adelante, la venta tiene que seguir mostrando lo que se
                    fabricó. */}
                <PrescriptionDetails prescription={recetaCongelada || order.prescription} />
                {isLockedSale && recetaCongelada && (
                    <p className="-mt-2 px-6 text-[10px] font-bold text-stone-500 dark:text-stone-400">
                        🔒 Receta congelada al enviar a fábrica{congeladaEl ? ` el ${congeladaEl}` : ''}
                        {congeladaPor ? ` por ${congeladaPor}` : ''}. Editar la receta en la ficha del cliente
                        no cambia esta venta.
                    </p>
                )}

                {/* Repaso del armazón. Con la venta ya en fábrica es SOLO LECTURA
                    (y muestra los dos pares de un 2x1); el editor queda para
                    presupuestos y para una venta reabierta por administración. */}
                {isSale && isLockedSale && <FrameRecapReadOnly order={order} />}

                {/* Medidas y Forma del Armazón (Repaso de la Venta / Cotización) */}
                {isSale && !isLockedSale && (
                    <div className="bg-stone-50 dark:bg-stone-900/50 rounded-[2rem] p-6 border-2 border-stone-200 dark:border-stone-700">
                        <div className="flex items-center gap-2 mb-4">
                            <Glasses className="w-5 h-5 text-indigo-500" />
                            <h4 className="text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-widest">
                                Medidas y Forma del Armazón (Laboratorio)
                            </h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                                <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">
                                    Forma / Aro
                                </label>
                                <input
                                    type="text"
                                    value={labFrameShape}
                                    onChange={(e) => setLabFrameShape(e.target.value)}
                                    placeholder="Ej: Redondo, Cuadrado"
                                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-800 dark:text-stone-200 uppercase"
                                />
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">
                                    Horizontal (A)
                                </label>
                                <input
                                    type="text"
                                    value={frameA}
                                    onChange={(e) => setFrameA(e.target.value)}
                                    placeholder="Ej: 52"
                                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-800 dark:text-stone-200"
                                />
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">
                                    Vertical (B)
                                </label>
                                <input
                                    type="text"
                                    value={frameB}
                                    onChange={(e) => setFrameB(e.target.value)}
                                    placeholder="Ej: 45"
                                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-800 dark:text-stone-200"
                                />
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">
                                    Puente (Pte / DBL)
                                </label>
                                <input
                                    type="text"
                                    value={frameDbl}
                                    onChange={(e) => setFrameDbl(e.target.value)}
                                    placeholder="Ej: 18"
                                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-800 dark:text-stone-200"
                                />
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">
                                    Diagonal (ED / EDC)
                                </label>
                                <input
                                    type="text"
                                    value={frameEdc}
                                    onChange={(e) => setFrameEdc(e.target.value)}
                                    placeholder="Ej: 54"
                                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-800 dark:text-stone-200"
                                />
                            </div>
                            <div className="col-span-2 sm:col-span-3">
                                <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">
                                    Detalles / Notas del Armazón
                                </label>
                                <input
                                    type="text"
                                    value={labFrameDetails}
                                    onChange={(e) => setLabFrameDetails(e.target.value)}
                                    placeholder="Ej: Patillas con flex, acetato negro"
                                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-800 dark:text-stone-200"
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={handleSaveFrameMeasures}
                                disabled={isSavingFrame}
                                className="px-6 py-2.5 bg-stone-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSavingFrame ? 'Guardando...' : 'Guardar Medidas del Armazón'}
                            </button>
                        </div>
                    </div>
                )}

                {/* SmartLab Info Block - Expanded View */}
                {isSale && !isOptovision && order.smartLabProgress != null && order.smartLabProgress > 0 && (
                    <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 rounded-[2rem] p-5 border-2 border-blue-200/50 dark:border-blue-800/30">
                        <div className="flex items-center gap-2 mb-4">
                            <Factory className="w-5 h-5 text-blue-500" />
                            <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Estado en Laboratorio (SmartLab)</h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div className="bg-white/60 dark:bg-stone-800/60 rounded-xl p-3 text-center">
                                <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">Progreso</span>
                                <span className={`text-lg font-black ${order.smartLabProgress >= 100 ? 'text-emerald-500' : 'text-blue-600'}`}>{order.smartLabProgress}%</span>
                            </div>
                            <div className="bg-white/60 dark:bg-stone-800/60 rounded-xl p-3 text-center">
                                <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">Sector</span>
                                <span className="text-[11px] font-black text-stone-700 dark:text-stone-200 leading-tight">{order.smartLabSector || '—'}</span>
                            </div>
                            <div className="bg-white/60 dark:bg-stone-800/60 rounded-xl p-3 text-center">
                                <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">Ingreso Lab</span>
                                <span className="text-[11px] font-black text-stone-700 dark:text-stone-200">{order.smartLabEntryDate || '—'}</span>
                            </div>
                            <div className="bg-white/60 dark:bg-stone-800/60 rounded-xl p-3 text-center">
                                <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest block mb-1">Días en Lab</span>
                                <span className="text-lg font-black text-amber-500">{order.smartLabDays ?? '—'}</span>
                            </div>
                        </div>
                        <div className="h-2.5 bg-white/60 dark:bg-stone-800/60 rounded-full overflow-hidden border border-blue-100 dark:border-blue-900/50">
                            <div 
                                className={`h-full rounded-full transition-all duration-700 ${order.smartLabProgress >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
                                style={{ width: `${Math.min(100, order.smartLabProgress)}%` }}
                            />
                        </div>
                        {order.smartLabLastSync && (
                            <p className="text-[8px] font-bold text-stone-400 text-right mt-2">
                                Última sync: {new Date(order.smartLabLastSync).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>
                )}

                {order.frameSource && (
                    <div className="flex items-center gap-4 p-5 bg-amber-50/50 dark:bg-amber-950/20 border-2 border-amber-200/50 dark:border-amber-900/50 rounded-[2rem]">
                        <Glasses className="w-6 h-6 text-amber-600" />
                        <div>
                            <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">Armazón</p>
                            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                {labFrame.origin}
                            </p>
                        </div>
                    </div>
                )}

                {/* Segundo par (2x1) y teñido: lo que se eligió en el Repaso Final y no
                    tiene su propio campo editable acá (el Par 1 se corrige arriba). */}
                {(labFrame.pairs[1] && !labFrame.pairs[1].isEmpty || labFrame.tint || labFrame.notes) && (
                    <div className="bg-stone-50 dark:bg-stone-900/50 rounded-[2rem] p-6 border-2 border-stone-200 dark:border-stone-700 space-y-4">
                        {labFrame.pairs[1] && !labFrame.pairs[1].isEmpty && (
                            <div>
                                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2">Segundo Par (Bonificado)</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold text-stone-700 dark:text-stone-200">
                                    {labFrame.pairs[1].shape && <p>Forma: <span className="uppercase">{labFrame.pairs[1].shape}</span></p>}
                                    {labFrame.pairs[1].measurements && <p>{labFrame.pairs[1].measurements}</p>}
                                    {labFrame.pairs[1].details && <p className="sm:col-span-3">{labFrame.pairs[1].details}</p>}
                                </div>
                            </div>
                        )}
                        {labFrame.tint && (
                            <div>
                                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Tratamiento / Teñido</p>
                                <p className="text-xs font-bold text-stone-800 dark:text-stone-200">{labFrame.tint.text}</p>
                                {labFrame.tint.ambiguousPair && (
                                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Es un 2x1 y solo hay una línea de teñido cargada: confirmar a qué par corresponde.
                                    </p>
                                )}
                            </div>
                        )}
                        {labFrame.notes && (
                            <div>
                                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Observaciones Lab</p>
                                <p className="text-xs font-bold text-stone-800 dark:text-stone-200">{labFrame.notes}</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="flex items-center gap-2 ml-1">
                        <Calculator className="w-4 h-4 text-stone-400" />
                        <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Totales por Método</h4>
                    </div>
                    {/* Solo si el admin aplicó un descuento especial. Sin esto, los tres
                        totales aparecen ya descontados y no hay forma de saber por qué —
                        con un descuento que cubre todo el presupuesto, quedaban tres $0
                        sin ninguna explicación en pantalla. */}
                    {financials.specialDiscount > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-3xl bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-100/70 dark:border-rose-900/50">
                            <div>
                                <p className="text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase tracking-widest">Descuento especial</p>
                                <p className="text-[9px] font-bold text-stone-600 dark:text-stone-400 mt-0.5">Lo aplicó el administrador</p>
                            </div>
                            <p className="text-sm font-black text-rose-700 dark:text-rose-300">
                                ${Math.round(financials.listPriceBeforeSpecial).toLocaleString()}
                                <span className="mx-1.5 font-bold">−</span>
                                ${Math.round(financials.specialDiscount).toLocaleString()}
                                <span className="mx-1.5 font-bold">=</span>
                                ${Math.round(financials.listPrice).toLocaleString()}
                            </p>
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { label: 'Efectivo', amount: financials.totalCash, color: 'emerald', discount: financials.discountCash },
                            { label: 'Transf.', amount: financials.totalTransfer, color: 'violet', discount: financials.discountTransfer },
                            { label: 'Cuotas', amount: financials.totalCard, color: 'orange', discount: 0 }
                        ].map(tier => (
                            <div key={tier.label} className={`bg-${tier.color}-50/50 dark:bg-${tier.color}-950/20 p-4 rounded-3xl border-2 border-${tier.color}-100/50`}>
                                <p className={`text-[10px] font-black text-${tier.color}-600 uppercase tracking-widest mb-1`}>{tier.label} {tier.discount > 0 && `-${tier.discount}%`}</p>
                                <p className={`text-xl font-black text-${tier.color}-600`}>${tier.amount.toLocaleString()}</p>
                                {tier.label === 'Cuotas' && (
                                    <div className="mt-2 space-y-1 border-t border-orange-100/70 pt-2">
                                        <p className="text-[9px] font-black text-orange-500">
                                            3 cuotas sin interés: ${financials.installment3.toLocaleString()}
                                        </p>
                                        <p className="text-[9px] font-black text-orange-500">
                                            6 cuotas sin interés: ${financials.installment6.toLocaleString()}
                                        </p>
                                    </div>
                                )}
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
                            <span className={`text-[10px] font-black uppercase ${financials.progress >= 100 || order.authorizedByAdmin ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {Math.round(financials.progress)}% Completado {order.authorizedByAdmin && financials.progress < 50 && '(Autorizado)'}
                            </span>
                        </div>
                        <div className="h-2 bg-stone-100 dark:bg-stone-900 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700">
                            <div className={`h-full transition-all duration-700 ${financials.progress >= 100 || order.authorizedByAdmin ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(financials.progress, 100)}%` }} />
                        </div>

                        {currentUserRole === 'ADMIN' && financials.progress < 50 && (
                            <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl mt-2 animate-in slide-in-from-top-1">
                                <input 
                                    type="checkbox" 
                                    id={`auth-check-summary-${order.id}`}
                                    checked={order.authorizedByAdmin || false}
                                    onChange={(e) => handleToggleAuth(e.target.checked)}
                                    className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
                                />
                                <label htmlFor={`auth-check-summary-${order.id}`} className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest cursor-pointer select-none">
                                    Autorizar operación con seña menor al 50%
                                </label>
                            </div>
                        )}
                        
                        {currentUserRole !== 'ADMIN' && financials.progress < 50 && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2 mt-2">
                                <span className="text-amber-500 text-xs">⚠️</span>
                                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                                    {order.authorizedByAdmin 
                                        ? '✓ Autorizado por Administrador' 
                                        : 'Seña menor al 50% - Requiere autorización del Administrador'
                                    }
                                </span>
                            </div>
                        )}

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
                                                        <PaymentVoucherInfo payment={paymentValue} className="mt-0.5" />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {paymentValue.receiptUrl && (
                                                        <button 
                                                            onClick={() => window.open(resolveStorageUrl(paymentValue.receiptUrl), '_blank')}
                                                            className="p-2 hover:bg-primary/5 text-stone-400 hover:text-primary rounded-xl transition-all"
                                                            title="Ver Comprobante Adjunto"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => window.open(`/api/payments/${paymentValue.id}/receipt-pdf`, '_blank')}
                                                        className="p-2 hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600 rounded-xl transition-all"
                                                        title="Descargar Recibo PDF"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </button>
                                                    {/* Solo admin puede eliminar pagos de ventas */}
                                                    {(!isSale || currentUserRole === 'ADMIN') && (
                                                    <button 
                                                        onClick={async () => {
                                                            const firstConfirm = window.confirm('⚠️ ATENCIÓN: Estás a punto de eliminar este pago. El saldo se actualizará automáticamente. ¿Estás seguro?');
                                                            if (!firstConfirm) return;
                                                            
                                                            // Double validation for ADMINs
                                                            if (currentUserRole === 'ADMIN') {
                                                                const secondConfirm = window.prompt('Para confirmar la eliminación del pago, escribí "ELIMINAR" en mayúsculas:');
                                                                if (secondConfirm !== 'ELIMINAR') {
                                                                    window.alert('Eliminación cancelada. La palabra no coincide.');
                                                                    return;
                                                                }
                                                            }

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
                                                        }}
                                                        disabled={isDeletingPayment === paymentValue.id}
                                                        className="p-2 hover:bg-red-50 text-stone-300 hover:text-red-500 rounded-xl transition-all disabled:opacity-50"
                                                        title="Eliminar Pago"
                                                    >
                                                        <Trash2 className={`w-3.5 h-3.5 ${isDeletingPayment === paymentValue.id ? 'animate-pulse' : ''}`} />
                                                    </button>
                                                    )}
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

                {/* Post Venta — la MISMA tarjeta que en ventas y en la ficha del
                    cliente. Acá no hay reproceso: eso se hace desde la venta. */}
                {isSale && (order.labStatus && order.labStatus !== 'NONE' || order.postSaleNotes || order.postSaleCost > 0 || order.postSaleOrderOption) && (
                    <PostSaleServiceForm
                        value={postSaleValueFromOrder(order)}
                        onRefresh={() => { onRefreshContact?.(); }}
                        userRole={currentUserRole}
                    />
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
                            currentUserRole === 'ADMIN' ? (
                                <button 
                                    onClick={handleUnlock}
                                    disabled={isUpdatingLock}
                                    className="sm:col-span-4 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Unlock className="w-5 h-5" /> REABRIR PARA EDITAR
                                </button>
                            ) : (
                                <div className="sm:col-span-4 flex items-center gap-3 p-4 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 rounded-2xl">
                                    <Lock className="w-5 h-5 text-stone-400" />
                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Venta Bloqueada (Solo Admin)</span>
                                </div>
                            )
                        ) : isSale ? (
                            <div className="sm:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button 
                                    onClick={() => onEdit?.(order)}
                                    className="py-4 bg-stone-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <Pencil className="w-5 h-5" /> EDITAR DETALLES DE LA VENTA
                                </button>
                                <button 
                                    onClick={handleLock}
                                    disabled={isUpdatingLock}
                                    className="py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    <Lock className="w-5 h-5" /> VOLVER A BLOQUEAR
                                </button>
                            </div>
                        ) : null}
                        
                        {/* ── FACTURACIÓN (solo ventas) ──
                            Mismas reglas que /admin/ventas: se factura únicamente contra
                            lo pagado y no facturado todavía. ADMIN emite en ARCA; el
                            vendedor solo puede solicitarla. Las facturas ya emitidas
                            quedan como acceso directo al PDF desde acá mismo. */}
                        {isSale && (completedInvoices.length > 0 || pendingToInvoice > 0) && (
                            <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
                                {completedInvoices.map((inv: any) => (
                                    <button
                                        key={inv.id}
                                        onClick={() => openInvoicePDF(inv.id)}
                                        title={`Ver PDF de Factura\nCAE: ${inv.cae}\nVto: ${inv.caeExpiration}`}
                                        className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all"
                                    >
                                        <div className="text-left">
                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">Factura C</span>
                                            <span className="text-xs font-black text-indigo-600">
                                                {inv.pointOfSale?.toString().padStart(4, '0')}-{inv.voucherNumber?.toString().padStart(8, '0')}
                                            </span>
                                        </div>
                                        <ExternalLink className="w-4 h-4 text-indigo-400" />
                                    </button>
                                ))}
                                {pendingToInvoice > 0 && (
                                    <button
                                        onClick={handleInvoiceRequest}
                                        disabled={isRequestingInvoice}
                                        title={isAdmin ? 'Emitir Factura C' : 'Solicitar Factura al administrador'}
                                        className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                                            isAdmin
                                                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 hover:bg-indigo-100'
                                                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-500 hover:bg-amber-100'
                                        }`}
                                    >
                                        {isRequestingInvoice
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <FileText className="w-3.5 h-3.5" />}
                                        {isAdmin ? 'Facturar' : 'Solicitar Factura'}
                                        <span className="opacity-60">· ${Math.round(pendingToInvoice).toLocaleString('es-AR')}</span>
                                    </button>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => window.open(`/api/orders/${order.id}/pdf`, '_blank')}
                            className="py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
                        >
                            <Download className="w-3.5 h-3.5" /> PDF
                        </button>
                        <button 
                            onClick={handleWhatsApp} 
                            disabled={!contact.phone || isSendingWhatsApp}
                            className="py-3 bg-emerald-50 dark:bg-emerald-900 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-30"
                        >
                            <WhatsAppIcon className={`w-3.5 h-3.5 ${isSendingWhatsApp ? 'animate-pulse' : ''}`} /> {isSendingWhatsApp ? 'Enviando...' : 'WhatsApp'}
                        </button>
                        <button 
                            onClick={handleWhatsAppPDF} 
                            disabled={!contact.phone || isSendingPDF}
                            className="py-3 bg-emerald-50 dark:bg-emerald-900 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-30"
                        >
                            <Download className={`w-3.5 h-3.5 ${isSendingPDF ? 'animate-bounce' : ''}`} /> {isSendingPDF ? 'Enviando...' : 'Enviar PDF'}
                        </button>
                        <button 
                            onClick={() => setShowPayment(true)}
                            className="py-3 bg-amber-50 text-amber-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                        >
                            <Banknote className="w-3.5 h-3.5" /> Abonar
                        </button>
                        {/* Ocultar botón eliminar para vendedores en ventas ya cerradas */}
                        {!isLockedSale && (
                        <button 
                            onClick={() => {
                                if (currentUserRole === 'ADMIN') {
                                    const firstConfirm = window.confirm('⚠️ ATENCIÓN: Estás a punto de eliminar este presupuesto/venta. ¿Estás seguro?');
                                    if (!firstConfirm) return;
                                    const secondConfirm = window.prompt('Para confirmar la eliminación definitiva, escribí "ELIMINAR" en mayúsculas:');
                                    if (secondConfirm === 'ELIMINAR') {
                                        onDelete?.(order.id);
                                    } else {
                                        window.alert('Eliminación cancelada. La palabra no coincide.');
                                    }
                                } else {
                                    if (window.confirm('¿Seguro que querés eliminar este presupuesto? Esta acción no se puede deshacer.')) {
                                        onDelete?.(order.id);
                                    }
                                }
                            }}
                            className="py-3 bg-red-50 text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                        >
                            <X className="w-3.5 h-3.5" /> Eliminar
                        </button>
                        )}

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

            {/* Emisión en ARCA — solo ADMIN llega acá (handleInvoiceRequest lo filtra). */}
            {invoiceOrder && (
                <InvoiceModal
                    order={invoiceOrder}
                    initialAmount={invoiceOrder.customAmount}
                    onClose={() => setInvoiceOrder(null)}
                    onSuccess={async () => {
                        setInvoiceOrder(null);
                        if (onRefreshContact) await onRefreshContact();
                    }}
                />
            )}

            {showPayment && (
                <AddPaymentModal
                    orderId={order.id}
                    totalAmount={order.total || 0}
                    paidAmount={order.paid || 0}
                    onClose={() => setShowPayment(false)}
                    onSuccess={async (paymentResult: any) => {
                        setShowPayment(false);
                        if (paymentResult.thresholdReached) {
                            setShowIshAlert(true);
                        }
                        if (onRefreshContact) {
                            await onRefreshContact();
                        }
                        // Only show checkout if it was a quote and we want to convert
                        if (isQuote) setShowCheckout(true);
                    }}
                />
            )}

            {showCheckout && (
                <CheckoutModal
                    order={order}
                    contact={contact as any}
                    currentUserRole={currentUserRole}
                    onClose={() => setShowCheckout(false)}
                    onRequestPrescription={onRequestPrescription}
                    onComplete={async (data) => {
                        if (onConvert) {
                            await onConvert(order.id, { 
                                prescriptionId: data.prescriptionId,
                                labFrameShape: data.labFrameShape,
                                labFrameDetails: data.labFrameDetails,
                                labNotes: data.labNotes,
                                labColor: data.labColor,
                                labMeasurePte: data.labMeasurePte,
                                labMeasureA: data.labMeasureA,
                                labMeasureB: data.labMeasureB,
                                labMeasureEd: data.labMeasureEd,
                                labFrameShape2: data.labFrameShape2,
                                labFrameDetails2: data.labFrameDetails2,
                                labMeasurePte2: data.labMeasurePte2,
                                labMeasureA2: data.labMeasureA2,
                                labMeasureB2: data.labMeasureB2,
                                labMeasureEd2: data.labMeasureEd2,
                                authorizedByAdmin: data.authorizedByAdmin,
                                // Estos cuatro se cargan en el checkout y acá se
                                // PERDÍAN (llegaban undefined a la conversión):
                                // solo sobrevivían si el vendedor había apretado
                                // "Guardar datos" antes de confirmar. El origen
                                // del armazón y sus datos son parte del pedido
                                // que se congela con la venta.
                                frameSource: data.frameSource,
                                userFrameBrand: data.userFrameBrand,
                                userFrameModel: data.userFrameModel,
                                clientData: data.clientData,
                            });
                            setShowCheckout(false);
                        }
                    }}
                    onRefreshContact={onRefreshContact || (async () => {})}
                />
            )}
            
            {showIshAlert && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-red-950/80 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-[3rem] p-8 text-center border-4 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.4)] animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                            <AlertCircle className="w-12 h-12 text-red-600" />
                        </div>
                        <h3 className="text-2xl font-black text-stone-900 dark:text-white mb-4 uppercase italic tracking-tighter">
                            ¡OBJETIVO ALCANZADO!
                        </h3>
                        <p className="text-stone-600 dark:text-stone-300 font-bold mb-8 leading-relaxed">
                            ya completaste el objetivo en <span className="text-red-600 font-black">POSNET ISH</span><br/>
                            <span className="text-2xl mt-2 block">AHORA PASA A <span className="text-emerald-600 font-black">posnet yani</span></span>
                        </p>
                        <button 
                            onClick={() => setShowIshAlert(false)}
                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
                        >
                            ENTENDIDO
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
