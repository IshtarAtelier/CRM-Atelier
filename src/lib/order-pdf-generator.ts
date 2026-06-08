
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PricingService } from '@/services/PricingService';
import fs from 'fs';
import path from 'path';

export function getOrderHtml(order: any, client: any): string {
    const isSale = order.orderType === 'SALE';
    
    let dateStr = '';
    try {
        dateStr = format(new Date(order.createdAt), "dd 'de' MMMM, yyyy", { locale: es });
    } catch (e) {
        dateStr = new Date().toLocaleDateString('es-AR');
    }

    // Cargar logo local en base64 si existe
    let logoBase64 = '';
    try {
        const logoPath = path.join(process.cwd(), 'public', 'assets', 'logo-atelier-optica.png');
        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath);
            logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        }
    } catch (e) {
        console.error('Error al leer logo local para el PDF:', e);
    }

    const logoUrl = logoBase64 || `https://crm-atelier-production-ae72.up.railway.app/assets/logo-atelier-optica.png`;
    
    // Brand Colors
    const brandBeige = '#D4C3B5';
    const brandSand = '#A68B7C';
    const systemEmerald = '#10b981';
    
    const financials = PricingService.calculateOrderFinancials(order);
    const markupFactor = 1 + ((order.markup || 0) / 100);

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${isSale ? 'Venta' : 'Presupuesto'} - ${client?.name || 'Cliente'} - Atelier Óptica</title>
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
        
        @media print { body { padding: 30px; } }
    </style>
</head>
<body>
    <div class='letterhead'>
        <img src='${logoUrl}' class='letterhead-logo' alt='Atelier Óptica' />
        <div class='letterhead-right'>
            <div class='address-bold'>José Luis de Tejeda 4380</div>
            <div>Cerro de las Rosas, Córdoba</div>
            <div>WhatsApp: 351 1234567</div>
        </div>
    </div>
    <div class='tagline'>ATELIER ÓPTICA — LA ÓPTICA MEJOR CALIFICADA EN CÓRDOBA ⭐⭐⭐⭐⭐</div>

    <div class='doc-header'>
        <div>
            <div class='doc-title'>${isSale ? 'Orden de Venta' : 'Presupuesto'} <span style="background:#1c1917; color:white; padding:2px 8px; border-radius:4px; font-size:7px; margin-left:10px; vertical-align:middle;">V2.0</span></div>
            <div class='doc-meta'>#${order.id.slice(-6).toUpperCase()} · ${dateStr}</div>
        </div>
    </div>

    <div class='info-grid'>
        <div class='info-box'>
            <h3>👤 Cliente</h3>
            <div class='info-row'><span class='info-label'>Nombre</span><span class='info-value'>${client?.name || 'Cliente Final'}</span></div>
            <div class='info-row'><span class='info-label'>WhatsApp</span><span class='info-value'>${client?.phone || '-'}</span></div>
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
                <th style="text-align: right">Precio Unit.</th>
                <th style="text-align: right">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            ${(order.items || []).map((it: any) => {
                const itemPrice = Math.round(it.price * markupFactor);
                return `
                <tr>
                    <td>
                        <div style="font-weight: 900;">${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}</div>
                        ${it.eye ? `<div style="font-size:10px; color:#78716c;">Lado: ${it.eye}</div>` : ''}
                    </td>
                    <td style='text-align:center; font-weight: 800;'>${it.quantity}</td>
                    <td style='text-align:right'>$${itemPrice.toLocaleString()}</td>
                    <td style='text-align:right; font-weight: 900;'>$${(itemPrice * it.quantity).toLocaleString()}</td>
                </tr>
            `}).join('')}
        </tbody>
    </table>

    ${(() => {
        // El subtotal de los items suma los precios unitarios ya inflados
        const rawSubtotalInflated = (order.items || []).reduce((sum: number, it: any) => sum + (Math.round(it.price * markupFactor) * (it.quantity || 1)), 0);
        
        // La promo también debe figurar inflada para que la resta tenga sentido matemáticamente
        const promoFrameDiscount = order.appliedPromoDiscount || 0;
        const promoFrameInflated = Math.round(promoFrameDiscount * markupFactor);
        
        const specialDiscount = order.specialDiscount || 0;

        // Solo mostramos este recuadro si hubo descuentos que explicar
        if (promoFrameInflated === 0 && specialDiscount === 0) return '';

        return `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 25px;">
            <div style="width: 320px; background: #fffcf9; border: 1.5px solid ${brandBeige}; border-radius: 14px; padding: 16px;">
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px;">
                    <span style="color: #78716c; font-weight: 600;">Subtotal Items:</span>
                    <span style="font-weight: 800;">$${rawSubtotalInflated.toLocaleString()}</span>
                </div>
                ${promoFrameInflated > 0 ? `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; color: #10b981;">
                    <span style="font-weight: 600;">🎁 ${order.appliedPromoName || 'Bonificación Armazón'}:</span>
                    <span style="font-weight: 800;">-$${promoFrameInflated.toLocaleString()}</span>
                </div>
                ` : ''}
                ${specialDiscount > 0 ? `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; color: #10b981;">
                    <span style="font-weight: 600;">✨ Descuento Especial:</span>
                    <span style="font-weight: 800;">-$${specialDiscount.toLocaleString()}</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; padding-top: 10px; margin-top: 8px; border-top: 1.5px solid ${brandBeige}; font-size: 14px; font-weight: 900; color: ${brandSand};">
                    <span>PRECIO DE LISTA FINAL:</span>
                    <span>$${financials.listPrice.toLocaleString()}</span>
                </div>
            </div>
        </div>
        `;
    })()}

    ${!financials.hasBalance ? `
    <div style="margin-top: 30px; padding: 35px; border-radius: 20px; background: #f0fdf4; border: 2px solid #10b981; text-align: center; color: #065f46;">
        <h2 style="font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">✅ Orden Pagada en su Totalidad</h2>
        <p style="font-size: 15px; font-weight: 700;">El saldo ha sido cancelado. Total abonado: <span style="font-weight: 900; font-size: 22px;">$${financials.paidReal.toLocaleString()}</span></p>
    </div>
    ` : `
    <div class='payment-methods'>
        <div class='payment-card p-efective'>
            <span class='p-title'>💵 Efectivo (-${financials.discountCash}%)</span>
            <span class='p-amount'>$${financials.totalCash.toLocaleString()}</span>
            <div class='p-saldo'>
                <span class='p-saldo-label'>Saldo Pendiente</span>
                <span>$${financials.remainingCash.toLocaleString()}</span>
            </div>
        </div>
        <div class='payment-card p-transfer'>
            <span class='p-title'>🏦 Transferencia (-${financials.discountTransfer}%)</span>
            <span class='p-amount'>$${financials.totalTransfer.toLocaleString()}</span>
            <div class='p-saldo'>
                <span class='p-saldo-label'>Saldo Pendiente</span>
                <span>$${financials.remainingTransfer.toLocaleString()}</span>
            </div>
        </div>
        <div class='payment-card p-card'>
            <span class='p-title'>💳 Tarjetas (Lista)</span>
            <span class='p-amount'>$${financials.totalCard.toLocaleString()}</span>
            <div class='p-saldo'>
                <span class='p-saldo-label'>Saldo Listado</span>
                <span>$${financials.remainingCard.toLocaleString()}</span>
            </div>
            <div class='installments'>
                <div class='inst-row'>
                    <span style="font-size:10px; font-weight:700;">3 Cuotas sin interés de</span>
                    <span class='inst-quota'>$${financials.installment3.toLocaleString()}</span>
                </div>
                <div class='inst-row' style="margin-top: 8px;">
                    <span style="font-size:10px; font-weight:700;">6 Cuotas sin interés de</span>
                    <span class='inst-quota'>$${financials.installment6.toLocaleString()}</span>
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
    `}

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
}

export async function generateOrderPDF(order: any, contact: any): Promise<{ base64: string, filename: string }> {
    const isSale = order.orderType === 'SALE';
    const safeName = (contact?.name || 'Cliente').replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-');
    const filename = `${isSale ? 'Venta' : 'Presupuesto'}_${order.id.slice(-4).toUpperCase()}_${safeName}.pdf`;

    // Usar jsPDF directamente — funciona sin dependencias del sistema (sin Chromium)
    return generateOrderPDFWithJsPDF(order, contact, filename);
}

async function generateOrderPDFWithJsPDF(order: any, contact: any, filename: string): Promise<{ base64: string, filename: string }> {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const isSale = order.orderType === 'SALE';
    const financials = PricingService.calculateOrderFinancials(order);
    const markupFactor = 1 + ((order.markup || 0) / 100);
    
    // Brand colors
    const brandSand: [number, number, number] = [166, 139, 124]; // #A68B7C
    const brandBeige: [number, number, number] = [212, 195, 181]; // #D4C3B5
    const emerald: [number, number, number] = [16, 185, 129]; // #10b981
    const darkText: [number, number, number] = [28, 25, 23]; // #1c1917
    const grayText: [number, number, number] = [120, 113, 108]; // #78716c
    
    let dateStr = '';
    try {
        dateStr = format(new Date(order.createdAt), "dd 'de' MMMM, yyyy", { locale: es });
    } catch {
        dateStr = new Date().toLocaleDateString('es-AR');
    }
    
    const pageWidth = 210;
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;
    
    // --- HEADER ---
    // Logo placeholder (text-based since we can't embed images easily in jsPDF without canvas)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandSand);
    doc.text('ATELIER ÓPTICA', margin, y + 5);
    
    // Right side - address
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandSand);
    doc.text('JOSÉ LUIS DE TEJEDA 4380', pageWidth - margin, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayText);
    doc.text('Cerro de las Rosas, Córdoba', pageWidth - margin, y + 4, { align: 'right' });
    doc.text('WhatsApp: 351 1234567', pageWidth - margin, y + 8, { align: 'right' });
    
    y += 14;
    
    // Divider line
    doc.setDrawColor(...brandBeige);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    
    // Tagline
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandSand);
    doc.text('ATELIER ÓPTICA — LA ÓPTICA MEJOR CALIFICADA EN CÓRDOBA ⭐⭐⭐⭐⭐', pageWidth / 2, y, { align: 'center' });
    y += 8;
    
    // --- DOC HEADER ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandSand);
    doc.text(`${isSale ? 'ORDEN DE VENTA' : 'PRESUPUESTO'}`, margin, y);
    
    doc.setFontSize(8);
    doc.setTextColor(168, 162, 158);
    doc.text(`#${order.id.slice(-6).toUpperCase()} · ${dateStr}`, margin, y + 5);
    y += 14;
    
    // --- CLIENT INFO ---
    const boxHeight = 20;
    const halfWidth = (contentWidth - 5) / 2;
    
    // Client box
    doc.setDrawColor(...brandBeige);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, halfWidth, boxHeight, 3, 3);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandSand);
    doc.text('👤 CLIENTE', margin + 4, y + 5);
    doc.setFontSize(9);
    doc.setTextColor(...darkText);
    doc.text(contact?.name || 'Cliente Final', margin + 4, y + 11);
    doc.setFontSize(8);
    doc.setTextColor(...grayText);
    doc.text(contact?.phone || '-', margin + 4, y + 16);
    
    // Local box
    const boxX = margin + halfWidth + 5;
    doc.setDrawColor(...brandBeige);
    doc.roundedRect(boxX, y, halfWidth, boxHeight, 3, 3);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandSand);
    doc.text('🏢 ATELIER LOCAL', boxX + 4, y + 5);
    doc.setFontSize(9);
    doc.setTextColor(...darkText);
    doc.text('Cerro de las Rosas', boxX + 4, y + 11);
    doc.setFontSize(8);
    doc.setTextColor(...grayText);
    doc.text('Vigencia: 15 días corridos', boxX + 4, y + 16);
    
    y += boxHeight + 8;
    
    // --- ITEMS TABLE ---
    const tableRows = (order.items || []).map((it: any) => {
        const itemPrice = Math.round(it.price * markupFactor);
        return [
            `${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}`,
            `${it.quantity}`,
            `$${itemPrice.toLocaleString()}`,
            `$${(itemPrice * it.quantity).toLocaleString()}`
        ];
    });
    
    autoTable(doc, {
        startY: y,
        head: [['Descripción', 'Cant.', 'Precio Unit.', 'Subtotal']],
        body: tableRows,
        margin: { left: margin, right: margin },
        headStyles: {
            fillColor: brandSand,
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: 'bold',
            cellPadding: 3
        },
        bodyStyles: {
            fontSize: 8,
            cellPadding: 3,
            textColor: darkText
        },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.5 },
            1: { halign: 'center', cellWidth: contentWidth * 0.1 },
            2: { halign: 'right', cellWidth: contentWidth * 0.2 },
            3: { halign: 'right', cellWidth: contentWidth * 0.2, fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [255, 252, 249] },
        theme: 'grid'
    });
    
    y = (doc as any).lastAutoTable.finalY + 10;
    
    // --- PAYMENT METHODS ---
    if (financials.hasBalance) {
        const cardWidth = (contentWidth - 10) / 3;
        const cardY = y;
        const cardH = 35;
        
        // Efectivo
        doc.setDrawColor(...brandBeige);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, cardY, cardWidth, cardH, 3, 3);
        doc.setFillColor(...emerald);
        doc.rect(margin, cardY, cardWidth, 1.5, 'F');
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkText);
        doc.text(`💵 EFECTIVO (-${financials.discountCash}%)`, margin + 3, cardY + 7);
        doc.setFontSize(14);
        doc.text(`$${financials.totalCash.toLocaleString()}`, margin + 3, cardY + 15);
        doc.setFontSize(7);
        doc.setTextColor(...grayText);
        doc.text(`Saldo: $${financials.remainingCash.toLocaleString()}`, margin + 3, cardY + 22);
        
        // Transferencia
        const card2X = margin + cardWidth + 5;
        doc.setDrawColor(...brandBeige);
        doc.roundedRect(card2X, cardY, cardWidth, cardH, 3, 3);
        doc.setFillColor(124, 58, 237);
        doc.rect(card2X, cardY, cardWidth, 1.5, 'F');
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkText);
        doc.text(`🏦 TRANSFERENCIA (-${financials.discountTransfer}%)`, card2X + 3, cardY + 7);
        doc.setFontSize(14);
        doc.text(`$${financials.totalTransfer.toLocaleString()}`, card2X + 3, cardY + 15);
        doc.setFontSize(7);
        doc.setTextColor(...grayText);
        doc.text(`Saldo: $${financials.remainingTransfer.toLocaleString()}`, card2X + 3, cardY + 22);
        
        // Tarjeta
        const card3X = margin + (cardWidth + 5) * 2;
        doc.setDrawColor(...brandBeige);
        doc.roundedRect(card3X, cardY, cardWidth, cardH, 3, 3);
        doc.setFillColor(249, 115, 22);
        doc.rect(card3X, cardY, cardWidth, 1.5, 'F');
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkText);
        doc.text('💳 TARJETAS (LISTA)', card3X + 3, cardY + 7);
        doc.setFontSize(14);
        doc.text(`$${financials.totalCard.toLocaleString()}`, card3X + 3, cardY + 15);
        doc.setFontSize(7);
        doc.setTextColor(...grayText);
        doc.text(`Saldo: $${financials.remainingCard.toLocaleString()}`, card3X + 3, cardY + 22);
        doc.text(`3 cuotas: $${financials.installment3.toLocaleString()}`, card3X + 3, cardY + 27);
        doc.text(`6 cuotas: $${financials.installment6.toLocaleString()}`, card3X + 3, cardY + 31);
        
        y = cardY + cardH + 10;
        
        // --- TOTALS BAR ---
        doc.setFillColor(28, 25, 23);
        doc.roundedRect(margin, y, contentWidth, 22, 4, 4, 'F');
        
        const colW = contentWidth / 4;
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        
        // Efectivo total
        doc.setTextColor(...emerald);
        doc.text('💵 EFECTIVO', margin + 5, y + 7);
        doc.setFontSize(12);
        doc.text(`$${financials.totalCash.toLocaleString()}`, margin + 5, y + 15);
        
        // Transfer total
        doc.setFontSize(6);
        doc.setTextColor(167, 139, 250);
        doc.text('🏦 TRANSF', margin + colW + 5, y + 7);
        doc.setFontSize(12);
        doc.text(`$${financials.totalTransfer.toLocaleString()}`, margin + colW + 5, y + 15);
        
        // Card total
        doc.setFontSize(6);
        doc.setTextColor(251, 146, 60);
        doc.text('💳 TARJETA', margin + colW * 2 + 5, y + 7);
        doc.setFontSize(12);
        doc.text(`$${financials.totalCard.toLocaleString()}`, margin + colW * 2 + 5, y + 15);
        
        // Paid
        doc.setFontSize(6);
        doc.setTextColor(168, 162, 158);
        doc.text('ABONADO REAL', margin + colW * 3 + 5, y + 7);
        doc.setFontSize(12);
        doc.setTextColor(251, 191, 36);
        doc.text(`$${financials.paidReal.toLocaleString()}`, margin + colW * 3 + 5, y + 15);
        
        y += 30;
    } else {
        // Paid in full
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(...emerald);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, y, contentWidth, 20, 4, 4, 'FD');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(6, 95, 70);
        doc.text('✅ ORDEN PAGADA EN SU TOTALIDAD', pageWidth / 2, y + 9, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Total abonado: $${financials.paidReal.toLocaleString()}`, pageWidth / 2, y + 16, { align: 'center' });
        y += 28;
    }
    
    // --- PRESCRIPTION ---
    if (order.prescription) {
        const rxW = (contentWidth - 5) / 2;
        
        doc.setDrawColor(...brandBeige);
        doc.roundedRect(margin, y, rxW, 16, 2, 2);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...brandSand);
        doc.text('OD', margin + 4, y + 5);
        doc.setFontSize(10);
        doc.setTextColor(...darkText);
        doc.text(`${order.prescription.sphereOD || '0'} / ${order.prescription.cylinderOD || '0'} x ${order.prescription.axisOD || '0'}°`, margin + 4, y + 12);
        
        doc.roundedRect(margin + rxW + 5, y, rxW, 16, 2, 2);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...brandSand);
        doc.text('OI', margin + rxW + 9, y + 5);
        doc.setFontSize(10);
        doc.setTextColor(...darkText);
        doc.text(`${order.prescription.sphereOI || '0'} / ${order.prescription.cylinderOI || '0'} x ${order.prescription.axisOI || '0'}°`, margin + rxW + 9, y + 12);
        
        y += 22;
    }
    
    // --- FOOTER ---
    doc.setDrawColor(...brandBeige);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(168, 162, 158);
    doc.text(`ATELIER ÓPTICA · TEJEDA 4380 · PROFESIONALISMO ÉTICA Y DISEÑO · ${format(new Date(), 'yyyy')}`, pageWidth / 2, y, { align: 'center' });
    
    const base64 = doc.output('datauristring').split(',')[1];
    console.log('[generateOrderPDF] Generated with jsPDF fallback successfully');
    return { base64, filename };
}

