
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
        
        .letterhead { padding-bottom:20px; border-bottom:2px solid ${brandBeige}; margin-bottom: 8px; overflow: hidden; }
        .letterhead-logo { width: 363px; height: 55px; float: left; object-fit: contain; }
        .letterhead-right { float: right; text-align:right; font-size:10px; color:#78716c; font-weight: 500; margin-top: 5px; }
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
                let eyeLabel = '';
                if (it.eye === 'RIGHT' || it.eye === 'OD') eyeLabel = 'Ojo Derecho (OD)';
                else if (it.eye === 'LEFT' || it.eye === 'OI') eyeLabel = 'Ojo Izquierdo (OI)';
                else if (it.eye) eyeLabel = it.eye;

                let priceDisplay = `$${itemPrice.toLocaleString()}`;
                let totalDisplay = `$${(itemPrice * it.quantity).toLocaleString()}`;
                
                if (itemPrice === 0) {
                    priceDisplay = '<span style="color:#10b981; font-weight:800; font-size:10px;">SIN CARGO</span>';
                    totalDisplay = '<span style="color:#10b981; font-weight:900;">$0</span>';
                }

                return `
                <tr>
                    <td>
                        <div style="font-weight: 900;">${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}</div>
                        ${eyeLabel ? `<div style="font-size:10px; color:#78716c; font-weight: 600;">Lado: ${eyeLabel}</div>` : ''}
                        ${itemPrice === 0 ? `<div style="font-size:9px; color:#10b981; margin-top:2px; font-weight:bold; letter-spacing: 0.5px;">✨ Bonificado por Promoción</div>` : ''}
                    </td>
                    <td style='text-align:center; font-weight: 800;'>${it.quantity}</td>
                    <td style='text-align:right'>${priceDisplay}</td>
                    <td style='text-align:right; font-weight: 900;'>${totalDisplay}</td>
                </tr>
            `}).join('')}
        </tbody>
    </table>

    ${(() => {
        const rawSubtotalInflated = (order.items || []).reduce((sum: number, it: any) => sum + (Math.round(it.price * markupFactor) * (it.quantity || 1)), 0);
        const promoFrameDiscount = order.appliedPromoDiscount || 0;
        const promoFrameInflated = Math.round(promoFrameDiscount * markupFactor);
        const specialDiscount = order.specialDiscount || 0;

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

    const html = getOrderHtml(order, contact);
    
    let browser;
    try {
        const path = await import('path');
        const browsersPath = path.join(process.cwd(), '.playwright-browsers');
        process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
        const { chromium } = await import('playwright');
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.setContent(html, { waitUntil: 'networkidle' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            printBackground: true
        });
        
        const base64String = pdfBuffer.toString('base64');
        return { base64: base64String, filename };
    } catch (e: any) {
        console.error('Error generating PDF with Playwright:', e);
        console.warn('Falling back to jsPDF');
        return generateOrderPDFWithJsPDF(order, contact, filename);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function generateOrderPDFWithJsPDF(order: any, contact: any, filename: string): Promise<{ base64: string, filename: string }> {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const isSale = order.orderType === 'SALE';
    const financials = PricingService.calculateOrderFinancials(order);
    const markupFactor = 1 + ((order.markup || 0) / 100);
    
    const brandSand: [number, number, number] = [166, 139, 124];
    const brandBeige: [number, number, number] = [212, 195, 181];
    const emerald: [number, number, number] = [16, 185, 129];
    const darkText: [number, number, number] = [28, 25, 23];
    const grayText: [number, number, number] = [120, 113, 108];
    const violet: [number, number, number] = [124, 58, 237];
    const orange: [number, number, number] = [249, 115, 22];
    
    let dateStr = '';
    try {
        dateStr = format(new Date(order.createdAt), "dd/MM/yyyy", { locale: es });
    } catch { dateStr = new Date().toLocaleDateString('es-AR'); }
    
    const pw = 210;
    const m = 15;
    const cw = pw - m * 2;
    let y = m;

    // --- LOGO ---
    try {
        const logoPath = path.join(process.cwd(), 'public', 'assets', 'logo-atelier-optica.png');
        if (fs.existsSync(logoPath)) {
            const logoB64 = fs.readFileSync(logoPath).toString('base64');
            doc.addImage(`data:image/png;base64,${logoB64}`, 'PNG', m, y - 3, 40, 14);
        } else {
            doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
            doc.text('ATELIER OPTICA', m, y + 5);
        }
    } catch {
        doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
        doc.text('ATELIER OPTICA', m, y + 5);
    }
    
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('JOSE LUIS DE TEJEDA 4380', pw - m, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...grayText);
    doc.text('Cerro de las Rosas, Cordoba', pw - m, y + 4, { align: 'right' });
    doc.text('WhatsApp: 351 1234567', pw - m, y + 8, { align: 'right' });
    
    y += 14;
    doc.setDrawColor(...brandBeige); doc.setLineWidth(0.5);
    doc.line(m, y, pw - m, y);
    y += 4;
    
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('ATELIER OPTICA  -  LA OPTICA MEJOR CALIFICADA EN CORDOBA', pw / 2, y, { align: 'center' });
    y += 7;
    
    // Doc title
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text(isSale ? 'ORDEN DE VENTA' : 'PRESUPUESTO', m, y);
    doc.setFontSize(8); doc.setTextColor(168, 162, 158);
    doc.text(`#${order.id.slice(-6).toUpperCase()}  |  ${dateStr}`, m, y + 5);
    y += 14;
    
    // --- CLIENT & LOCAL ---
    const bh = 22; const hw = (cw - 6) / 2;
    
    doc.setFillColor(255, 252, 249); doc.setDrawColor(...brandBeige); doc.setLineWidth(0.3);
    doc.roundedRect(m, y, hw, bh, 2, 2, 'FD');
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('CLIENTE', m + 4, y + 5);
    doc.setDrawColor(...brandBeige); doc.line(m + 4, y + 7, m + hw - 4, y + 7);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
    doc.text(contact?.name || 'Cliente Final', m + 4, y + 13);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...grayText);
    doc.text(`Tel: ${contact?.phone || '-'}`, m + 4, y + 18);
    
    const bx2 = m + hw + 6;
    doc.setFillColor(255, 252, 249);
    doc.roundedRect(bx2, y, hw, bh, 2, 2, 'FD');
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('ATELIER LOCAL', bx2 + 4, y + 5);
    doc.line(bx2 + 4, y + 7, bx2 + hw - 4, y + 7);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
    doc.text('Cerro de las Rosas', bx2 + 4, y + 13);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...grayText);
    doc.text('Vigencia: 15 dias corridos', bx2 + 4, y + 18);
    
    y += bh + 6;
    
    // --- ITEMS TABLE ---
    const rows = (order.items || []).map((it: any) => {
        const ip = Math.round(it.price * markupFactor);
        
        let eyeLabel = '';
        if (it.eye === 'RIGHT' || it.eye === 'OD') eyeLabel = 'Ojo Derecho (OD)';
        else if (it.eye === 'LEFT' || it.eye === 'OI') eyeLabel = 'Ojo Izquierdo (OI)';
        else if (it.eye) eyeLabel = it.eye;
        
        let itemName = `${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}`.trim();
        if (eyeLabel) itemName += `\nLado: ${eyeLabel}`;
        
        let priceLabel = `$${ip.toLocaleString()}`;
        let totalLabel = `$${(ip * it.quantity).toLocaleString()}`;
        
        if (ip === 0) {
            itemName += `\n✨ Bonificado por Promo`;
            priceLabel = 'SIN CARGO';
            totalLabel = '$0';
        }

        return [
            itemName,
            `${it.quantity}`,
            priceLabel,
            totalLabel
        ];
    });
    
    autoTable(doc, {
        startY: y,
        head: [['Descripcion', 'Cant.', 'Precio Unit.', 'Subtotal']],
        body: rows,
        margin: { left: m, right: m },
        headStyles: { fillColor: brandSand, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 3 },
        bodyStyles: { fontSize: 8, cellPadding: 3, textColor: darkText },
        columnStyles: {
            0: { cellWidth: cw * 0.5 },
            1: { halign: 'center' as const, cellWidth: cw * 0.1 },
            2: { halign: 'right' as const, cellWidth: cw * 0.2 },
            3: { halign: 'right' as const, cellWidth: cw * 0.2, fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [255, 252, 249] },
        theme: 'grid'
    });
    
    y = (doc as any).lastAutoTable.finalY + 8;
    
    // --- PAYMENT CARDS ---
    if (financials.hasBalance) {
        const cardW = (cw - 8) / 3;
        const cy = y;
        const ch = 32;
        
        const drawCard = (x: number, topColor: [number,number,number], title: string, amount: number, saldo: number, extra?: string[]) => {
            doc.setDrawColor(...brandBeige); doc.setLineWidth(0.3);
            doc.roundedRect(x, cy, cardW, ch, 2, 2);
            doc.setFillColor(...topColor); doc.rect(x, cy, cardW, 1.5, 'F');
            doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
            doc.text(title, x + 3, cy + 7);
            doc.setFontSize(13); doc.text(`$${amount.toLocaleString()}`, x + 3, cy + 15);
            doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...grayText);
            doc.text(`Saldo: $${saldo.toLocaleString()}`, x + 3, cy + 21);
            if (extra) extra.forEach((l, i) => { doc.setFontSize(6); doc.text(l, x + 3, cy + 25 + i * 4); });
        };
        
        drawCard(m, emerald, `EFECTIVO (-${financials.discountCash}%)`, financials.totalCash, financials.remainingCash);
        drawCard(m + cardW + 4, violet, `TRANSFERENCIA (-${financials.discountTransfer}%)`, financials.totalTransfer, financials.remainingTransfer);
        drawCard(m + (cardW + 4) * 2, orange, 'TARJETAS (LISTA)', financials.totalCard, financials.remainingCard, [
            `3 cuotas s/int: $${financials.installment3.toLocaleString()}`,
            `6 cuotas s/int: $${financials.installment6.toLocaleString()}`
        ]);
        
        y = cy + ch + 8;
        
        // Totals bar
        doc.setFillColor(28, 25, 23); doc.roundedRect(m, y, cw, 20, 3, 3, 'F');
        const colW = cw / 4;
        const drawCol = (x: number, label: string, val: string, color: [number,number,number]) => {
            doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...color);
            doc.text(label, x, y + 7);
            doc.setFontSize(11); doc.text(val, x, y + 14);
        };
        drawCol(m + 4, 'EFECTIVO', `$${financials.totalCash.toLocaleString()}`, emerald);
        drawCol(m + colW + 4, 'TRANSFERENCIA', `$${financials.totalTransfer.toLocaleString()}`, [167, 139, 250]);
        drawCol(m + colW * 2 + 4, 'TARJETA', `$${financials.totalCard.toLocaleString()}`, [251, 146, 60]);
        drawCol(m + colW * 3 + 4, 'ABONADO REAL', `$${financials.paidReal.toLocaleString()}`, [251, 191, 36]);
        y += 26;
    } else {
        doc.setFillColor(240, 253, 244); doc.setDrawColor(...emerald); doc.setLineWidth(0.5);
        doc.roundedRect(m, y, cw, 18, 3, 3, 'FD');
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(6, 95, 70);
        doc.text('ORDEN PAGADA EN SU TOTALIDAD', pw / 2, y + 8, { align: 'center' });
        doc.setFontSize(9);
        doc.text(`Total abonado: $${financials.paidReal.toLocaleString()}`, pw / 2, y + 14, { align: 'center' });
        y += 24;
    }
    
    // --- PRESCRIPTION ---
    if (order.prescription) {
        const rxW = (cw - 6) / 2;
        doc.setDrawColor(...brandBeige); doc.setLineWidth(0.3);
        doc.roundedRect(m, y, rxW, 16, 2, 2);
        doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
        doc.text('OJO DERECHO (OD)', m + 4, y + 5);
        doc.setFontSize(10); doc.setTextColor(...darkText);
        doc.text(`${order.prescription.sphereOD || '0'} / ${order.prescription.cylinderOD || '0'} x ${order.prescription.axisOD || '0'}`, m + 4, y + 12);
        
        doc.roundedRect(m + rxW + 6, y, rxW, 16, 2, 2);
        doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
        doc.text('OJO IZQUIERDO (OI)', m + rxW + 10, y + 5);
        doc.setFontSize(10); doc.setTextColor(...darkText);
        doc.text(`${order.prescription.sphereOI || '0'} / ${order.prescription.cylinderOI || '0'} x ${order.prescription.axisOI || '0'}`, m + rxW + 10, y + 12);
        y += 22;
    }
    
    // --- FOOTER ---
    doc.setDrawColor(...brandBeige); doc.setLineWidth(0.5);
    doc.line(m, y, pw - m, y);
    y += 5;
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(168, 162, 158);
    doc.text(`ATELIER OPTICA  |  TEJEDA 4380  |  PROFESIONALISMO ETICA Y DISENO  |  ${format(new Date(), 'yyyy')}`, pw / 2, y, { align: 'center' });
    
    const base64 = doc.output('datauristring').split(',')[1];
    console.log('[generateOrderPDF] Generated with jsPDF fallback successfully');
    return { base64, filename };
}
