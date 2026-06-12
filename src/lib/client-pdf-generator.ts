import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import fs from 'fs';
import path from 'path';

export function getClientHtml(client: any): string {
    let dateStr = '';
    try {
        dateStr = format(new Date(client.createdAt), "dd 'de' MMMM, yyyy", { locale: es });
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
        console.error('Error al leer logo local para el PDF de la ficha:', e);
    }

    const logoUrl = logoBase64 || `https://crm-atelier-production-ae72.up.railway.app/assets/logo-atelier-optica.png`;
    
    // Brand Colors
    const brandBeige = '#D4C3B5';
    const brandSand = '#A68B7C';
    
    // Formatear recetas
    const prescriptionsHtml = (client.prescriptions || []).map((rx: any) => {
        let rxDate = '';
        try {
            rxDate = format(new Date(rx.date), "dd/MM/yyyy");
        } catch {
            rxDate = '-';
        }
        
        return `
        <div class="rx-card">
            <div class="rx-header">
                <span class="rx-title">Receta (${rx.prescriptionType || 'General'})</span>
                <span class="rx-date">Fecha: ${rxDate}</span>
            </div>
            <table class="rx-table">
                <thead>
                    <tr>
                        <th>Ojo</th>
                        <th>Esférico (Sph)</th>
                        <th>Cilíndrico (Cyl)</th>
                        <th>Eje (Axis)</th>
                        ${rx.prismOD || rx.prismOI ? '<th>Prisma</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="font-bold">OD (Derecho)</td>
                        <td>${rx.sphereOD !== null ? (rx.sphereOD >= 0 ? '+' : '') + rx.sphereOD : '-'}</td>
                        <td>${rx.cylinderOD !== null ? (rx.cylinderOD >= 0 ? '+' : '') + rx.cylinderOD : '-'}</td>
                        <td>${rx.axisOD !== null ? rx.axisOD + '°' : '-'}</td>
                        ${rx.prismOD || rx.prismOI ? `<td>${rx.prismOD || '-'}</td>` : ''}
                    </tr>
                    <tr>
                        <td class="font-bold">OI (Izquierdo)</td>
                        <td>${rx.sphereOI !== null ? (rx.sphereOI >= 0 ? '+' : '') + rx.sphereOI : '-'}</td>
                        <td>${rx.cylinderOI !== null ? (rx.cylinderOI >= 0 ? '+' : '') + rx.cylinderOI : '-'}</td>
                        <td>${rx.axisOI !== null ? rx.axisOI + '°' : '-'}</td>
                        ${rx.prismOD || rx.prismOI ? `<td>${rx.prismOI || '-'}</td>` : ''}
                    </tr>
                </tbody>
            </table>
            
            <div class="rx-details">
                ${rx.addition ? `<div class="detail-item"><span class="detail-label">Adición:</span> <span class="detail-val">${rx.addition}</span></div>` : ''}
                ${rx.pd ? `<div class="detail-item"><span class="detail-label">DNP (Distancia):</span> <span class="detail-val">${rx.pd} mm</span></div>` : ''}
                ${rx.distanceOD || rx.distanceOI ? `<div class="detail-item"><span class="detail-label">DNP OD/OI:</span> <span class="detail-val">${rx.distanceOD || '-'} / ${rx.distanceOI || '-'} mm</span></div>` : ''}
                ${rx.heightOD || rx.heightOI ? `<div class="detail-item"><span class="detail-label">Altura OD/OI:</span> <span class="detail-val">${rx.heightOD || '-'} / ${rx.heightOI || '-'} mm</span></div>` : ''}
            </div>
            
            ${rx.notes ? `<div class="rx-notes"><strong>Notas de receta:</strong> ${rx.notes}</div>` : ''}
        </div>
        `;
    }).join('');

    // Formatear Pedidos/Presupuestos
    const ordersHtml = (client.orders || []).map((ord: any) => {
        let ordDate = '';
        try {
            ordDate = format(new Date(ord.createdAt), "dd/MM/yyyy");
        } catch {
            ordDate = '-';
        }
        const remaining = Math.max(0, ord.total - ord.paid);
        const statusLabel = ord.status === 'COMPLETED' ? 'Completado' : ord.status === 'PENDING' ? 'Pendiente' : ord.status;
        const typeLabel = ord.orderType === 'SALE' ? 'Venta' : 'Presupuesto';
        
        const itemsList = (ord.items || []).map((it: any) => {
            return `${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''} (x${it.quantity})`;
        }).join(', ');

        return `
        <tr>
            <td class="font-bold">#${ord.id.slice(-6).toUpperCase()}</td>
            <td>${ordDate}</td>
            <td><span class="badge badge-${ord.orderType?.toLowerCase()}">${typeLabel}</span></td>
            <td><span class="badge badge-${ord.status?.toLowerCase()}">${statusLabel}</span></td>
            <td>$${Math.round(ord.total).toLocaleString('es-AR')}</td>
            <td>$${Math.round(ord.paid).toLocaleString('es-AR')}</td>
            <td class="${remaining > 0 ? 'text-red font-bold' : 'text-green font-bold'}">$${Math.round(remaining).toLocaleString('es-AR')}</td>
            <td class="small-text">${itemsList || 'Sin items'}</td>
        </tr>
        `;
    }).join('');

    // Formatear interacciones
    const interactionsHtml = (client.interactions || []).map((int: any) => {
        let intDate = '';
        try {
            intDate = format(new Date(int.createdAt), "dd/MM/yyyy HH:mm");
        } catch {
            intDate = '-';
        }
        let typeBadge = '';
        if (int.type === 'NOTE') typeBadge = 'Nota';
        else if (int.type === 'STORE_VISIT') typeBadge = 'Visita';
        else typeBadge = int.type;

        return `
        <div class="timeline-item">
            <div class="timeline-meta">
                <span class="timeline-date">${intDate}</span>
                <span class="timeline-badge">${typeBadge}</span>
            </div>
            <div class="timeline-content">${int.content}</div>
        </div>
        `;
    }).join('');

    // Formatear tareas
    const tasksHtml = (client.tasks || []).map((tsk: any) => {
        let tskDate = '';
        try {
            tskDate = format(new Date(tsk.dueDate), "dd/MM/yyyy");
        } catch {
            tskDate = 'Sin fecha';
        }
        const statusLabel = tsk.status === 'PENDING' ? 'Pendiente' : tsk.status === 'COMPLETED' ? 'Completado' : tsk.status;

        return `
        <div class="task-item">
            <span class="badge badge-${tsk.status === 'COMPLETED' ? 'completed' : 'pending'}">${statusLabel}</span>
            <span class="task-desc">${tsk.description}</span>
            <span class="task-date">Vence: ${tskDate}</span>
        </div>
        `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ficha de Cliente - ${client.name} - Atelier Óptica</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter','Segoe UI',sans-serif; }
        @page { margin: 0; size: auto; }
        body { padding: 40px 50px; color: #1c1917; font-size: 12px; line-height:1.4; background: white; }
        
        .letterhead { padding-bottom:15px; border-bottom:2px solid ${brandBeige}; margin-bottom: 8px; overflow: hidden; }
        .letterhead-logo { height: 35px; width: auto; max-width: 220px; float: left; object-fit: contain; }
        .letterhead-right { float: right; text-align:right; font-size:10px; color:#78716c; font-weight: 500; margin-top: 5px; }
        .address-bold { font-weight:800; color:${brandSand}; text-transform: uppercase; letter-spacing: 1px; }
        
        .tagline { text-align:center; font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:${brandSand}; padding:10px 0; border-bottom: 1px solid #f5f5f4; margin-bottom: 15px; }
        
        .doc-header { margin-bottom:20px; }
        .doc-title { font-size:20px; font-weight:900; text-transform:uppercase; color:${brandSand}; letter-spacing: 2px; }
        .doc-meta { font-size:11px; color:#a8a29e; font-weight: 850; margin-top: 2px; }

        .info-grid { display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px; }
        .info-box { border:1.5px solid ${brandBeige}; border-radius:12px; padding:12px; background: #fffcf9; }
        .info-box h3 { font-size:9px; font-weight:900; text-transform:uppercase; color:${brandSand}; border-bottom: 1px solid ${brandBeige}; padding-bottom: 4px; margin-bottom: 8px; }
        .info-row { display:flex; justify-content:space-between; margin-bottom:5px; font-size:11.5px; }
        .info-label { color:#78716c; font-weight: 600; }
        .info-value { font-weight:800; color:#1c1917; }
        
        .tags-container { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
        .tag-badge { background: ${brandSand}; color: white; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; }

        .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; color: ${brandSand}; letter-spacing: 1.5px; border-left: 3px solid ${brandSand}; padding-left: 8px; margin: 25px 0 10px 0; }

        /* Recetas */
        .rx-card { border: 1.5px solid ${brandBeige}; border-radius: 12px; padding: 12px; background: #white; margin-bottom: 12px; }
        .rx-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; font-weight: 800; border-bottom: 1px dashed ${brandBeige}; padding-bottom: 4px; }
        .rx-title { color: ${brandSand}; text-transform: uppercase; }
        .rx-date { color: #78716c; }
        .rx-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: none; }
        .rx-table th { background: #f5f5f4; color: #78716c; font-size: 9px; padding: 5px; text-align: center; border: 1px solid ${brandBeige}; }
        .rx-table td { padding: 5px; font-size: 11px; text-align: center; border: 1px solid ${brandBeige}; }
        .rx-details { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 5px; font-size: 10.5px; }
        .detail-item { display: flex; gap: 4px; }
        .detail-label { color: #78716c; font-weight: 600; }
        .detail-val { font-weight: 800; }
        .rx-notes { margin-top: 6px; font-size: 10.5px; color: #57534e; background: #fdfbf7; padding: 6px; border-radius: 6px; border-left: 2px solid ${brandBeige}; }

        /* Pedidos */
        table.orders-table { width:100%; border-collapse:collapse; margin-bottom:15px; border-radius: 10px; overflow: hidden; border: 1.5px solid ${brandBeige}; }
        table.orders-table th { background:${brandSand}; color:white; padding:8px 10px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:1px; }
        table.orders-table td { padding:8px 10px; border-bottom:1px solid #f5f5f4; font-size:11px; }
        table.orders-table tr:nth-child(even) { background:#fffcf9; }
        
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .badge-sale { background: #d1fae5; color: #065f46; }
        .badge-quote { background: #fef3c7; color: #92400e; }
        .badge-completed { background: #d1fae5; color: #065f46; }
        .badge-pending { background: #fee2e2; color: #991b1b; }
        .badge-confirmed { background: #dbeafe; color: #1e40af; }
        
        .text-red { color: #b91c1c; }
        .text-green { color: #15803d; }
        .font-bold { font-weight: 800; }
        .small-text { font-size: 9.5px; color: #78716c; max-width: 200px; word-break: break-word; }

        /* Timeline / Notas */
        .timeline { border-left: 2px solid ${brandBeige}; margin-left: 10px; padding-left: 15px; }
        .timeline-item { position: relative; margin-bottom: 12px; }
        .timeline-item::before { content: ''; position: absolute; left: -21px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: ${brandSand}; border: 2px solid white; }
        .timeline-meta { font-size: 9.5px; font-weight: 800; margin-bottom: 2px; display: flex; gap: 8px; align-items: center; }
        .timeline-date { color: #a8a29e; }
        .timeline-badge { background: #f5f5f4; color: #78716c; padding: 1px 5px; border-radius: 3px; }
        .timeline-content { font-size: 11px; color: #44403c; }

        /* Tareas */
        .task-item { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; font-size: 11px; background: #faf9f6; padding: 6px 10px; border-radius: 8px; border: 1px solid #f2ece4; }
        .task-desc { font-weight: 700; flex: 1; color: #44403c; }
        .task-date { color: #a8a29e; font-size: 9.5px; font-weight: bold; }

        .footer { margin-top: 40px; text-align: center; border-top: 2px solid ${brandBeige}; padding-top: 15px; font-size: 8.5px; color: #a8a29e; text-transform: uppercase; letter-spacing: 2px; font-weight: 900; }
        
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
        <div class='doc-title'>Ficha del Cliente</div>
        <div class='doc-meta'>Generado el ${new Date().toLocaleDateString('es-AR')} · Registro: ${dateStr}</div>
    </div>

    <div class='info-grid'>
        <div class='info-box'>
            <h3>👤 Información Personal</h3>
            <div class='info-row'><span class='info-label'>Nombre completo</span><span class='info-value'>${client.name || '-'}</span></div>
            <div class='info-row'><span class='info-label'>DNI</span><span class='info-value'>${client.dni || '-'}</span></div>
            <div class='info-row'><span class='info-label'>Teléfono</span><span class='info-value'>${client.phone || '-'}</span></div>
            <div class='info-row'><span class='info-label'>Email</span><span class='info-value'>${client.email || '-'}</span></div>
            <div class='info-row'><span class='info-label'>Dirección</span><span class='info-value'>${client.address || '-'}</span></div>
        </div>
        <div class='info-box'>
            <h3>📋 Datos Internos</h3>
            <div class='info-row'><span class='info-label'>Obra Social</span><span class='info-value'>${client.insurance || '-'}</span></div>
            <div class='info-row'><span class='info-label'>Médico derivante</span><span class='info-value'>${client.doctor || '-'}</span></div>
            <div class='info-row'><span class='info-label'>Estado de CRM</span><span class='info-value'><span class="badge badge-${client.status?.toLowerCase()}">${client.status === 'CONTACT' ? 'Contacto' : client.status === 'CONFIRMED' ? 'Confirmado' : client.status}</span></span></div>
            <div class='info-row'><span class='info-label'>Origen</span><span class='info-value'>${client.contactSource || '-'}</span></div>
            <div class='info-row' style="flex-direction: column; align-items: flex-start; justify-content: flex-start; margin-top: 6px;">
                <span class='info-label' style="margin-bottom:4px;">Etiquetas:</span>
                <div class="tags-container">
                    ${(client.tags || []).length > 0 
                        ? client.tags.map((t: any) => `<span class="tag-badge" style="background:${t.color || brandSand}">${t.name}</span>`).join('') 
                        : '<span style="color:#a8a29e; font-style:italic; font-size:10px;">Sin etiquetas</span>'}
                </div>
            </div>
        </div>
    </div>

    <!-- Sección Recetas -->
    <div class="section-title">Historial de Recetas</div>
    ${prescriptionsHtml || '<div style="border:1.5px solid #E5E5E5; border-radius:12px; padding:12px; text-align:center; color:#a8a29e; font-style:italic;">No registra recetas cargadas.</div>'}

    <!-- Sección Pedidos -->
    <div class="section-title">Historial de Pedidos y Presupuestos</div>
    ${(client.orders || []).length > 0 ? `
    <table class="orders-table">
        <thead>
            <tr>
                <th>Código</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Abonado</th>
                <th>Saldo</th>
                <th>Productos</th>
            </tr>
        </thead>
        <tbody>
            ${ordersHtml}
        </tbody>
    </table>
    ` : '<div style="border:1.5px solid #E5E5E5; border-radius:12px; padding:12px; text-align:center; color:#a8a29e; font-style:italic;">No registra pedidos o presupuestos.</div>'}

    <!-- Sección Tareas -->
    ${(client.tasks || []).length > 0 ? `
    <div class="section-title">Tareas y Seguimiento</div>
    <div style="margin-bottom: 20px;">
        ${tasksHtml}
    </div>
    ` : ''}

    <!-- Sección Interacciones -->
    <div class="section-title">Historial de Notas / Visitas</div>
    ${(client.interactions || []).length > 0 ? `
    <div class="timeline">
        ${interactionsHtml}
    </div>
    ` : '<div style="border:1.5px solid #E5E5E5; border-radius:12px; padding:12px; text-align:center; color:#a8a29e; font-style:italic;">Sin notas registradas.</div>'}

    <div class='footer'>Atelier Óptica · Tejeda 4380 · Profesionalismo Ética y Diseño · ${format(new Date(), "yyyy")}</div>
</body>
</html>`;
}

export async function generateClientPDF(client: any): Promise<{ base64: string, filename: string }> {
    const safeName = (client.name || 'Cliente').replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-');
    const filename = `Ficha_Cliente_${safeName}.pdf`;

    const html = getClientHtml(client);
    
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
        console.error('Error generating Client PDF with Playwright:', e);
        console.warn('Falling back to jsPDF');
        return generateClientPDFWithJsPDF(client, filename);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function generateClientPDFWithJsPDF(client: any, filename: string): Promise<{ base64: string, filename: string }> {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const brandSand: [number, number, number] = [166, 139, 124];
    const brandBeige: [number, number, number] = [212, 195, 181];
    const darkText: [number, number, number] = [28, 25, 23];
    const grayText: [number, number, number] = [120, 113, 108];
    const borderGray: [number, number, number] = [229, 229, 229];
    
    let dateStr = '';
    try {
        dateStr = format(new Date(client.createdAt), "dd/MM/yyyy", { locale: es });
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
            doc.addImage(`data:image/png;base64,${logoB64}`, 'PNG', m, y - 3, 45, 6.8);
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
    y += 10;
    
    // Doc title
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('FICHA DE CLIENTE', m, y);
    doc.setFontSize(8); doc.setTextColor(168, 162, 158);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-AR')}  |  Registro: ${dateStr}`, m, y + 5);
    y += 12;
    
    // --- DETAILS BOXES ---
    const bh = 34; const hw = (cw - 6) / 2;
    
    // Col 1: Personal Info
    doc.setFillColor(255, 252, 249); doc.setDrawColor(...brandBeige); doc.setLineWidth(0.3);
    doc.roundedRect(m, y, hw, bh, 2, 2, 'FD');
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('INFORMACION PERSONAL', m + 4, y + 5);
    doc.line(m + 4, y + 7, m + hw - 4, y + 7);
    
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...grayText);
    doc.text('Nombre:', m + 4, y + 12); doc.text('DNI:', m + 4, y + 16);
    doc.text('Teléfono:', m + 4, y + 20); doc.text('Email:', m + 4, y + 24);
    doc.text('Dirección:', m + 4, y + 28);
    
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
    doc.text(client.name || '-', m + 22, y + 12); doc.text(client.dni || '-', m + 22, y + 16);
    doc.text(client.phone || '-', m + 22, y + 20); doc.text(client.email || '-', m + 22, y + 24);
    doc.text(client.address || '-', m + 22, y + 28);

    // Col 2: Internal Details
    const bx2 = m + hw + 6;
    doc.setFillColor(255, 252, 249);
    doc.roundedRect(bx2, y, hw, bh, 2, 2, 'FD');
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('DATOS INTERNOS', bx2 + 4, y + 5);
    doc.line(bx2 + 4, y + 7, bx2 + hw - 4, y + 7);
    
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...grayText);
    doc.text('Obra Social:', bx2 + 4, y + 12); doc.text('Médico:', bx2 + 4, y + 16);
    doc.text('Estado CRM:', bx2 + 4, y + 20); doc.text('Origen:', bx2 + 4, y + 24);
    doc.text('Etiquetas:', bx2 + 4, y + 28);
    
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
    doc.text(client.insurance || '-', bx2 + 22, y + 12); doc.text(client.doctor || '-', bx2 + 22, y + 16);
    doc.text(client.status === 'CONTACT' ? 'Contacto' : client.status === 'CONFIRMED' ? 'Confirmado' : client.status || '-', bx2 + 22, y + 20);
    doc.text(client.contactSource || '-', bx2 + 22, y + 24);
    
    const tagsText = (client.tags || []).map((t: any) => t.name).join(', ');
    doc.setFontSize(7);
    doc.text(tagsText || 'Sin etiquetas', bx2 + 22, y + 28);
    
    y += bh + 8;
    
    // --- PRESCRIPTIONS TABLE ---
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('HISTORIAL DE RECETAS', m, y);
    y += 3;
    
    const rxRows: any[] = [];
    (client.prescriptions || []).forEach((rx: any) => {
        let rxDate = '';
        try { rxDate = format(new Date(rx.date), "dd/MM/yyyy"); } catch { rxDate = '-'; }
        
        const odStr = `${rx.sphereOD >= 0 ? '+' : ''}${rx.sphereOD || 0} / ${rx.cylinderOD || 0} x ${rx.axisOD || 0}°${rx.prismOD ? ` (Pr: ${rx.prismOD})` : ''}`;
        const oiStr = `${rx.sphereOI >= 0 ? '+' : ''}${rx.sphereOI || 0} / ${rx.cylinderOI || 0} x ${rx.axisOI || 0}°${rx.prismOI ? ` (Pr: ${rx.prismOI})` : ''}`;
        
        let details = '';
        if (rx.addition) details += `Add: ${rx.addition} | `;
        if (rx.pd) details += `DNP: ${rx.pd} mm | `;
        if (rx.distanceOD) details += `DNP OD/OI: ${rx.distanceOD}/${rx.distanceOI} | `;
        if (rx.notes) details += `Notas: ${rx.notes}`;
        
        rxRows.push([rxDate, rx.prescriptionType || 'General', odStr, oiStr, details]);
    });
    
    if (rxRows.length > 0) {
        autoTable(doc, {
            startY: y,
            head: [['Fecha', 'Tipo', 'Ojo Derecho (OD)', 'Ojo Izquierdo (OI)', 'Detalles / Notas']],
            body: rxRows,
            margin: { left: m, right: m },
            theme: 'plain',
            headStyles: { 
                fillColor: [245, 245, 244], 
                textColor: brandSand, 
                fontStyle: 'bold', 
                fontSize: 7, 
                lineWidth: 0.1,
                lineColor: brandBeige
            },
            bodyStyles: { fontSize: 7.5, textColor: darkText, cellPadding: 4, lineWidth: 0.1, lineColor: borderGray },
            columnStyles: {
                0: { cellWidth: 18 },
                1: { cellWidth: 18 },
                2: { cellWidth: 38 },
                3: { cellWidth: 38 },
                4: { cellWidth: 68 }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 8;
    } else {
        doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...grayText);
        doc.text('No registra recetas cargadas.', m, y + 4);
        y += 10;
    }
    
    // --- ORDERS TABLE ---
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('HISTORIAL DE PEDIDOS Y PRESUPUESTOS', m, y);
    y += 3;
    
    const ordRows: any[] = [];
    (client.orders || []).forEach((ord: any) => {
        let ordDate = '';
        try { ordDate = format(new Date(ord.createdAt), "dd/MM/yyyy"); } catch { ordDate = '-'; }
        const remaining = Math.max(0, ord.total - ord.paid);
        const itemsList = (ord.items || []).map((it: any) => {
            return `${it.product?.brand || it.productBrandSnapshot || ''} (x${it.quantity})`;
        }).join(', ');
        
        ordRows.push([
            `#${ord.id.slice(-6).toUpperCase()}`,
            ordDate,
            ord.orderType === 'SALE' ? 'Venta' : 'Presup.',
            ord.status === 'COMPLETED' ? 'Completado' : ord.status === 'PENDING' ? 'Pendiente' : ord.status,
            `$${Math.round(ord.total).toLocaleString('es-AR')}`,
            `$${Math.round(ord.paid).toLocaleString('es-AR')}`,
            `$${Math.round(remaining).toLocaleString('es-AR')}`,
            itemsList || '-'
        ]);
    });
    
    if (ordRows.length > 0) {
        autoTable(doc, {
            startY: y,
            head: [['Código', 'Fecha', 'Tipo', 'Estado', 'Total', 'Abonado', 'Saldo', 'Productos']],
            body: ordRows,
            margin: { left: m, right: m },
            theme: 'plain',
            headStyles: { 
                fillColor: [245, 245, 244], 
                textColor: brandSand, 
                fontStyle: 'bold', 
                fontSize: 7, 
                lineWidth: 0.1,
                lineColor: brandBeige
            },
            bodyStyles: { fontSize: 7.5, textColor: darkText, cellPadding: 4, lineWidth: 0.1, lineColor: borderGray },
            columnStyles: {
                0: { cellWidth: 16, fontStyle: 'bold' },
                1: { cellWidth: 18 },
                2: { cellWidth: 14 },
                3: { cellWidth: 18 },
                4: { cellWidth: 20, halign: 'right' },
                5: { cellWidth: 20, halign: 'right' },
                6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
                7: { cellWidth: 54 }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 8;
    } else {
        doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...grayText);
        doc.text('No registra pedidos o presupuestos.', m, y + 4);
        y += 10;
    }
    
    // Check page space for timeline, add page if needed
    if (y > 220) {
        doc.addPage();
        y = m;
    }
    
    // --- TIMELINE / INTERACTIONS ---
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
    doc.text('HISTORIAL DE NOTAS / VISITAS', m, y);
    y += 5;
    
    const interactions = client.interactions || [];
    if (interactions.length > 0) {
        interactions.forEach((int: any) => {
            if (y > 270) {
                doc.addPage();
                y = m + 5;
            }
            let intDate = '';
            try { intDate = format(new Date(int.createdAt), "dd/MM/yyyy HH:mm"); } catch { intDate = '-'; }
            
            doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...brandSand);
            doc.text(`${intDate} - ${int.type === 'NOTE' ? 'Nota' : 'Visita'}`, m, y);
            
            doc.setFont('helvetica', 'normal'); doc.setTextColor(...darkText);
            const splitText = doc.splitTextToSize(int.content || '', cw - 10);
            doc.text(splitText, m + 2, y + 4.5);
            
            y += 6 + splitText.length * 4;
        });
    } else {
        doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...grayText);
        doc.text('Sin notas registradas.', m, y);
        y += 8;
    }
    
    // --- FOOTER ---
    y = 280;
    doc.setDrawColor(...brandBeige); doc.setLineWidth(0.5);
    doc.line(m, y, pw - m, y);
    y += 5;
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(168, 162, 158);
    doc.text(`ATELIER OPTICA  |  TEJEDA 4380  |  PROFESIONALISMO ETICA Y DISENO  |  ${format(new Date(), 'yyyy')}`, pw / 2, y, { align: 'center' });
    
    const base64 = doc.output('datauristring').split(',')[1];
    return { base64, filename };
}
