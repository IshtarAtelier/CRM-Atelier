'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Download, Search, Package, Clock, CheckCircle2, Truck, Eye, Pencil, Save, X, AlertTriangle, MessageCircle, FileText, Banknote, ArrowRightLeft, CreditCard, ChevronRight, ExternalLink, Clipboard, CheckCheck, Copy, Loader2, ArrowRight, FlaskConical, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import InvoiceModal from '@/components/InvoiceModal';
import { SMARTLAB_CONFIG, SMARTLAB_OPTIONS } from '@/lib/smartlab-config';

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
    const [smartLabId, setSmartLabId] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [labFields, setLabFields] = useState<Record<string, string>>({});
    const [savingField, setSavingField] = useState<string | null>(null);
    const [autoValidationStatus, setAutoValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'error'>('idle');
    const [autoValidationResult, setAutoValidationResult] = useState<any>(null);

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
        const res = await fetch('/api/orders');
        const data = await res.json();
        // Only show SALE orders (not QUOTE)
        const sales = (data || []).filter((o: Order) => o.orderType === 'SALE' && !o.isDeleted);
        setOrders(sales);
        setLoading(false);
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

    const SMARTLAB_URL = SMARTLAB_CONFIG.loginUrl;

    const copyToClipboard = async (text: string, fieldId: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(fieldId);
            setTimeout(() => setCopiedField(null), 1500);
        } catch {
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
        const odItem = lensItems.find((i: any) => i.eye === 'OD');
        const oiItem = lensItems.find((i: any) => i.eye === 'OI');
        const lensType = lensItems[0]?.product?.type || 'MONOFOCAL';
        const lensIndex = (lensItems[0]?.product as any)?.lensIndex || '';
        const lensBrand = lensItems[0]?.product?.brand || '';
        const laboratory = (lensItems[0]?.product as any)?.laboratory || '';
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
            `Vendedor: ${(order as any).user?.name || 'N/A'}`,
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

    const validateSmartLab = async (orderId: string) => {
        setAutoValidationStatus('validating');
        try {
            const res = await fetch('/api/smartlab-submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, action: 'validate' }),
            });
            if (res.ok) {
                const data = await res.json();
                setAutoValidationResult(data);
                setAutoValidationStatus(data.validation?.isValid ? 'valid' : 'invalid');
            } else {
                setAutoValidationStatus('error');
            }
        } catch (err) {
            console.error('Error validating SmartLab:', err);
            setAutoValidationStatus('error');
        }
    };

    const submitToSmartLab = async (orderId: string) => {
        if (!confirm('¿Enviar este pedido automáticamente a SmartLab?')) return;
        setAutoValidationStatus('validating');
        try {
            const res = await fetch('/api/smartlab-submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, action: 'submit' }),
            });
            const data = await res.json();
            if (res.ok) {
                alert(`✅ ${data.message || 'Pedido enviado exitosamente'}`);
                // Advance status to SENT if successful
                const currentOrder = orders.find(o => o.id === orderId);
                if (currentOrder && currentOrder.labStatus === 'NONE') {
                    await advanceStatus(orderId, 'NONE');
                }
                setSmartLabId(null);
            } else {
                alert(`❌ Error: ${data.error || 'No se pudo enviar el pedido'}`);
                setAutoValidationStatus('invalid');
            }
        } catch (err: any) {
            alert(`❌ Error de conexión: ${err.message}`);
            setAutoValidationStatus('error');
        }
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
                frameA: 'frameA',
                frameB: 'frameB',
                frameDbl: 'frameDbl',
                frameEdc: 'frameEdc',
                prismOD: 'labPrismOD',
                prismOI: 'labPrismOI',
                baseCurve: 'labBaseCurve',
                frameType: 'labFrameType',
                bevelPosition: 'labBevelPosition',
            };
            await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [bodyMap[field]]: value }),
            });
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, [bodyMap[field]]: value } : o));
            
            // Re-validate after saving if modal is open
            if (smartLabId === orderId) {
                validateSmartLab(orderId);
            }
        } catch (err) {
            console.error('Error saving lab field:', err);
        }
        setTimeout(() => setSavingField(null), 500);
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

                                        {/* SmartLab Button */}
                                        <button
                                            onClick={() => {
                                                setSmartLabId(order.id);
                                                validateSmartLab(order.id);
                                            }}
                                            className="p-3 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl hover:scale-110 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all"
                                            title="Cargar en SmartLab"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>

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

            {/* ── SmartLab Modal ─────────────────────────── */}
            {smartLabId && orders.filter(o => o.id === smartLabId).map(order => {
                const getVal = (field: string) => labFields[`${order.id}_${field}`] ?? (order as any)[`lab${field.charAt(0).toUpperCase() + field.slice(1)}`] ?? '';
                const d = getSmartLabData(order);
                const LENS_TYPE_LABELS: Record<string, string> = {
                    'MONOFOCAL': 'Monofocal',
                    'MULTIFOCAL': 'Multifocal',
                    'BIFOCAL': 'Bifocal',
                    'OCUPACIONAL': 'Ocupacional',
                    'SOLAR': 'Solar',
                };

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

                return (
                    <div key={order.id} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSmartLabId(null)}>
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
                                            <p className="text-blue-200 text-xs font-medium">Copiá cada campo y pegalo en SmartLab (Venta #{order.id.slice(-4).toUpperCase()})</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {autoValidationStatus === 'valid' && (
                                            <button
                                                onClick={() => submitToSmartLab(order.id)}
                                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
                                            >
                                                <Package className="w-4 h-4" />
                                                Enviar SmartLab (Auto)
                                            </button>
                                        )}
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
                                            Manual
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

                            {/* Validation Status Banner */}
                            <div className={`px-8 py-3 border-b flex items-center justify-between transition-all duration-300 ${
                                autoValidationStatus === 'validating' ? 'bg-stone-50 border-stone-100' :
                                autoValidationStatus === 'valid' ? 'bg-emerald-50 border-emerald-100' :
                                autoValidationStatus === 'invalid' ? 'bg-amber-50 border-amber-100' :
                                'bg-red-50 border-red-100'
                            }`}>
                                <div className="flex items-center gap-3">
                                    {autoValidationStatus === 'validating' ? (
                                        <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
                                    ) : autoValidationStatus === 'valid' ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    )}
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                                        autoValidationStatus === 'validating' ? 'text-stone-400' :
                                        autoValidationStatus === 'valid' ? 'text-emerald-600' :
                                        autoValidationStatus === 'invalid' ? 'text-amber-600' :
                                        'text-red-600'
                                    }`}>
                                        {autoValidationStatus === 'validating' ? 'Validando datos...' :
                                         autoValidationStatus === 'valid' ? 'Pedido listo para enviar' :
                                         autoValidationStatus === 'invalid' ? 'Faltan datos requeridos' :
                                         'Error de validación'}
                                    </span>
                                </div>
                                {autoValidationResult?.validation?.missingFields?.length > 0 && (
                                    <div className="flex flex-wrap gap-2 justify-end max-w-[60%]">
                                        {autoValidationResult.validation.missingFields.map((f: string) => (
                                            <span key={f} className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-[9px] font-black uppercase">Falta: {f}</span>
                                        ))}
                                    </div>
                                )}
                                {autoValidationResult?.validation?.warnings?.length > 0 && autoValidationStatus === 'valid' && (
                                    <div className="flex flex-wrap gap-2 justify-end max-w-[60%]">
                                        {autoValidationResult.validation.warnings.map((w: string) => (
                                            <span key={w} className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-[9px] font-black uppercase" title={w}>⚠️ Sugerencia</span>
                                        ))}
                                    </div>
                                )}
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
                                            <span className="text-sm font-bold text-stone-800 dark:text-white">{(order as any).user?.name || 'N/A'}</span>
                                            <CopyBtn value={(order as any).user?.name || ''} field="vendedor" />
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

                                {/* Datos de la Receta */}
                                {order.prescription && (() => {
                                    const rx = order.prescription;
                                    const fmtVal = (v: number | null | undefined, suffix = '') => {
                                        if (v == null) return '—';
                                        return (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)) + suffix;
                                    };
                                    const fmtNum = (v: number | null | undefined) => v != null ? String(v) : '—';
                                    const hasNear = rx.prescriptionType === 'NEAR' && (rx.nearSphereOD != null || rx.nearSphereOI != null);
                                    const hasDnp = rx.distanceOD != null || rx.distanceOI != null || rx.pd != null;
                                    const hasHeight = rx.heightOD != null || rx.heightOI != null;

                                    return (
                                        <div className="border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl overflow-hidden">
                                            <div className="px-5 py-3 bg-emerald-100/60 dark:bg-emerald-900/40 border-b border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                                                <h3 className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">📋 Receta Vinculada</h3>
                                                {rx.imageUrl && (
                                                    <a href={rx.imageUrl} target="_blank" className="text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline flex items-center gap-1">
                                                        <Eye className="w-3 h-3" /> Ver Foto
                                                    </a>
                                                )}
                                            </div>
                                            <div className="p-5 space-y-4">
                                                {/* Lejos */}
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="border-b border-emerald-200/50 dark:border-emerald-800/50">
                                                            <th className="text-left text-[9px] font-black text-emerald-600 uppercase tracking-widest px-3 py-2 w-16">{hasNear ? 'LEJOS' : ''}</th>
                                                            <th className="text-center text-[9px] font-black text-emerald-600/60 uppercase tracking-widest px-2 py-2">Esf</th>
                                                            <th className="text-center text-[9px] font-black text-emerald-600/60 uppercase tracking-widest px-2 py-2">Cil</th>
                                                            <th className="text-center text-[9px] font-black text-emerald-600/60 uppercase tracking-widest px-2 py-2">Eje</th>
                                                            {(rx.additionOD != null || rx.additionOI != null || rx.addition != null) && (
                                                                <th className="text-center text-[9px] font-black text-emerald-600/60 uppercase tracking-widest px-2 py-2">Add</th>
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[{ label: 'OD', sph: rx.sphereOD, cyl: rx.cylinderOD, axis: rx.axisOD, add: rx.additionOD ?? rx.addition },
                                                          { label: 'OI', sph: rx.sphereOI, cyl: rx.cylinderOI, axis: rx.axisOI, add: rx.additionOI ?? rx.addition }].map(eye => (
                                                            <tr key={eye.label} className="border-b border-emerald-100/50 dark:border-emerald-800/30 last:border-0">
                                                                <td className="px-3 py-2 text-xs font-black text-emerald-700 dark:text-emerald-300">{eye.label}</td>
                                                                <td className="px-2 py-2 text-center text-sm font-bold text-stone-800 dark:text-white">{fmtVal(eye.sph)}</td>
                                                                <td className="px-2 py-2 text-center text-sm font-bold text-stone-800 dark:text-white">{fmtVal(eye.cyl)}</td>
                                                                <td className="px-2 py-2 text-center text-sm font-bold text-stone-800 dark:text-white">{eye.axis != null ? `${eye.axis}°` : '—'}</td>
                                                                {(rx.additionOD != null || rx.additionOI != null || rx.addition != null) && (
                                                                    <td className="px-2 py-2 text-center text-sm font-bold text-stone-800 dark:text-white">{fmtVal(eye.add)}</td>
                                                                )}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>

                                                {/* Cerca (si prescriptionType = NEAR) */}
                                                {hasNear && (
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr className="border-b border-emerald-200/50 dark:border-emerald-800/50">
                                                                <th className="text-left text-[9px] font-black text-emerald-600 uppercase tracking-widest px-3 py-2 w-16">CERCA</th>
                                                                <th className="text-center text-[9px] font-black text-emerald-600/60 uppercase tracking-widest px-2 py-2">Esf</th>
                                                                <th className="text-center text-[9px] font-black text-emerald-600/60 uppercase tracking-widest px-2 py-2">Cil</th>
                                                                <th className="text-center text-[9px] font-black text-emerald-600/60 uppercase tracking-widest px-2 py-2">Eje</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {[{ label: 'OD', sph: rx.nearSphereOD, cyl: rx.nearCylinderOD, axis: rx.nearAxisOD },
                                                              { label: 'OI', sph: rx.nearSphereOI, cyl: rx.nearCylinderOI, axis: rx.nearAxisOI }].map(eye => (
                                                                <tr key={eye.label} className="border-b border-emerald-100/50 dark:border-emerald-800/30 last:border-0">
                                                                    <td className="px-3 py-2 text-xs font-black text-emerald-700 dark:text-emerald-300">{eye.label}</td>
                                                                    <td className="px-2 py-2 text-center text-sm font-bold text-stone-800 dark:text-white">{fmtVal(eye.sph)}</td>
                                                                    <td className="px-2 py-2 text-center text-sm font-bold text-stone-800 dark:text-white">{fmtVal(eye.cyl)}</td>
                                                                    <td className="px-2 py-2 text-center text-sm font-bold text-stone-800 dark:text-white">{eye.axis != null ? `${eye.axis}°` : '—'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}

                                                {/* DNP + Altura */}
                                                {(hasDnp || hasHeight) && (
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {hasDnp && (
                                                            <div className="bg-white/60 dark:bg-stone-800/60 rounded-xl p-3">
                                                                <span className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest block mb-1">DNP (Dist. Pupilar)</span>
                                                                <div className="flex gap-4 text-sm font-bold text-stone-800 dark:text-white">
                                                                    <span>OD: {fmtNum(rx.distanceOD ?? rx.pd)}</span>
                                                                    <span>OI: {fmtNum(rx.distanceOI ?? rx.pd)}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {hasHeight && (
                                                            <div className="bg-white/60 dark:bg-stone-800/60 rounded-xl p-3">
                                                                <span className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest block mb-1">Altura</span>
                                                                <div className="flex gap-4 text-sm font-bold text-stone-800 dark:text-white">
                                                                    <span>OD: {fmtNum(rx.heightOD)}</span>
                                                                    <span>OI: {fmtNum(rx.heightOI)}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Notas de la receta */}
                                                {rx.notes && (
                                                    <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-white/40 dark:bg-stone-800/40 rounded-lg px-3 py-2">
                                                        <span className="font-black">Notas:</span> {rx.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

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
                                <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Observaciones</label>
                                    <div className="flex items-center justify-between gap-2">
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

                                             {/* Prismas */}
                                             <div className="grid grid-cols-2 gap-4">
                                                 <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                                     <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Prisma OD</label>
                                                     <div className="flex items-center gap-2">
                                                         <input
                                                             type="text"
                                                             value={getVal('prismOD')}
                                                             onChange={e => setLabFields(prev => ({ ...prev, [`${order.id}_prismOD`]: e.target.value }))}
                                                             onBlur={e => saveLabField(order.id, 'prismOD', e.target.value)}
                                                             placeholder="Ej: 2.0 BI"
                                                             className="flex-1 px-3 py-2 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-medium outline-none bg-white dark:bg-stone-900"
                                                         />
                                                     </div>
                                                 </div>
                                                 <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                                     <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Prisma OI</label>
                                                     <div className="flex items-center gap-2">
                                                         <input
                                                             type="text"
                                                             value={getVal('prismOI')}
                                                             onChange={e => setLabFields(prev => ({ ...prev, [`${order.id}_prismOI`]: e.target.value }))}
                                                             onBlur={e => saveLabField(order.id, 'prismOI', e.target.value)}
                                                             placeholder="Ej: 2.0 BI"
                                                             className="flex-1 px-3 py-2 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-medium outline-none bg-white dark:bg-stone-900"
                                                         />
                                                     </div>
                                                 </div>
                                             </div>
                                         </div>
                                    );
                                })()}

                                {/* ── Medidas del Armazón ─────────────── */}
                                <div className="border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 rounded-2xl overflow-hidden">
                                    <div className="px-5 py-3 bg-violet-100/60 dark:bg-violet-900/40 border-b border-violet-200 dark:border-violet-800">
                                        <h3 className="text-[10px] font-black text-violet-700 dark:text-violet-400 uppercase tracking-widest">📐 Medidas del Armazón</h3>
                                    </div>
                                    <div className="grid grid-cols-4 gap-3 p-4">
                                        {[
                                            { label: 'A (Ancho)', field: 'frameA', key: 'frameA' },
                                            { label: 'B (Alto)', field: 'frameB', key: 'frameB' },
                                            { label: 'DBL (Puente)', field: 'frameDbl', key: 'frameDbl' },
                                            { label: 'EDC (Diagonal)', field: 'frameEdc', key: 'frameEdc' },
                                        ].map(f => {
                                            const val = labFields[`${order.id}_${f.key}`] ?? (order as any)[f.key] ?? '';
                                            return (
                                                <div key={f.key}>
                                                    <label className="text-[9px] font-black text-violet-600/70 uppercase tracking-widest block mb-1">{f.label}</label>
                                                    <input
                                                        type="text"
                                                        value={val}
                                                        onChange={e => setLabFields(prev => ({ ...prev, [`${order.id}_${f.key}`]: e.target.value }))}
                                                        onBlur={e => saveLabField(order.id, f.key, e.target.value)}
                                                        placeholder="mm"
                                                        className="w-full px-3 py-2 border-2 border-violet-200 dark:border-violet-700 rounded-xl text-sm font-bold text-center focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-white dark:bg-stone-900 transition-all"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* ── Especificaciones de Laboratorio ────────── */}
                                <div className="border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl overflow-hidden">
                                    <div className="px-5 py-3 bg-emerald-100/60 dark:bg-emerald-900/40 border-b border-emerald-200 dark:border-emerald-800">
                                        <h3 className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">🧪 Especificaciones Técnicas</h3>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-1">Tipo de Armazón</label>
                                                <select
                                                    value={getVal('frameType')}
                                                    onChange={e => saveLabField(order.id, 'frameType', e.target.value)}
                                                    className="w-full px-3 py-2 border-2 border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold bg-white dark:bg-stone-800 outline-none"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {SMARTLAB_OPTIONS.frameTypes.map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-1">Posición del Bisel</label>
                                                <select
                                                    value={getVal('bevelPosition')}
                                                    onChange={e => saveLabField(order.id, 'bevelPosition', e.target.value)}
                                                    className="w-full px-3 py-2 border-2 border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold bg-white dark:bg-stone-800 outline-none"
                                                >
                                                    {SMARTLAB_OPTIONS.bevelPositions.map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-1">Curva Base</label>
                                            <input
                                                type="text"
                                                value={getVal('baseCurve')}
                                                onChange={e => setLabFields(prev => ({ ...prev, [`${order.id}_baseCurve`]: e.target.value }))}
                                                onBlur={e => saveLabField(order.id, 'baseCurve', e.target.value)}
                                                placeholder="Ej: 6.0"
                                                className="w-full px-3 py-2 border-2 border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold bg-white dark:bg-stone-800 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Validación y Carga Automática ──────── */}
                                <div className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl overflow-hidden">
                                    <div className="px-5 py-3 bg-blue-100/60 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
                                        <h3 className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                            🤖 Carga Automática SmartLab
                                        </h3>
                                        <button
                                            onClick={async () => {
                                                setAutoValidationStatus('validating');
                                                try {
                                                    const res = await fetch('/api/smartlab-submit', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ orderId: order.id, action: 'validate' }),
                                                    });
                                                    const data = await res.json();
                                                    setAutoValidationResult(data);
                                                    setAutoValidationStatus(data.validation?.isValid ? 'valid' : 'invalid');
                                                } catch (err) {
                                                    setAutoValidationStatus('error');
                                                }
                                            }}
                                            disabled={autoValidationStatus === 'validating'}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {autoValidationStatus === 'validating' ? (
                                                <><Loader2 className="w-3 h-3 animate-spin" /> Validando...</>
                                            ) : (
                                                <><CheckCircle2 className="w-3 h-3" /> Validar Datos</>
                                            )}
                                        </button>
                                    </div>

                                    <div className="p-5 space-y-3">
                                        {autoValidationStatus === 'idle' && (
                                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium text-center py-2">
                                                Hacé clic en <strong>&quot;Validar Datos&quot;</strong> para verificar que todos los campos estén completos antes de cargar en SmartLab.
                                            </p>
                                        )}

                                        {autoValidationResult && (
                                            <>
                                                {/* Missing fields */}
                                                {autoValidationResult.validation?.missingFields?.length > 0 && (
                                                    <div className="bg-red-50 dark:bg-red-950/50 border-2 border-red-200 dark:border-red-800 rounded-xl p-3">
                                                        <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-2">❌ Campos Obligatorios Faltantes</p>
                                                        <ul className="space-y-1">
                                                            {autoValidationResult.validation.missingFields.map((f: string, i: number) => (
                                                                <li key={i} className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> {f}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Warnings */}
                                                {autoValidationResult.validation?.warnings?.length > 0 && (
                                                    <div className="bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-3">
                                                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">⚠️ Advertencias</p>
                                                        <ul className="space-y-1">
                                                            {autoValidationResult.validation.warnings.map((w: string, i: number) => (
                                                                <li key={i} className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> {w}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Valid */}
                                                {autoValidationStatus === 'valid' && (
                                                    <div className="bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
                                                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                                        <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">✅ Todos los datos están completos</p>
                                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-1">
                                                            El pedido está listo para ser cargado en SmartLab.
                                                            <br />La carga automática se habilitará cuando la cuenta de SmartLab esté activa.
                                                        </p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Reference */}
                                <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest pt-2">
                                    <span>Venta #{order.id.slice(-4).toUpperCase()} · {format(new Date(order.createdAt), "d MMM yyyy", { locale: es })}</span>
                                    <span>Total: ${(order.total || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

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
