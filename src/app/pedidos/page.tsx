'use client';

import { useState, useEffect } from 'react';
import {
    Package, Clock, CheckCircle2, Truck, Search, Download, Pencil,
    Save, X, ChevronRight, AlertCircle, Eye, ArrowRight, Hash,
    Calendar, User, ShoppingBag, Loader2, Filter, MessageCircle,
    ExternalLink, Copy, CheckCheck, Clipboard
} from 'lucide-react';
import { PricingService } from '@/services/PricingService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Types ─────────────────────────────────────────────

interface OrderItem {
    id: string;
    productId: string;
    quantity: number;
    price: number;
    eye?: string;
    sphereVal?: number;
    cylinderVal?: number;
    axisVal?: number;
    additionVal?: number;
    product: {
        name?: string;
        brand?: string;
        model?: string;
        category?: string;
        type?: string;
        lensIndex?: string;
        laboratory?: string;
    };
}

interface Order {
    id: string;
    clientId: string;
    status: string;
    total: number;
    paid: number;
    discount?: number;
    markup?: number;
    discountCash?: number;
    discountTransfer?: number;
    subtotalWithMarkup?: number;
    orderType?: string;
    labStatus?: string;
    labSentAt?: string;
    labNotes?: string;
    labOrderNumber?: string;
    frameSource?: string | null;
    userFrameBrand?: string | null;
    userFrameModel?: string | null;
    userFrameNotes?: string | null;
    labColor?: string | null;
    labTreatment?: string | null;
    labDiameter?: string | null;
    labPdOd?: string | null;
    labPdOi?: string | null;
    createdAt: string;
    isDeleted?: boolean;
    client: {
        id: string;
        name: string;
        phone?: string;
        email?: string;
    };
    user?: {
        name: string;
    };
    items: OrderItem[];
    payments: any[];
}

// ── Lab Status Config ─────────────────────────────

const LAB_STEPS = [
    { key: 'NONE', label: 'Pendiente', icon: Clock, color: 'stone', bg: 'bg-stone-100 dark:bg-stone-800', text: 'text-stone-500 dark:text-stone-400', ring: 'ring-stone-200 dark:ring-stone-700' },
    { key: 'SENT', label: 'Procesado', icon: Package, color: 'blue', bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-800' },
    { key: 'IN_PROGRESS', label: 'En Fábrica', icon: Clock, color: 'amber', bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-800' },
    { key: 'READY', label: 'Listo p/ Retirar', icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-800' },
    { key: 'DELIVERED', label: 'Entregado', icon: Truck, color: 'indigo', bg: 'bg-indigo-50 dark:bg-indigo-950', text: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-200 dark:ring-indigo-800' },
];

function getLabStep(status: string) {
    return LAB_STEPS.find(s => s.key === status) || LAB_STEPS[0];
}

function getNextStatus(current: string): string | null {
    const idx = LAB_STEPS.findIndex(s => s.key === current);
    if (idx < 0 || idx >= LAB_STEPS.length - 1) return null;
    return LAB_STEPS[idx + 1].key;
}

// ── Main Page ─────────────────────────────────────

export default function PedidosPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [smartLabId, setSmartLabId] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [labFields, setLabFields] = useState<Record<string, string>>({});
    const [savingField, setSavingField] = useState<string | null>(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/orders');
            const data = await res.json();
            // Only confirmed sales (SALE), not quotes, not deleted
            const sales = (data || []).filter(
                (o: Order) => o.orderType === 'SALE' && !o.isDeleted
            );
            setOrders(sales);
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
        setLoading(false);
    };

    // ── Actions ───────────────────────────────

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

    const notifyWhatsApp = async (order: Order, status: string) => {
        if (!order.client.phone) {
            alert('⚠️ El cliente no tiene teléfono registrado');
            return;
        }
        try {
            const res = await fetch('/api/whatsapp/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order.id,
                    clientPhone: order.client.phone,
                    clientName: order.client.name,
                    status: status || order.labStatus || 'NONE',
                    orderNumber: order.id.slice(-4).toUpperCase(),
                }),
            });
            if (res.ok) {
                alert('✅ Notificación enviada por WhatsApp');
            } else {
                const data = await res.json();
                alert(`❌ ${data.error || 'Error al enviar'}`);
            }
        } catch {
            alert('❌ Error: verificá que el servidor WhatsApp esté corriendo');
        }
    };

    const saveLabOrderNumber = async (orderId: string) => {
        setUpdatingId(orderId);
        try {
            await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ labOrderNumber: editValue }),
            });
            setEditingId(null);
            setEditValue('');
            await fetchOrders();
        } catch (error) {
            console.error('Error saving lab number:', error);
        }
        setUpdatingId(null);
    };

    const downloadLabSheet = (order: Order) => {
        const items = order.items || [];
        const dateStr = format(new Date(order.createdAt), "d 'de' MMMM yyyy", { locale: es });
        const markupFactor = 1 + ((order.markup || 0) / 100);

        const financials = PricingService.calculateOrderFinancials(order);

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido Lab - ${order.client.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter','Segoe UI',sans-serif; }
  body { padding: 30px 40px; color: #1c1917; font-size: 13px; line-height:1.4; background: white; }
  
  .letterhead { display:flex; justify-content:space-between; align-items:center; padding-bottom:15px; border-bottom:2px solid #D4C3B5; margin-bottom: 8px; }
  .letterhead-right { text-align:right; font-size:10px; color:#78716c; font-weight: 500; }
  .address-bold { font-weight:800; color:#A68B7C; text-transform: uppercase; letter-spacing: 1px; }
  
  .payment-methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 25px; }
  .payment-card { border-radius: 18px; padding: 18px; border: 1.5px solid #D4C3B5; position: relative; overflow: hidden; background: #fffcf9; }
  .payment-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 5px; }
  .p-efective::before { background: #10b981; }
  .p-transfer::before { background: #7c3aed; }
  .p-card::before { background: #f97316; }

  .p-title { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: block; color: #78716c; }
  .p-amount { font-size: 16px; font-weight: 900; color: #1c1917; display: block; }
  .p-saldo { font-size: 11px; font-weight: 900; background: #f5f5f4; display: inline-block; padding: 4px 10px; border-radius: 8px; margin-top: 8px; }
  .p-saldo-label { color: #78716c; font-size: 7px; display: block; margin-bottom: 2px; text-transform: uppercase; font-weight: 800; }

  .doc-title-row { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 900; color: #1c1917; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }

  table { width:100%; border-collapse:collapse; margin-bottom:15px; border-radius: 12px; overflow: hidden; border: 1px solid #D4C3B5; }
  th { background:#A68B7C; color:white; padding:10px 14px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:1px; }
  td { padding:10px 14px; border-bottom:1px solid #f5f5f4; font-size:11px; }
  tr:nth-child(even) { background:#fffcf9; }

  .totals-summary { margin-top: 25px; padding: 25px; border-radius: 20px; background: #1c1917; color: white; display: flex; justify-content: space-between; align-items: center; border: 2px solid #A68B7C; }
  .tot-col { text-align: center; padding: 0 15px; border-right: 1px solid rgba(255,255,255,0.1); }
  .tot-col:last-of-type { border-right: none; }
  .tot-val { font-size: 18px; font-weight: 900; display: block; }
  .tot-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #a8a29e; display: block; margin-bottom: 4px; }
  .tot-paid { text-align: right; border-left: 2px solid rgba(255,255,255,0.2); padding-left: 25px; margin-left: 10px; }
  .paid-value { font-size: 24px; font-weight: 900; color: #fbbf24; }

  .footer { margin-top: 30px; text-align: center; border-top: 1px solid #D4C3B5; padding-top: 15px; font-size: 9px; color: #a8a29e; text-transform: uppercase; letter-spacing: 3px; font-weight: 900; }
</style>
</head>
<body>
    <div class='letterhead'>
        <div class='address-bold'>Pedido de Laboratorio <span style="color:#78716c; font-weight:500;">#${order.id.slice(-6).toUpperCase()}</span> <span style="background:#1c1917; color:white; padding:2px 8px; border-radius:4px; font-size:7px; margin-left:10px; vertical-align:middle;">V2.0</span></div>
        <div class='letterhead-right'>
            <div>José Luis de Tejeda 4380 · Córdoba</div>
            <div>Fecha: ${dateStr}</div>
        </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
        <div style="border:1px solid #D4C3B5; border-radius:12px; padding:12px;">
            <div style="font-size:8px; font-weight:900; color:#A68B7C; text-transform:uppercase; margin-bottom:5px;">Cliente</div>
            <div style="font-weight:700;">${order.client.name}</div>
            <div style="font-size:10px; color:#78716c;">Tel: ${order.client.phone || '-'}</div>
        </div>
        <div style="border:1px solid #D4C3B5; border-radius:12px; padding:12px;">
            <div style="font-size:8px; font-weight:900; color:#A68B7C; text-transform:uppercase; margin-bottom:5px;">Estado de Pago</div>
            <div style="font-weight:700;">Abonado Real: $${financials.paidReal.toLocaleString()}</div>
            <div style="font-size:10px; color:${financials.hasBalance ? '#c2410c' : '#10b981'}; font-weight:700;">
                ${financials.hasBalance ? `PENDIENTE: $${financials.remainingCash.toLocaleString()}` : 'PAGADO COMPLETO'}
            </div>
        </div>
    </div>

    <div class='payment-methods'>
        <div class='payment-card p-efective'>
            <span class='p-title'>💵 Total Efectivo (-${financials.discountCash}%)</span>
            <span class='p-amount'>$${financials.totalCash.toLocaleString()}</span>
            ${financials.hasBalance ? `<div class='p-saldo'><span class='p-saldo-label'>Saldo</span>$${financials.remainingCash.toLocaleString()}</div>` : '<span class=\'p-saldo\' style="color:#10b981;">PAGADO</span>'}
        </div>
        <div class='payment-card p-transfer'>
            <span class='p-title'>🏦 Total Transferencia (-${financials.discountTransfer}%)</span>
            <span class='p-amount'>$${financials.totalTransfer.toLocaleString()}</span>
            ${financials.hasBalance ? `<div class='p-saldo'><span class='p-saldo-label'>Saldo</span>$${financials.remainingTransfer.toLocaleString()}</div>` : '<span class=\'p-saldo\' style="color:#10b981;">PAGADO</span>'}
        </div>
        <div class='payment-card p-card'>
            <span class='p-title'>💳 Total Tarjetas (Lista)</span>
            <span class='p-amount'>$${financials.totalCard.toLocaleString()}</span>
            ${financials.hasBalance ? `<div class='p-saldo'><span class='p-saldo-label'>Saldo</span>$${financials.remainingCard.toLocaleString()}</div>` : '<span class=\'p-saldo\' style="color:#10b981;">PAGADO</span>'}
        </div>
    </div>

    <div class='doc-title-row'><span>👓 Productos / cristales</span></div>
    <table>
      <thead><tr><th style="width: 50%">PRODUCTO</th><th style="text-align:center">CANT.</th><th style="text-align:right">PRECIO</th><th style="text-align:right">SUBTOTAL</th></tr></thead>
      <tbody>${items.map(it => {
            const itemPrice = Math.round(it.price * markupFactor);
            return `<tr>
          <td><div style="font-weight: 700">${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''}</div></td>
          <td style='text-align:center'>${it.quantity}</td>
          <td style='text-align:right'>$${itemPrice.toLocaleString()}</td>
          <td style='text-align:right; font-weight:700;'>$${(itemPrice * it.quantity).toLocaleString()}</td>
        </tr>`}).join('')}
      </tbody>
    </table>

    <div class='totals-summary' style="margin-top:10px;">
        <div class='tot-col'>
            <span class='tot-label' style="color: #10b981;">💵 Efectivo</span>
            <span class='tot-val' style="color: #10b981;">$${financials.totalCash.toLocaleString()}</span>
        </div>
        <div class='tot-col'>
            <span class='tot-label' style="color: #a78bfa;">🏦 Transf</span>
            <span class='tot-val' style="color: #a78bfa;">$${financials.totalTransfer.toLocaleString()}</span>
        </div>
        <div class='tot-col'>
            <span class='tot-label' style="color: #fb923c;">💳 Tarjeta</span>
            <span class='tot-val' style="color: #fb923c;">$${financials.totalCard.toLocaleString()}</span>
        </div>
        <div class='tot-paid'>
            <span class='tot-label'>Abonado Real</span>
            <span class='paid-value'>$${financials.paidReal.toLocaleString()}</span>
        </div>
    </div>

    <div class='footer'>Atelier Óptica · Tejeda 4380 · Córdoba · ${format(new Date(), "yyyy")}</div>
</body></html>`;

        const printWindow = window.open('', '_blank', 'width=800,height=1000');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 400);
        }
    };


    const sendOrderWhatsApp = (order: Order) => {
        const items = order.items || [];
        const saldo = (order.total || 0) - (order.paid || 0);
        const labStepLabel = getLabStep(order.labStatus || 'NONE').label;
        const lines = items.map(it => `• ${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''} x${it.quantity} — $${(it.price * it.quantity).toLocaleString()}`);

        let text = `✨ *ATELIER ÓPTICA — PEDIDO EN PROCESO* ✨\n`;
        text += `📍 José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n`;
        text += `🏆 La óptica mejor calificada en Google Business ⭐ 5/5\n`;
        text += `\n👤 *Cliente:* ${order.client.name}\n`;
        text += `📋 *Operación:* #${order.id.slice(-4).toUpperCase()}\n`;
        text += `📦 *Estado:* ${labStepLabel}\n\n`;
        text += lines.join('\n');
        text += `\n\n———————————————`;
        text += `\n*Total:* $${(order.total || 0).toLocaleString()}`;
        text += `\n*Abonado:* $${(order.paid || 0).toLocaleString()}`;
        if (saldo > 0) text += `\n*Saldo pendiente:* $${saldo.toLocaleString()}`;
        text += `\n\n⏱️ *Tiempo estimado de confección:* 7 a 10 días hábiles`;
        if (order.labNotes) text += `\n\n📝 *Observaciones:* ${order.labNotes}`;

        const phone = order.client.phone?.replace(/\D/g, '') || '';
        const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
    };

    // ── SmartLab Helpers ──────────────────────────

    const SMARTLAB_URL = 'http://grupooptico.dyndns.info/pedidos/web/app.php/';

    const copyToClipboard = async (text: string, fieldId: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(fieldId);
            setTimeout(() => setCopiedField(null), 1500);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopiedField(fieldId);
            setTimeout(() => setCopiedField(null), 1500);
        }
    };

    const getSmartLabData = (order: Order) => {
        const lensItems = order.items.filter(i => i.product?.category === 'LENS');
        const odItem = lensItems.find(i => i.eye === 'OD');
        const oiItem = lensItems.find(i => i.eye === 'OI');
        const lensType = lensItems[0]?.product?.type || 'MONOFOCAL';
        const lensIndex = lensItems[0]?.product?.lensIndex || '';
        const lensBrand = lensItems[0]?.product?.brand || '';
        const laboratory = lensItems[0]?.product?.laboratory || '';
        const frameItems = order.items.filter(i => i.product?.category === 'FRAME' || i.product?.category === 'SUNGLASS');
        const frameInfo = frameItems.length > 0
            ? `${frameItems[0]?.product?.brand || ''} ${frameItems[0]?.product?.model || ''}`.trim()
            : order.frameSource === 'USUARIO'
                ? `${order.userFrameBrand || ''} ${order.userFrameModel || ''}`.trim()
                : '';

        return { lensType, lensIndex, lensBrand, laboratory, odItem, oiItem, frameInfo, lensItems };
    };

    const copyAllSmartLab = (order: Order) => {
        const d = getSmartLabData(order);
        const lines = [
            `=== PEDIDO SMARTLAB ===${' '}`,
            `Paciente: ${order.client.name}`,
            `Vendedor: ${order.user?.name || 'N/A'}`,
            `Tipo: ${d.lensType}`,
            '',
            `--- Correcciones ---`,
            `OD: Esf ${d.odItem?.sphereVal ?? '—'} | Cil ${d.odItem?.cylinderVal ?? '—'} | Eje ${d.odItem?.axisVal ?? '—'}`,
            `OI: Esf ${d.oiItem?.sphereVal ?? '—'} | Cil ${d.oiItem?.cylinderVal ?? '—'} | Eje ${d.oiItem?.axisVal ?? '—'}`,
        ];
        if (d.lensType === 'MULTIFOCAL' || d.lensType === 'BIFOCAL') {
            lines.push(`Adición OD: ${d.odItem?.additionVal ?? '—'}`);
            lines.push(`Adición OI: ${d.oiItem?.additionVal ?? '—'}`);
        }
        lines.push('');
        lines.push(`Material/Índice: ${d.lensIndex || '—'}`);
        lines.push(`Marca: ${d.lensBrand || '—'}`);
        lines.push(`Laboratorio: ${d.laboratory || '—'}`);
        if (d.frameInfo) lines.push(`Armazón: ${d.frameInfo}`);
        if (order.labNotes) lines.push(`Observaciones: ${order.labNotes}`);
        const color = labFields[`${order.id}_color`] ?? order.labColor;
        const treatment = labFields[`${order.id}_treatment`] ?? order.labTreatment;
        const diameter = labFields[`${order.id}_diameter`] ?? order.labDiameter;
        const pdOd = labFields[`${order.id}_pdOd`] ?? order.labPdOd;
        const pdOi = labFields[`${order.id}_pdOi`] ?? order.labPdOi;
        if (color) lines.push(`Color: ${color}`);
        if (treatment && treatment !== 'Ninguno') lines.push(`Tratamiento: ${treatment}`);
        if (diameter) lines.push(`Diámetro: ${diameter}`);
        if (pdOd) lines.push(`DP Ojo Derecho: ${pdOd}`);
        if (pdOi) lines.push(`DP Ojo Izquierdo: ${pdOi}`);
        lines.push(`N° Op CRM: #${order.id.slice(-4).toUpperCase()}`);

        copyToClipboard(lines.join('\n'), 'all');
    };

    const saveLabField = async (orderId: string, field: string, value: string) => {
        const key = `${orderId}_${field}`;
        setLabFields(prev => ({ ...prev, [key]: value }));
        setSavingField(key);
        try {
            const bodyMap: Record<string, string> = {
                color: 'labColor',
                treatment: 'labTreatment',
                diameter: 'labDiameter',
                pdOd: 'labPdOd',
                pdOi: 'labPdOi',
            };
            await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [bodyMap[field]]: value }),
            });
            // Update local orders state to reflect saved data
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, [bodyMap[field]]: value } : o));
        } catch (err) {
            console.error('Error saving lab field:', err);
        }
        setTimeout(() => setSavingField(null), 500);
    };

    // ── Filters ────────────────────────────────

    const filtered = orders.filter(o => {
        const matchSearch = search === '' ||
            o.client.name.toLowerCase().includes(search.toLowerCase()) ||
            o.id.toLowerCase().includes(search.toLowerCase()) ||
            (o.labOrderNumber || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === 'ALL' || (o.labStatus || 'NONE') === filterStatus;
        return matchSearch && matchStatus;
    });

    // ── Stats ──────────────────────────────────

    const stats = LAB_STEPS.map(step => ({
        ...step,
        count: orders.filter(o => (o.labStatus || 'NONE') === step.key).length,
    }));

    // ── Render ─────────────────────────────────

    return (
        <main className="p-4 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <div>
                    <h1 className="text-4xl font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-3">
                        <Package className="w-9 h-9 text-blue-500" /> Pedidos a Laboratorio
                    </h1>
                    <p className="text-stone-400 text-sm mt-1 font-medium">
                        Gestión y seguimiento de pedidos enviados a fábrica
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-black text-blue-500">{orders.length}</p>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Pedidos activos</p>
                </div>
            </div>

            {/* Pipeline Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
                {stats.map((step) => {
                    const Icon = step.icon;
                    const isActive = filterStatus === step.key;
                    return (
                        <button
                            key={step.key}
                            onClick={() => setFilterStatus(filterStatus === step.key ? 'ALL' : step.key)}
                            className={`relative rounded-2xl p-5 text-center transition-all border-2 group hover:scale-[1.02] ${isActive
                                ? `${step.bg} ${step.text} border-current shadow-lg`
                                : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 hover:border-stone-200 dark:hover:border-stone-600'
                                }`}
                        >
                            <Icon className={`w-5 h-5 mx-auto mb-2 ${isActive ? '' : 'text-stone-300 dark:text-stone-600 group-hover:text-stone-400'}`} />
                            <p className="text-3xl font-black">{step.count}</p>
                            <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${isActive ? 'opacity-80' : 'text-stone-400'}`}>
                                {step.label}
                            </p>
                            {isActive && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-current rounded-full animate-pulse" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Search */}
            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, N° venta o N° operación lab..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    />
                </div>
                {filterStatus !== 'ALL' && (
                    <button
                        onClick={() => setFilterStatus('ALL')}
                        className="px-5 py-2 bg-stone-100 dark:bg-stone-800 rounded-2xl text-xs font-bold text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all flex items-center gap-2"
                    >
                        <X className="w-3.5 h-3.5" /> Quitar filtro
                    </button>
                )}
            </div>

            {/* Orders List */}
            {loading ? (
                <div className="text-center py-20">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-sm font-bold text-stone-400">Cargando pedidos...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-3xl">
                    <Package className="w-16 h-16 text-stone-200 dark:text-stone-700 mx-auto mb-4" />
                    <p className="text-sm font-black text-stone-300 dark:text-stone-600 uppercase tracking-widest">
                        {filterStatus !== 'ALL' ? 'No hay pedidos con ese estado' : 'No hay pedidos pendientes'}
                    </p>
                    <p className="text-xs text-stone-300 dark:text-stone-600 mt-2">
                        Los pedidos llegan cuando se confirma una venta
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map(order => {
                        const step = getLabStep(order.labStatus || 'NONE');
                        const nextStep = getNextStatus(order.labStatus || 'NONE');
                        const nextStepInfo = nextStep ? getLabStep(nextStep) : null;
                        const Icon = step.icon;
                        const isExpanded = expandedId === order.id;
                        const isUpdating = updatingId === order.id;
                        const payProgress = order.total > 0 ? Math.min(100, (order.paid / order.total) * 100) : 100;

                        const financials = PricingService.calculateOrderFinancials(order);

                        return (
                            <div
                                key={order.id}
                                className={`bg-white dark:bg-stone-800 border-2 rounded-2xl transition-all overflow-hidden ${isExpanded
                                    ? `${step.ring} ring-2 border-transparent shadow-xl`
                                    : 'border-stone-100 dark:border-stone-700 hover:shadow-lg'
                                    }`}
                            >
                                {/* Main Row */}
                                <div className="p-6 flex items-center gap-5">
                                    {/* Status Icon */}
                                    <div className={`w-14 h-14 rounded-2xl ${step.bg} ${step.text} flex items-center justify-center flex-shrink-0 transition-all ${isUpdating ? 'animate-pulse' : ''}`}>
                                        <Icon className="w-6 h-6" />
                                    </div>

                                    {/* Client Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-lg font-black text-stone-800 dark:text-white truncate">
                                                {order.client.name}
                                            </h3>
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${step.bg} ${step.text}`}>
                                                {step.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                            <span className="flex items-center gap-1">
                                                <Hash className="w-3 h-3" />
                                                {order.id.slice(-4).toUpperCase()}
                                            </span>
                                            <span>·</span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(new Date(order.createdAt), "d MMM yyyy", { locale: es })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Financial Chips (Standardized) */}
                                    <div className="flex items-center gap-2">
                                        {!financials.hasBalance ? (
                                            <div className="px-6 py-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center min-w-[320px]">
                                                <span className="text-[10px] font-black uppercase tracking-widest">PEDIDO SALDADO / PAGADO</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-800 text-center min-w-[100px]">
                                                    <span className="text-[8px] font-black text-emerald-500 uppercase block tracking-tighter">Efectivo</span>
                                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                        ${financials.remainingCash.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="px-3 py-2 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-800 text-center min-w-[100px]">
                                                    <span className="text-[8px] font-black text-purple-500 uppercase block tracking-tighter">Transf</span>
                                                    <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                                                        ${financials.remainingTransfer.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="px-3 py-2 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-100 dark:border-orange-800 text-center min-w-[100px]">
                                                    <span className="text-[8px] font-black text-orange-500 uppercase block tracking-tighter">Tarjeta</span>
                                                    <span className="text-xs font-black text-orange-600 dark:text-orange-400">
                                                        ${financials.remainingCard.toLocaleString()}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Lab Order Number */}
                                    <div className="flex-shrink-0 w-44">
                                        {editingId === order.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    placeholder="N° operación"
                                                    className="w-full px-3 py-2 border-2 border-blue-300 dark:border-blue-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none bg-white dark:bg-stone-900"
                                                    autoFocus
                                                    onKeyDown={e => e.key === 'Enter' && saveLabOrderNumber(order.id)}
                                                />
                                                <button
                                                    onClick={() => saveLabOrderNumber(order.id)}
                                                    className="p-2 bg-blue-500 text-white rounded-xl hover:scale-105 transition-all"
                                                >
                                                    <Save className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => { setEditingId(null); setEditValue(''); }}
                                                    className="p-2 bg-stone-200 dark:bg-stone-700 text-stone-500 rounded-xl hover:scale-105 transition-all"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingId(order.id);
                                                    setEditValue(order.labOrderNumber || '');
                                                }}
                                                className={`w-full text-left px-3 py-2 border-2 border-dashed rounded-xl transition-all group ${order.labOrderNumber
                                                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 hover:border-blue-400'
                                                    : 'bg-stone-50 dark:bg-stone-700 border-stone-200 dark:border-stone-600 hover:border-blue-300 dark:hover:border-blue-700'
                                                    }`}
                                            >
                                                {order.labOrderNumber ? (
                                                    <div>
                                                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">N° Op. Lab</span>
                                                        <span className="text-sm font-black text-blue-600 dark:text-blue-400">{order.labOrderNumber}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-stone-400 group-hover:text-blue-500 transition-colors">
                                                        <Hash className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Agregar N° Op.</span>
                                                    </div>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Total */}
                                    <div className="flex-shrink-0 text-right w-28">
                                        <p className="text-xl font-black text-stone-800 dark:text-white">${(order.total || 0).toLocaleString()}</p>
                                        <div className="w-full h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full mt-2 overflow-hidden">
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

                                        {/* Download Lab Sheet */}
                                        <button
                                            onClick={() => downloadLabSheet(order)}
                                            className="p-3 bg-stone-50 dark:bg-stone-700 text-stone-500 dark:text-stone-400 rounded-xl hover:scale-110 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400 transition-all"
                                            title="Descargar PDF del pedido"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>

                                        {/* SmartLab Button */}
                                        <button
                                            onClick={() => setSmartLabId(order.id)}
                                            className="p-3 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl hover:scale-110 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all"
                                            title="Cargar en SmartLab"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>

                                        {/* WhatsApp Send to Client */}
                                        <button
                                            onClick={() => sendOrderWhatsApp(order)}
                                            className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl hover:scale-110 hover:bg-emerald-100 transition-all"
                                            title="Enviar resumen al cliente por WhatsApp"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                        </button>

                                        {/* Expand */}
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : order.id)}
                                            className={`p-3 rounded-xl transition-all hover:scale-110 ${isExpanded
                                                ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900'
                                                : 'bg-stone-50 dark:bg-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-600'
                                                }`}
                                            title="Ver detalle"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Detail */}
                                {isExpanded && (
                                    <div className="border-t-2 border-stone-100 dark:border-stone-700 px-6 pb-6 pt-5 bg-stone-50/50 dark:bg-stone-900/50">
                                        {/* Progress Pipeline */}
                                        <div className="flex items-center gap-2 mb-6 p-4 bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700">
                                            {LAB_STEPS.map((s, i) => {
                                                const currentIdx = LAB_STEPS.findIndex(x => x.key === (order.labStatus || 'NONE'));
                                                const isPast = i <= currentIdx;
                                                const isCurrent = i === currentIdx;
                                                const SIcon = s.icon;
                                                return (
                                                    <div key={s.key} className="flex items-center flex-1">
                                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${isCurrent
                                                            ? `${s.bg} ${s.text} font-black ring-2 ${s.ring}`
                                                            : isPast
                                                                ? `${s.text} opacity-60`
                                                                : 'text-stone-300 dark:text-stone-600'
                                                            }`}>
                                                            <SIcon className="w-4 h-4" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">{s.label}</span>
                                                        </div>
                                                        {i < LAB_STEPS.length - 1 && (
                                                            <ChevronRight className={`w-4 h-4 mx-1 flex-shrink-0 ${isPast ? 'text-stone-400' : 'text-stone-200 dark:text-stone-700'}`} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Items Table */}
                                        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 overflow-hidden">
                                            <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-700">
                                                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Productos del pedido</h4>
                                            </div>
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-stone-100 dark:border-stone-700">
                                                        <th className="text-left text-[9px] font-black text-stone-400 uppercase tracking-widest px-5 py-3">Producto</th>
                                                        <th className="text-left text-[9px] font-black text-stone-400 uppercase tracking-widest px-5 py-3">Tipo</th>
                                                        <th className="text-center text-[9px] font-black text-stone-400 uppercase tracking-widest px-5 py-3">Cant.</th>
                                                        <th className="text-right text-[9px] font-black text-stone-400 uppercase tracking-widest px-5 py-3">Precio</th>
                                                        <th className="text-right text-[9px] font-black text-stone-400 uppercase tracking-widest px-5 py-3">Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {order.items.map(item => (
                                                        <tr key={item.id} className="border-b border-stone-50 dark:border-stone-700/50 last:border-0">
                                                            <td className="px-5 py-3 text-sm font-bold text-stone-800 dark:text-white">
                                                                {item.product?.brand} {item.product?.model || item.product?.name || '—'}
                                                            </td>
                                                            <td className="px-5 py-3 text-xs text-stone-500">
                                                                {item.product?.type || item.product?.category || '—'}
                                                            </td>
                                                            <td className="px-5 py-3 text-sm font-bold text-stone-600 dark:text-stone-300 text-center">
                                                                {item.quantity}
                                                            </td>
                                                            <td className="px-5 py-3 text-sm font-bold text-stone-600 dark:text-stone-300 text-right">
                                                                ${item.price?.toLocaleString()}
                                                            </td>
                                                            <td className="px-5 py-3 text-sm font-black text-stone-800 dark:text-white text-right">
                                                                ${(item.price * item.quantity).toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <div className="px-5 py-4 bg-stone-50 dark:bg-stone-900 flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                    {order.client.phone && (
                                                        <span className="text-xs text-stone-400">
                                                            📞 {order.client.phone}
                                                        </span>
                                                    )}
                                                    {order.labNotes && (
                                                        <span className="text-xs text-stone-400 italic">
                                                            📝 {order.labNotes}
                                                        </span>
                                                    )}
                                                </div>
                                            {/* Financial Summary (Standardized) */}
                                            <div className="mt-5 p-6 rounded-[2rem] bg-stone-900 dark:bg-black text-white border-2 border-stone-800 flex justify-between items-center shadow-xl">
                                                <div className="flex gap-8">
                                                    <div className="text-center">
                                                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Efectivo</span>
                                                        <span className="text-xl font-black text-emerald-400">${financials.totalCash.toLocaleString()}</span>
                                                    </div>
                                                    <div className="text-center">
                                                        <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest block mb-1">Transferencia</span>
                                                        <span className="text-xl font-black text-purple-400">${financials.totalTransfer.toLocaleString()}</span>
                                                    </div>
                                                    <div className="text-center">
                                                        <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest block mb-1">Tarjeta</span>
                                                        <span className="text-xl font-black text-orange-400">${financials.totalCard.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right border-l border-stone-800 pl-8 ml-4">
                                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1">Abonado Real</span>
                                                    <span className="text-3xl font-black text-amber-400">${financials.paidReal.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            </div>
                                        </div>

                                        {/* Frame Info Badge */}
                                        {order.frameSource && (
                                            <div className="mt-3 flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl">
                                                <span className="text-lg">🕶️</span>
                                                <div>
                                                    <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Armazón</p>
                                                    <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
                                                        {order.frameSource === 'OPTICA'
                                                            ? 'De la óptica (incluido en el pedido)'
                                                            : `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}${order.userFrameNotes ? ' · ' + order.userFrameNotes : ''}`
                                                        }
                                                    </p>
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

            {/* ── SmartLab Modal ─────────────────────────── */}
            {smartLabId && (() => {
                const order = orders.find(o => o.id === smartLabId);
                if (!order) return null;
                const d = getSmartLabData(order);

                const CopyBtn = ({ value, field }: { value: string; field: string }) => (
                    <button
                        onClick={() => copyToClipboard(value, field)}
                        className={`p-1.5 rounded-lg transition-all hover:scale-110 flex-shrink-0 ${copiedField === field
                            ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600'
                            : 'bg-stone-100 dark:bg-stone-700 text-stone-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950'
                            }`}
                        title={copiedField === field ? '¡Copiado!' : 'Copiar'}
                    >
                        {copiedField === field
                            ? <CheckCheck className="w-3.5 h-3.5" />
                            : <Copy className="w-3.5 h-3.5" />
                        }
                    </button>
                );

                const LENS_TYPE_LABELS: Record<string, string> = {
                    'MONOFOCAL': 'Monofocal',
                    'MULTIFOCAL': 'Multifocal',
                    'BIFOCAL': 'Bifocal',
                    'OCUPACIONAL': 'Ocupacional',
                    'SOLAR': 'Solar',
                };

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSmartLabId(null)}>
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                        {/* Modal */}
                        <div
                            className="relative bg-white dark:bg-stone-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-5 rounded-t-3xl">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                            <ExternalLink className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black tracking-tight">Cargar en SmartLab</h2>
                                            <p className="text-blue-200 text-xs font-medium">Copiá cada campo y pegalo en SmartLab</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => copyAllSmartLab(order)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all hover:scale-105 ${copiedField === 'all'
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-white/20 hover:bg-white/30 text-white'
                                                }`}
                                        >
                                            {copiedField === 'all' ? <CheckCheck className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                                            {copiedField === 'all' ? '¡Copiado!' : 'Copiar Todo'}
                                        </button>
                                        <button
                                            onClick={() => window.open(SMARTLAB_URL, '_blank')}
                                            className="px-4 py-2 bg-white text-blue-700 rounded-xl text-xs font-black flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Abrir SmartLab
                                        </button>
                                        <button
                                            onClick={() => setSmartLabId(null)}
                                            className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-8 space-y-6">
                                {/* Tipo de Lente */}
                                <div className="flex items-center gap-3 flex-wrap">
                                    {Object.entries(LENS_TYPE_LABELS).map(([key, label]) => (
                                        <span
                                            key={key}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${d.lensType === key
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-300'
                                                : 'bg-stone-100 dark:bg-stone-700 text-stone-300 dark:text-stone-600'
                                                }`}
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>

                                {/* Paciente y Vendedor */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Paciente</label>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-bold text-stone-800 dark:text-white">{order.client.name}</span>
                                            <CopyBtn value={order.client.name} field="paciente" />
                                        </div>
                                    </div>
                                    <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Vendedor</label>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-bold text-stone-800 dark:text-white">{order.user?.name || 'N/A'}</span>
                                            <CopyBtn value={order.user?.name || ''} field="vendedor" />
                                        </div>
                                    </div>
                                </div>

                                {/* Correcciones */}
                                <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                                    <div className="px-5 py-3 bg-stone-50 dark:bg-stone-900 border-b border-stone-100 dark:border-stone-700">
                                        <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Correcciones</h3>
                                    </div>
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-stone-100 dark:border-stone-700">
                                                <th className="text-left text-[9px] font-black text-stone-400 uppercase tracking-widest px-5 py-2.5 w-20"></th>
                                                <th className="text-center text-[9px] font-black text-stone-400 uppercase tracking-widest px-3 py-2.5">Esférico</th>
                                                <th className="text-center text-[9px] font-black text-stone-400 uppercase tracking-widest px-3 py-2.5">Cilíndrico</th>
                                                <th className="text-center text-[9px] font-black text-stone-400 uppercase tracking-widest px-3 py-2.5">Eje</th>
                                                {(d.lensType === 'MULTIFOCAL' || d.lensType === 'BIFOCAL' || d.lensType === 'OCUPACIONAL') && (
                                                    <th className="text-center text-[9px] font-black text-stone-400 uppercase tracking-widest px-3 py-2.5">Adición</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[{ label: 'Ojo Derecho', item: d.odItem, prefix: 'od' }, { label: 'Ojo Izquierdo', item: d.oiItem, prefix: 'oi' }].map(row => (
                                                <tr key={row.prefix} className="border-b border-stone-50 dark:border-stone-700/50 last:border-0">
                                                    <td className="px-5 py-3 text-xs font-black text-stone-500 uppercase tracking-widest">{row.prefix.toUpperCase()}</td>
                                                    <td className="px-3 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span className={`text-sm font-bold ${row.item?.sphereVal != null ? 'text-stone-800 dark:text-white' : 'text-stone-300 dark:text-stone-600'}`}>
                                                                {row.item?.sphereVal != null ? (row.item.sphereVal > 0 ? `+${row.item.sphereVal.toFixed(2)}` : row.item.sphereVal.toFixed(2)) : '—'}
                                                            </span>
                                                            {row.item?.sphereVal != null && <CopyBtn value={row.item.sphereVal > 0 ? `+${row.item.sphereVal.toFixed(2)}` : row.item.sphereVal.toFixed(2)} field={`${row.prefix}_sph`} />}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span className={`text-sm font-bold ${row.item?.cylinderVal != null ? 'text-stone-800 dark:text-white' : 'text-stone-300 dark:text-stone-600'}`}>
                                                                {row.item?.cylinderVal != null ? (row.item.cylinderVal > 0 ? `+${row.item.cylinderVal.toFixed(2)}` : row.item.cylinderVal.toFixed(2)) : '—'}
                                                            </span>
                                                            {row.item?.cylinderVal != null && <CopyBtn value={row.item.cylinderVal > 0 ? `+${row.item.cylinderVal.toFixed(2)}` : row.item.cylinderVal.toFixed(2)} field={`${row.prefix}_cyl`} />}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span className={`text-sm font-bold ${row.item?.axisVal != null ? 'text-stone-800 dark:text-white' : 'text-stone-300 dark:text-stone-600'}`}>
                                                                {row.item?.axisVal != null ? `${row.item.axisVal}°` : '—'}
                                                            </span>
                                                            {row.item?.axisVal != null && <CopyBtn value={String(row.item.axisVal)} field={`${row.prefix}_axis`} />}
                                                        </div>
                                                    </td>
                                                    {(d.lensType === 'MULTIFOCAL' || d.lensType === 'BIFOCAL' || d.lensType === 'OCUPACIONAL') && (
                                                        <td className="px-3 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <span className={`text-sm font-bold ${row.item?.additionVal != null ? 'text-stone-800 dark:text-white' : 'text-stone-300 dark:text-stone-600'}`}>
                                                                    {row.item?.additionVal != null ? `+${row.item.additionVal.toFixed(2)}` : '—'}
                                                                </span>
                                                                {row.item?.additionVal != null && <CopyBtn value={`+${row.item.additionVal.toFixed(2)}`} field={`${row.prefix}_add`} />}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Material, Marca, Laboratorio */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Material / Índice</label>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-sm font-bold ${d.lensIndex ? 'text-stone-800 dark:text-white' : 'text-stone-300 dark:text-stone-600 italic'}`}>
                                                {d.lensIndex || 'No registrado'}
                                            </span>
                                            {d.lensIndex && <CopyBtn value={d.lensIndex} field="material" />}
                                        </div>
                                    </div>
                                    <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Marca</label>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-sm font-bold ${d.lensBrand ? 'text-stone-800 dark:text-white' : 'text-stone-300 dark:text-stone-600 italic'}`}>
                                                {d.lensBrand || 'No registrado'}
                                            </span>
                                            {d.lensBrand && <CopyBtn value={d.lensBrand} field="marca" />}
                                        </div>
                                    </div>
                                    <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Laboratorio</label>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-sm font-bold ${d.laboratory ? 'text-stone-800 dark:text-white' : 'text-stone-300 dark:text-stone-600 italic'}`}>
                                                {d.laboratory || 'No registrado'}
                                            </span>
                                            {d.laboratory && <CopyBtn value={d.laboratory} field="laboratorio" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Armazón */}
                                {(d.frameInfo || order.frameSource) && (
                                    <div className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 rounded-2xl p-4">
                                        <label className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-2">🕶️ Armazón</label>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-bold text-amber-900 dark:text-amber-300">
                                                {order.frameSource === 'OPTICA'
                                                    ? `De la óptica${d.frameInfo ? ` — ${d.frameInfo}` : ''}`
                                                    : order.frameSource === 'USUARIO'
                                                        ? `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}${order.userFrameNotes ? ` · ${order.userFrameNotes}` : ''}`.trim()
                                                        : d.frameInfo || 'Sin especificar'
                                                }
                                            </span>
                                            {d.frameInfo && <CopyBtn value={d.frameInfo} field="armazon" />}
                                        </div>
                                    </div>
                                )}

                                {/* Observaciones */}
                                <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Observaciones</label>
                                    <div className="flex items-start justify-between gap-2">
                                        <span className={`text-sm ${order.labNotes ? 'text-stone-800 dark:text-white' : 'text-stone-300 dark:text-stone-600 italic'}`}>
                                            {order.labNotes || 'Sin observaciones'}
                                        </span>
                                        {order.labNotes && <CopyBtn value={order.labNotes} field="obs" />}
                                    </div>
                                </div>

                                {/* Color, Tratamiento, Diámetro, DP */}
                                {(() => {
                                    const TREATMENTS = ['Ninguno', 'Ultralayer', 'Multifacetado', 'Laca', 'Element'];
                                    const getVal = (field: string) => labFields[`${order.id}_${field}`] ?? (order as any)[`lab${field.charAt(0).toUpperCase() + field.slice(1)}`] ?? '';
                                    const colorVal = getVal('color') || '';
                                    const treatmentVal = getVal('treatment') || 'Ninguno';
                                    const diameterVal = getVal('diameter') || '';
                                    const pdOdVal = getVal('pdOd') || '';
                                    const pdOiVal = getVal('pdOi') || '';

                                    return (
                                        <div className="space-y-4">
                                            {/* Color */}
                                            <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Color</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={colorVal}
                                                        onChange={e => setLabFields(prev => ({ ...prev, [`${order.id}_color`]: e.target.value }))}
                                                        onBlur={e => saveLabField(order.id, 'color', e.target.value)}
                                                        placeholder="Ej: Blanco, Fotocromático, Gris..."
                                                        className="flex-1 px-3 py-2 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white dark:bg-stone-900 transition-all"
                                                    />
                                                    {colorVal && <CopyBtn value={colorVal} field="lab_color" />}
                                                    {savingField === `${order.id}_color` && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                                                </div>
                                            </div>

                                            {/* Tratamientos */}
                                            <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Tratamientos</label>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {TREATMENTS.map(t => (
                                                        <button
                                                            key={t}
                                                            onClick={() => saveLabField(order.id, 'treatment', t)}
                                                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 ${treatmentVal === t
                                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                                                    : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600'
                                                                }`}
                                                        >
                                                            {t}
                                                        </button>
                                                    ))}
                                                    {treatmentVal && treatmentVal !== 'Ninguno' && <CopyBtn value={treatmentVal} field="lab_treatment" />}
                                                    {savingField === `${order.id}_treatment` && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                                                </div>
                                            </div>

                                            {/* Diámetro + DP OD/OI */}
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Diámetro</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={diameterVal}
                                                            onChange={e => setLabFields(prev => ({ ...prev, [`${order.id}_diameter`]: e.target.value }))}
                                                            onBlur={e => saveLabField(order.id, 'diameter', e.target.value)}
                                                            placeholder="Ej: 65"
                                                            className="flex-1 px-3 py-2 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white dark:bg-stone-900 transition-all"
                                                        />
                                                        {diameterVal && <CopyBtn value={diameterVal} field="lab_diameter" />}
                                                    </div>
                                                </div>
                                                <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">DP Ojo Derecho</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={pdOdVal}
                                                            onChange={e => setLabFields(prev => ({ ...prev, [`${order.id}_pdOd`]: e.target.value }))}
                                                            onBlur={e => saveLabField(order.id, 'pdOd', e.target.value)}
                                                            placeholder="Ej: 32"
                                                            className="flex-1 px-3 py-2 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white dark:bg-stone-900 transition-all"
                                                        />
                                                        {pdOdVal && <CopyBtn value={pdOdVal} field="lab_pdOd" />}
                                                    </div>
                                                </div>
                                                <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">DP Ojo Izquierdo</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={pdOiVal}
                                                            onChange={e => setLabFields(prev => ({ ...prev, [`${order.id}_pdOi`]: e.target.value }))}
                                                            onBlur={e => saveLabField(order.id, 'pdOi', e.target.value)}
                                                            placeholder="Ej: 31"
                                                            className="flex-1 px-3 py-2 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white dark:bg-stone-900 transition-all"
                                                        />
                                                        {pdOiVal && <CopyBtn value={pdOiVal} field="lab_pdOi" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Reference */}
                                <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest pt-2">
                                    <span>Venta #{order.id.slice(-4).toUpperCase()} · {format(new Date(order.createdAt), "d MMM yyyy", { locale: es })}</span>
                                    <span>Total: ${(order.total || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </main>
    );
}
