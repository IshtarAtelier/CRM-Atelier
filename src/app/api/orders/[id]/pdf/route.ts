import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
                prescription: true
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

        const logoUrl = `https://crm-atelier-production-ae72.up.railway.app/assets/logo-atelier-optica.png`;
        
        // Colors from Logo (Beige/Sand palette)
        const brandBeige = '#D4C3B5'; // Tono principal logo
        const brandSand = '#A68B7C';  // Tono oscuro logo
        const systemEmerald = '#10b981'; // Mantener para el total por legibilidad
        
        // Calculations
        const listPrice = Number(order.subtotalWithMarkup) || Number(order.total) || 0;
        const discountCash = Number(order.discountCash) || 20;
        const discountTransfer = Number(order.discountTransfer) || 15;
        
        const totalCash = Math.round(listPrice * (1 - discountCash / 100));
        const totalTransfer = Math.round(listPrice * (1 - discountTransfer / 100));
        
        const currentTotal = Number(order.total) || totalCash; 
        const paid = Number(order.paid) || 0;
        const remainingCash = Math.max(0, currentTotal - paid);
        const remainingList = Math.max(0, listPrice - paid);

        // Installments
        const total3 = Math.round(remainingList * 1.10);
        const quota3 = Math.round(total3 / 3);
        const total6 = Math.round(remainingList * 1.20);
        const quota6 = Math.round(total6 / 6);

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
        .item-brand { font-weight: 900; color: #1c1917; }
        .item-sub { font-size: 10px; color:#78716c; font-weight: 600; }

        .payment-methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
        .payment-card { border-radius: 18px; padding: 18px; border: 1.5px solid ${brandBeige}; position: relative; overflow: hidden; }
        .payment-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 5px; }
        
        .p-efective { background: white; }
        .p-efective::before { background: ${systemEmerald}; }
        .p-efective .p-title { color: ${systemEmerald}; }
        
        .p-transfer { background: white; }
        .p-transfer::before { background: #7c3aed; }
        .p-transfer .p-title { color: #5b21b6; }
        
        .p-card { background: white; }
        .p-card::before { background: ${brandSand}; }
        .p-card .p-title { color: ${brandSand}; }

        .p-title { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; display: block; }
        .p-amount { font-size: 18px; font-weight: 900; color: #1c1917; display: block; margin-bottom: 2px; }
        .p-discount { font-size: 9px; font-weight: 800; background: #f5f5f4; display: inline-block; padding: 3px 8px; border-radius: 6px; margin-top: 5px; color: #57534e; }
        
        .installments { border-top: 1px solid #f5f5f4; margin-top: 12px; padding-top: 10px; }
        .inst-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
        .inst-label { font-size: 10px; font-weight: 700; color: #78716c; }
        .inst-quota { font-size: 14px; font-weight: 900; color: ${brandSand}; }
        .inst-total { font-size: 8px; color: #a8a29e; font-weight: 700; display: block; text-align: right; text-transform: uppercase; }

        .totals-summary { margin-top: 25px; padding: 25px; border-radius: 20px; background: #1c1917; color: white; display: flex; justify-content: space-between; align-items: center; border: 2px solid ${brandSand}; }
        .tot-main-title { font-size: 11px; font-weight: 900; color: #a8a29e; text-transform: uppercase; letter-spacing: 3px; }
        .tot-amount { font-size: 34px; font-weight: 900; color: ${systemEmerald}; letter-spacing: -1px; }
        .tot-saldo { text-align: right; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 25px; }
        .saldo-label { font-size: 10px; color: #a8a29e; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 3px; }
        .saldo-value { font-size: 24px; font-weight: 900; color: #fbbf24; }

        .prescription-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; }
        .eye-box { border: 1.5px solid ${brandBeige}; border-radius: 14px; padding: 14px; background: #fffcf9; }
        .eye-title { font-size: 9px; font-weight: 900; color: ${brandSand}; margin-bottom: 8px; border-bottom: 1px solid ${brandBeige}; padding-bottom: 5px; }
        .eye-data { font-size: 15px; font-weight: 800; color: #1c1917; letter-spacing: 1px; }

        .footer { margin-top: 40px; text-align: center; border-top: 2px solid ${brandBeige}; padding-top: 20px; font-size: 9px; color: #a8a29e; text-transform: uppercase; letter-spacing: 3px; font-weight: 900; }
        
        .print-btn { position: fixed; top: 20px; right: 20px; padding: 14px 28px; background: ${brandSand}; color: white; border: none; border-radius: 14px; font-weight: 900; cursor: pointer; box-shadow: 0 10px 15px -3px rgba(166,139,124,0.4); z-index: 1000; text-transform: uppercase; letter-spacing: 1px; }
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
            <div class='doc-meta'>Ref: #${order.id.slice(-6).toUpperCase()} · Creado el ${dateStr}</div>
        </div>
    </div>

    <div class='info-grid'>
        <div class='info-box'>
            <h3>👤 Información del Cliente</h3>
            <div class='info-row'><span class='info-label'>Nombre</span><span class='info-value'>${order.client?.name || 'Cliente Final'}</span></div>
            <div class='info-row'><span class='info-label'>WhatsApp</span><span class='info-value'>${order.client?.phone || '-'}</span></div>
        </div>
        <div class='info-box'>
            <h3>🏢 Punto de Atención</h3>
            <div class='info-row'><span class='info-label'>Sucursal</span><span class='info-value'>Cerro de las Rosas</span></div>
            <div class='info-row'><span class='info-label'>Condición</span><span class='info-value'>Validez 15 días</span></div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 60%">Descripción del Producto</th>
                <th style="text-align: center">Cant.</th>
                <th style="text-align: right">P. Unitario</th>
                <th style="text-align: right">Total</th>
            </tr>
        </thead>
        <tbody>
            ${(order.items || []).map((it: any) => `
                <tr>
                    <td>
                        <div class='item-brand'>${it.product?.brand || ''} ${it.product?.model || it.product?.name || ''}</div>
                        ${it.eye ? `<div class='item-sub'>Lado: ${it.eye}</div>` : ''}
                    </td>
                    <td style='text-align:center; font-weight: 800;'>${it.quantity}</td>
                    <td style='text-align:right'>$${Math.round(it.price).toLocaleString()}</td>
                    <td style='text-align:right; font-weight: 900; color: #1c1917;'>$${Math.round(it.price * it.quantity).toLocaleString()}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class='payment-methods'>
        <div class='payment-card p-efective'>
            <span class='p-title'>💵 Pago Efectivo</span>
            <span class='p-amount'>$${totalCash.toLocaleString()}</span>
            <span class='p-discount'>Bonificación ${discountCash}%</span>
        </div>
        <div class='payment-card p-transfer'>
            <span class='p-title'>🏦 Transferencia</span>
            <span class='p-amount'>$${totalTransfer.toLocaleString()}</span>
            <span class='p-discount'>Bonificación ${discountTransfer}%</span>
        </div>
        <div class='payment-card p-card'>
            <span class='p-title'>💳 Tarjetas / Lista</span>
            <span class='p-amount'>$${listPrice.toLocaleString()}</span>
            <div class='installments'>
                <div class='inst-row'>
                    <span class='inst-label'>3 Cuotas de</span>
                    <span class='inst-quota'>$${quota3.toLocaleString()}</span>
                </div>
                <span class='inst-total'>Total: $${total3.toLocaleString()}</span>
                <div class='inst-row' style="margin-top: 8px;">
                    <span class='inst-label'>6 Cuotas de</span>
                    <span class='inst-quota'>$${quota6.toLocaleString()}</span>
                </div>
                <span class='inst-total'>Total: $${total6.toLocaleString()}</span>
            </div>
        </div>
    </div>

    <div class='totals-summary'>
        <div>
            <span class='tot-main-title'>Total Consolidado</span>
            <div class='tot-amount'>$${currentTotal.toLocaleString()}</div>
        </div>
        <div class='tot-saldo'>
            ${paid > 0 ? `
                <span class='saldo-label'>Abonado: $${paid.toLocaleString()}</span>
                <span class='saldo-label' style="margin-top: 5px;">Saldo Pendiente</span>
                <span class='saldo-value'>$${(currentTotal - paid).toLocaleString()}</span>
            ` : `
                <span class='saldo-label'>Atelier Óptica</span>
                <span class='saldo-value' style="color: ${brandBeige};">Elegancia Visual</span>
            `}
        </div>
    </div>

    ${order.prescription ? `
        <div class='prescription-grid'>
            <div class='eye-box'>
                <div class='eye-title'>DIAGNÓSTICO OJO DERECHO (OD)</div>
                <div class='eye-data'>${order.prescription.sphereOD || '0'} / ${order.prescription.cylinderOD || '0'} x ${order.prescription.axisOD || '0'}°</div>
            </div>
            <div class='eye-box'>
                <div class='eye-title'>DIAGNÓSTICO OJO IZQUIERDO (OI)</div>
                <div class='eye-data'>${order.prescription.sphereOI || '0'} / ${order.prescription.cylinderOI || '0'} x ${order.prescription.axisOI || '0'}°</div>
            </div>
        </div>
    ` : ''}

    <div class='footer'>Atelier Óptica · Profesionalismo Ética y Diseño · Tejeda 4380 · ${format(new Date(), "yyyy")}</div>
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
