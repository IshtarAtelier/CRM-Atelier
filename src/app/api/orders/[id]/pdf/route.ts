import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { PricingService } from '@/services/PricingService';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                client: true,
                items: {
                    include: {
                        product: true
                    }
                },
                prescription: true,
                payments: true
            }
        });

        if (!order) {
            return new Response('Pedido no encontrado', { status: 404 });
        }

        const isSale = order.orderType === 'SALE';
        
        let dateStr = '';
        try {
            dateStr = format(new Date(order.createdAt), "dd 'de' MMMM, yyyy", { locale: es });
        } catch (e) {
            dateStr = new Date().toLocaleDateString('es-AR');
        }

        const logoUrl = `https://crm-atelier-production-ae72.app.railway.com/assets/logo-atelier-optica.png`;
        
        // Brand Colors
        const brandBeige = '#D4C3B5';
        const brandSand = '#A68B7C';
        const systemEmerald = '#10b981';
        
        const financials = PricingService.calculateOrderFinancials(order);

        const markupFactor = 1 + ((order.markup || 0) / 100);

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${isSale ? 'Venta' : 'Presupuesto'} #${order.id.slice(-6).toUpperCase()}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter','Segoe UI',sans-serif; }
        @page { margin: 0; size: auto; }
        body { padding: 40px 50px; color: #1c1917; font-size: 13px; line-height:1.4; background: white; }
        
        .letterhead { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; border-bottom:2px solid ${brandBeige}; margin-bottom: 8px; }
        .letterhead-logo { height:58px; }
        .letterhead-right { text-align:right; font-size:10px; color:#78716c; font-weight: 500; }
        .address-bold { font-weight:800; color:${brandSand}; text-transform: uppercase; letter-spacing: 1px; }
        
        .tagline { text-align:center; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:2.5px; color:${brandSand}; padding:14px 0; border-bottom: 1px solid #f5f5f4; margin-bottom: 10px; }
        
        .doc-header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:20px; }
        .doc-title { font-size:22px; font-weight:900; text-transform:uppercase; color:${brandSand}; letter-spacing: 2px; }
        .doc-meta { font-size:11px; color:#a8a29e; font-weight: 800; }

        .info-grid { display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px; }
        .info-box { border:1.5px solid ${brandBeige}; border-radius:14px; padding:14px; background: #fffcf9; }
        .info-box h3 { font-size:9px; font-weight:900; text-transform:uppercase; color:${brandSand}; border-bottom: 1px solid ${brandBeige}; padding-bottom: 6px; margin-bottom: 8px; }
        .info-row { display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px; }
        .info-label { color:#78716c; font-weight: 600; }
        .info-value { font-weight:800; color:#1c1917; }

        table { width:100%; border-collapse:collapse; margin-bottom:20px; border-radius: 12px; overflow: hidden; border: 1.5px solid ${brandBeige}; }
        th { background:${brandSand}; color:white; padding:12px 14px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:1.5px; }
        td { padding:12px 14px; border-bottom:1px solid #f5f5f4; font-size:12px; }
        tr:nth-child(even) { background:#fffcf9; }

        .payment-methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
        .payment-card { border-radius: 18px; padding: 18px; border: 1.5px solid ${brandBeige}; position: relative; overflow: hidden; }
        .payment-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 5px; }
        .p-efective::before { background: ${systemEmerald}; }
        .p-transfer::before { background: #7c3aed; }
        .p-card::before { background: #f97316; }

        .p-title { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; display: block; }
        .p-amount { font-size: 18px; font-weight: 900; color: #1c1917; display: block; margin-bottom: 2px; }
        .p-saldo { font-size: 12px; font-weight: 900; background: #f5f5f4; display: inline-block; padding: 4px 10px; border-radius: 8px; margin-top: 8px; }
        .p-saldo-label { color: #78716c; font-size: 8px; display: block; margin-bottom: 2px; text-transform: uppercase; }
        
        .installments { border-top: 1px solid #f5f5f4; margin-top: 12px; padding-top: 10px; }
        .inst-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
        .inst-quota { font-size: 14px; font-weight: 900; color: #c2410c; }
        .inst-total { font-size: 8px; color: #a8a29e; font-weight: 700; text-align: right; text-transform: uppercase; display: block; }
        .p-tag { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color:#a8a29e; margin-bottom: 4px; display: block; }

        .totals-summary { margin-top: 25px; padding: 25px; border-radius: 20px; background: #1c1917; color: white; display: flex; justify-content: space-between; align-items: center; border: 2px solid ${brandSand}; }
        .tot-amount { font-size: 34px; font-weight: 900; color: ${systemEmerald}; letter-spacing: -1px; }
        .tot-col { text-align: center; padding: 0 15px; border-right: 1px solid rgba(255,255,255,0.1); }
        .tot-col:last-of-type { border-right: none; }
        .tot-val { font-size: 18px; font-weight: 900; display: block; }
        .tot-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #a8a29e; display: block; margin-bottom: 4px; }
        
        .tot-paid { text-align: right; border-left: 2px solid rgba(255,255,255,0.2); padding-left: 25px; margin-left: 10px; }
        .paid-value { font-size: 24px; font-weight: 900; color: #fbbf24; }

        .footer { margin-top: 40px; text-align: center; border-top: 2px solid ${brandBeige}; padding-top: 20px; font-size: 9px; color: #a8a29e; text-transform: uppercase; letter-spacing: 3px; font-weight: 900; }
        .print-btn { position: fixed; top: 20px; right: 20px; padding: 14px 28px; background: ${brandSand}; color: white; border: none; border-radius: 14px; font-weight: 900; cursor: pointer; z-index: 1000; text-transform: uppercase; }
        @media print { .print-btn { display: none; } body { padding: 30px; } }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">Imprimir PDF</button>

    <div class='letterhead'>
        <img src='${logoUrl}' class='letterhead-logo' alt='Atelier Óptica' />
        <div class='letterhead-right'>
            <div class='address-bold'>José Luis de Tejeda 4380</div>
            <div>Cerro de las Rosas, Córdoba</div>
            <div>WhatsApp: 351 1234567</div>
        </div>
    </div>
    <div class='tagline'>La óptica mejor calificada de Córdoba ⭐ 5/5 Google Business</div>

    <div class='doc-header'>
        <div>
            <div class='doc-title'>${isSale ? 'Orden de Venta' : 'Presupuesto'}</div>
            <div class='doc-meta'>#${order.id.slice(-6).toUpperCase()} · ${dateStr}</div>
        </div>
    </div>

    <div class='info-grid'>
        <div class='info-box'>
            <h3>👤 Cliente</h3>
            <div class='info-row'><span class='info-label'>Nombre</span><span class='info-value'>${order.client?.name || 'Cliente Final'}</span></div>
            <div class='info-row'><span class='info-label'>WhatsApp</span><span class='info-value'>${order.client?.phone || '-'}</span></div>
        </div>
        <div class='info-box'>
            <h3>🏢 Atelier Local</h3>
            <div class='info-row'><span class='info-label'>Sucursal</span><span class='info-value'>Cerro de las Rosas</span></div>
            <div class='info-row'><span class='info-label'>Vigencia</span><span class='info-value'>15 días corridos</span></div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 60%">Descripción</th>
                <th style="text-align: center">Cant.</th>
                <th style="text-align: right">Precio</th>
                <th style="text-align: right">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            ${(order.items || []).map((it: any) => {
                const itemPrice = Math.round(it.price * markupFactor);
                return `
                <tr>
                    <td>
                        <div style="font-weight: 900;">${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''}</div>
                        ${it.eye ? `<div style="font-size:10px; color:#78716c;">Lado: ${it.eye}</div>` : ''}
                    </td>
                    <td style='text-align:center; font-weight: 800;'>${it.quantity}</td>
                    <td style='text-align:right'>$${itemPrice.toLocaleString()}</td>
                    <td style='text-align:right; font-weight: 900;'>$${(itemPrice * it.quantity).toLocaleString()}</td>
                </tr>
            `}).join('')}
        </tbody>
    </table>

    <div class='payment-methods'>
        <div class='payment-card p-efective'>
            <span class='p-title'>💵 Efectivo (-${financials.discountCash}%)</span>
            <span class='p-amount'>$${financials.totalCash.toLocaleString()}</span>
            ${financials.hasBalance ? `
            <div class='p-saldo'>
                <span class='p-saldo-label'>Saldo Pendiente</span>
                <span>$${financials.remainingCash.toLocaleString()}</span>
            </div>
            ` : `<span class="p-saldo" style="color:#10b981; background:#f0fdf4;">PAGADO COMPLETO</span>`}
        </div>
        <div class='payment-card p-transfer'>
            <span class='p-title'>🏦 Transferencia (-${financials.discountTransfer}%)</span>
            <span class='p-amount'>$${financials.totalTransfer.toLocaleString()}</span>
            ${financials.hasBalance ? `
            <div class='p-saldo'>
                <span class='p-saldo-label'>Saldo Pendiente</span>
                <span>$${financials.remainingTransfer.toLocaleString()}</span>
            </div>
            ` : `<span class="p-saldo" style="color:#10b981; background:#f0fdf4;">PAGADO COMPLETO</span>`}
        </div>
        <div class='payment-card p-card'>
            <span class='p-title'>💳 Tarjetas (Lista)</span>
            <span class='p-amount'>$${financials.totalCard.toLocaleString()}</span>
            ${financials.hasBalance ? `
            <div class='p-saldo'>
                <span class='p-saldo-label'>Saldo Listado</span>
                <span>$${financials.remainingCard.toLocaleString()}</span>
            </div>
            ` : `<span class="p-saldo" style="color:#10b981; background:#f0fdf4;">PAGADO COMPLETO</span>`}
            <div class='installments'>
                <div class='inst-row'>
                    <span style="font-size:10px; font-weight:700;">3 Cuotas de</span>
                    <span class='inst-quota'>$${Math.round(financials.totalCard * 1.10 / 3).toLocaleString()}</span>
                </div>
                <div class='inst-row' style="margin-top: 8px;">
                    <span style="font-size:10px; font-weight:700;">6 Cuotas de</span>
                    <span class='inst-quota'>$${Math.round(financials.totalCard * 1.25 / 6).toLocaleString()}</span>
                </div>
            </div>
        </div>
    </div>

    <div class='totals-summary'>
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

    ${order.prescription ? `
        <div style="margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="border: 1.5px solid ${brandBeige}; border-radius: 12px; padding: 12px;">
                <div style="font-size: 8px; font-weight: 900; color: ${brandSand}; margin-bottom: 5px;">OD</div>
                <div style="font-size: 14px; font-weight: 800;">${order.prescription.sphereOD || '0'} / ${order.prescription.cylinderOD || '0'} x ${order.prescription.axisOD || '0'}°</div>
            </div>
            <div style="border: 1.5px solid ${brandBeige}; border-radius: 12px; padding: 12px;">
                <div style="font-size: 8px; font-weight: 900; color: ${brandSand}; margin-bottom: 5px;">OI</div>
                <div style="font-size: 14px; font-weight: 800;">${order.prescription.sphereOI || '0'} / ${order.prescription.cylinderOI || '0'} x ${order.prescription.axisOI || '0'}°</div>
            </div>
        </div>
    ` : ''}

    <div class='footer'>Atelier Óptica · Tejeda 4380 · Profesionalismo Ética y Diseño · ${format(new Date(), "yyyy")}</div>
</body>
</html>`;

        return new Response(html, {
            headers: { 'Content-Type': 'text/html' },
        });
    } catch (error: any) {
        console.error('Error generando PDF:', error);
        return new Response(`Error interno: ${error.message}`, { status: 500 });
    }
}
