'use client';

import React from 'react';
import { 
    Calculator, Receipt, Download, MessageCircle, 
    CheckCircle2, X, Plus, Clock, Glasses, 
    User, Banknote, ArrowRightLeft, CreditCard,
    TrendingUp, Lock, Shield, ArrowRight,
    ChevronRight, ChevronDown, ChevronUp, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface QuoteSummaryProps {
    order: any;
    contact: {
        id: string;
        name: string;
        phone?: string;
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
    showActions = true
}: QuoteSummaryProps) {
    const isSale = order.orderType === 'SALE';
    const isQuote = !isSale;
    const isLockedSale = isSale && currentUserRole !== 'ADMIN';
    const progress = (order.paid / order.total) * 100;
    const minRequired = (order.total || 0) * 0.4;

    const LAB_LABELS: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
        'NONE': { label: 'Sin enviar', color: 'bg-stone-100 text-stone-500', next: 'SENT', nextLabel: 'Enviar a Lab' },
        'SENT': { label: 'Enviado', color: 'bg-blue-100 text-blue-600', next: 'IN_PROGRESS', nextLabel: 'En Proceso' },
        'IN_PROGRESS': { label: 'En Lab', color: 'bg-amber-100 text-amber-600', next: 'READY', nextLabel: 'Marcar Listo' },
        'READY': { label: 'Listo', color: 'bg-emerald-100 text-emerald-600', next: 'DELIVERED', nextLabel: 'Entregado' },
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

    const handleDownloadPDF = () => {
        const items = order.items || [];
        const subtotalBase = items.reduce((s: number, it: any) => s + (it.price * it.quantity), 0);
        const markupPct = order.markup || 0;
        const listPrice = subtotalBase * (1 + markupPct / 100);
        const discountCash = order.discountCash !== null ? order.discountCash : (order.discount || 20);
        const discountTransfer = order.discountTransfer !== null ? order.discountTransfer : 15;

        const amtCash = Math.round(listPrice * (1 - discountCash / 100));
        const amtTransfer = Math.round(listPrice * (1 - discountTransfer / 100));
        const cuota3 = Math.round(listPrice / 3);
        const cuota6 = Math.round(listPrice / 6);

        const dateStr = new Date(order.createdAt).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
        const logoUrl = `${window.location.origin}/assets/logo-atelier-optica.png`;

        const saldoCash = Math.max(0, amtCash - (order.paid || 0));
        const saldoTransfer = Math.max(0, amtTransfer - (order.paid || 0));
        const saldoCard = Math.max(0, Math.round(listPrice) - (order.paid || 0));

        const html = `<!DOCTYPE html><html><head><meta charset='utf-8'>
<title>${isSale ? 'Venta' : 'Presupuesto'} ${contact.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
  body { padding:40px 50px; color:#1c1917; line-height:1.5; }
  .letterhead { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; margin-bottom:8px; border-bottom:3px solid #1c1917; }
  .letterhead-left { display:flex; align-items:center; gap:16px; }
  .letterhead-logo { height:52px; }
  .letterhead-right { text-align:right; font-size:10px; color:#78716c; line-height:1.6; }
  .letterhead-right .address { font-weight:600; color:#57534e; }
  .tagline { text-align:center; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:3px; color:#a0845e; padding:10px 0 20px; }
  .meta-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
  .meta-row .doc-id { font-size:13px; font-weight:900; color:#1c1917; }
  .meta-row .doc-date { font-size:11px; color:#78716c; }
  .client { background:#fafaf9; border:1px solid #e7e5e4; border-radius:12px; padding:16px 20px; margin-bottom:28px; }
  .client-label { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:2px; color:#a8a29e; }
  .client-name { font-size:18px; font-weight:900; color:#1c1917; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; }
  th { background:#1c1917; color:white; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:2px; padding:12px 16px; text-align:left; }
  th:last-child, td:last-child { text-align:right; }
  td { padding:12px 16px; font-size:13px; border-bottom:1px solid #f5f5f4; }
  td:first-child { font-weight:700; }
  .totals { display:flex; justify-content:flex-end; }
  .totals-box { background:#fafaf9; border:2px solid #e7e5e4; border-radius:16px; padding:20px 28px; min-width:320px; }
  .total-row { display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px; color:#57534e; }
  .total-row.highlight-transf { font-size:15px; font-weight:800; color:#8b5cf6; margin-top:12px; border-top:1px solid #e7e5e4; padding-top:12px; }
  .total-row.final { font-size:22px; font-weight:900; color:#10b981; border-top:2px solid #10b981; padding-top:10px; margin-top:8px; }
  .footer { margin-top:48px; padding-top:20px; border-top:1px solid #e7e5e4; font-size:10px; color:#a8a29e; text-align:center; text-transform:uppercase; letter-spacing:2px; }
  
  .payments-section { border: 2px solid #10b981; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
  .payments-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
  .payment-stat h4 { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #a8a29e; margin-bottom: 4px; }
  .payment-stat .val-paid { font-size: 24px; font-weight: 900; color: #10b981; }
  .saldos-block { display: flex; gap: 24px; text-align: right; }
  .saldo-item .label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; display: block; }
  .saldo-item .val { font-size: 14px; font-weight: 900; }
  .s-efvo .label, .s-efvo .val { color: #10b981; }
  .s-transf .label, .s-transf .val { color: #8b5cf6; }
  .s-cuotas .label, .s-cuotas .val { color: #f97316; }
  .progress-bg { height: 16px; background: #f5f5f4; border-radius: 8px; overflow: hidden; position: relative; border: 1px solid #e7e5e4; margin-bottom: 20px; }
  .progress-bar { height: 100%; background: #10b981; transition: width 0.3s; }
  .marker { position: absolute; top: 0; left: 40%; height: 100%; width: 2px; background: rgba(0,0,0,0.1); }
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
<div class='meta-row'>
  <span class='doc-id'>${isSale ? 'Venta' : 'Presupuesto'} #${order.id.slice(-4).toUpperCase()}</span>
  <span class='doc-date'>${dateStr}</span>
</div>
<div class='client'>
  <div class='client-label'>Cliente</div>
  <div class='client-name'>${contact.name}</div>
</div>
<table>
  <thead><tr><th>Producto</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
  <tbody>${items.map((it: any) => {
            const itPriceWithMarkup = it.price * (1 + markupPct / 100);
            return `<tr><td>${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''}</td><td style='text-align:center'>${it.quantity}</td><td>$${itPriceWithMarkup.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td>$${(itPriceWithMarkup * it.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>`;
        }).join('')}</tbody>
</table>
${order.frameSource ? `<div style='background:#fffbeb;border:1px solid #fbbf24;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:12px'><strong style='color:#92400e'>🕶️ Armazón:</strong> ${order.frameSource === 'OPTICA' ? 'De la óptica (incluido en el presupuesto)' : `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}${order.userFrameNotes ? ' · ' + order.userFrameNotes : ''}`}</div>` : ''}

${(order.paid > 0) ? `
<div class='payments-section'>
  <div class='payments-header'>
    <div class='payment-stat'>
      <h4>Pagado</h4>
      <div class='val-paid'>$${(order.paid || 0).toLocaleString()}</div>
    </div>
    <div class='saldos-block'>
      ${order.discountCash > 0 ? `<div class='saldo-item s-efvo'><span class='label'>💵 Saldo Efvo</span><span class='val'>$${saldoCash.toLocaleString()}</span></div>` : ''}
      ${order.discountTransfer > 0 ? `<div class='saldo-item s-transf'><span class='label'>🏦 Saldo Transf</span><span class='val'>$${saldoTransfer.toLocaleString()}</span></div>` : ''}
      <div class='saldo-item s-cuotas'><span class='label'>💳 Saldo Cuotas</span><span class='val'>$${saldoCard.toLocaleString()}</span></div>
    </div>
  </div>
</div>
` : ''}

<div class='totals'><div class='totals-box'>
  <div class='total-row' style='font-size: 15px; font-weight: 800; color: #1c1917'><span>Precio de Lista (Cuotas)</span><span>$${Math.round(listPrice).toLocaleString()}</span></div>
  <div class='total-row high-transf'><span>Total Transferencia (-${discountTransfer}%)</span><span>$${amtTransfer.toLocaleString()}</span></div>
  <div class='total-row final'><span>Total Efectivo (-${discountCash}%)</span><span>$${amtCash.toLocaleString()}</span></div>
</div></div>
<div class='footer'>${isSale ? 'Venta Registrada' : 'Presupuesto válido por 5 días hábiles'} · Atelier Óptica · José Luis de Tejeda 4380, Córdoba</div>
</body></html>`;

        const printWindow = window.open('', '_blank', 'width=800,height=900');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 400);
        }
    };

    const handleWhatsApp = () => {
        const items = order.items || [];
        const subtotalBase = items.reduce((s: number, it: any) => s + (it.price * it.quantity), 0);
        const markupPct = order.markup || 0;
        const listPrice = subtotalBase * (1 + markupPct / 100);
        const discountCash = order.discountCash !== null ? order.discountCash : (order.discount || 20);
        const discountTransfer = order.discountTransfer !== null ? order.discountTransfer : 15;

        const amtCash = Math.round(listPrice * (1 - discountCash / 100));
        const amtTransfer = Math.round(listPrice * (1 - discountTransfer / 100));
        const cuota3 = Math.round(listPrice / 3);
        const cuota6 = Math.round(listPrice / 6);

        const lines = items.map((it: any) => {
            const itemTotalWithMarkup = (it.price * it.quantity) * (1 + markupPct / 100);
            return `• ${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''} x${it.quantity} — $${itemTotalWithMarkup.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        });
        
        let text = `✨ *${isSale ? 'VENTA' : 'PRESUPUESTO'} — ATELIER ÓPTICA* ✨\n`;
        text += `📍 José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n`;
        text += `\n👤 *Cliente:* ${contact.name}\n\n`;
        text += lines.join('\n');
        if (order.frameSource) {
            text += `\n\n🕶️ *Armazón:* ${order.frameSource === 'OPTICA' ? 'De la óptica (incluido)' : `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}${order.userFrameNotes ? ' · ' + order.userFrameNotes : ''}`}`;
        }
        text += `\n\n———————————————`;
        text += `\n*Precio de Lista (Cuotas): $${Math.round(listPrice).toLocaleString()}*`;
        text += `\n↳ 3 cuotas s/interés de $${cuota3.toLocaleString()}`;
        text += `\n↳ 6 cuotas s/interés de $${cuota6.toLocaleString()}`;

        text += `\n\n🏦 *Total Transferencia (-${discountTransfer}%): $${amtTransfer.toLocaleString()}*`;
        text += `\n💵 *Total Efectivo (-${discountCash}%): $${amtCash.toLocaleString()}*`;
        text += `\n\n_Válido por 5 días hábiles._`;

        const phone = contact.phone?.replace(/\D/g, '') || '';
        const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
    };

    if (!isExpanded) {
        return (
            <button
                onClick={onToggleExpand}
                className={`w-full flex items-center justify-between bg-white dark:bg-stone-800 border ${order.isDeleted ? 'border-red-100 opacity-50' : 'border-stone-200 dark:border-stone-700 hover:border-primary/40 dark:hover:border-primary/40'} rounded-2xl px-5 py-4 transition-all hover:shadow-md group text-left`}
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
                            {format(new Date(order.createdAt), "d MMM yy", { locale: es })} · {order.items?.length || 0} prod.
                            {order.discount > 0 ? ` · ${order.discount}% desc.` : ''}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {order.paid > 0 && (
                        <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                            ${(order.paid || 0).toLocaleString()} pagado
                        </span>
                    )}
                    {isSale && (
                        <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${labInfo.color}`}>
                            {labInfo.label}
                        </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-primary transition-colors" />
                </div>
            </button>
        );
    }

    return (
        <div className={`bg-white dark:bg-stone-800 border-2 ${isSale ? 'border-emerald-200/50 dark:border-emerald-800/50 shadow-xl' : 'border-amber-200/50 dark:border-amber-800/50 shadow-lg'} rounded-[2.5rem] p-8 transition-all relative overflow-hidden group`}>
            {/* Background design elements */}
            <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-10 transition-colors ${isSale ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            
            {/* Header */}
            <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isSale ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {isSale ? <Receipt className="w-7 h-7" /> : <Calculator className="w-7 h-7" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${isSale ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                {isSale ? 'VENTA' : 'PRESUPUESTO'} #{order.id.slice(-4).toUpperCase()}
                            </span>
                            {order.isDeleted && <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-lg uppercase tracking-widest animate-pulse">ELIMINADO</span>}
                        </div>
                        <h3 className="text-3xl font-black text-stone-800 dark:text-white tracking-tighter leading-none">
                            ${(order.total || 0).toLocaleString()}
                        </h3>
                    </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                    {isSale && (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-2 ${labInfo.color} border-current/10 shadow-sm`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse bg-current`} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{labInfo.label}</span>
                        </div>
                    )}
                    {order.paid >= order.total ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-widest">PAGADO TOTAL</span>
                        </div>
                    ) : (
                        <div className="text-right">
                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-0.5">Saldo Pendiente</span>
                            <span className="text-lg font-black text-stone-900 dark:text-stone-100 tracking-tighter">
                                ${((order.total || 0) - (order.paid || 0)).toLocaleString()}
                            </span>
                        </div>
                    )}
                    {onToggleExpand && (
                        <button onClick={onToggleExpand} className="p-2 hover:bg-stone-50 dark:hover:bg-stone-900 rounded-xl transition-colors">
                            <ChevronUp className="w-5 h-5 text-stone-400" />
                        </button>
                    )}
                </div>
            </div>

            {/* Items List */}
            <div className="mb-8 space-y-3 relative z-10">
                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Plus className="w-3 h-3" /> Detalle de productos
                </h4>
                {order.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center bg-stone-50/50 dark:bg-stone-900/30 px-5 py-3 rounded-2xl border border-stone-100 dark:border-stone-800 backdrop-blur-sm group/item hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-3">
                            {item.eye && (
                                <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-[10px] font-black uppercase tracking-widest italic leading-none ${item.eye === 'OD' ? 'bg-stone-900 text-white dark:bg-stone-700' : 'bg-stone-200 text-stone-600 dark:bg-stone-800'}`}>
                                    {item.eye}
                                </span>
                            )}
                            <div>
                                <span className="text-sm font-black text-stone-800 dark:text-stone-200 block group-hover/item:text-primary transition-colors">
                                    {item.product?.brand} {item.product?.model || item.product?.name}
                                </span>
                                <span className="text-[10px] font-bold text-stone-400">{item.product?.type || item.product?.category} x{item.quantity}</span>
                            </div>
                        </div>
                        <span className="text-sm font-black text-stone-900 dark:text-stone-100 tracking-tight">
                            ${((item.price * item.quantity) * (1 + (order.markup || 0) / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                    </div>
                ))}
            </div>

            {/* Frame Info */}
            {order.frameSource && (
                <div className="mb-8 flex items-center gap-4 p-5 bg-amber-50/50 dark:bg-amber-950/20 border-2 border-amber-200/50 dark:border-amber-900/50 rounded-[2rem] relative z-10">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-2xl flex items-center justify-center text-amber-600">
                        <Glasses className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">Armazón</p>
                        <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                            {order.frameSource === 'OPTICA'
                                ? 'De la óptica (incluido en presupuesto)'
                                : `Del cliente — ${order.userFrameBrand || ''} ${order.userFrameModel || ''}${order.userFrameNotes ? ' · ' + order.userFrameNotes : ''}`
                            }
                        </p>
                    </div>
                </div>
            )}

            {/* Pricing Tiers & Discounts */}
            <div className="grid grid-cols-3 gap-4 mb-8 relative z-10">
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-3xl border-2 border-emerald-100/50 dark:border-emerald-900/30">
                    <div className="flex items-center gap-2 mb-2">
                        <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Efectivo</span>
                        {order.discountCash > 0 && <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-lg">-{order.discountCash}%</span>}
                    </div>
                    <p className="text-xl font-black text-emerald-600 tracking-tighter">${Math.round(order.subtotalWithMarkup * (1 - (order.discountCash || 0) / 100)).toLocaleString()}</p>
                </div>
                <div className="bg-violet-50/50 dark:bg-violet-950/20 p-4 rounded-3xl border-2 border-violet-100/50 dark:border-violet-900/30">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500" />
                        <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Transf.</span>
                        {order.discountTransfer > 0 && <span className="text-[9px] font-black bg-violet-500 text-white px-1.5 py-0.5 rounded-lg">-{order.discountTransfer}%</span>}
                    </div>
                    <p className="text-xl font-black text-violet-600 tracking-tighter">${Math.round(order.subtotalWithMarkup * (1 - (order.discountTransfer || 0) / 100)).toLocaleString()}</p>
                </div>
                <div className="bg-orange-50/50 dark:bg-orange-950/20 p-4 rounded-3xl border-2 border-orange-100/50 dark:border-orange-900/30">
                    <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Cuotas</span>
                    </div>
                    <p className="text-xl font-black text-orange-600 tracking-tighter">${Math.round(order.subtotalWithMarkup).toLocaleString()}</p>
                </div>
            </div>

            {/* Payments Summary */}
            {order.paid > 0 && (
                <div className="mb-8 relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" /> Progreso de pago
                        </h4>
                        <span className="text-xs font-black text-emerald-500">${(order.paid || 0).toLocaleString()} pagado</span>
                    </div>
                    <div className="h-4 bg-stone-100 dark:bg-stone-900 rounded-full border border-stone-200 dark:border-stone-700 overflow-hidden relative p-1 shadow-inner">
                        <div className={`h-full transition-all duration-1000 rounded-full shadow-lg ${order.paid >= minRequired ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                        <div className="absolute top-0 left-[40%] h-full w-0.5 bg-stone-900/10 dark:bg-white/10" title="Mínimo 40%" />
                    </div>
                    
                    {order.payments && order.payments.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {order.payments.map((p: any) => (
                                <div key={p.id} className="flex items-center justify-between bg-stone-50/30 dark:bg-stone-900 px-4 py-2.5 rounded-xl border border-stone-100/50 dark:border-stone-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center">
                                            <Banknote className="w-4 h-4" />
                                        </div>
                                        <div className="text-left">
                                            <span className="text-[11px] font-black text-stone-700 dark:text-stone-200 block leading-none mb-1">{getPaymentLabel(p.method)}</span>
                                            <span className="text-[8px] text-stone-400 font-bold uppercase tracking-widest">{format(new Date(p.date), "d MMM yyyy", { locale: es })}</span>
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">${p.amount?.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Actions Bar */}
            {showActions && !order.isDeleted && (
                <div className="pt-8 border-t border-stone-100 dark:border-stone-700 grid grid-cols-3 gap-3 relative z-10">
                    {/* Main Action Component */}
                    <div className="col-span-3 pb-2">
                        {isQuote ? (
                            <button
                                onClick={() => onConvert?.(order.id)}
                                className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3"
                            >
                                <CheckCircle2 className="w-5 h-5" /> CONVERTIR EN VENTA
                            </button>
                        ) : isLockedSale ? (
                            <div className="flex items-center gap-4 p-5 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-700 rounded-3xl shadow-inner">
                                <Lock className="w-6 h-6 text-stone-400 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Venta Registrada — Solo Lectura</p>
                                    <p className="text-[9px] font-bold text-stone-400 mt-0.5">Para modificar esta venta, solicitá autorización al administrador.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => onAddPayment?.(order.id)}
                                    className="py-4 bg-stone-900 text-white dark:bg-stone-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> REGISTRAR PAGO
                                </button>
                                {order.paid >= minRequired && contact.status === 'CONFIRMED' && (
                                    <button
                                        onClick={() => onCloseSale?.()}
                                        className="py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> CERRAR VENTA
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleDownloadPDF}
                        className="py-4 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 dark:hover:bg-stone-700 transition-all flex items-center justify-center gap-2"
                    >
                        <Download className="w-4 h-4" /> PDF
                    </button>
                    
                    <button
                        onClick={handleWhatsApp}
                        className="py-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2"
                    >
                        <MessageCircle className="w-4 h-4" /> WHATSAPP
                    </button>

                    <button
                        onClick={() => onDelete?.(order.id)}
                        disabled={isLockedSale && currentUserRole !== 'ADMIN'}
                        className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isLockedSale && currentUserRole !== 'ADMIN' 
                            ? 'bg-stone-50 text-stone-300 cursor-not-allowed opacity-50' 
                            : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                    >
                        <X className="w-4 h-4" /> ELIMINAR
                    </button>
                </div>
            )}

            {/* Deleted Reason Footer */}
            {order.isDeleted && order.deletedReason && (
                <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 italic">Pedido cancelado</p>
                    <p className="text-xs font-bold leading-tight">"{order.deletedReason}"</p>
                </div>
            )}
        </div>
    );
}
