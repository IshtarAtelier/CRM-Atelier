'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Download, Search, Package, Clock, CheckCircle2, Truck, Eye, Pencil, Save, X, AlertTriangle, MessageCircle, FileText, Banknote, ArrowRightLeft, CreditCard, ChevronRight, ExternalLink, Clipboard, CheckCheck, Copy, Loader2, ArrowRight, FlaskConical, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import InvoiceModal from '@/components/InvoiceModal';

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
    } | null;
    sphereVal?: number | null;
    cylinderVal?: number | null;
    axisVal?: number | null;
    additionVal?: number | null;
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
        if (isAdmin) {
            setInvoiceOrder(order);
        } else {
            try {
                const res = await fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'INVOICE_REQUEST',
                        message: `Solicitar factura para venta #${order.id.slice(-4).toUpperCase()} de ${order.client.name} por $${(order.total || 0).toLocaleString()}`,
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
        const logoUrl = `${window.location.origin}/assets/logo-atelier-optica.png`;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido Lab - ${order.client.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter','Segoe UI',sans-serif; }
  body { padding: 40px 50px; color: #1c1917; font-size: 13px; line-height:1.5; }
  .letterhead { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; margin-bottom:8px; border-bottom:3px solid #1c1917; }
  .letterhead-left { display:flex; align-items:center; gap:16px; }
  .letterhead-logo { height:52px; }
  .letterhead-right { text-align:right; font-size:10px; color:#78716c; line-height:1.6; }
  .letterhead-right .address { font-weight:600; color:#57534e; }
  .tagline { text-align:center; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:3px; color:#a0845e; padding:10px 0 20px; }
  .doc-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
  .doc-title { font-size:18px; font-weight:900; text-transform:uppercase; letter-spacing:3px; color:#c2410c; }
  .doc-number { font-size:11px; color:#78716c; margin-top:4px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; }
  .info-box { border:2px solid #e7e5e4; border-radius:12px; padding:16px; }
  .info-box h3 { font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#a8a29e; margin-bottom:8px; }
  .info-row { display:flex; justify-content:space-between; margin-bottom:4px; }
  .info-row .label { color:#78716c; font-size:12px; }
  .info-row .value { font-weight:700; font-size:12px; }
  table { width:100%; border-collapse:collapse; margin:20px 0; }
  th { background:#1c1917; color:white; padding:10px 14px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:1px; }
  td { padding:10px 14px; border-bottom:1px solid #e7e5e4; font-size:12px; }
  tr:nth-child(even) { background:#fafaf9; }
  .lab-number-box { border:3px dashed #c2410c; border-radius:16px; padding:20px; margin-top:24px; display:flex; align-items:center; gap:16px; }
  .lab-number-box .label { font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#c2410c; white-space:nowrap; }
  .lab-number-box .input-line { flex:1; border-bottom:2px solid #1c1917; min-height:24px; font-size:16px; font-weight:700; }
  .notes-box { border:2px solid #e7e5e4; border-radius:12px; padding:16px; margin-top:16px; }
  .notes-box h3 { font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#a8a29e; margin-bottom:8px; }
  .notes-lines { min-height:60px; border-bottom:1px solid #e7e5e4; margin-bottom:8px; }
  .footer { margin-top:32px; padding-top:16px; border-top:1px solid #e7e5e4; font-size:9px; color:#a8a29e; text-align:center; text-transform:uppercase; letter-spacing:2px; }
  .totals { text-align:right; margin-top:12px; }
  .totals .row { font-size:13px; margin-bottom:4px; }
  .totals .total { font-size:20px; font-weight:900; border-top:2px solid #1c1917; padding-top:8px; margin-top:4px; }
  @media print { body { padding: 20px; } }
</style></head><body>
<div class='letterhead'>
  <div class='letterhead-left'>
    <img src='${logoUrl}' class='letterhead-logo' alt='Atelier Óptica' />
  </div>
  <div class='letterhead-right'>
    <div class='address'>José Luis de Tejeda 4380</div>
    <div>Cerro de las Rosas, Córdoba</div>
  </div>
</div>
<div class='tagline'>La óptica mejor calificada en Google Business ⭐ 5/5</div>
<div class='doc-header'>
  <div>
    <div class='doc-title'>Pedido a Laboratorio</div>
    <div class='doc-number'>Venta #${order.id.slice(-4).toUpperCase()} · ${dateStr}</div>
  </div>
</div>

<div class='info-grid'>
  <div class='info-box'>
    <h3>👤 Datos del Cliente</h3>
    <div class='info-row'><span class='label'>Nombre</span><span class='value'>${order.client.name}</span></div>
    <div class='info-row'><span class='label'>Teléfono</span><span class='value'>${order.client.phone || 'No registrado'}</span></div>
  </div>
  <div class='info-box'>
    <h3>📦 Estado del Pedido</h3>
    <div class='info-row'><span class='label'>Enviado al Lab</span><span class='value'>${labDate}</span></div>
    <div class='info-row'><span class='label'>Estado</span><span class='value'>${LAB_STATUS[order.labStatus || 'NONE']?.label || 'Sin enviar'}</span></div>
    <div class='info-row'><span class='label'>Abonado</span><span class='value'>$${(order.paid || 0).toLocaleString()} / $${(order.total || 0).toLocaleString()}</span></div>
  </div>
</div>

${(() => {
    const paid = order.paid || 0;
    const total = order.total || 0;
    const pending = Math.max(0, total - paid);
    const subMarkup = order.subtotalWithMarkup || 0;
    const hasSubs = subMarkup > 0;
    const saldoEfvo = pending;
    const saldoTransf = hasSubs ? Math.max(0, Math.round(subMarkup * (1 - (order.discountTransfer || 0) / 100)) - paid) : 0;
    const saldoCuotas = hasSubs ? Math.max(0, Math.round(subMarkup * (1 - (order.discountCard || 0) / 100)) - paid) : 0;
    
    if (paid >= total) {
        return `<div style='background:#ecfdf5;border:2px solid #10b981;border-radius:14px;padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px'>
            <span style='font-size:20px'>✅</span>
            <div>
                <span style='font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#059669;display:block'>Estado de Pago</span>
                <span style='font-size:15px;font-weight:900;color:#047857'>PAGADO COMPLETO — $${paid.toLocaleString()}</span>
            </div>
        </div>`;
    }
    
    let html = `<div style='border:2px solid #e7e5e4;border-radius:14px;padding:16px 20px;margin-bottom:20px'>
        <div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px'>
            <div>
                <span style='font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#a8a29e;display:block'>Pagado</span>
                <span style='font-size:20px;font-weight:900;color:#10b981'>$${paid.toLocaleString()}</span>
            </div>
            <div style='display:flex;gap:16px;text-align:right'>
                <div>
                    <span style='font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#10b981;display:block'>💵 Saldo Efvo</span>
                    <span style='font-size:13px;font-weight:900;color:#10b981'>$${saldoEfvo.toLocaleString()}</span>
                </div>`;
    if (hasSubs && (order.discountTransfer || 0) > 0) {
        html += `
                <div>
                    <span style='font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#8b5cf6;display:block'>🏦 Saldo Transf</span>
                    <span style='font-size:13px;font-weight:900;color:#8b5cf6'>$${saldoTransf.toLocaleString()}</span>
                </div>`;
    }
    if (hasSubs) {
        html += `
                <div>
                    <span style='font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#f97316;display:block'>💳 Saldo Cuotas</span>
                    <span style='font-size:13px;font-weight:900;color:#f97316'>$${saldoCuotas.toLocaleString()}</span>
                </div>`;
    }
    html += `
            </div>
        </div>
        <div style='height:10px;background:#f5f5f4;border-radius:5px;overflow:hidden;border:1px solid #e7e5e4'>
            <div style='height:100%;background:#10b981;width:${Math.min(100, total > 0 ? (paid / total) * 100 : 0)}%;border-radius:5px'></div>
        </div>
    </div>`;
    return html;
})()}

<h3 style="font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#a8a29e; margin-bottom:8px;">🔬 Productos / Cristales</h3>
<table>
  <thead><tr><th>Producto</th><th>Tipo</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
  <tbody>${items.map(it => `<tr><td>${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''}</td><td>${it.product?.type || it.product?.category || ''}</td><td style='text-align:center'>${it.quantity}</td><td>$${it.price?.toLocaleString()}</td><td>$${(it.price * it.quantity).toLocaleString()}</td></tr>`).join('')}</tbody>
</table>
${order.frameSource ? `<div style='background:#fffbeb;border:2px solid #fbbf24;border-radius:12px;padding:12px 16px;margin:12px 0;font-size:12px'><strong style='color:#92400e'>🕶️ Armazón:</strong> ${order.frameSource === 'OPTICA' ? 'De la óptica (incluido en el pedido)' : `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}${order.userFrameNotes ? ' · ' + order.userFrameNotes : ''}`}</div>` : ''}

<div class='totals'>
  ${order.discount ? `<div class='row' style='color:#ef4444'>Descuento: ${order.discount}%</div>` : ''}
  <div class='total'>Total: $${(order.total || 0).toLocaleString()}</div>
</div>

<div class='lab-number-box'>
  <span class='label'>N° Operación Lab:</span>
  <span class='input-line'>${order.labOrderNumber || ''}</span>
</div>

<div class='notes-box'>
  <h3>📝 Observaciones para el Cliente</h3>
  <div class='notes-lines'>${order.labNotes || ''}</div>
</div>

<div class='footer'>Atelier Óptica · José Luis de Tejeda 4380, Córdoba · Generado el ${format(new Date(), "d/MM/yyyy HH:mm", { locale: es })}</div>
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
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-3">
                        <ShoppingCart className="w-9 h-9 text-emerald-500" /> Ventas
                    </h1>
                    <p className="text-stone-400 text-sm mt-1">Operaciones confirmadas y enviadas a laboratorio</p>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-black text-emerald-500">${stats.revenue.toLocaleString()}</p>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Facturación total</p>
                </div>
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
                <div className="flex gap-4">
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
                    <div className="flex gap-2">
                        {['ALL', 'SENT', 'IN_PROGRESS', 'READY', 'DELIVERED'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilterLab(f)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterLab === f ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:bg-stone-200'}`}
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
                        Reintentar
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
                        const payProgress = order.total > 0 ? Math.min(100, (order.paid / order.total) * 100) : 100;

                        return (
                            <div key={order.id} className={`border-2 rounded-2xl p-6 hover:shadow-lg transition-all ${payProgress < 100
                                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                                    : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700'
                                }`}>
                                <div className="flex items-center gap-6">
                                    {/* Lab Status Icon */}
                                    <div className={`w-14 h-14 rounded-2xl ${labInfo.color} flex items-center justify-center flex-shrink-0 ${isUpdating ? 'animate-pulse' : ''}`}>
                                        <LabIcon className="w-6 h-6" />
                                    </div>

                                    {/* Main Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-lg font-black text-stone-800 dark:text-white truncate">{order.client.name}</h3>
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${labInfo.color}`}>
                                                {labInfo.label}
                                            </span>
                                            {payProgress >= 100 ? (
                                                <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600">PAGADO</span>
                                            ) : (
                                                <div className="flex flex-col gap-1.5 ml-4 border-l-2 border-stone-100 dark:border-stone-700 pl-4 py-0.5">
                                                    <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Saldo Pendiente</span>
                                                    <div className="flex gap-2">
                                                        <div className="flex flex-col rounded-lg bg-emerald-50 px-2 py-1 text-emerald-600">
                                                            <span className="text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Banknote className="w-3 h-3" /> Efvo</span>
                                                            <span className="text-[10px] font-black mt-0.5">${((order.total || 0) - (order.paid || 0)).toLocaleString()}</span>
                                                        </div>
                                                        {(order.subtotalWithMarkup || 0) > 0 && (() => {
                                                            const transferTotal = (order.subtotalWithMarkup || 0) * (1 - (order.discountTransfer || 0) / 100);
                                                            const transferSaldo = Math.max(0, Math.round(transferTotal) - (order.paid || 0));
                                                            const cardTotal = (order.subtotalWithMarkup || 0) * (1 - (order.discountCard || 0) / 100);
                                                            const cardSaldo = Math.max(0, Math.round(cardTotal) - (order.paid || 0));
                                                            return (
                                                                <>
                                                                    <div className="flex flex-col rounded-lg bg-violet-50 px-2 py-1 text-violet-600">
                                                                        <span className="text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> Transf</span>
                                                                        <span className="text-[10px] font-black mt-0.5">${transferSaldo.toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="flex flex-col rounded-lg bg-orange-50 px-2 py-1 text-orange-600">
                                                                        <span className="text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><CreditCard className="w-3 h-3" /> Cuotas</span>
                                                                        <span className="text-[10px] font-black mt-0.5">${cardSaldo.toLocaleString()}</span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                            <span>Venta #{order.id.slice(-4).toUpperCase()}</span>
                                            <span>·</span>
                                            <span>{format(new Date(order.createdAt), "d MMM yyyy", { locale: es })}</span>
                                            <span>·</span>
                                            <span>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                                            {order.labSentAt && (
                                                <>
                                                    <span>·</span>
                                                    <span>Enviado: {format(new Date(order.labSentAt), "d/MM HH:mm", { locale: es })}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Lab Order Number */}
                                    <div className="flex-shrink-0 w-48">
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
                                                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">N° Op. Lab</span>
                                                        <span className="text-sm font-black text-stone-800 dark:text-white">{order.labOrderNumber}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-stone-400 group-hover:text-emerald-500">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Agregar N° Op.</span>
                                                    </div>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Total */}
                                    <div className="flex-shrink-0 text-right">
                                        <p className="text-xl font-black text-stone-800 dark:text-white">${(order.total || 0).toLocaleString()}</p>
                                        <div className="w-24 h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full mt-2 overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${payProgress}%` }} />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
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
                                            const inv = (order.invoices || []).find((i: any) => i.status === 'COMPLETED');
                                            if (inv) {
                                                return (
                                                    <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl" title={`CAE: ${inv.cae}\nVto: ${inv.caeExpiration}`}>
                                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">Factura C</span>
                                                        <span className="text-xs font-black text-indigo-600">
                                                            {inv.pointOfSale.toString().padStart(4, '0')}-{inv.voucherNumber.toString().padStart(8, '0')}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <button
                                                    onClick={() => handleInvoiceRequest(order)}
                                                    className={`p-3 rounded-xl hover:scale-110 transition-all ${isAdmin ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 hover:bg-indigo-100' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-500 hover:bg-amber-100'}`}
                                                    title={isAdmin ? 'Emitir Factura C' : 'Solicitar Factura'}
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                            );
                                        })()}
                                        {/* WhatsApp notify — visible when READY or has pending balance */}
                                        {order.client.phone && (order.labStatus === 'READY' || payProgress < 100) && (
                                            <button
                                                onClick={() => {
                                                    const pending = (order.total || 0) - (order.paid || 0);
                                                    const isReady = order.labStatus === 'READY';
                                                    let msg = `*Hola ${order.client.name}* 👋\n\n`;
                                                    if (isReady) {
                                                        msg += `Te avisamos que *tu pedido ya está listo para retirar* en *Atelier Óptica* 🎉\n\n`;
                                                    }
                                                    if (pending > 0) {
                                                        msg += `📋 *Detalle del saldo:*\n`;
                                                        msg += `• Total: $${(order.total || 0).toLocaleString()}\n`;
                                                        msg += `• Abonado: $${(order.paid || 0).toLocaleString()}\n`;
                                                        msg += `• *Saldo pendiente en efectivo: $${pending.toLocaleString()}*\n`;
                                                        if ((order.subtotalWithMarkup || 0) > 0) {
                                                            const transferTotal = (order.subtotalWithMarkup || 0) * (1 - (order.discountTransfer || 0) / 100);
                                                            const transferSaldo = Math.max(0, Math.round(transferTotal) - (order.paid || 0));
                                                            msg += `• *Saldo con transferencia: $${transferSaldo.toLocaleString()}*\n`;

                                                            const cardTotal = (order.subtotalWithMarkup || 0) * (1 - (order.discountCard || 0) / 100);
                                                            const cardSaldo = Math.max(0, Math.round(cardTotal) - (order.paid || 0));
                                                            msg += `• *Saldo en cuotas: $${cardSaldo.toLocaleString()}*\n`;
                                                        }
                                                        msg += `\n💳 Podés abonar con efectivo, débito, transferencia o tarjeta de crédito.\n`;
                                                        msg += `👉 *¿Nos podrías avisar cómo quisieras abonar el saldo?*\n\n`;
                                                    } else {
                                                        msg += `✅ Tu pedido está *completamente pago*.\n\n`;
                                                    }
                                                    if (isReady) {
                                                        msg += `📍 *Dirección:* José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n`;
                                                        msg += `🗺️ *Ubicación:* https://share.google/j2ZT7ReboDLt7onCp\n`;
                                                        msg += `🕒 *Horarios:*\n   • Lunes a viernes de 9:00 a 13:30 y de 16:00 a 19:30\n   • Sábados de 10:00 a 14:00 hs\n\n`;
                                                        msg += `¡Te esperamos! Muchas gracias.\n`;
                                                    } else {
                                                        msg += `📍 Te esperamos en la óptica. ¡Muchas gracias!\n`;
                                                    }
                                                    msg += `\n_La óptica mejor calificada en Google Business ⭐ 5/5_`;
                                                    const phone = (order.client.phone || '').replace(/\D/g, '');
                                                    window.open(`https://wa.me/${phone.startsWith('54') ? phone : '54' + phone}?text=${encodeURIComponent(msg)}`, '_blank');
                                                }}
                                                className={`p-3 rounded-xl hover:scale-110 transition-all ${order.labStatus === 'READY' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 animate-pulse hover:animate-none' : 'bg-emerald-50 text-emerald-600'}`}
                                                title={order.labStatus === 'READY' ? 'Avisar que está listo para retirar' : 'Avisar saldo pendiente'}
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                            </button>
                                        )}
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
                            </div>
                        );
                    })}
                </div>
            )}


            {/* Invoice Modal */}
            {invoiceOrder && (
                <InvoiceModal
                    order={invoiceOrder}
                    onClose={() => setInvoiceOrder(null)}
                    onSuccess={() => fetchOrders()}
                />
            )}
        </main>
    );
}
