'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Download, Search, Package, Clock, CheckCircle2, Truck, Eye, Pencil, Save, X, AlertTriangle, MessageCircle, FileText, Banknote, ArrowRightLeft, CreditCard, ChevronRight, ExternalLink, Clipboard, CheckCheck, Copy, Loader2, ArrowRight, FlaskConical, Calendar } from 'lucide-react';
import { PricingService } from '@/services/PricingService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import InvoiceModal from '@/components/InvoiceModal';
import { generateInvoicePDF } from '@/lib/invoice-generator';

interface OrderItem {
    id: string;
    productId: string;
    quantity: number;
    price: number;
    product: {
        id: string;
        name: string;
        price: number;
        brand: string | null;
        model: string | null;
        category: string;
        type: string | null;
        laboratory?: string | null;
    } | null;
    sphereVal?: number | null;
    cylinderVal?: number | null;
    axisVal?: number | null;
    additionVal?: number | null;
    eye?: string | null;
    pdVal?: number | null;
    heightVal?: number | null;
    prismVal?: string | null;
}

interface Prescription {
    id: string;
    sphereOD?: number | null;
    cylinderOD?: number | null;
    axisOD?: number | null;
    sphereOI?: number | null;
    cylinderOI?: number | null;
    axisOI?: number | null;
    addition?: number | null;
    additionOD?: number | null;
    additionOI?: number | null;
    pd?: number | null;
    distanceOD?: number | null;
    distanceOI?: number | null;
    heightOD?: number | null;
    heightOI?: number | null;
    notes?: string | null;
    imageUrl?: string | null;
    prescriptionType?: string | null;
    nearSphereOD?: number | null;
    nearSphereOI?: number | null;
    nearCylinderOD?: number | null;
    nearAxisOD?: number | null;
    nearCylinderOI?: number | null;
    nearAxisOI?: number | null;
    prismOD?: string | null;
    prismOI?: string | null;
}

interface Order {
    id: string;
    clientId: string;
    status: string;
    total: number;
    paid: number;
    discount?: number;
    orderType?: string;
    labStatus?: string;
    labSentAt?: string;
    labNotes?: string;
    labOrderNumber?: string;
    frameSource?: string | null;
    userFrameBrand?: string | null;
    userFrameModel?: string | null;
    userFrameNotes?: string | null;
    frameA?: string | null;
    frameB?: string | null;
    frameDbl?: string | null;
    frameEdc?: string | null;
    createdAt: string;
    isDeleted?: boolean;
    deletedReason?: string;
    markup?: number;
    discountCash?: number;
    discountTransfer?: number;
    discountCard?: number;
    subtotalWithMarkup?: number;
    labColor?: string | null;
    labTreatment?: string | null;
    labDiameter?: string | null;
    labPdOd?: string | null;
    labPdOi?: string | null;
    prescriptionId?: string | null;
    prescription?: Prescription | null;
    client: {
        id: string;
        name: string;
        phone?: string;
        email?: string;
        dni?: string | null;
    };
    items: OrderItem[];
    payments: any[];
    invoices?: { id: string; cae: string; caeExpiration: string; voucherNumber: number; pointOfSale: number; status: string }[];
}

const LAB_STATUS: Record<string, { key: string, label: string; color: string; icon: any; bg: string; text: string; ring: string }> = {
    'NONE': { key: 'NONE', label: 'Sin enviar', color: 'bg-stone-100 text-stone-500', bg: 'bg-stone-100 dark:bg-stone-800', text: 'text-stone-500 dark:text-stone-400', ring: 'ring-stone-200 dark:ring-stone-700', icon: Clock },
    'SENT': { key: 'SENT', label: 'Enviado', color: 'bg-blue-100 text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-800', icon: Package },
    'IN_PROGRESS': { key: 'IN_PROGRESS', label: 'En Proceso', color: 'bg-amber-100 text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-800', icon: Clock },
    'READY': { key: 'READY', label: 'Listo p/ Retirar', color: 'bg-emerald-100 text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-800', icon: CheckCircle2 },
    'DELIVERED': { key: 'DELIVERED', label: 'Entregado', color: 'bg-indigo-100 text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950', text: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-200 dark:ring-indigo-800', icon: Truck },
};

const LAB_STEPS = Object.values(LAB_STATUS);

function getNextStatus(current: string): string | null {
    const idx = LAB_STEPS.findIndex(s => s.key === current);
    if (idx < 0 || idx >= LAB_STEPS.length - 1) return null;
    return LAB_STEPS[idx + 1].key;
}

export default function VentasPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [search, setSearch] = useState('');
    const [filterLab, setFilterLab] = useState<string>('ALL');
    const [filterLaboratory, setFilterLaboratory] = useState<string>('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [editingOrderNumber, setEditingOrderNumber] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [userRole, setUserRole] = useState('STAFF');
    const [loading, setLoading] = useState(true);
    const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
    const [expandedDetail, setExpandedDetail] = useState<string | null>(null);

    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchOrders();
        // Get user role from localStorage or fallback to API
        const loadUserRole = async () => {
            try {
                const stored = localStorage.getItem('user');
                if (stored) {
                    const u = JSON.parse(stored);
                    setUserRole(u.role || 'STAFF');
                    return;
                }
            } catch { }
            // Fallback: fetch from API if localStorage is empty
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const u = await res.json();
                    setUserRole(u.role || 'STAFF');
                    localStorage.setItem('user', JSON.stringify(u));
                }
            } catch { }
        };
        loadUserRole();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/orders?paginate=true&limit=100');
            const data = await res.json();
            
            if (data.error) {
                setError(data.error);
                setOrders([]);
            } else {
                // The API now returns { orders, pagination } if ?paginate=true
                const allOrders = data.orders || [];
                // Only show SALE orders (not QUOTE)
                const sales = allOrders.filter((o: Order) => o.orderType === 'SALE' && !o.isDeleted);
                setOrders(sales);
            }
        } catch (err: any) {
            console.error('Error fetching orders:', err);
            setError('Error al conectar con el servidor. Por favor, reintente.');
        } finally {
            setLoading(false);
        }
    };

    const isAdmin = userRole === 'ADMIN';

    // Extract unique laboratories from lens items
    const uniqueLaboratories = Array.from(
        new Set(
            orders.flatMap(o =>
                o.items
                    .filter(i => i.product?.category === 'LENS' && (i.product as any)?.laboratory)
                    .map(i => (i.product as any).laboratory as string)
            )
        )
    ).sort();

    const filteredOrders = orders.filter(o => {
        const matchSearch = search === '' ||
            o.client.name.toLowerCase().includes(search.toLowerCase()) ||
            o.id.toLowerCase().includes(search.toLowerCase()) ||
            (o.labOrderNumber || '').toLowerCase().includes(search.toLowerCase());
        const matchLab = filterLab === 'ALL' || (o.labStatus || 'NONE') === filterLab;
        const matchLaboratory = filterLaboratory === 'ALL' || o.items.some(i => i.product?.category === 'LENS' && (i.product as any)?.laboratory === filterLaboratory);
        const matchDate = (!dateFrom || new Date(o.createdAt) >= new Date(dateFrom)) && (!dateTo || new Date(o.createdAt) <= new Date(dateTo + 'T23:59:59'));
        return matchSearch && matchLab && matchLaboratory && matchDate;
    });

    const saveLabOrderNumber = async (orderId: string) => {
        await fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labOrderNumber: editValue }),
        });
        setEditingOrderNumber(null);
        fetchOrders();
    };

    const handleDeleteRequest = async (orderId: string) => {
        if (isAdmin) {
            if (confirm('¿Eliminar esta venta definitivamente?')) {
                await fetch(`/api/orders/${orderId}?reason=Eliminado por admin`, { method: 'DELETE' });
                fetchOrders();
            }
        } else {
            const order = orders.find(o => o.id === orderId);
            const reason = prompt('Motivo de la solicitud de eliminación:');
            if (!reason) return;
            try {
                const res = await fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'DELETE_REQUEST',
                        message: `Eliminar venta #${orderId.slice(-4).toUpperCase()} de ${order?.client?.name || 'cliente'}. Motivo: ${reason}`,
                        orderId,
                    }),
                });
                if (res.ok) {
                    alert('✅ Solicitud de eliminación enviada al administrador.');
                } else {
                    alert('Error al enviar la solicitud.');
                }
            } catch {
                alert('Error de conexión.');
            }
        }
    };

    const handleInvoiceRequest = async (order: Order) => {
        const financials = PricingService.calculateOrderFinancials(order);
        const maxInvoiceable = financials.paidReal;

        if (maxInvoiceable <= 0) {
            return alert('No hay pagos registrados para esta venta. No se puede solicitar factura.');
        }

        if (isAdmin) {
            setInvoiceOrder({ ...order, customAmount: maxInvoiceable } as any);
        } else {
            const amountStr = prompt(
                `Monto a facturar para ${order.client.name}:\n(Pago total registrado hasta hoy: $${maxInvoiceable.toLocaleString('es-AR')})`, 
                maxInvoiceable.toString()
            );
            
            if (!amountStr) return;
            
            const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
            
            if (isNaN(amount)) return alert('Monto inválido');
            if (amount > maxInvoiceable) {
                return alert(`Error: No podés facturar más de lo que el cliente pagó ($${maxInvoiceable.toLocaleString('es-AR')}).`);
            }

            try {
                const res = await fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'INVOICE_REQUEST',
                        message: `Solicitar factura de $${amount.toLocaleString('es-AR')} (Pago total del cliente: $${maxInvoiceable.toLocaleString('es-AR')}) para venta #${order.id.slice(-4).toUpperCase()} (${order.client.name})`,
                        orderId: order.id,
                    }),
                });
                if (res.ok) {
                    alert('✅ Solicitud de factura enviada al administrador.');
                } else {
                    alert('Error al enviar la solicitud.');
                }
            } catch {
                alert('Error de conexión.');
            }
        }
    };

    const advanceStatus = async (orderId: string, currentStatus: string) => {
        const next = getNextStatus(currentStatus || 'NONE');
        if (!next) return;
        setUpdatingId(orderId);
        try {
            await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ labStatus: next }),
            });
            await fetchOrders();
        } catch (error) {
            console.error('Error advancing status:', error);
        }
        setUpdatingId(null);
    };

    const downloadLabSheet = (order: Order) => {
        const items = order.items || [];
        const dateStr = format(new Date(order.createdAt), "d 'de' MMMM yyyy", { locale: es });
        const labDate = order.labSentAt ? format(new Date(order.labSentAt), "d/MM/yyyy HH:mm", { locale: es }) : 'Pendiente';
        const financials = PricingService.calculateOrderFinancials(order);
        const logoUrl = `https://crm-atelier-production-ae72.up.railway.app/assets/logo-atelier-optica.png`;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido Lab - ${order.client.name} | Atelier</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter','Segoe UI',sans-serif; }
  body { padding: 40px 50px; color: #1c1917; font-size: 13px; line-height:1.4; background: white; }
  .letterhead { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; border-bottom:2px solid #1c1917; margin-bottom: 8px; }
  .letterhead-logo { height:58px; }
  .letterhead-right { text-align:right; font-size:10px; color:#78716c; font-weight: 500; }
  .address-bold { font-weight:800; color:#1c1917; text-transform: uppercase; letter-spacing: 1px; }
  .tagline { text-align:center; font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:2.5px; color:#a0845e; padding:14px 0; border-bottom: 1px solid #f5f5f4; margin-bottom: 10px; }
  .doc-header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:20px; }
  .doc-title { font-size:22px; font-weight:900; text-transform:uppercase; color:#1c1917; letter-spacing: 2px; }
  .doc-meta { font-size:11px; color:#a8a29e; font-weight: 800; }
  .info-grid { display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px; }
  .info-box { border:1.5px solid #e7e5e4; border-radius:14px; padding:14px; background: #fffcf9; }
  .info-box h3 { font-size:9px; font-weight:900; text-transform:uppercase; color:#a8a29e; border-bottom: 1px solid #e7e5e4; padding-bottom: 6px; margin-bottom: 8px; }
  .info-row { display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px; }
  .info-label { color:#78716c; font-weight: 600; }
  .info-value { font-weight:800; color:#1c1917; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; border-radius: 12px; overflow: hidden; border: 1.5px solid #e7e5e4; }
  th { background:#1c1917; color:white; padding:12px 14px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:1px; }
  td { padding:12px 14px; border-bottom:1px solid #f5f5f4; font-size:12px; }
  tr:nth-child(even) { background:#fffcf9; }
  .financial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
  .financial-card { border-radius: 18px; padding: 18px; border: 1.5px solid #e7e5e4; text-align: center; }
  .f-title { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; display: block; color: #a8a29e; }
  .f-amount { font-size: 18px; font-weight: 900; color: #1c1917; display: block; margin-bottom: 4px; }
  .f-saldo { font-size: 11px; font-weight: 900; color: #10b981; background: #f0fdf4; padding: 4px 10px; border-radius: 8px; display: inline-block; }
  .totals-summary { margin-top: 25px; padding: 25px; border-radius: 20px; background: #1c1917; color: white; display: flex; justify-content: space-between; align-items: center; }
  .tot-col { text-align: center; padding: 0 15px; border-right: 1px solid rgba(255,255,255,0.1); }
  .tot-col:last-of-type { border-right: none; }
  .tot-val { font-size: 18px; font-weight: 900; display: block; }
  .tot-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #a8a29e; display: block; margin-bottom: 4px; }
  .tot-paid { text-align: right; border-left: 2px solid rgba(255,255,255,0.2); padding-left: 25px; margin-left: 10px; }
  .paid-value { font-size: 24px; font-weight: 900; color: #fbbf24; }
  .footer { margin-top: 40px; text-align: center; border-top: 2px solid #e7e5e4; padding-top: 20px; font-size: 9px; color: #a8a29e; text-transform: uppercase; letter-spacing: 3px; font-weight: 900; }
  .print-btn { position: fixed; top: 20px; right: 20px; padding: 14px 28px; background: #1c1917; color: white; border: none; border-radius: 14px; font-weight: 900; cursor: pointer; z-index: 1000; }
</style></head><body>
<button class="print-btn" onclick="window.print()">IMPRIMIR PDF</button>
<div class='letterhead'>
    <img src='${logoUrl}' class='letterhead-logo' alt='Atelier Óptica' />
    <div class='letterhead-right'>
        <div class='address-bold'>José Luis de Tejeda 4380 · Córdoba</div>
        <div>Fecha: ${dateStr}</div>
    </div>
</div>
<div class='tagline'>La óptica mejor calificada de Córdoba ⭐ 5/5 Google Business</div>
<div class='doc-header'>
    <div>
        <div class='doc-title'>Pedido de Laboratorio <span style="background:#1c1917; color:white; padding:2px 8px; border-radius:4px; font-size:7px; margin-left:10px; vertical-align:middle;">V2.0</span></div>
        <div class='doc-meta'>#${order.id.slice(-6).toUpperCase()} · ${labDate}</div>
    </div>
</div>
<div class='info-grid'>
    <div class='info-box'>
        <h3>👤 Datos del Cliente</h3>
        <div class='info-row'><span class='info-label'>Nombre</span><span class='info-value'>${order.client.name}</span></div>
        <div class='info-row'><span class='info-label'>Teléfono</span><span class='info-value'>${order.client.phone || 'No registrado'}</span></div>
    </div>
    <div class='info-box'>
        <h3>🔬 Info Cristales</h3>
        <div class='info-row'><span class='info-label'>Tratamiento</span><span class='info-value'>${order.labTreatment || 'Normal'}</span></div>
        <div class='info-row'><span class='info-label'>Color</span><span class='info-value'>${order.labColor || 'Blanco'}</span></div>
    </div>
</div>

<table>
    <thead><tr><th>Producto</th><th>Tipo</th><th style='text-align:center'>Cant.</th><th style='text-align:right'>Precio</th><th style='text-align:right'>Subtotal</th></tr></thead>
    <tbody>${items.map(it => `<tr><td>${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''}</td><td>${it.product?.type || it.product?.category || ''}</td><td style='text-align:center'>${it.quantity}</td><td style='text-align:right'>$${it.price?.toLocaleString()}</td><td style='text-align:right'>$${(it.price * it.quantity).toLocaleString()}</td></tr>`).join('')}</tbody>
</table>

<div class='financial-grid'>
    <div class='financial-card'>
        <span class='f-title'>💵 Saldo Efectivo</span>
        <span class='f-amount'>$${financials.remainingCash.toLocaleString()}</span>
        ${!financials.hasBalance ? '<span class="f-saldo">PAGADO</span>' : ''}
    </div>
    <div class='financial-card'>
        <span class='f-title'>🏦 Saldo Transferencia</span>
        <span class='f-amount'>$${financials.remainingTransfer.toLocaleString()}</span>
        ${!financials.hasBalance ? '<span class="f-saldo">PAGADO</span>' : ''}
    </div>
    <div class='financial-card'>
        <span class='f-title'>💳 Saldo Tarjeta</span>
        <span class='f-amount'>$${financials.remainingCard.toLocaleString()}</span>
        ${!financials.hasBalance ? '<span class="f-saldo">PAGADO</span>' : ''}
    </div>
</div>

<div class='totals-summary'>
    <div class='tot-col'>
        <span class='tot-label'>💵 Efectivo</span>
        <span class='tot-val'>$${financials.totalCash.toLocaleString()}</span>
    </div>
    <div class='tot-col'>
        <span class='tot-label'>🏦 Transf</span>
        <span class='tot-val'>$${financials.totalTransfer.toLocaleString()}</span>
    </div>
    <div class='tot-col'>
        <span class='tot-label'>💳 Tarjeta</span>
        <span class='tot-val'>$${financials.totalCard.toLocaleString()}</span>
    </div>
    <div class='tot-paid'>
        <span class='tot-label'>Abonado Real</span>
        <span class='paid-value'>$${financials.paidReal.toLocaleString()}</span>
    </div>
</div>

<div class='footer'>Atelier Óptica · José Luis de Tejeda 4380, Córdoba · Profesionalismo y Diseño</div>
</body></html>`;

        const printWindow = window.open('', '_blank', 'width=800,height=1000');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 400);
        }
    };

    const stats = {
        total: orders.length,
        sent: orders.filter(o => o.labStatus === 'SENT').length,
        inProgress: orders.filter(o => o.labStatus === 'IN_PROGRESS').length,
        ready: orders.filter(o => o.labStatus === 'READY').length,
        delivered: orders.filter(o => o.labStatus === 'DELIVERED').length,
        revenue: orders.reduce((s, o) => s + (o.total || 0), 0),
    };

    return (
        <main className="p-4 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-3">
                        <ShoppingCart className="w-8 h-8 lg:w-9 lg:h-9 text-emerald-500" /> Ventas
                    </h1>
                    <p className="text-stone-400 text-xs lg:text-sm mt-1">Operaciones confirmadas y enviadas a laboratorio</p>
                </div>
                {isAdmin && (
                    <div className="text-left md:text-right w-full md:w-auto p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl md:bg-transparent md:p-0">
                        <p className="text-2xl lg:text-3xl font-black text-emerald-500">${stats.revenue.toLocaleString()}</p>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Facturación total</p>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                {[
                    { label: 'Total Ventas', value: stats.total, color: 'bg-stone-900 text-white' },
                    { label: 'Enviadas', value: stats.sent, color: 'bg-blue-100 text-blue-600' },
                    { label: 'En Proceso', value: stats.inProgress, color: 'bg-amber-100 text-amber-600' },
                    { label: 'Listas', value: stats.ready, color: 'bg-emerald-100 text-emerald-600' },
                    { label: 'Entregadas', value: stats.delivered, color: 'bg-indigo-100 text-indigo-600' },
                ].map(s => (
                    <div key={s.label} className={`${s.color} rounded-2xl p-5 text-center`}>
                        <p className="text-3xl font-black">{s.value}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-70">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="space-y-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Buscar por cliente, N° venta o N° operación lab..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
                        {['ALL', 'SENT', 'IN_PROGRESS', 'READY', 'DELIVERED'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilterLab(f)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filterLab === f ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:bg-stone-200'}`}
                            >
                                {f === 'ALL' ? 'Todas' : LAB_STATUS[f]?.label || f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Laboratory & Date Filters */}
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Lab filter dropdown */}
                    <div className="flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-stone-400" />
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Lab:</span>
                        <select
                            value={filterLaboratory}
                            onChange={e => setFilterLaboratory(e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-700 dark:text-stone-300 outline-none focus:border-emerald-500 transition-all cursor-pointer"
                        >
                            <option value="ALL">Todos los laboratorios</option>
                            {uniqueLaboratories.map(lab => (
                                <option key={lab} value={lab}>{lab}</option>
                            ))}
                        </select>
                    </div>

                    <div className="h-6 w-px bg-stone-200 dark:bg-stone-600" />

                    {/* Date filters */}
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-stone-400" />
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Desde:</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="px-3 py-2 border-2 border-stone-100 dark:border-stone-600 rounded-xl text-xs font-bold bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none focus:border-emerald-500"
                        />
                        <span className="text-stone-400 text-xs font-bold">a</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="px-3 py-2 border-2 border-stone-100 dark:border-stone-600 rounded-xl text-xs font-bold bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none focus:border-emerald-500"
                        />
                        {(dateFrom || dateTo) && (
                            <button
                                onClick={() => { setDateFrom(''); setDateTo(''); }}
                                className="p-2 bg-stone-100 dark:bg-stone-800 text-stone-400 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-all hover:scale-105"
                                title="Limpiar fechas"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Orders Grid */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="w-10 h-10 border-4 border-stone-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm font-bold text-stone-400">Cargando ventas...</p>
                </div>
            ) : error ? (
                <div className="text-center py-20 border-2 border-dashed border-red-200 dark:border-red-900/30 rounded-3xl bg-red-50/30 dark:bg-red-900/10">
                    <AlertTriangle className="w-16 h-16 text-red-300 mx-auto mb-4" />
                    <p className="text-sm font-black text-red-400 uppercase tracking-widest">Error al cargar datos</p>
                    <p className="text-xs text-red-400 mt-2">{error}</p>
                    <button 
                        onClick={() => fetchOrders()}
                        className="mt-6 px-6 py-2 bg-stone-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all"
                    >
                        REINTENTAR
                    </button>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-3xl">
                    <ShoppingCart className="w-16 h-16 text-stone-200 mx-auto mb-4" />
                    <p className="text-sm font-black text-stone-300 uppercase tracking-widest">No hay ventas {filterLab !== 'ALL' ? 'con ese estado' : ''}</p>
                    <p className="text-xs text-stone-300 mt-2">Las ventas se crean al convertir un presupuesto en la ficha del contacto</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map(order => {
                        const labInfo = LAB_STATUS[order.labStatus || 'NONE'] || LAB_STATUS['NONE'];
                        const nextStep = getNextStatus(order.labStatus || 'NONE');
                        const nextStepInfo = nextStep ? LAB_STATUS[nextStep] : null;
                        const LabIcon = labInfo.icon;
                        const isUpdating = updatingId === order.id;
                        const financials = PricingService.calculateOrderFinancials(order);

                        return (
                            <div key={order.id} className={`border-2 rounded-2xl p-4 lg:p-6 hover:shadow-lg transition-all ${financials.hasBalance
                                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                                    : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700'
                                }`}>
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                                    {/* Lab Status Icon & Basic Info (Combined on Mobile) */}
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-2xl ${labInfo.color} flex items-center justify-center flex-shrink-0 ${isUpdating ? 'animate-pulse' : ''}`}>
                                            <LabIcon className="w-5 h-5 lg:w-6 lg:h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base lg:text-lg font-black text-stone-800 dark:text-white truncate">{order.client.name}</h3>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                <span className={`px-2 py-0.5 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-widest ${labInfo.color}`}>
                                                    {labInfo.label}
                                                </span>
                                                {financials.progress >= 100 && (
                                                    <span className="px-2 py-0.5 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600">PAGADO</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Total on Mobile Header */}
                                        <div className="lg:hidden text-right">
                                            <p className="text-lg font-black text-stone-800 dark:text-white">${(order.total || 0).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Payment Detail (Triple Saldo) */}
                                    <div className="flex flex-col gap-1.5 lg:border-l-2 lg:border-stone-100 lg:dark:border-stone-700 lg:pl-4 py-0.5">
                                        <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Saldo Pendiente</span>
                                        <div className="flex flex-wrap gap-2">
                                            {!financials.hasBalance ? (
                                                <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">
                                                    PAGADO
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex flex-col rounded-lg bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                                                        <span className="text-[7px] lg:text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Banknote className="w-3 h-3" /> Efvo</span>
                                                        <span className="text-[9px] lg:text-[10px] font-black mt-0.5">$${financials.remainingCash.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex flex-col rounded-lg bg-violet-50 dark:bg-violet-900/10 px-2 py-1 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30">
                                                        <span className="text-[7px] lg:text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> Transf</span>
                                                        <span className="text-[9px] lg:text-[10px] font-black mt-0.5">$${financials.remainingTransfer.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex flex-col rounded-lg bg-orange-50 dark:bg-orange-900/10 px-2 py-1 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30">
                                                        <span className="text-[7px] lg:text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><CreditCard className="w-3 h-3" /> Cuotas</span>
                                                        <span className="text-[9px] lg:text-[10px] font-black mt-0.5">$${financials.remainingCard.toLocaleString()}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Info Badges */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] lg:text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                        <span>Venta #{order.id.slice(-4).toUpperCase()}</span>
                                        <span>·</span>
                                        <span>{format(new Date(order.createdAt), "d MMM yyyy", { locale: es })}</span>
                                        <span>·</span>
                                        <span>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                                        {order.labSentAt && (
                                            <>
                                                <span className="hidden sm:inline">·</span>
                                                <span className="w-full sm:w-auto mt-1 sm:mt-0">Enviado: {format(new Date(order.labSentAt), "d/MM HH:mm", { locale: es })}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Lab Order Number & Actions */}
                                <div className="flex flex-col lg:flex-row items-center gap-4 mt-4 pt-4 border-t border-stone-100 dark:border-stone-700">
                                    <div className="w-full lg:w-72">
                                        {editingOrderNumber === order.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    placeholder="N° operación"
                                                    className="w-full px-3 py-2 border-2 border-emerald-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
                                                    autoFocus
                                                />
                                                <button onClick={() => saveLabOrderNumber(order.id)} className="p-2 bg-emerald-500 text-white rounded-xl hover:scale-105 transition-all">
                                                    <Save className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setEditingOrderNumber(null)} className="p-2 bg-stone-200 text-stone-500 rounded-xl hover:scale-105 transition-all">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditingOrderNumber(order.id); setEditValue(order.labOrderNumber || ''); }}
                                                className="w-full text-left px-3 py-2 bg-stone-50 dark:bg-stone-700 border-2 border-dashed border-stone-200 dark:border-stone-600 rounded-xl hover:border-emerald-300 transition-all group"
                                            >
                                                {order.labOrderNumber ? (
                                                    <div>
                                                        <span className="text-[8px] lg:text-[9px] font-black text-stone-400 uppercase tracking-widest block">N° Op. Lab</span>
                                                        <span className="text-xs lg:text-sm font-black text-stone-800 dark:text-white">{order.labOrderNumber}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-stone-400 group-hover:text-emerald-500">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest">Agregar N° Op.</span>
                                                    </div>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Total on Desktop */}
                                    <div className="hidden lg:block flex-shrink-0 text-right">
                                        <p className="text-xl font-black text-stone-800 dark:text-white">${(order.total || 0).toLocaleString()}</p>
                                        <div className="w-24 h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full mt-2 overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${financials.progress}%` }} />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 lg:flex-shrink-0 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 no-scrollbar">
                                        {/* Advance Status Button */}
                                        {nextStepInfo && (
                                            <button
                                                onClick={() => advanceStatus(order.id, order.labStatus || 'NONE')}
                                                disabled={isUpdating}
                                                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-sm ${nextStepInfo.key === 'SENT'
                                                    ? 'bg-blue-500 text-white shadow-blue-500/20 hover:shadow-blue-500/30'
                                                    : nextStepInfo.key === 'IN_PROGRESS'
                                                        ? 'bg-amber-500 text-white shadow-amber-500/20'
                                                        : nextStepInfo.key === 'READY'
                                                            ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                                            : 'bg-indigo-500 text-white shadow-indigo-500/20'
                                                    }`}
                                            >
                                                {isUpdating ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                )}
                                                {nextStepInfo.label}
                                            </button>
                                        )}


                                        {/* Invoice badge or button */}
                                        {(() => {
                                            const completedInvoices = (order.invoices || []).filter((i: any) => i.status === 'COMPLETED');
                                            const totalInvoiced = completedInvoices.reduce((acc: number, curr: any) => acc + curr.totalAmount, 0);
                                            
                                            const renderNodes: React.ReactNode[] = [];

                                            completedInvoices.forEach((inv: any) => {
                                                renderNodes.push(
                                                    <button 
                                                        key={`inv-${inv.id}`}
                                                        onClick={async () => {
                                                            try {
                                                                const res = await fetch(`/api/billing/invoice/${inv.id}/pdf-data`);
                                                                if (!res.ok) {
                                                                    const errorData = await res.json();
                                                                    throw new Error(errorData.error || 'Error desconocido');
                                                                }
                                                                const data = await res.json();
                                                                await generateInvoicePDF(data);
                                                            } catch (e: any) {
                                                                alert('Error abriendo el PDF: ' + e.message);
                                                            }
                                                        }}
                                                        className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all text-left flex items-center gap-2" 
                                                        title={`Ver PDF de Factura\nCAE: ${inv.cae}\nVto: ${inv.caeExpiration}`}
                                                    >
                                                        <div>
                                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">Factura C</span>
                                                            <span className="text-xs font-black text-indigo-600">
                                                                {inv.pointOfSale?.toString().padStart(4, '0')}-{inv.voucherNumber?.toString().padStart(8, '0')}
                                                            </span>
                                                        </div>
                                                        <ExternalLink className="w-4 h-4 text-indigo-400" />
                                                    </button>
                                                );
                                            });

                                            // Only render "Solicitar Factura" if there is remaining un-invoiced paid balance
                                            if (financials.paidReal > totalInvoiced) {
                                                renderNodes.push(
                                                    <button
                                                        key={`req-${order.id}`}
                                                        onClick={() => handleInvoiceRequest(order)}
                                                        className={`p-3 rounded-xl hover:scale-110 transition-all ${isAdmin ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 hover:bg-indigo-100' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-500 hover:bg-amber-100'}`}
                                                        title={isAdmin ? 'Emitir Factura C' : 'Solicitar Factura'}
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                );
                                            }

                                            return <>{renderNodes}</>;
                                        })()}
                                        {/* WhatsApp notify */}
                                        {order.client.phone && (order.labStatus === 'READY' || financials.hasBalance) && (
                                            <button
                                                onClick={() => {
                                                    let msg = `*Hola ${order.client.name}*\n\n`;
                                                    msg += `Te avisamos que *tu pedido ya está listo para retirar* en *Atelier Óptica*\n\n`;
                                                    if (financials.hasBalance) {
                                                        msg += `*Detalle del saldo:*\n`;
                                                        msg += `• *Saldo con TARJETA / CUOTAS: $${financials.remainingCard.toLocaleString()}*\n`;
                                                        msg += `• *Saldo con TRANSFERENCIA: $${financials.remainingTransfer.toLocaleString()}*\n`;
                                                        msg += `• *Saldo si pagás en EFECTIVO: $${financials.remainingCash.toLocaleString()}*\n`;
                                                        msg += `\nPodés abonar con cualquier medio de pago.\n`;
                                                        msg += `*¿Nos podrías avisar cómo quisieras abonar el saldo?*\n\n`;
                                                    } else {
                                                        msg += `Tu pedido está *completamente pago*.\n\n`;
                                                    }
                                                    msg += `*Dirección:* José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n`;
                                                    msg += `*Ubicación:* https://share.google/j2ZT7ReboDLt7onCp\n`;
                                                    msg += `*Horarios:*\n   • Lunes a viernes de 9:00 a 13:30 y de 16:00 a 19:30\n   • Sábados de 10:00 a 14:00 hs\n\n`;
                                                    msg += `¡Te esperamos! Muchas gracias.\n`;
                                                    msg += `\n_La óptica mejor calificada en Google Business 5/5_`;
                                                    const phone = (order.client.phone || '').replace(/\D/g, '');
                                                    window.open(`https://wa.me/${phone.startsWith('54') ? phone : '54' + phone}?text=${encodeURIComponent(msg)}`, '_blank');
                                                }}
                                                className={`p-3 rounded-xl hover:scale-110 transition-all ${order.labStatus === 'READY' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 animate-pulse hover:animate-none' : 'bg-emerald-50 text-emerald-600'}`}
                                                title={order.labStatus === 'READY' ? 'Avisar que está listo para retirar' : 'Avisar saldo pendiente'}
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                        {/* SmartLab detail toggle */}
                                        <button
                                            onClick={() => setExpandedDetail(expandedDetail === order.id ? null : order.id)}
                                            className={`p-3 rounded-xl hover:scale-110 transition-all ${expandedDetail === order.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100'}`}
                                            title="Ver detalle para SmartLab"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => downloadLabSheet(order)}
                                            className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:scale-110 transition-all"
                                            title="Descargar hoja de pedido lab"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        {isAdmin ? (
                                            <button
                                                onClick={() => handleDeleteRequest(order.id)}
                                                className="p-3 bg-red-50 text-red-500 rounded-xl hover:scale-110 transition-all"
                                                title="Eliminar venta"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleDeleteRequest(order.id)}
                                                className="p-3 bg-amber-50 text-amber-500 rounded-xl hover:scale-110 transition-all"
                                                title="Solicitar eliminación"
                                            >
                                                <AlertTriangle className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* ====== Expandable SmartLab Detail Panel ====== */}
                                {expandedDetail === order.id && (
                                    <div className="mt-4 pt-4 border-t-2 border-dashed border-stone-200 dark:border-stone-600 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                                        {/* Section Header */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <FlaskConical className="w-4 h-4 text-indigo-500" />
                                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Detalle para SmartLab</span>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            {/* ── Column 1: Receta (Prescription) ── */}
                                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/40">
                                                <h4 className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                    <Eye className="w-3.5 h-3.5" /> Receta
                                                    {order.prescription?.prescriptionType === 'NEAR' && (
                                                        <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded text-[7px]">CERCA</span>
                                                    )}
                                                </h4>
                                                {order.prescription ? (
                                                    <div className="space-y-2">
                                                        {/* Lejos */}
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="text-[8px] font-black text-stone-400 uppercase tracking-widest">
                                                                    <th className="text-left py-1">Ojo</th>
                                                                    <th className="text-center py-1">Esf</th>
                                                                    <th className="text-center py-1">Cil</th>
                                                                    <th className="text-center py-1">Eje</th>
                                                                    <th className="text-center py-1">Add</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                <tr className="border-t border-blue-100 dark:border-blue-800/30">
                                                                    <td className="py-1.5 font-black text-blue-600">OD</td>
                                                                    <td className="py-1.5 text-center font-bold text-stone-800 dark:text-stone-200">{order.prescription.sphereOD != null ? (order.prescription.sphereOD > 0 ? '+' : '') + order.prescription.sphereOD.toFixed(2) : '—'}</td>
                                                                    <td className="py-1.5 text-center font-bold text-stone-800 dark:text-stone-200">{order.prescription.cylinderOD != null ? order.prescription.cylinderOD.toFixed(2) : '—'}</td>
                                                                    <td className="py-1.5 text-center font-bold text-stone-800 dark:text-stone-200">{order.prescription.axisOD != null ? order.prescription.axisOD + '°' : '—'}</td>
                                                                    <td className="py-1.5 text-center font-bold text-stone-800 dark:text-stone-200">{order.prescription.additionOD != null ? '+' + order.prescription.additionOD.toFixed(2) : (order.prescription.addition != null ? '+' + order.prescription.addition.toFixed(2) : '—')}</td>
                                                                </tr>
                                                                <tr className="border-t border-blue-100 dark:border-blue-800/30">
                                                                    <td className="py-1.5 font-black text-blue-600">OI</td>
                                                                    <td className="py-1.5 text-center font-bold text-stone-800 dark:text-stone-200">{order.prescription.sphereOI != null ? (order.prescription.sphereOI > 0 ? '+' : '') + order.prescription.sphereOI.toFixed(2) : '—'}</td>
                                                                    <td className="py-1.5 text-center font-bold text-stone-800 dark:text-stone-200">{order.prescription.cylinderOI != null ? order.prescription.cylinderOI.toFixed(2) : '—'}</td>
                                                                    <td className="py-1.5 text-center font-bold text-stone-800 dark:text-stone-200">{order.prescription.axisOI != null ? order.prescription.axisOI + '°' : '—'}</td>
                                                                    <td className="py-1.5 text-center font-bold text-stone-800 dark:text-stone-200">{order.prescription.additionOI != null ? '+' + order.prescription.additionOI.toFixed(2) : (order.prescription.addition != null ? '+' + order.prescription.addition.toFixed(2) : '—')}</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>

                                                        {/* Near Rx (if prescriptionType = NEAR) */}
                                                        {order.prescription.prescriptionType === 'NEAR' && (order.prescription.nearSphereOD != null || order.prescription.nearSphereOI != null) && (
                                                            <div className="mt-2 pt-2 border-t border-blue-100 dark:border-blue-800/30">
                                                                <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Rx Cerca</span>
                                                                <table className="w-full text-xs mt-1">
                                                                    <tbody>
                                                                        <tr>
                                                                            <td className="py-1 font-black text-amber-600 w-8">OD</td>
                                                                            <td className="py-1 text-center font-bold">{order.prescription.nearSphereOD != null ? (order.prescription.nearSphereOD > 0 ? '+' : '') + order.prescription.nearSphereOD.toFixed(2) : '—'}</td>
                                                                            <td className="py-1 text-center font-bold">{order.prescription.nearCylinderOD != null ? order.prescription.nearCylinderOD.toFixed(2) : '—'}</td>
                                                                            <td className="py-1 text-center font-bold">{order.prescription.nearAxisOD != null ? order.prescription.nearAxisOD + '°' : '—'}</td>
                                                                        </tr>
                                                                        <tr className="border-t border-amber-100 dark:border-amber-800/30">
                                                                            <td className="py-1 font-black text-amber-600 w-8">OI</td>
                                                                            <td className="py-1 text-center font-bold">{order.prescription.nearSphereOI != null ? (order.prescription.nearSphereOI > 0 ? '+' : '') + order.prescription.nearSphereOI.toFixed(2) : '—'}</td>
                                                                            <td className="py-1 text-center font-bold">{order.prescription.nearCylinderOI != null ? order.prescription.nearCylinderOI.toFixed(2) : '—'}</td>
                                                                            <td className="py-1 text-center font-bold">{order.prescription.nearAxisOI != null ? order.prescription.nearAxisOI + '°' : '—'}</td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}

                                                        {/* Prismas */}
                                                        {(order.prescription.prismOD || order.prescription.prismOI) && (
                                                            <div className="mt-2 pt-2 border-t border-blue-100 dark:border-blue-800/30 flex gap-4">
                                                                <div>
                                                                    <span className="text-[7px] font-black text-stone-400 uppercase">Prisma OD</span>
                                                                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200">{order.prescription.prismOD || '—'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[7px] font-black text-stone-400 uppercase">Prisma OI</span>
                                                                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200">{order.prescription.prismOI || '—'}</p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {order.prescription.notes && (
                                                            <div className="mt-2 pt-2 border-t border-blue-100 dark:border-blue-800/30">
                                                                <span className="text-[7px] font-black text-stone-400 uppercase">Notas Rx</span>
                                                                <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-0.5">{order.prescription.notes}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-stone-400 italic">Sin receta cargada</p>
                                                )}
                                            </div>

                                            {/* ── Column 2: Distancias y Alturas Pupilares ── */}
                                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/40">
                                                <h4 className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><path d="M11 12h2"/></svg>
                                                    Distancias y Alturas
                                                </h4>

                                                {/* DNP */}
                                                <div className="mb-3">
                                                    <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Dist. Pupilar (DNP)</span>
                                                    <div className="grid grid-cols-2 gap-3 mt-1.5">
                                                        <div className="bg-white/60 dark:bg-stone-800/40 rounded-xl px-3 py-2 text-center">
                                                            <span className="text-[7px] font-black text-emerald-500 uppercase block">OD</span>
                                                            <span className="text-lg font-black text-stone-800 dark:text-white">
                                                                {order.prescription?.distanceOD != null ? order.prescription.distanceOD : (order.labPdOd || '—')}
                                                            </span>
                                                            <span className="text-[8px] text-stone-400 ml-0.5">mm</span>
                                                        </div>
                                                        <div className="bg-white/60 dark:bg-stone-800/40 rounded-xl px-3 py-2 text-center">
                                                            <span className="text-[7px] font-black text-emerald-500 uppercase block">OI</span>
                                                            <span className="text-lg font-black text-stone-800 dark:text-white">
                                                                {order.prescription?.distanceOI != null ? order.prescription.distanceOI : (order.labPdOi || '—')}
                                                            </span>
                                                            <span className="text-[8px] text-stone-400 ml-0.5">mm</span>
                                                        </div>
                                                    </div>
                                                    {order.prescription?.pd != null && (
                                                        <div className="mt-1 text-center">
                                                            <span className="text-[7px] font-black text-stone-400 uppercase">Total: </span>
                                                            <span className="text-xs font-black text-stone-700 dark:text-stone-300">{order.prescription.pd} mm</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Alturas */}
                                                <div className="pt-3 border-t border-emerald-100 dark:border-emerald-800/30">
                                                    <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Alturas Pupilares</span>
                                                    <div className="grid grid-cols-2 gap-3 mt-1.5">
                                                        <div className="bg-white/60 dark:bg-stone-800/40 rounded-xl px-3 py-2 text-center">
                                                            <span className="text-[7px] font-black text-teal-500 uppercase block">OD</span>
                                                            <span className="text-lg font-black text-stone-800 dark:text-white">
                                                                {order.prescription?.heightOD != null ? order.prescription.heightOD : '—'}
                                                            </span>
                                                            <span className="text-[8px] text-stone-400 ml-0.5">mm</span>
                                                        </div>
                                                        <div className="bg-white/60 dark:bg-stone-800/40 rounded-xl px-3 py-2 text-center">
                                                            <span className="text-[7px] font-black text-teal-500 uppercase block">OI</span>
                                                            <span className="text-lg font-black text-stone-800 dark:text-white">
                                                                {order.prescription?.heightOI != null ? order.prescription.heightOI : '—'}
                                                            </span>
                                                            <span className="text-[8px] text-stone-400 ml-0.5">mm</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ── Column 3: Armazón & Cristales ── */}
                                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/40">
                                                <h4 className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                    <Package className="w-3.5 h-3.5" /> Armazón & Cristales
                                                </h4>

                                                {/* Frame Info */}
                                                <div className="mb-3">
                                                    <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Armazón</span>
                                                    {(() => {
                                                        const frameItems = order.items.filter(i => i.product?.category === 'FRAME' || i.product?.category === 'ATELIER');
                                                        const hasUserFrame = order.frameSource === 'USUARIO';
                                                        return (
                                                            <div className="mt-1 space-y-1">
                                                                {frameItems.map(fi => (
                                                                    <div key={fi.id} className="bg-white/60 dark:bg-stone-800/40 rounded-lg px-3 py-1.5">
                                                                        <span className="text-xs font-bold text-stone-800 dark:text-stone-200">{fi.product?.brand} {fi.product?.model || fi.product?.name}</span>
                                                                    </div>
                                                                ))}
                                                                {hasUserFrame && (
                                                                    <div className="bg-white/60 dark:bg-stone-800/40 rounded-lg px-3 py-1.5">
                                                                        <span className="text-[7px] font-black text-amber-500 uppercase">Armazón del cliente</span>
                                                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                                                                            {[order.userFrameBrand, order.userFrameModel].filter(Boolean).join(' ') || 'Sin detalle'}
                                                                        </p>
                                                                        {order.userFrameNotes && <p className="text-[10px] text-stone-500 mt-0.5">{order.userFrameNotes}</p>}
                                                                    </div>
                                                                )}
                                                                {frameItems.length === 0 && !hasUserFrame && (
                                                                    <p className="text-xs text-stone-400 italic mt-1">Sin armazón</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Frame Measurements */}
                                                    {(order.frameA || order.frameB || order.frameDbl) && (
                                                        <div className="flex gap-2 mt-2 flex-wrap">
                                                            {order.frameA && (
                                                                <div className="bg-white/60 dark:bg-stone-800/40 rounded-lg px-2 py-1 text-center">
                                                                    <span className="text-[7px] font-black text-stone-400 block">A</span>
                                                                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">{order.frameA}</span>
                                                                </div>
                                                            )}
                                                            {order.frameB && (
                                                                <div className="bg-white/60 dark:bg-stone-800/40 rounded-lg px-2 py-1 text-center">
                                                                    <span className="text-[7px] font-black text-stone-400 block">B</span>
                                                                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">{order.frameB}</span>
                                                                </div>
                                                            )}
                                                            {order.frameDbl && (
                                                                <div className="bg-white/60 dark:bg-stone-800/40 rounded-lg px-2 py-1 text-center">
                                                                    <span className="text-[7px] font-black text-stone-400 block">DBL</span>
                                                                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">{order.frameDbl}</span>
                                                                </div>
                                                            )}
                                                            {order.frameEdc && (
                                                                <div className="bg-white/60 dark:bg-stone-800/40 rounded-lg px-2 py-1 text-center">
                                                                    <span className="text-[7px] font-black text-stone-400 block">EDC</span>
                                                                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">{order.frameEdc}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Cristales */}
                                                <div className="pt-3 mt-3 border-t border-amber-100 dark:border-amber-800/30">
                                                    <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Cristales</span>
                                                    {(() => {
                                                        const lensItems = order.items.filter(i => i.product?.category === 'LENS');
                                                        if (lensItems.length === 0) return <p className="text-xs text-stone-400 italic mt-1">Sin cristales</p>;
                                                        return (
                                                            <div className="mt-1 space-y-1">
                                                                {lensItems.map(li => (
                                                                    <div key={li.id} className="bg-white/60 dark:bg-stone-800/40 rounded-lg px-3 py-1.5">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-xs font-bold text-stone-800 dark:text-stone-200">{li.product?.brand} {li.product?.model || li.product?.name}</span>
                                                                            {li.product?.laboratory && (
                                                                                <span className="text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded">{li.product.laboratory}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-stone-500">
                                                                            {li.product?.type && <span>{li.product.type}</span>}
                                                                            {li.eye && <span className="font-bold text-blue-500">({li.eye})</span>}
                                                                            <span>x{li.quantity}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                {/* Lab extra info */}
                                                {(order.labColor || order.labTreatment || order.labDiameter) && (
                                                    <div className="pt-3 mt-3 border-t border-amber-100 dark:border-amber-800/30">
                                                        <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Info Lab</span>
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {order.labColor && (
                                                                <span className="text-[10px] font-bold bg-white/60 dark:bg-stone-800/40 px-2 py-0.5 rounded-lg">Color: {order.labColor}</span>
                                                            )}
                                                            {order.labTreatment && (
                                                                <span className="text-[10px] font-bold bg-white/60 dark:bg-stone-800/40 px-2 py-0.5 rounded-lg">Trat: {order.labTreatment}</span>
                                                            )}
                                                            {order.labDiameter && (
                                                                <span className="text-[10px] font-bold bg-white/60 dark:bg-stone-800/40 px-2 py-0.5 rounded-lg">Ø: {order.labDiameter}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Full Items List (all non-lens items like accessories) */}
                                        {order.items.filter(i => i.product?.category !== 'LENS' && i.product?.category !== 'FRAME' && i.product?.category !== 'ATELIER').length > 0 && (
                                            <div className="mt-2">
                                                <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Otros Items</span>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {order.items.filter(i => i.product?.category !== 'LENS' && i.product?.category !== 'FRAME' && i.product?.category !== 'ATELIER').map(oi => (
                                                        <span key={oi.id} className="text-[10px] font-bold bg-stone-100 dark:bg-stone-700 px-2 py-1 rounded-lg text-stone-600 dark:text-stone-300">
                                                            {oi.product?.brand} {oi.product?.model || oi.product?.name} x{oi.quantity}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}


            {/* Invoice Modal */}
            {invoiceOrder && (
                <InvoiceModal
                    order={invoiceOrder}
                    initialAmount={(invoiceOrder as any).customAmount}
                    onClose={() => setInvoiceOrder(null)}
                    onSuccess={() => fetchOrders()}
                />
            )}
        </main>
    );
}
