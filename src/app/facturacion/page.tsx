'use client';

import React, { useState, useEffect } from 'react';
import { 
    Receipt, Search, Filter, Calendar, User, 
    CreditCard, CheckCircle2, AlertCircle, 
    ChevronRight, ArrowRight, Download, Eye,
    Plus, Loader2, X
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
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isSearchingManual, setIsSearchingManual] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        const loadUser = async () => {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setUserRole(data.role);
            }
        };
        loadUser();
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/orders');
            const data = await res.json();
            // All SALE orders that are not deleted
            const sales = (data || []).filter((o: Order) => o.orderType === 'SALE' && !o.isDeleted);
            setOrders(sales);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadInvoice = async (invoiceId: string) => {
        setDownloadingId(invoiceId);
        try {
            const res = await fetch(`/api/billing/invoice?invoiceId=${invoiceId}`);
            if (res.ok) {
                const { pdfUrl } = await res.json();
                if (pdfUrl) {
                    window.open(pdfUrl, '_blank');
                } else {
                    alert('No se pudo generar el enlace del PDF. Intentá de nuevo.');
                }
            }
        } catch (error) {
            console.error('Error downloading invoice:', error);
        } finally {
            setDownloadingId(null);
        }
    };

    const isAdmin = userRole === 'ADMIN';

    // Methods that trigger automatic billing request
    const ISH_METHODS = ['PAY_WAY_6_ISH', 'PAY_WAY_3_ISH', 'NARANJA_Z_ISH', 'GO_CUOTAS_ISH'];
    const YANI_METHODS = ['PAY_WAY_6_YANI', 'PAY_WAY_3_YANI', 'NARANJA_Z_YANI'];
    const AUTO_BILL_METHODS = [...ISH_METHODS, ...YANI_METHODS];

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             order.id.toLowerCase().includes(searchTerm.toLowerCase());
        
        const hasInvoice = order.invoices?.some(inv => inv.status === 'COMPLETED');
        const hasIshYaniPayment = order.payments?.some(p => AUTO_BILL_METHODS.includes(p.method));

        if (activeTab === 'pending') {
            // Pending: auto-flagged orders WITOUT invoice OR manual search matches
            return !hasInvoice && (hasIshYaniPayment || (searchTerm.length > 2 && matchesSearch));
        } else {
            // Completed: orders WITH invoice
            return hasInvoice && matchesSearch;
        }
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

    return (
        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
            {/* Header */}
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

                <div className="flex bg-stone-100 dark:bg-stone-800 p-1.5 rounded-[2rem] shadow-inner">
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={`px-8 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-white dark:bg-stone-700 text-blue-600 shadow-md scale-[1.02]' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                        Solicitudes Pendientes
                    </button>
                    <button 
                        onClick={() => setActiveTab('completed')}
                        className={`px-8 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'completed' ? 'bg-white dark:bg-stone-700 text-emerald-600 shadow-md scale-[1.02]' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                        Facturas Emitidas
                    </button>
                </div>
            </div>

            {/* Top Bar with search */}
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
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-5 top-1/2 -translate-y-1/2 p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors font-black">
                            <X size={16} />
                        </button>
                    )}
                </div>
                <button 
                    onClick={fetchOrders}
                    className="bg-white dark:bg-stone-800 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-all text-stone-500 hover:text-primary active:scale-95"
                >
                    <Loader2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Orders List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                    <Loader2 className="w-12 h-12 text-primary/30 animate-spin mb-4" />
                    <p className="text-stone-400 font-bold text-xs uppercase tracking-widest italic">Cargando pedidos...</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-white dark:bg-stone-800 rounded-[3rem] p-20 text-center shadow-sm border-2 border-dashed border-stone-100 dark:border-stone-700">
                    <div className="w-24 h-24 bg-stone-50 dark:bg-stone-900/50 rounded-full flex items-center justify-center mx-auto mb-8">
                        <Filter className="w-10 h-10 text-stone-200" />
                    </div>
                    <h3 className="text-xl font-black text-stone-800 dark:text-white mb-2">No se encontraron {activeTab === 'pending' ? 'solicitudes pendientes' : 'facturas emitidas'}</h3>
                    <p className="text-stone-400 font-bold text-sm italic max-w-sm mx-auto">
                        {activeTab === 'pending' 
                            ? "Probá buscando manualmente por nombre de cliente si el pedido no se autodetectó."
                            : "Podés buscar facturas emitidas por nombre o nro de comprobante."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredOrders.map(order => {
                        const accountRecommendation = detectBillingAccount(order.payments);
                        const hasIsh = order.payments?.some(p => ISH_METHODS.includes(p.method));
                        const hasYani = order.payments?.some(p => YANI_METHODS.includes(p.method));
                        const isBilled = order.invoices?.some(inv => inv.status === 'COMPLETED');
                        const invoice = order.invoices?.find(inv => inv.status === 'COMPLETED');

                        return (
                            <div key={order.id} className="bg-white dark:bg-stone-800 rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl hover:translate-x-1 transition-all group border border-transparent hover:border-primary/10">
                                <div className="flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${isBilled ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-blue-500 shadow-blue-500/20'}`}>
                                            <Receipt size={24} className="group-hover:rotate-12 transition-transform" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-stone-800 dark:text-white flex items-center gap-2 tracking-tight">
                                                {order.client.name}
                                                {!isBilled && (
                                                    <span className={`text-[9px] px-2 py-1 rounded-full text-white uppercase tracking-widest ${accountRecommendation === 'ISH' ? 'bg-blue-500' : accountRecommendation === 'YANI' ? 'bg-indigo-500' : 'bg-stone-400'}`}>
                                                        {accountRecommendation || 'ELECCIÓN MANUAL'}
                                                    </span>
                                                )}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1">
                                                    <Calendar size={12} /> {format(new Date(order.createdAt), 'dd MMM yyyy', { locale: es })}
                                                </span>
                                                <span className="text-[10px] font-black text-stone-300">•</span>
                                                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                                    ID: #{order.id.slice(-6).toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="hidden lg:flex flex-col items-end">
                                        <div className="text-2xl font-black text-stone-800 dark:text-white tracking-tighter">
                                            ${order.total.toLocaleString('es-AR')}
                                        </div>
                                        <div className="flex gap-2 mt-1">
                                            {order.payments?.map(p => (
                                                <span key={p.id} className="text-[8px] font-black text-stone-400 bg-stone-100 dark:bg-stone-700 px-2 py-0.5 rounded-md uppercase">
                                                    {p.method.replace(/_ISH|_YANI/g, '').replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {isBilled ? (
                                            <div className="flex flex-col items-end">
                                                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                    <CheckCircle2 size={12} /> FC {invoice?.pointOfSale.toString().padStart(4, '0')}-{invoice?.voucherNumber.toString().padStart(8, '0')}
                                                </div>
                                                <button 
                                                    onClick={() => invoice && handleDownloadInvoice(invoice.id)}
                                                    disabled={downloadingId === invoice?.id}
                                                    className="text-[9px] font-black text-stone-400 hover:text-primary uppercase tracking-widest flex items-center gap-1 bg-stone-50 dark:bg-stone-900 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                                                >
                                                    {downloadingId === invoice?.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} 
                                                    Ver Factura
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setSelectedOrder(order)}
                                                className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest italic flex items-center gap-2 hover:bg-primary hover:text-white dark:hover:bg-primary transition-all active:scale-95 shadow-lg shadow-stone-200 dark:shadow-none"
                                            >
                                                FACTURAR <ArrowRight size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Invoicing Modal */}
            {selectedOrder && (
                <InvoiceModal 
                    order={selectedOrder}
                    initialAccount={detectBillingAccount(selectedOrder.payments) || 'ISH'}
                    onClose={() => setSelectedOrder(null)}
                    onSuccess={() => {
                        setSelectedOrder(null);
                        fetchOrders();
                        setActiveTab('completed');
                    }}
                />
            )}
        </div>
    );
}
