import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as fs from 'fs';
import * as path from 'path';

export function getReceiptHtml(payment: any, order: any, client: any): string {
    let dateStr = '';
    try {
        dateStr = format(new Date(payment.date), "dd 'de' MMMM, yyyy", { locale: es });
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
        console.error('Error al leer logo local para el PDF del recibo:', e);
    }

    const logoUrl = logoBase64 || `https://crm-atelier-production-ae72.up.railway.app/assets/logo-atelier-optica.png`;
    
    // Brand Colors
    const brandBeige = '#D4C3B5';
    const brandSand = '#A68B7C';
    const systemEmerald = '#10b981';
    
    let methodLabel = payment?.method || 'Desconocido';
    if (methodLabel === 'EFECTIVO' || methodLabel === 'CASH') methodLabel = 'Efectivo';
    else if (methodLabel.includes('TRANSFERENCIA')) methodLabel = 'Transferencia Bancaria';
    else if (methodLabel.includes('NARANJA_Z') || methodLabel === 'PLAN_Z') methodLabel = 'Tarjeta Naranja (Plan Z)';
    else if (methodLabel.includes('PAY_WAY_3') || methodLabel === 'CREDIT_3') methodLabel = 'Tarjeta de Crédito (3 Cuotas)';
    else if (methodLabel.includes('PAY_WAY_6') || methodLabel === 'CREDIT_6') methodLabel = 'Tarjeta de Crédito (6 Cuotas)';
    else if (methodLabel.includes('PAY_WAY')) methodLabel = 'Tarjeta de Crédito';
    else if (methodLabel.includes('GO_CUOTAS')) methodLabel = 'Go Cuotas';
    else methodLabel = methodLabel.replace(/_/g, ' ');

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recibo de Pago - ${client?.name || 'Cliente'} - Atelier Óptica</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter','Segoe UI',sans-serif; }
        @page { margin: 0; size: auto; }
        body { padding: 40px 50px; color: #1c1917; font-size: 13px; line-height:1.4; background: white; }
        
        .letterhead { padding-bottom:20px; border-bottom:2px solid ${brandBeige}; margin-bottom: 8px; overflow: hidden; }
        .letterhead-logo { width: 297px; height: 45px; float: left; }
        .letterhead-right { float: right; text-align:right; font-size:10px; color:#78716c; font-weight: 500; margin-top: 5px; }
        .address-bold { font-weight:800; color:${brandSand}; text-transform: uppercase; letter-spacing: 1px; }
        
        .tagline { text-align:center; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:2.5px; color:${brandSand}; padding:14px 0; border-bottom: 1px solid #f5f5f4; margin-bottom: 25px; }
        
        .doc-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:30px; }
        .doc-title { font-size:24px; font-weight:900; text-transform:uppercase; color:${brandSand}; letter-spacing: 2px; }
        .doc-meta { font-size:12px; color:#a8a29e; font-weight: 800; margin-top: 5px; }
        .doc-type-badge { background: #1c1917; color: white; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 900; letter-spacing: 2px; }

        .info-grid { display:grid; grid-template-columns: 1fr; gap:20px; margin-bottom:30px; }
        .info-box { border:1.5px solid ${brandBeige}; border-radius:14px; padding:20px; background: #fffcf9; }
        .info-row { display:flex; justify-content:space-between; margin-bottom:12px; font-size:14px; align-items: center; }
        .info-row:last-child { margin-bottom: 0; }
        .info-label { color:#78716c; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
        .info-value { font-weight:800; color:#1c1917; font-size: 16px; }

        .amount-box { border-radius: 20px; background: #f0fdf4; border: 2px solid ${systemEmerald}; padding: 30px; text-align: center; margin-bottom: 30px; }
        .amount-label { color: #065f46; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; display: block; }
        .amount-value { font-size: 48px; font-weight: 900; color: ${systemEmerald}; letter-spacing: -1px; }

        .footer { margin-top: 60px; text-align: center; border-top: 2px solid ${brandBeige}; padding-top: 20px; font-size: 9px; color: #a8a29e; text-transform: uppercase; letter-spacing: 3px; font-weight: 900; }
        
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
            <div class='doc-title'>RECIBO X</div>
            <div class='doc-meta'>${dateStr}</div>
        </div>
        <div class='doc-type-badge'>
            COMPROBANTE DE PAGO
        </div>
    </div>

    <div class='amount-box'>
        <span class='amount-label'>Monto Recibido</span>
        <div class='amount-value'>$${payment.amount.toLocaleString('es-AR')}</div>
    </div>

    <div class='info-grid'>
        <div class='info-box'>
            <div class='info-row'>
                <span class='info-label'>Recibimos de</span>
                <span class='info-value'>${client?.name || 'Cliente Final'}</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>En concepto de</span>
                <span class='info-value'>Pago a cuenta / Orden #${order.id.slice(-6).toUpperCase()}</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Método de Pago</span>
                <span class='info-value'>${methodLabel}</span>
            </div>
            ${payment.notes ? `
            <div class='info-row' style="border-top: 1px solid #D4C3B5; padding-top: 12px; margin-top: 12px;">
                <span class='info-label'>Referencia / Notas</span>
                <span class='info-value' style="font-size: 13px; color: #78716c;">${payment.notes}</span>
            </div>
            ` : ''}
        </div>
    </div>

    <div style="margin-top: 40px; font-size: 11px; color: #a8a29e; text-align: center; font-weight: 500;">
        Este documento es un comprobante de pago no válido como factura.<br>
        Documento no fiscal.
    </div>

    <div class='footer'>Atelier Óptica · Tejeda 4380 · Profesionalismo Ética y Diseño · ${format(new Date(), "yyyy")}</div>
</body>
</html>`;
}

export async function generateReceiptPDF(payment: any, order: any, contact: any): Promise<{ base64: string, filename: string }> {
    const safeName = (contact?.name || 'Cliente').replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-');
    const safeDate = new Date(payment.date).toISOString().split('T')[0];
    const filename = `Recibo_X_${order.id.slice(-4).toUpperCase()}_${safeDate}_${safeName}.pdf`;

    const html = getReceiptHtml(payment, order, contact);
    
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
        console.error('Error generating Receipt PDF with Playwright:', e);
        console.warn('Falling back to jsPDF');
        return generateReceiptPDFWithJsPDF(payment, order, contact, filename);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function generateReceiptPDFWithJsPDF(payment: any, order: any, contact: any, filename: string): Promise<{ base64: string, filename: string }> {
    const { default: jsPDF } = await import('jspdf');
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const brandSand: [number, number, number] = [166, 139, 124];
    const brandBeige: [number, number, number] = [212, 195, 181];
    const emerald: [number, number, number] = [16, 185, 129];
    const darkText: [number, number, number] = [28, 25, 23];
    const grayText: [number, number, number] = [120, 113, 108];
    
    let dateStr = '';
    try {
        dateStr = format(new Date(payment.date), "dd/MM/yyyy", { locale: es });
    } catch { dateStr = new Date().toLocaleDateString('es-AR'); }
    
    const pw = 210;
    const m = 15;
    let y = m;

    // --- LOGO ---
    try {
        const logoPath = path.join(process.cwd(), 'public', 'assets', 'logo-atelier-optica.png');
        if (fs.existsSync(logoPath)) {
            const logoB64 = fs.readFileSync(logoPath).toString('base64');
            doc.addImage(`data:image/png;base64,${logoB64}`, 'PNG', m, y - 3, 66, 10);
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
    y += 12;
    
    // Doc title
    doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('RECIBO X', m, y);
    doc.setFontSize(10); doc.setTextColor(168, 162, 158);
    doc.text(dateStr, m, y + 6);
    y += 20;

    // Amount Box
    doc.setFillColor(240, 253, 244); doc.setDrawColor(...emerald); doc.setLineWidth(0.5);
    doc.roundedRect(m, y, pw - m * 2, 25, 3, 3, 'FD');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(6, 95, 70);
    doc.text('MONTO RECIBIDO', pw / 2, y + 8, { align: 'center' });
    doc.setFontSize(22); doc.setTextColor(...emerald);
    doc.text(`$${payment.amount.toLocaleString('es-AR')}`, pw / 2, y + 18, { align: 'center' });
    y += 35;
    
    // Details
    doc.setFillColor(255, 252, 249); doc.setDrawColor(...brandBeige); doc.setLineWidth(0.3);
    doc.roundedRect(m, y, pw - m * 2, payment.notes ? 45 : 35, 3, 3, 'FD');
    
    const drawRow = (ly: number, label: string, val: string) => {
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...grayText);
        doc.text(label, m + 5, ly);
        doc.setFontSize(11); doc.setTextColor(...darkText);
        doc.text(val, pw - m - 5, ly, { align: 'right' });
    };

    let methodLabel2 = payment?.method || 'Desconocido';
    if (methodLabel2 === 'EFECTIVO' || methodLabel2 === 'CASH') methodLabel2 = 'Efectivo';
    else if (methodLabel2.includes('TRANSFERENCIA')) methodLabel2 = 'Transferencia Bancaria';
    else if (methodLabel2.includes('NARANJA_Z') || methodLabel2 === 'PLAN_Z') methodLabel2 = 'Tarjeta Naranja (Plan Z)';
    else if (methodLabel2.includes('PAY_WAY_3') || methodLabel2 === 'CREDIT_3') methodLabel2 = 'Tarjeta de Crédito (3 Cuotas)';
    else if (methodLabel2.includes('PAY_WAY_6') || methodLabel2 === 'CREDIT_6') methodLabel2 = 'Tarjeta de Crédito (6 Cuotas)';
    else if (methodLabel2.includes('PAY_WAY')) methodLabel2 = 'Tarjeta de Crédito';
    else if (methodLabel2.includes('GO_CUOTAS')) methodLabel2 = 'Go Cuotas';
    else methodLabel2 = methodLabel2.replace(/_/g, ' ');

    drawRow(y + 8, 'RECIBIMOS DE', contact?.name || 'Cliente Final');
    drawRow(y + 18, 'EN CONCEPTO DE', `Pago a cuenta / Orden #${order.id.slice(-6).toUpperCase()}`);
    drawRow(y + 28, 'METODO DE PAGO', methodLabel2);
    
    if (payment.notes) {
        doc.setDrawColor(...brandBeige); doc.line(m + 5, y + 33, pw - m - 5, y + 33);
        drawRow(y + 40, 'REFERENCIA', payment.notes.substring(0, 40));
    }

    y += payment.notes ? 55 : 45;

    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...grayText);
    doc.text('Documento no fiscal - Comprobante de pago interno', pw / 2, y, { align: 'center' });

    // Footer
    y = 280;
    doc.setDrawColor(...brandBeige); doc.setLineWidth(0.5);
    doc.line(m, y, pw - m, y);
    y += 5;
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(168, 162, 158);
    doc.text(`ATELIER OPTICA  |  TEJEDA 4380  |  PROFESIONALISMO ETICA Y DISENO  |  ${format(new Date(), 'yyyy')}`, pw / 2, y, { align: 'center' });
    
    const base64 = doc.output('datauristring').split(',')[1];
    return { base64, filename };
}
