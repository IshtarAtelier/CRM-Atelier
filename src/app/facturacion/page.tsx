'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Receipt, Search, Filter, Calendar, User, 
    CreditCard, CheckCircle2, AlertCircle, 
    ChevronRight, ArrowRight, Download, Eye,
    Plus, Loader2, X, Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import InvoiceModal from '@/components/InvoiceModal';
import { BillingAccount, detectBillingAccount } from '@/lib/afip';

interface Order {
    id: string;
    total: number;
    createdAt: string;
    orderType: string;
    isDeleted: boolean;
    client: {
        id: string;
        name: string;
        dni?: string | null;
    };
    payments: {
        id: string;
        amount: number;
        method: string;
        createdAt: string;
        receiptUrl?: string | null;
    }[];
    invoices: {
        id: string;
        status: string;
        cae: string;
        voucherNumber: number;
        pointOfSale: number;
        billingAccount: string;
        createdAt: string;
    }[];
}

export default function BillingPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isSearchingManual, setIsSearchingManual] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const [notifications, setNotifications] = useState<any[]>([]);
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setUserRole(data.role);
            }
        };
        loadUser();
        refreshData();
    }, []);

    const refreshData = async () => {
        setLoading(true);
        try {
            // Fetch notifications
            const notifRes = await fetch('/api/notifications');
            const notifs = await notifRes.json();
            setNotifications(Array.isArray(notifs) ? notifs.filter((n: any) => n.type === 'INVOICE_REQUEST') : []);

            // Fetch orders for context and completed tab
            const res = await fetch('/api/orders');
            const data = await res.json();
            const sales = (data || []).filter((o: Order) => o.orderType === 'SALE' && !o.isDeleted);
            setOrders(sales);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadInvoice = async (invoiceId: string) => {
        setDownloadingId(invoiceId);
        try {
            const res = await fetch(`/api/billing/invoice?invoiceId=${invoiceId}`);
            const data = await res.json();
            if (res.ok && data.pdfUrl) {
                window.open(data.pdfUrl, '_blank');
            } else {
                alert('No se pudo generar el enlace del PDF: ' + (data.error || 'Error de SDK'));
            }
        } catch (error: any) {
            console.error('Error downloading invoice:', error);
            alert('Error descargando la factura: ' + error.message);
        } finally {
            setDownloadingId(null);
        }
    };

    const isAdmin = userRole === 'ADMIN';

    const ISH_METHODS = ['PAY_WAY_6_ISH', 'PAY_WAY_3_ISH', 'NARANJA_Z_ISH', 'GO_CUOTAS_ISH'];
    const YANI_METHODS = ['PAY_WAY_6_YANI', 'PAY_WAY_3_YANI', 'NARANJA_Z_YANI'];

    const detectBillingAccount = (payments: any[] = []) => {
        if (!payments) return null;
        if (payments.some(p => ISH_METHODS.includes(p.method))) return 'ISH';
        if (payments.some(p => YANI_METHODS.includes(p.method))) return 'YANI';
        return null;
    };

    const pendingRequests = notifications
        .filter(n => n.status === 'PENDING')
        .map(n => {
            const order = orders.find(o => o.id === n.orderId);
            const amountMatch = n.message.match(/\$([0-9.,]+)/);
            let requestedAmount = order?.total || 0;
            if (amountMatch) {
                const amtStr = amountMatch[1].replace(/\./g, '').replace(',', '.');
                requestedAmount = parseFloat(amtStr);
            }

            // Detect account from the notification message prefix [ISH] or [YANI]
            let detectedAccount: 'ISH' | 'YANI' | null = null;
            if (n.message.includes('[ISH]')) detectedAccount = 'ISH';
            else if (n.message.includes('[YANI]')) detectedAccount = 'YANI';
            else if (order) detectedAccount = detectBillingAccount(order.payments) as any;

            return { ...n, order, requestedAmount, detectedAccount };
        })
        .filter(n => !!n.order)
        .filter(n => {
            const search = searchTerm.toLowerCase();
            return n.order.client.name.toLowerCase().includes(search) || 
                   n.order.id.toLowerCase().includes(search);
        });

    const completedInvoices = orders.filter(order => {
        const hasInvoice = order.invoices?.some(inv => inv.status === 'COMPLETED');
        if (!hasInvoice) return false;
        const matchesSearch = order.client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             order.id.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    if (userRole && !isAdmin) {
        return (
            <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-2xl font-black text-stone-800 dark:text-white mb-2">Acceso Restringido</h1>
                <p className="text-stone-400 font-bold max-w-md italic">Solo los administradores pueden gestionar la facturación electrónica.</p>
            </div>
        );
    }

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyStats = completedInvoices.reduce((acc, order) => {
        const completedInvoicesOfOrder = (order.invoices || []).filter(inv => inv.status === 'COMPLETED');
        completedInvoicesOfOrder.forEach(invoice => {
            const invDate = new Date(invoice.createdAt);
            if (invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear) {
                if (invoice.billingAccount === 'ISH') acc.ishCount++;
                if (invoice.billingAccount === 'YANI') acc.yaniCount++;
            }
        });
        return acc;
    }, { ishCount: 0, yaniCount: 0 });

    return (
        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-stone-800 dark:text-white tracking-tighter flex items-center gap-3">
                        <Receipt className="w-10 h-10 text-primary" />
                        Facturación
                    </h1>
                    <p className="text-stone-400 font-bold mt-1 italic uppercase text-[10px] tracking-widest">
                        Gestión de Factura Electrónica (ARCA / AFIP)
                    </p>
                </div>

                <div className="flex flex-col items-end gap-4">
                    <div className="flex bg-stone-100 dark:bg-stone-800 p-1.5 rounded-[2rem] shadow-inner">
                        <button 
                            onClick={() => setActiveTab('pending')}
                            className={`px-8 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-white dark:bg-stone-700 text-blue-600 shadow-md scale-[1.02]' : 'text-stone-400 hover:text-stone-600'}`}
                        >
                            Solicitudes Pendientes ({pendingRequests.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('completed')}
                            className={`px-8 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'completed' ? 'bg-white dark:bg-stone-700 text-emerald-600 shadow-md scale-[1.02]' : 'text-stone-400 hover:text-stone-600'}`}
                        >
                            Facturas Emitidas
                        </button>
                    </div>

                    <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600/70 dark:text-indigo-400/70">
                            Facturas del Mes:
                        </span>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                                YANI: <span className="bg-indigo-100 dark:bg-indigo-800/50 px-2 py-0.5 rounded-lg ml-1">{monthlyStats.yaniCount}</span>
                            </span>
                            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                                ISH: <span className="bg-indigo-100 dark:bg-indigo-800/50 px-2 py-0.5 rounded-lg ml-1">{monthlyStats.ishCount}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex-1 relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-primary transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Buscar por cliente o N° de pedido..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-stone-800 border-none rounded-[2rem] py-5 pl-14 pr-6 text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                    />
                </div>
                <button 
                    onClick={refreshData}
                    className="bg-white dark:bg-stone-800 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-all text-stone-500 hover:text-primary active:scale-95"
                >
                    <Loader2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                    <Loader2 className="w-12 h-12 text-primary/30 animate-spin mb-4" />
                    <p className="text-stone-400 font-bold text-xs uppercase tracking-widest italic">Cargando datos...</p>
                </div>
            ) : activeTab === 'pending' ? (
                <div className="grid grid-cols-1 gap-4">
                    {pendingRequests.length === 0 ? (
                         <div className="bg-white dark:bg-stone-800 rounded-[3rem] p-20 text-center shadow-sm border-2 border-dashed border-stone-100 dark:border-stone-700">
                            <h3 className="text-xl font-black text-stone-800 dark:text-white mb-2">No hay solicitudes pendientes</h3>
                            <p className="text-stone-400 font-bold text-sm italic max-w-sm mx-auto">Las solicitudes aparecen automáticamente cuando se registra un pago con Pay Way o Naranja Z.</p>
                        </div>
                    ) : pendingRequests.map(req => (
                        <div key={req.id} className="bg-white dark:bg-stone-800 rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl hover:translate-x-1 transition-all group border border-transparent hover:border-primary/10">
                            <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-500 shadow-blue-500/20 flex items-center justify-center text-white shadow-lg">
                                        <Receipt size={24} className="group-hover:rotate-12 transition-transform" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-stone-800 dark:text-white flex items-center gap-2 tracking-tight">
                                            <span className="cursor-pointer hover:text-blue-600 hover:underline transition-colors" onClick={(e) => { e.stopPropagation(); router.push(`/contactos?id=${req.order.client.id}`); }}>{req.order.client.name}</span>
                                            <span className="text-[9px] px-2 py-1 rounded-full bg-blue-100 text-blue-600 uppercase tracking-widest">
                                                {req.requestedBy === 'SISTEMA (Auto)' ? 'AUTOMÁTICA' : 'MANUAL'}
                                            </span>
                                        </h3>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1">
                                                <Calendar size={12} /> {format(new Date(req.createdAt), 'dd MMM yyyy', { locale: es })}
                                            </span>
                                            <span className="text-[10px] font-black text-stone-300">•</span>
                                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                                Venta #{req.order.id.slice(-4).toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-stone-400 font-bold italic mt-1">{req.message}</p>
                                    </div>
                                </div>

                                <div className="hidden lg:flex flex-col items-end">
                                    <div className="text-2xl font-black text-blue-600 tracking-tighter">
                                        ${Math.round(req.requestedAmount).toLocaleString('es-AR')}
                                    </div>
                                    <div className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Monto de Comprobante</div>
                                </div>

                                {/* Receipt button */}
                                {req.order.payments?.some((p: any) => p.receiptUrl) && (
                                    <button
                                        onClick={() => {
                                            const receipt = req.order.payments.find((p: any) => p.receiptUrl);
                                            if (receipt?.receiptUrl) setSelectedReceipt(receipt.receiptUrl);
                                        }}
                                        className="hidden lg:flex items-center gap-1.5 text-[9px] font-black text-stone-400 hover:text-blue-600 uppercase tracking-widest bg-stone-50 dark:bg-stone-900 px-3 py-2 rounded-xl transition-all"
                                    >
                                        <ImageIcon size={12} /> Comprobante
                                    </button>
                                )}

                                <button 
                                    onClick={() => setSelectedOrder({ ...req.order, customAmount: req.requestedAmount, notificationId: req.id, detectedAccount: req.detectedAccount } as any)}
                                    className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest italic flex items-center gap-2 hover:bg-primary hover:text-white transition-all active:scale-95 shadow-lg shadow-stone-200 dark:shadow-none"
                                >
                                    FACTURAR <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                     {completedInvoices.length === 0 ? (
                         <div className="bg-white dark:bg-stone-800 rounded-[3rem] p-20 text-center shadow-sm border-2 border-dashed border-stone-100 dark:border-stone-700">
                            <h3 className="text-xl font-black text-stone-800 dark:text-white mb-2">No hay facturas emitidas</h3>
                        </div>
                    ) : completedInvoices.map(order => {
                        const completedArray = (order.invoices || []).filter((i: any) => i.status === 'COMPLETED');
                        return (
                            <div key={order.id} className="bg-white dark:bg-stone-800 rounded-[2.5rem] p-6 shadow-sm border border-emerald-500/10 transition-all group">
                                <div className="flex items-start md:items-center justify-between gap-6 flex-col md:flex-row">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-2xl bg-emerald-500 shadow-emerald-500/20 flex items-center justify-center text-white shadow-lg">
                                            <CheckCircle2 size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-stone-800 dark:text-white tracking-tight cursor-pointer hover:text-blue-600 hover:underline transition-colors" onClick={() => router.push(`/contactos?id=${order.client.id}`)}>{order.client.name}</h3>
                                            <div className="text-[10px] font-bold text-stone-400 mt-1 uppercase tracking-widest">
                                                Ctd. Facturas: {completedArray.length}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                                        {completedArray.map(invoice => (
                                            <div key={invoice.id} className="flex items-center gap-3 bg-stone-50 dark:bg-stone-900 border-2 border-stone-100 dark:border-stone-800 px-4 py-2 rounded-2xl">
                                                <div className="text-right">
                                                    <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest">
                                                        {invoice.billingAccount} — FC {invoice.pointOfSale.toString().padStart(4, '0')}-{invoice.voucherNumber.toString().padStart(8, '0')}
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleDownloadInvoice(invoice.id)}
                                                    disabled={downloadingId === invoice.id}
                                                    className="w-8 h-8 flex justify-center items-center rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50"
                                                    title="Descargar PDF"
                                                >
                                                    {downloadingId === invoice.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} 
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedOrder && (
                <InvoiceModal 
                    order={selectedOrder as any}
                    initialAccount={(selectedOrder as any).detectedAccount || 'ISH'}
                    initialAmount={(selectedOrder as any).customAmount}
                    onClose={() => setSelectedOrder(null)}
                    onSuccess={async () => {
                        if ((selectedOrder as any).notificationId) {
                            await fetch(`/api/notifications`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    id: (selectedOrder as any).notificationId,
                                    status: 'APPROVED'
                                })
                            });
                        }
                        setSelectedOrder(null);
                        refreshData();
                        setActiveTab('completed');
                    }}
                />
            )}

            {/* Receipt Modal */}
            {selectedReceipt && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setSelectedReceipt(null)}>
                    <div className="bg-white dark:bg-stone-900 rounded-[2rem] p-4 max-w-lg w-full relative shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedReceipt(null)} className="absolute top-6 right-6 p-2 bg-stone-100 dark:bg-stone-800 rounded-xl hover:bg-stone-200 transition-colors">
                            <X className="w-5 h-5 text-stone-500" />
                        </button>
                        <h3 className="text-sm font-black uppercase tracking-widest text-stone-400 mb-6 flex items-center gap-2 px-2"><ImageIcon className="w-4 h-4"/> Comprobante de Pago</h3>
                        <div className="rounded-xl overflow-hidden bg-stone-50 dark:bg-stone-800 flex items-center justify-center min-h-[300px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={selectedReceipt} alt="Comprobante" className="max-h-[70vh] object-contain" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
