'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Package, Clock, CheckCircle2, Search, Download,
    Save, X, Eye, ArrowRight, Hash,
    Calendar, Loader2, ExternalLink, Copy, CheckCheck, Clipboard,
    Factory, ChevronLeft, ChevronRight
} from 'lucide-react';
import { OrderDetailPanel } from '@/components/orders/OrderDetailPanel';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { PricingService } from '@/services/PricingService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Order } from '@/types/orders';

// ── Lab Status Config ─────────────────────────────

import { LAB_STEPS } from '@/components/orders/OrderDetailPanel';

function getLabStep(status: string) {
    return LAB_STEPS.find(s => s.key === status) || LAB_STEPS[0];
}

function getNextStatus(current: string): string | null {
    const idx = LAB_STEPS.findIndex(s => s.key === current);
    if (idx < 0 || idx >= LAB_STEPS.length - 1) return null;
    return LAB_STEPS[idx + 1].key;
}

function PostSaleCard({ 
    order, 
    onRefresh, 
    onMove, 
    onExpand 
}: { 
    order: any; 
    onRefresh: () => void; 
    onMove: (direction: 'left' | 'right') => void; 
    onExpand: () => void; 
}) {
    const [newNote, setNewNote] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    // Split existing postSaleNotes by newline to show as history entries
    const notesHistory = order.postSaleNotes 
        ? order.postSaleNotes.split('\n').filter((line: string) => line.trim() !== '') 
        : [];

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNote.trim()) return;

        setIsSavingNote(true);
        try {
            const formattedDate = new Date().toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            const newEntry = `[${formattedDate}]: ${newNote.trim()}`;
            const updatedNotes = order.postSaleNotes 
                ? `${order.postSaleNotes}\n${newEntry}` 
                : newEntry;

            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postSaleNotes: updatedNotes })
            });

            if (res.ok) {
                setNewNote('');
                onRefresh();
            } else {
                const data = await res.json();
                alert(`⚠️ Error: ${data.error || 'No se pudo guardar la nota'}`);
            }
        } catch (err) {
            console.error('Error adding note:', err);
            alert('⚠️ Error de red al guardar la nota.');
        } finally {
            setIsSavingNote(false);
        }
    };

    const currentStatus = order.labStatus || 'NONE';
    const statusKeys = ['SENT', 'IN_PROGRESS', 'FINISHED', 'READY', 'DELIVERED'];
    let currentIdx = statusKeys.indexOf(currentStatus);
    if (currentStatus === 'NONE') currentIdx = 0;

    const canMoveLeft = currentIdx > 0;
    const canMoveRight = currentIdx < statusKeys.length - 1;

    return (
        <div className="bg-white dark:bg-stone-850 rounded-2xl border border-stone-200/70 dark:border-stone-750 p-4 shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
                {/* Header: Client & Venta ID */}
                <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black text-stone-850 dark:text-stone-100 uppercase tracking-tight leading-tight truncate">
                            {order.client.name}
                        </h4>
                        <span className="text-[9px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest block mt-0.5">
                            Venta #{order.id.slice(-4).toUpperCase()}
                        </span>
                    </div>
                    <button
                        onClick={onExpand}
                        className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-750 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg transition-colors flex-shrink-0"
                        title="Ver Ficha y Medidas"
                    >
                        <Eye className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Info block: Cost & Responsible & OP Option */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {order.postSaleResponsible && (
                        <span className="bg-stone-100 dark:bg-stone-750 text-stone-600 dark:text-stone-300 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1">
                            👤 {order.postSaleResponsible}
                        </span>
                    )}
                    {order.postSaleCost > 0 && (
                        <span className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">
                            $ {order.postSaleCost.toLocaleString('es-AR')}
                        </span>
                    )}
                    {order.postSaleOrderOption && (
                        <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">
                            OP: {order.postSaleOrderOption === 'SAME' ? `Misma (#${order.labOrderNumber || 'Original'})` : `Nueva (#${order.postSaleNewOrderNumber || '—'})`}
                        </span>
                    )}
                </div>

                {/* History Notes list (Timeline feed) */}
                <div className="bg-stone-50 dark:bg-stone-900/40 rounded-xl p-2.5 border border-stone-100 dark:border-stone-800 space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                    <p className="text-[7px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest border-b border-stone-200/20 pb-1">
                        Historial de Incidencia
                    </p>
                    {notesHistory.length === 0 ? (
                        <p className="text-[9px] text-stone-400 italic">Sin observaciones registradas.</p>
                    ) : (
                        <div className="space-y-1.5 text-[9px] leading-relaxed">
                            {notesHistory.map((line: string, i: number) => {
                                const match = line.match(/^\[(.*?)\]:\s*(.*)$/);
                                if (match) {
                                    return (
                                        <div key={i} className="flex flex-col text-stone-600 dark:text-stone-300">
                                            <span className="text-[7px] font-black text-amber-600 dark:text-amber-500">{match[1]}</span>
                                            <span className="font-semibold">{match[2]}</span>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={i} className="text-stone-500 dark:text-stone-400 font-semibold">
                                        {line}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Note Quick Add & Actions */}
            <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                {/* Note Quick Add Input Form */}
                <form onSubmit={handleAddNote} className="flex gap-1.5 items-center">
                    <input
                        type="text"
                        placeholder="Comentar..."
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        disabled={isSavingNote}
                        className="flex-1 bg-stone-50 dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800 text-[10px] p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 dark:text-stone-200"
                    />
                    <button
                        type="submit"
                        disabled={isSavingNote || !newNote.trim()}
                        className="px-2.5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 text-white rounded-xl text-[10px] font-black transition-all flex-shrink-0"
                    >
                        {isSavingNote ? '...' : '+'}
                    </button>
                </form>

                {/* Pipeline Arrow controllers */}
                <div className="flex items-center justify-between pt-1">
                    <button
                        onClick={() => onMove('left')}
                        disabled={!canMoveLeft}
                        className="p-1 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-20 rounded-lg transition-colors flex items-center justify-center"
                        title="Mover a etapa anterior"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[7px] font-black text-stone-450 dark:text-stone-500 uppercase tracking-widest italic select-none">
                        Mover
                    </span>
                    <button
                        onClick={() => onMove('right')}
                        disabled={!canMoveRight}
                        className="p-1 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-450 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-20 rounded-lg transition-colors flex items-center justify-center"
                        title="Mover a siguiente etapa"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────

export default function PedidosPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('SENT');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [smartLabId, setSmartLabId] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [labFields, setLabFields] = useState<Record<string, string>>({});
    const [savingField, setSavingField] = useState<string | null>(null);
    const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);
    const [userRole, setUserRole] = useState('STAFF');

    const [viewMode, setViewMode] = useState<'LAB_ORDERS' | 'POST_VENTA'>('LAB_ORDERS');

    const PIPELINE_COLUMNS = [
        { key: 'SENT', label: 'Reportados / Pendientes', color: 'border-amber-400/80 bg-amber-500/10 text-amber-600' },
        { key: 'IN_PROGRESS', label: 'En Laboratorio', color: 'border-blue-400/80 bg-blue-500/10 text-blue-600' },
        { key: 'FINISHED', label: 'Finalizado (Lab)', color: 'border-fuchsia-400/80 bg-fuchsia-500/10 text-fuchsia-600' },
        { key: 'READY', label: 'Listo p/ Retirar', color: 'border-emerald-400/80 bg-emerald-500/10 text-emerald-600' },
        { key: 'DELIVERED', label: 'Entregado / Cerrado', color: 'border-indigo-400/80 bg-indigo-500/10 text-indigo-600' }
    ];

    const postSaleOrders = useMemo(() => {
        return orders.filter(o => 
            o.postSaleNotes || 
            o.postSaleOrderOption || 
            (o.postSaleCost && o.postSaleCost > 0)
        ).filter(o => {
            if (search === '') return true;
            return o.client.name.toLowerCase().includes(search.toLowerCase()) ||
                   o.id.toLowerCase().includes(search.toLowerCase()) ||
                   (o.labOrderNumber || '').toLowerCase().includes(search.toLowerCase()) ||
                   (o.postSaleNotes || '').toLowerCase().includes(search.toLowerCase());
        });
    }, [orders, search]);

    const handleMoveCard = async (order: Order, direction: 'left' | 'right') => {
        const currentStatus = order.labStatus || 'NONE';
        const statusKeys = ['SENT', 'IN_PROGRESS', 'FINISHED', 'READY', 'DELIVERED'];
        let currentIdx = statusKeys.indexOf(currentStatus);
        if (currentStatus === 'NONE') currentIdx = 0;

        const targetIdx = direction === 'left' ? currentIdx - 1 : currentIdx + 1;
        if (targetIdx < 0 || targetIdx >= statusKeys.length) return;

        const nextStatus = statusKeys[targetIdx];
        
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ labStatus: nextStatus })
            });
            if (res.ok) {
                const updatedOrders = orders.map(o => o.id === order.id ? { ...o, labStatus: nextStatus } : o);
                setOrders(updatedOrders);
            } else {
                const data = await res.json();
                alert(`⚠️ Error al mover: ${data.error}`);
            }
        } catch (err) {
            console.error('Error moving card:', err);
            alert('⚠️ Error de red al mover tarjeta.');
        }
    };

    useEffect(() => {
        fetchOrders();
        // Auto-sync SmartLab en segundo plano al cargar la página
        const autoSync = async () => {
            setIsSyncing(true);
            try {
                const res = await fetch('/api/smartlab-sync', { method: 'POST' });
                if (res.ok) {
                    const data = await res.json();
                    setSyncResult(data);
                    await fetchOrders(); // Refrescar con datos actualizados
                    setTimeout(() => setSyncResult(null), 5000);
                }
            } catch (err) {
                console.error('Error auto-sync SmartLab:', err);
            } finally {
                setIsSyncing(false);
            }
        };
        const loadUserRole = async () => {
            try {
                const stored = localStorage.getItem('user');
                if (stored) {
                    const u = JSON.parse(stored);
                    setUserRole(u.role || 'STAFF');
                    return;
                }
            } catch { }
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const u = await res.json();
                    setUserRole(u.role || 'STAFF');
                    localStorage.setItem('user', JSON.stringify(u));
                }
            } catch { }
        };
        autoSync();
        loadUserRole();
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
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ labStatus: next }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(`⚠️ ${data.error || 'Error al avanzar el estado'}`);
            } else {
                await fetchOrders();
                // WhatsApp automático: el servidor (PATCH handler) ya envía la notificación
                // via BotService.notifyOrderReady() cuando labStatus cambia a READY
            }
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
                    clientPhone: order.client?.phone,
                    clientName: order.client?.name,
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

    const saveLabOrderNumber = async (order: Order) => {
        setUpdatingId(order.id);
        try {
            const updateData: any = { labOrderNumber: editValue };

            await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
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
          <td><div style="font-weight: 750">${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}</div></td>
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


    const sendOrderWhatsApp = async (order: Order) => {
        const items = order.items || [];
        const orderTotal = order.subtotalWithMarkup || order.total || 0;
        const saldo = orderTotal - (order.paid || 0);
        const labStepLabel = getLabStep(order.labStatus || 'NONE').label;
        const lines = items.map(it => `• ${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''} x${it.quantity} — $${(it.price * it.quantity).toLocaleString()}`);

        let text = `✨ *ATELIER ÓPTICA — PEDIDO EN PROCESO* ✨\n`;
        text += `📍 José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n`;
        text += `🏆 La óptica mejor calificada en Google Business ⭐ 5/5\n`;
        text += `\n👤 *Cliente:* ${order.client.name}\n`;
        text += `📋 *Operación:* #${order.id.slice(-4).toUpperCase()}\n`;
        text += `📦 *Estado:* ${labStepLabel}\n\n`;
        text += lines.join('\n');
        text += `\n\n———————————————`;
        text += `\n*Total:* $${orderTotal.toLocaleString()}`;
        text += `\n*Abonado:* $${(order.paid || 0).toLocaleString()}`;
        if (saldo > 0) text += `\n*Saldo pendiente:* $${saldo.toLocaleString()}`;
        text += `\n\n⏱️ *Tiempo estimado de confección:* 7 a 10 días hábiles`;
        if (order.labNotes) text += `\n\n📝 *Observaciones:* ${order.labNotes}`;

        const rawPhone = order.client.phone?.replace(/\D/g, '') || '';
        if (!rawPhone) {
            alert('⚠️ El cliente no tiene teléfono registrado.');
            return;
        }
        const phone = rawPhone.length >= 10 ? `549${rawPhone.slice(-10)}` : rawPhone;

        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: `${phone}@c.us`,
                    message: text
                })
            });
            if (res.ok) {
                alert('✅ Resumen enviado por WhatsApp al cliente a través del Bot.');
            } else {
                alert('❌ Error al enviar el WhatsApp.');
            }
        } catch (error) {
            console.error('Error sending whatsapp:', error);
            alert('❌ Error al conectar con el servidor de WhatsApp.');
        }
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
        const lensItems = order.items.filter(i => i.product?.category === 'Cristal');
        const odItem = lensItems.find(i => i.eye === 'OD');
        const oiItem = lensItems.find(i => i.eye === 'OI');
        const lensType = lensItems[0]?.product?.type || 'MONOFOCAL';
        const lensIndex = lensItems[0]?.product?.lensIndex || '';
        const lensBrand = lensItems[0]?.product?.brand || lensItems[0]?.productBrandSnapshot || '';
        const laboratory = lensItems[0]?.product?.laboratory || '';
        const frameItems = order.items.filter(i => i.product?.category === 'FRAME' || i.product?.category === 'SUNGLASS');
        const frameInfo = frameItems.length > 0
            ? `${frameItems[0]?.product?.brand || frameItems[0]?.productBrandSnapshot || ''} ${frameItems[0]?.product?.name || frameItems[0]?.productNameSnapshot || ''}`.trim()
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

    const autoSubmitSmartLab = async (order: any, pairNum: number = 1) => {
        setIsAutoSubmitting(true);
        try {
            const lensItems = order.items.filter((i: any) => i.product?.category === 'Cristal');
            const odItem = lensItems.find((i: any) => i.eye === 'OD');
            const oiItem = lensItems.find((i: any) => i.eye === 'OI');

            const frameItems = order.items?.filter((i: any) => i.product?.category === 'Armazón de Receta' || i.product?.category === 'Lentes de Sol' || i.productCategorySnapshot === 'Armazón de Receta' || i.productCategorySnapshot === 'Lentes de Sol' || i.product?.category === 'FRAME' || i.product?.category === 'SUNGLASS' || i.productCategorySnapshot === 'FRAME' || i.productCategorySnapshot === 'SUNGLASS') || [];
            
            const frameIdx = (pairNum === 2 && frameItems.length > 1) ? 1 : 0;
            const currentFrameItem = frameItems[frameIdx];

            const frameInfo = currentFrameItem
                ? `Armazón ${currentFrameItem?.product?.brand || currentFrameItem?.productBrandSnapshot || ''} ${currentFrameItem?.product?.name || currentFrameItem?.productNameSnapshot || ''}`.trim()
                : order.frameSource === 'USUARIO'
                    ? `Armazón del cliente ${order.userFrameBrand || ''} ${order.userFrameModel || ''}`.trim()
                    : '';

            const lensList = order.items?.filter((i: any) => i.product?.category === 'Cristal' || i.productCategorySnapshot === 'Cristal' || i.product?.category === 'LENS' || i.productCategorySnapshot === 'LENS') || [];
            const lensProduct = lensList.length > 0 ? lensList[0]?.product : null;
            const lensName = lensProduct?.name?.toLowerCase() || lensList[0]?.productNameSnapshot?.toLowerCase() || '';
            let lensIndex = lensProduct?.lensIndex || '';
            if (!lensIndex && lensName) {
                const indexMatch = lensName.match(/\b(1\.\d{2})\b/) || lensName.match(/\b(1\.\d)\b/);
                if (indexMatch) {
                    lensIndex = indexMatch[1];
                }
            }

            let tipo_lente = 'Monofocal';
            if (lensName.includes('multi') || lensName.includes('progresivo')) tipo_lente = 'Multifocal';
            else if (lensName.includes('bifo') && lensName.includes('kri')) tipo_lente = 'Bifocal Kri';
            else if (lensName.includes('bifo')) tipo_lente = 'Bifocal Ft';
            else if (lensName.includes('ocupa') || lensName.includes('intermedio')) tipo_lente = 'Ocupacional';

            let material = order.labMaterial || '';
            if (!material && lensName) {
                if (lensName.includes('poli')) material = 'Policarbonato';
                else if (lensName.includes('orga') || lensName.includes('orgá')) material = 'Orgánico';
                else if (lensName.includes('alto') || lensName.includes('1.6') || lensName.includes('1.7')) material = 'Alto Índice';
                else if (lensName.includes('vidrio') || lensName.includes('mineral')) material = 'Mineral';
            }

            let tratamiento = order.labTreatment || '';
            if (!tratamiento && lensName) {
                if (lensName.includes('blue') || lensName.includes('block') || lensName.includes('filtro azul') || lensName.includes('filtro de luz')) tratamiento = 'Filtro Azul';
                else if (lensName.includes('anti') || lensName.includes('ar')) tratamiento = 'Antirreflejo';
                else if (lensName.includes('foto') || lensName.includes('transition')) tratamiento = 'Fotocromático';
            }

            const treatmentItems = order.items?.filter((i: any) => i.product?.category === 'Tratamiento' || i.productCategorySnapshot === 'Tratamiento') || [];
            let tipo_tenido = '';
            let color_tenido = '';
            let intensidad_tenido = '';

            for (const item of treatmentItems) {
                const tName = (item.product?.name || item.productNameSnapshot || '').toLowerCase();
                if (!tratamiento) {
                    if (tName.includes('blue') || tName.includes('block') || tName.includes('filtro azul') || tName.includes('filtro de luz')) tratamiento = 'Filtro Azul';
                    else if (tName.includes('anti') || tName.includes('ar')) tratamiento = 'Antirreflejo';
                    else if (tName.includes('foto') || tName.includes('transition')) tratamiento = 'Fotocromático';
                }
                
                if (tName.includes('teñi') || tName.includes('tinte') || tName.includes('color')) {
                    if (tName.includes('degrade') || tName.includes('degradé') || tName.includes('bicolor') || tName.includes('fume')) tipo_tenido = 'Degradé';
                    else if (tName.includes('doble')) tipo_tenido = 'Doble Degradé';
                    else tipo_tenido = 'Pleno';

                    if (tName.includes('gris')) color_tenido = 'Gris';
                    else if (tName.includes('marr') || tName.includes('cafe')) color_tenido = 'Marrón';
                    else if (tName.includes('verde') || tName.includes('g15') || tName.includes('g-15')) color_tenido = 'Verde G15';
                    else if (tName.includes('rosa') || tName.includes('pink')) color_tenido = 'Rosa';
                    else if (tName.includes('azul') || tName.includes('blue')) color_tenido = 'Azul';
                    else if (tName.includes('ama')) color_tenido = 'Amarillo';
                    else if (tName.includes('naran')) color_tenido = 'Naranja';
                    else if (tName.includes('rojo') || tName.includes('red')) color_tenido = 'Rojo';

                    if (tName.includes('10')) intensidad_tenido = '10%';
                    else if (tName.includes('25')) intensidad_tenido = '25%';
                    else if (tName.includes('50')) intensidad_tenido = '50%';
                    else if (tName.includes('75')) intensidad_tenido = '75%';
                    else if (tName.includes('85')) intensidad_tenido = '85%';
                }
            }

            // Fallback: use crystalColor/crystalColorType from order items (set in cotizador)
            if (!color_tenido || !tipo_tenido) {
                const tintItem = order.items?.find((i: any) => i.crystalColor);
                if (tintItem) {
                    if (!color_tenido) color_tenido = tintItem.crystalColor || '';
                    if (!tipo_tenido) {
                        if (tintItem.crystalColorType === 'DEGRADE') tipo_tenido = 'Degradé';
                        else if (tintItem.crystalColorType === 'MUESTRA') tipo_tenido = 'Pleno';
                        else tipo_tenido = 'Pleno';
                    }
                }
            }
            // Detectar tipo de armazón del nombre del producto
            const frameNameLower = frameItems.length > 0
                ? (frameItems[0]?.product?.name || frameItems[0]?.productNameSnapshot || '').toLowerCase()
                : '';
            let tipo_armazon = '';
            if (frameNameLower.includes('acetato') || frameNameLower.includes('plást') || frameNameLower.includes('plast') || frameNameLower.includes('pasta') || frameNameLower.includes('nylon')) {
                tipo_armazon = 'PLÁSTICO';
            } else if (frameNameLower.includes('metal') || frameNameLower.includes('titanio') || frameNameLower.includes('acero')) {
                tipo_armazon = 'METALICO';
            }

            // Format Rx values for SmartLab: "+0.00", "-0.75", "+1.25", etc.
            const fmtRx = (v: any) => {
                if (v === undefined || v === null || v === '') return '';
                const n = typeof v === 'number' ? v : parseFloat(String(v));
                if (isNaN(n)) return '';
                return (n >= 0 ? '+' : '') + n.toFixed(2);
            };
            const fmtInt = (v: any) => {
                if (v === undefined || v === null || v === '') return '';
                const n = typeof v === 'number' ? v : parseInt(String(v));
                if (isNaN(n)) return '';
                return String(n);
            };

            const payload = {
                tipo_lente,
                labType: order.labType || '',
                codigoInterno: order.client.name,
                paciente_fullname: order.client.name,
                od_esfera: fmtRx(odItem?.sphereVal),
                od_cilindro: fmtRx(odItem?.cylinderVal),
                od_eje: fmtInt(odItem?.axisVal),
                od_adicion: fmtRx(odItem?.additionVal),
                oi_esfera: fmtRx(oiItem?.sphereVal),
                oi_cilindro: fmtRx(oiItem?.cylinderVal),
                oi_eje: fmtInt(oiItem?.axisVal),
                oi_adicion: fmtRx(oiItem?.additionVal),
                od_esfera_cerca: fmtRx(odItem?.nearSphereVal),
                od_cilindro_cerca: fmtRx(odItem?.nearCylinderVal),
                oi_esfera_cerca: fmtRx(oiItem?.nearSphereVal),
                oi_cilindro_cerca: fmtRx(oiItem?.nearCylinderVal),
                od_dp: order.labPdOd || '',
                oi_dp: order.labPdOi || '',
                od_dp_cerca: order.labNearPdOd || '',
                oi_dp_cerca: order.labNearPdOi || '',
                od_altura: order.labHeightOD || '',
                oi_altura: order.labHeightOI || '',
                diametro: order.labDiameter || '',
                indice: lensIndex,
                material,
                tratamiento,
                color: order.labColor || '',
                observaciones: order.labNotes || '',
                armazon: [frameInfo, pairNum === 2 ? (order.labFrameDetails2 || '') : (order.labFrameDetails || '')].filter(Boolean).join(' - '),
                forma_armazon: pairNum === 2 ? (order.labFrameShape2 || '') : (order.labFrameShape || ''),
                detalles_armazon: pairNum === 2 ? (order.labFrameDetails2 || '') : (order.labFrameDetails || ''),
                tipo_tenido,
                color_tenido,
                intensidad_tenido,
                tipo_aro: 'Calibrado Aro Entero',
                tipo_armazon,
                medidaA: pairNum === 2 ? (order.frameA2 || '') : (order.frameA || ''),
                medidaB: pairNum === 2 ? (order.frameB2 || '') : (order.frameB || ''),
                medidaED: pairNum === 2 ? (order.frameEdc2 || '') : (order.frameEdc || ''),
                medidaPte: pairNum === 2 ? (order.frameDbl2 || '') : (order.frameDbl || ''),
                fuzzy_article: [
                    lensName.includes('pro') ? 'pro' : '',
                    lensName.includes('free') ? 'free' : '',
                    lensName.includes('exclusive') ? 'exclusive' : '',
                    lensName.includes('drive') ? 'drive' : '',
                    lensName.includes('ailens') ? 'ailens' : '',
                    lensName.includes('super') ? 'super' : '',
                    lensName.includes('asfer') || lensName.includes('asfér') ? 'asfer' : '',
                    lensName.includes('org') ? 'org' : '',
                    lensName.includes('poli') ? 'poli' : '',
                    (lensName.includes('blue') || tratamiento === 'Filtro Azul') ? 'blue' : '',
                    (lensName.includes('ar') || tratamiento === 'Antirreflejo') ? 'c/ar' : '',
                    lensIndex ? String(lensIndex) : ''
                ].filter(Boolean)
            };

            const encodedData = encodeURIComponent(JSON.stringify(payload));
            const smartLabUrl = `https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=${encodedData}`;
            
            alert('✅ ¡Datos copiados al sistema!\n\nPASOS A SEGUIR:\n1️⃣ Se abrirá la web de SmartLab.\n2️⃣ Hacé clic en tu favorito ⭐ "🤖 Atelier → SmartLab".\n3️⃣ ¡No toques nada un segundo! El sistema elegirá el lente y llenará todo.\n\n⚠️ IMPORTANTE:\nSi la página te tira error "404", es porque se cerró tu sesión de SmartLab. Iniciá sesión manualmente y volvé a tocar este botón amarillo.');
            window.open(smartLabUrl, '_blank');

        } catch (error) {
            console.error('Error auto-submitting:', error);
            alert('❌ Ocurrió un error al copiar los datos.');
        } finally {
            setIsAutoSubmitting(false);
        }
    };


    const saveLabField = async (orderId: string, field: string, value: string) => {
        const key = `${orderId}_${field}`;
        setLabFields(prev => ({ ...prev, [key]: value }));
        setSavingField(key);
        try {
            const bodyMap: Record<string, string> = {
                notes: 'labNotes',
                color: 'labColor',
                treatment: 'labTreatment',
                diameter: 'labDiameter',
                pdOd: 'labPdOd',
                pdOi: 'labPdOi',
                type: 'labType',
                frameShape: 'labFrameShape',
                frameDetails: 'labFrameDetails',
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

    // Calculate crystal delay stats
    const crystalStats = useMemo(() => {
        const statsMap: Record<string, { totalDays: number; count: number; name: string }> = {};
        const labMap: Record<string, { totalDays: number; count: number; name: string }> = {};
        
        let totalValids = 0;
        let grandTotalDays = 0;

        orders.forEach(order => {
            if (!order.labSentAt) return;
            const start = new Date(order.labSentAt);
            const end = ['READY', 'DELIVERED'].includes(order.labStatus || '') && order.updatedAt
                ? new Date(order.updatedAt)
                : new Date();
            const diffDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
            
            totalValids++;
            grandTotalDays += diffDays;

            // Find crystal items
            const crystals = order.items.filter(i => i.product?.category === 'Cristal');
            crystals.forEach(item => {
                const crystalType = item.product?.type || 'Otros';
                if (!statsMap[crystalType]) {
                    statsMap[crystalType] = { totalDays: 0, count: 0, name: crystalType };
                }
                statsMap[crystalType].totalDays += diffDays;
                statsMap[crystalType].count++;
            });

            // Group by laboratory
            const lab = (crystals[0]?.product as any)?.laboratory || 'No especificado';
            if (!labMap[lab]) {
                labMap[lab] = { totalDays: 0, count: 0, name: lab };
            }
            labMap[lab].totalDays += diffDays;
            labMap[lab].count++;
        });

        const crystalAverages = Object.values(statsMap).map(s => ({
            name: s.name,
            avg: s.count > 0 ? (s.totalDays / s.count).toFixed(1) : '0',
            count: s.count
        })).sort((a, b) => b.count - a.count);

        const labAverages = Object.values(labMap).map(s => ({
            name: s.name,
            avg: s.count > 0 ? (s.totalDays / s.count).toFixed(1) : '0',
            count: s.count
        })).sort((a, b) => b.count - a.count);

        const generalAvg = totalValids > 0 ? (grandTotalDays / totalValids).toFixed(1) : '0';

        return { crystalAverages, labAverages, generalAvg };
    }, [orders]);

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
                <div className="flex items-center gap-4">
                    <button
                        onClick={async () => {
                            setIsSyncing(true);
                            setSyncResult(null);
                            try {
                                const res = await fetch('/api/smartlab-sync', { method: 'POST' });
                                const data = await res.json();
                                if (res.ok) {
                                    setSyncResult(data);
                                    fetchOrders();
                                    setTimeout(() => setSyncResult(null), 8000);
                                } else {
                                    alert(`❌ Error sync: ${data.error}`);
                                }
                            } catch (err) {
                                alert('❌ Error de red al sincronizar');
                            } finally {
                                setIsSyncing(false);
                            }
                        }}
                        disabled={isSyncing}
                        className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 border-2 ${
                            isSyncing 
                                ? 'bg-blue-50 border-blue-200 text-blue-500'
                                : syncResult 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                                    : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900'
                        }`}
                        title="Sincronizar estados con SmartLab"
                    >
                        {isSyncing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : syncResult ? (
                            <CheckCircle2 className="w-4 h-4" />
                        ) : (
                            <Factory className="w-4 h-4" />
                        )}
                        {isSyncing ? 'Sincronizando...' : syncResult ? `${syncResult.matched} sync · ${syncResult.newlyFinished || 0} nuevos` : 'Sync SmartLab'}
                    </button>
                    <div className="text-right">
                        <p className="text-3xl font-black text-blue-500">{orders.length}</p>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Pedidos activos</p>
                    </div>
                </div>
            </div>

            {/* View Selector Tabs */}
            <div className="flex gap-2 p-1.5 bg-stone-100/50 dark:bg-stone-800/50 rounded-2xl border border-stone-200/50 dark:border-stone-700/50 backdrop-blur-sm max-w-md mb-8">
                <button
                    onClick={() => setViewMode('LAB_ORDERS')}
                    className={`flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        viewMode === 'LAB_ORDERS'
                            ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-md border border-stone-200/20'
                            : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
                    }`}
                >
                    🔬 Laboratorio
                </button>
                <button
                    onClick={() => setViewMode('POST_VENTA')}
                    className={`flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        viewMode === 'POST_VENTA'
                            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                            : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
                    }`}
                >
                    🛡️ Post Venta ({postSaleOrders.length})
                </button>
            </div>

            {viewMode === 'LAB_ORDERS' && (
                <>
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

            {/* Tiempos de Demora Analytics */}
            <div className="bg-gradient-to-br from-stone-900 to-stone-800 dark:from-stone-950 dark:to-stone-900 rounded-[2.5rem] p-6 lg:p-8 text-white mb-8 border border-stone-800 dark:border-stone-850 shadow-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute left-1/3 bottom-0 w-60 h-60 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10">
                    <div>
                        <h2 className="text-xl lg:text-2xl font-black tracking-tight flex items-center gap-2">
                            <Clock className="w-6 h-6 text-amber-400 animate-pulse" /> Tiempos de Demora en Fábrica
                        </h2>
                        <p className="text-stone-400 text-xs mt-1 font-semibold">
                            Estadísticas y parámetros de demora real desde el envío a laboratorio
                        </p>
                    </div>
                    <div className="bg-stone-800/80 backdrop-blur-sm border border-stone-700/50 rounded-2xl px-5 py-3 text-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 block">Promedio General</span>
                        <span className="text-2xl font-black text-amber-400">{crystalStats.generalAvg} <span className="text-xs font-bold text-white">días</span></span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    {/* Cristal stats */}
                    <div className="bg-stone-850/50 backdrop-blur-md rounded-2xl p-5 border border-stone-700/30">
                        <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
                            <span>👓 Por Tipo de Cristal</span>
                        </h3>
                        <div className="space-y-3.5 animate-in fade-in duration-500">
                            {crystalStats.crystalAverages.length === 0 ? (
                                <p className="text-xs text-stone-500 font-bold py-2">No hay datos suficientes de cristales.</p>
                            ) : (
                                crystalStats.crystalAverages.map(c => (
                                    <div key={c.name} className="flex justify-between items-center bg-stone-900/30 p-2.5 rounded-xl border border-stone-800/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black tracking-tight text-stone-200">{c.name}</span>
                                            <span className="px-1.5 py-0.5 bg-stone-805 text-[8px] font-black text-stone-400 rounded-md">{c.count} pedido{c.count !== 1 ? 's' : ''}</span>
                                        </div>
                                        <span className="text-sm font-black text-amber-400">{c.avg} <span className="text-[10px] font-bold text-stone-400">días</span></span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Laboratory stats */}
                    <div className="bg-stone-850/50 backdrop-blur-md rounded-2xl p-5 border border-stone-700/30">
                        <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
                            <span>🧪 Por Laboratorio</span>
                        </h3>
                        <div className="space-y-3.5 animate-in fade-in duration-500">
                            {crystalStats.labAverages.length === 0 ? (
                                <p className="text-xs text-stone-500 font-bold py-2">No hay datos suficientes de laboratorios.</p>
                            ) : (
                                crystalStats.labAverages.map(l => (
                                    <div key={l.name} className="flex justify-between items-center bg-stone-900/30 p-2.5 rounded-xl border border-stone-800/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black tracking-tight text-stone-200 truncate max-w-[150px]">{l.name}</span>
                                            <span className="px-1.5 py-0.5 bg-stone-805 text-[8px] font-black text-stone-400 rounded-md">{l.count} pedido{l.count !== 1 ? 's' : ''}</span>
                                        </div>
                                        <span className="text-sm font-black text-blue-400">{l.avg} <span className="text-[10px] font-bold text-stone-400">días</span></span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )}

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
            ) : viewMode === 'POST_VENTA' ? (
                <div className="space-y-6">
                    {/* Kanban Board Container */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start pb-4">
                        {PIPELINE_COLUMNS.map(column => {
                            const columnOrders = postSaleOrders.filter(o => {
                                const status = o.labStatus || 'NONE';
                                if (column.key === 'SENT') {
                                    return status === 'SENT' || status === 'NONE';
                                }
                                return status === column.key;
                            });

                            return (
                                <div 
                                    key={column.key}
                                    className={`bg-stone-50/50 dark:bg-stone-900/30 rounded-3xl border-2 ${column.color.split(' ')[0]} p-4 flex flex-col min-h-[500px]`}
                                >
                                    {/* Column Header */}
                                    <div className="flex items-center justify-between mb-4 border-b border-stone-200/30 dark:border-stone-800 pb-2 flex-shrink-0">
                                        <h3 className={`text-xs font-black uppercase tracking-wider ${column.color.split(' ')[2]}`}>
                                            {column.label}
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${column.color.split(' ')[1]} ${column.color.split(' ')[2]}`}>
                                            {columnOrders.length}
                                        </span>
                                    </div>

                                    {/* Cards Stack */}
                                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh] pr-1 scrollbar-thin">
                                        {columnOrders.length === 0 ? (
                                            <div className="text-center py-12 text-stone-300 dark:text-stone-700 italic text-[10px] font-bold uppercase tracking-wider">
                                                Sin casos
                                            </div>
                                        ) : (
                                            columnOrders.map(order => (
                                                <PostSaleCard 
                                                    key={order.id} 
                                                    order={order} 
                                                    onRefresh={fetchOrders}
                                                    onMove={(direction) => handleMoveCard(order, direction)}
                                                    onExpand={() => setExpandedId(expandedId === order.id ? null : order.id)}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
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
                        const orderTotal = order.subtotalWithMarkup || order.total || 0;
                        const payProgress = orderTotal > 0 ? Math.min(100, (order.paid / orderTotal) * 100) : 100;

                        const financials = PricingService.calculateOrderFinancials(order);
                        const isGrupoOptico = order.items.some((i: any) => i.product?.category === 'Cristal' && /grupo[\s\-]?ó?o?ptico/i.test((i.product as any)?.laboratory || ''));

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
                                            {order.labSentAt && (() => {
                                                const start = new Date(order.labSentAt);
                                                const end = ['READY', 'DELIVERED'].includes(order.labStatus || '') && order.updatedAt
                                                    ? new Date(order.updatedAt)
                                                    : new Date();
                                                const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                                const isCompleted = ['READY', 'DELIVERED'].includes(order.labStatus || '');
                                                return (
                                                    <>
                                                        <span>·</span>
                                                        <span className={`flex items-center gap-1 font-black ${isCompleted ? 'text-emerald-500' : 'text-blue-500'}`}>
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {isCompleted ? `Demoró ${days} días` : `Lleva ${days} días`}
                                                        </span>
                                                    </>
                                                );
                                            })()}
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
                                                    onKeyDown={e => e.key === 'Enter' && saveLabOrderNumber(order)}
                                                />
                                                <button
                                                    onClick={() => saveLabOrderNumber(order)}
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
                                                    if (order.labOrderNumber) {
                                                        const confirmEdit = window.confirm('Este pedido ya tiene un Número de Operación asignado. ¿Deseás editarlo realmente?');
                                                        if (!confirmEdit) return;
                                                    }
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

                                    {/* SmartLab Progress Info */}
                                    {order.smartLabProgress != null && order.smartLabProgress > 0 && (
                                        <div className="flex-shrink-0 w-48">
                                            <div className="bg-blue-50/80 dark:bg-blue-950/30 rounded-xl px-3 py-2 border border-blue-100 dark:border-blue-800/50">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">SmartLab</span>
                                                    <span className={`text-[10px] font-black ${order.smartLabProgress >= 100 ? 'text-emerald-500' : 'text-blue-600'}`}>
                                                        {order.smartLabProgress}%
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden mb-1.5">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-500 ${order.smartLabProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${Math.min(100, order.smartLabProgress)}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[8px] font-bold text-stone-500 dark:text-stone-400 truncate max-w-[100px]">
                                                        {order.smartLabSector || '—'}
                                                    </span>
                                                    {order.smartLabDays != null && (
                                                        <span className="text-[8px] font-black text-amber-500">
                                                            {order.smartLabDays}d
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Total */}
                                    <div className="flex-shrink-0 text-right w-28">
                                        <p className="text-xl font-black text-stone-800 dark:text-white">${(order.subtotalWithMarkup || order.total || 0).toLocaleString()}</p>
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
                                                    ? 'bg-amber-500 text-white shadow-amber-500/20'
                                                    : nextStepInfo.key === 'IN_PROGRESS'
                                                        ? 'bg-blue-500 text-white shadow-blue-500/20 hover:shadow-blue-500/30'
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
                                        {isGrupoOptico && (
                                            <button
                                                onClick={() => setSmartLabId(order.id)}
                                                className="p-3 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl hover:scale-110 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all"
                                                title="Cargar en SmartLab"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </button>
                                        )}

                                        {/* WhatsApp Send to Client */}
                                        <button
                                            onClick={() => sendOrderWhatsApp(order)}
                                            className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl hover:scale-110 hover:bg-emerald-100 transition-all"
                                            title="Enviar resumen al cliente por WhatsApp"
                                        >
                                            <WhatsAppIcon className="w-4 h-4" />
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
                                    <OrderDetailPanel 
                                        order={order as any} 
                                        context="pedidos"
                                        financials={financials}
                                        userRole={userRole}
                                        onRefresh={fetchOrders}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal for Order Details in Post Venta view */}
            {viewMode === 'POST_VENTA' && expandedId && (() => {
                const order = orders.find(o => o.id === expandedId);
                if (!order) return null;
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setExpandedId(null)}>
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" />

                        {/* Modal Container */}
                        <div
                            className="relative bg-white dark:bg-stone-900 rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200 border border-stone-200 dark:border-stone-800"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-stone-100 dark:border-stone-850 flex justify-between items-center bg-stone-50/50 dark:bg-stone-900/50">
                                <div>
                                    <h3 className="text-lg font-black text-stone-850 dark:text-stone-100 uppercase tracking-tight leading-tight">
                                        Detalle de Caso: {order.client.name}
                                    </h3>
                                    <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mt-0.5">
                                        Venta #{order.id.slice(-4).toUpperCase()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setExpandedId(null)}
                                    className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-all text-stone-450 hover:text-stone-600 dark:hover:text-stone-300"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <OrderDetailPanel 
                                order={order as any} 
                                context="pedidos"
                                userRole={userRole}
                                onRefresh={fetchOrders}
                            />
                        </div>
                    </div>
                );
            })()}

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
                                        {(() => {
                                             const is2x1 = order.appliedPromoName?.toLowerCase().includes('2x1') || order.items?.some((it: any) => {
                                                 const str = `${it.product?.name || ''} ${it.productNameSnapshot || ''}`.toLowerCase();
                                                 return str.includes('2x1');
                                             });
                                             return is2x1 ? (
                                                 <>
                                                     <button
                                                         onClick={() => autoSubmitSmartLab(order, 1)}
                                                         disabled={isAutoSubmitting}
                                                         className="px-3 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 rounded-xl text-xs font-black flex items-center gap-1.5 hover:scale-105 transition-all shadow-lg disabled:opacity-50"
                                                         title="Copiar Par 1 y abrir SmartLab"
                                                     >
                                                         {isAutoSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                                                         <span>Par 1</span>
                                                     </button>
                                                     <button
                                                         onClick={() => autoSubmitSmartLab(order, 2)}
                                                         disabled={isAutoSubmitting}
                                                         className="px-3 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-orange-950 rounded-xl text-xs font-black flex items-center gap-1.5 hover:scale-105 transition-all shadow-lg disabled:opacity-50"
                                                         title="Copiar Par 2 (Bonificado) y abrir SmartLab"
                                                     >
                                                         {isAutoSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                                                         <span>Par 2</span>
                                                     </button>
                                                 </>
                                             ) : (
                                                 <button
                                                     onClick={() => autoSubmitSmartLab(order, 1)}
                                                     disabled={isAutoSubmitting}
                                                     className="px-4 py-2 bg-amber-400 text-amber-950 rounded-xl text-xs font-black flex items-center gap-2 hover:scale-105 transition-all shadow-lg disabled:opacity-50"
                                                 >
                                                     {isAutoSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                                                     {isAutoSubmitting ? 'Copiando...' : 'Autocompletar (Bookmarklet)'}
                                                 </button>
                                             );
                                         })()}
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
                                    <div className="flex items-start gap-2">
                                        <textarea
                                            value={labFields[`${order.id}_notes`] ?? order.labNotes ?? ''}
                                            onChange={e => setLabFields(prev => ({ ...prev, [`${order.id}_notes`]: e.target.value }))}
                                            onBlur={e => saveLabField(order.id, 'notes', e.target.value)}
                                            placeholder="Aclaraciones o notas para el laboratorio (opcional)..."
                                            className="flex-1 px-3 py-2 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white dark:bg-stone-900 transition-all min-h-[60px] resize-y"
                                        />
                                        {(labFields[`${order.id}_notes`] ?? order.labNotes) ? <CopyBtn value={labFields[`${order.id}_notes`] ?? order.labNotes ?? ''} field="obs" /> : null}
                                        {savingField === `${order.id}_notes` && <Loader2 className="w-4 h-4 text-blue-500 animate-spin mt-2" />}
                                    </div>
                                </div>

                                {/* Forma de Armazón (Solo Multifocales) */}
                                {d.lensType === 'MULTIFOCAL' && (
                                    <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Forma de Armazón (SmartLab)</label>
                                        <div className="grid grid-cols-4 gap-2 mb-1">
                                            {[
                                                { id: 'redondo', label: 'Redondo', svg: <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'ovalado', label: 'Ovalado', svg: <ellipse cx="12" cy="12" rx="10" ry="6" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'rectangular', label: 'Rectangular', svg: <rect x="2" y="7" width="20" height="10" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'cuadrado', label: 'Cuadrado', svg: <rect x="4" y="4" width="16" height="16" rx="3" ry="3" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'aviador', label: 'Aviador', svg: <path d="M4 10c-1.1 0-2 .9-2 2v2c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4v-2c0-1.1-.9-2-2-2H4zm10 0c-1.1 0-2 .9-2 2v2c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4v-2c0-1.1-.9-2-2-2h-2zM12 10V8c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'cateye', label: 'Cat-Eye', svg: <><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2"/></> },
                                                { id: 'pantos', label: 'Panto', svg: <path d="M5 10a5 5 0 0 1 10 0v2a5 5 0 0 1-10 0v-2zm12 0a5 5 0 0 1 10 0v2a5 5 0 0 1-10 0v-2zM15 10H17M5 10C5 6 8 3 12 3s7 3 7 7" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'geometrico', label: 'Geométrico', svg: <polygon points="12 3 21 8.5 21 15.5 12 21 3 15.5 3 8.5 12 3" fill="none" stroke="currentColor" strokeWidth="2"/> }
                                            ].map(shape => {
                                                const currentShape = labFields[`${order.id}_frameShape`] ?? order.labFrameShape;
                                                const isSelected = currentShape === shape.label;
                                                return (
                                                    <button
                                                        key={shape.id}
                                                        onClick={() => saveLabField(order.id, 'frameShape', shape.label)}
                                                        className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border-2 transition-all hover:scale-105 ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'border-transparent hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500'}`}
                                                    >
                                                        <svg viewBox="0 0 24 24" className="w-8 h-8">{shape.svg}</svg>
                                                        <span className="text-[10px] font-bold tracking-tight">{shape.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {savingField === `${order.id}_frameShape` && <div className="flex justify-end"><Loader2 className="w-4 h-4 text-blue-500 animate-spin mt-1" /></div>}
                                    </div>
                                )}

                                {/* Detalles del Armazón */}
                                <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Detalles del Armazón (SmartLab)</label>
                                    <div className="flex items-start gap-2">
                                        <textarea
                                            value={labFields[`${order.id}_frameDetails`] ?? order.labFrameDetails ?? ''}
                                            onChange={e => setLabFields(prev => ({ ...prev, [`${order.id}_frameDetails`]: e.target.value }))}
                                            onBlur={e => saveLabField(order.id, 'frameDetails', e.target.value)}
                                            placeholder="Detalles sobre el armazón (ej: tipo de ranurado, bisel, material, anotaciones del vendedor)..."
                                            className="flex-1 px-3 py-2 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white dark:bg-stone-900 transition-all min-h-[60px] resize-y"
                                        />
                                        {(labFields[`${order.id}_frameDetails`] ?? order.labFrameDetails) ? <CopyBtn value={labFields[`${order.id}_frameDetails`] ?? order.labFrameDetails ?? ''} field="frameDet" /> : null}
                                        {savingField === `${order.id}_frameDetails` && <Loader2 className="w-4 h-4 text-blue-500 animate-spin mt-2" />}
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
                                    const typeVal = getVal('type') || '';

                                    return (
                                        <div className="space-y-4">
                                            {/* Tipo: Stock vs Lab */}
                                            <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Origen del Lente (SmartLab)</label>
                                                <div className="flex items-center gap-2">
                                                    {['STOCK', 'LABORATORY'].map(t => (
                                                        <button
                                                            key={t}
                                                            onClick={() => saveLabField(order.id, 'type', t)}
                                                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 ${typeVal === t
                                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                                                    : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600'
                                                                }`}
                                                        >
                                                            {t === 'STOCK' ? '📦 Stock / Rango Ext' : '🧪 Laboratorio'}
                                                        </button>
                                                    ))}
                                                    {savingField === `${order.id}_type` && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                                                </div>
                                            </div>

                                            {/* Teñido — Info del Cotizador */}
                                            {(() => {
                                                const tintItems = order.items?.filter((i: any) => i.crystalColor) || [];
                                                const treatmentTint = order.items?.find((i: any) => {
                                                    const n = (i.product?.name || i.productNameSnapshot || '').toLowerCase();
                                                    return n.includes('teñi') || n.includes('tenido') || n.includes('tinte');
                                                });
                                                if (tintItems.length === 0 && !treatmentTint) return null;
                                                return (
                                                    <div className="border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 rounded-2xl p-4">
                                                        <label className="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest block mb-2">🎨 Teñido (Grupo Óptico)</label>
                                                        <div className="space-y-2">
                                                            {tintItems.map((item: any, i: number) => (
                                                                <div key={i} className="flex items-center gap-3">
                                                                    {item.eye && <span className="text-[9px] font-bold bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-md uppercase">{item.eye}</span>}
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="w-4 h-4 rounded-full border border-violet-300 shadow-sm flex-shrink-0" style={{ backgroundColor: 
                                                                            item.crystalColor?.includes('Gris') ? '#555555' :
                                                                            item.crystalColor?.includes('Marrón') ? '#6b4c3a' :
                                                                            item.crystalColor?.includes('Verde') ? '#2c4c3b' :
                                                                            item.crystalColor?.includes('Rosa') ? '#d4a3a3' :
                                                                            item.crystalColor?.includes('Amarillo') ? '#e1b854' :
                                                                            item.crystalColor?.includes('Naranja') ? '#d6804a' :
                                                                            item.crystalColor?.includes('Rojo') ? '#ab4040' :
                                                                            item.crystalColor?.includes('Azul') ? '#4a7fb5' : '#999'
                                                                        }} />
                                                                        <span className="text-sm font-bold text-violet-900 dark:text-violet-200">
                                                                            {item.crystalColorType === 'DEGRADE' ? 'Degradé' : item.crystalColorType === 'MUESTRA' ? 'Según Muestra' : 'Compacto'} — {item.crystalColor}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {treatmentTint && !tintItems.length && (
                                                                <span className="text-sm font-bold text-violet-900 dark:text-violet-200">
                                                                    {treatmentTint.product?.name || treatmentTint.productNameSnapshot}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Color (manual / SmartLab) */}
                                            <div className="border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-2">Color (SmartLab)</label>
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
                                    <span>Total: ${(order.subtotalWithMarkup || order.total || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </main>
    );
}
