import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

export interface InvoiceData {
    invoice: any;
    issuer: {
        name: string;
        cuit: string;
        address: string;
        ivaCondition: string;
        activityStart: string;
    };
    logo?: string | null;
}

export async function generateInvoicePDF(data: InvoiceData) {
    const { invoice, issuer, logo } = data;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // --- COLORES Y CONFIGURACIÓN ---
    const primaryColor = [158, 127, 101]; // #9e7f65 (Bronze)
    const textColor = [67, 56, 49];      // #433831 (Dark Stone)
    const lightBg = [250, 248, 245];    // #faf8f5 (Sand)
    
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    // --- 1. CABECERA (Limpia, sin recuadros pesados) ---
    // Línea divisoria superior sutil
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(10, 10, pageWidth - 10, 10);
    
    // Letra C (Fiscal) - Un diseño más moderno
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect((pageWidth / 2) - 8, 10, 16, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('C', (pageWidth / 2) - 4, 19);
    doc.setFontSize(7);
    doc.text('CÓD. 011', (pageWidth / 2) - 5.5, 21.5);
    
    // Línea central divisoria vertical
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.1);
    doc.line(pageWidth / 2, 22, pageWidth / 2, 55);

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    // Logo y Emisor (Izquierda)
    if (logo) {
        // Logo horizontal sutil (45mm ancho)
        doc.addImage(`data:image/png;base64,${logo}`, 'PNG', 12, 12, 45, 6.8);
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(issuer.name, 12, 35); // Bajamos un poco para dar aire al logo
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    
    // Domicilio con wrap para evitar que cruce al otro lado
    const addressLines = doc.splitTextToSize(`Domicilio: ${issuer.address}`, (pageWidth / 2) - 20);
    doc.text(addressLines, 12, 40);
    
    // Calculamos el Y siguiente basado en las líneas del domicilio
    const nextY = 40 + (addressLines.length * 4);
    doc.text(`IVA: ${issuer.ivaCondition}`, 12, nextY);
    doc.text(`Inicio Actividades: ${issuer.activityStart}`, 12, nextY + 4);

    // Datos Factura (Derecha)
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURA', (pageWidth / 2) + 15, 20);
    
    doc.setFontSize(9);
    doc.text(`NRO: ${invoice.pointOfSale.toString().padStart(4, '0')}-${invoice.voucherNumber.toString().padStart(8, '0')}`, (pageWidth / 2) + 15, 28);
    
    const fecha = new Date(invoice.createdAt).toLocaleDateString('es-AR');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de Emisión: ${fecha}`, (pageWidth / 2) + 15, 36);
    doc.text(`CUIT Emisor: ${issuer.cuit}`, (pageWidth / 2) + 15, 43);

    // --- 2. DATOS DEL RECEPTOR (Sección Minimalista) ---
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.3);
    doc.line(10, 60, pageWidth - 10, 60);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('CLIENTE / RECEPTOR', 12, 65);
    
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.order.client?.name || 'Consumidor Final', 12, 71);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const docLabel = invoice.docType === 80 ? 'CUIT' : invoice.docType === 96 ? 'DNI' : 'Doc';
    doc.text(`${docLabel}: ${invoice.docNumber}`, 12, 77);
    doc.text(`IVA: Consumidor Final`, 12, 83);
    
    // Condición de Venta destacada a la derecha
    doc.setFont('helvetica', 'bold');
    doc.text(`Medio de Pago: Otro`, pageWidth - 60, 71);

    // --- 3. TABLA DE ÍTEMS (Diseño Premium sin líneas verticales) ---
    const tableItems = invoice.order.items.map((it: any) => [
        it.product?.id?.slice(-4).toUpperCase() || '-',
        `${it.product?.brand || ''} ${it.product?.model || it.product?.name || 'Producto'}`.trim(),
        it.quantity,
        'unidades',
        it.price.toLocaleString('es-AR', { minimumFractionDigits: 2 }),
        (it.price * it.quantity).toLocaleString('es-AR', { minimumFractionDigits: 2 })
    ]);

    autoTable(doc, {
        startY: 90,
        head: [['Cód.', 'Descripción / Producto', 'Cant.', 'U.M.', 'Precio Unit.', 'Subtotal']],
        body: tableItems,
        headStyles: { 
            fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]], 
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            fontSize: 9
        },
        alternateRowStyles: { fillColor: [252, 251, 249] },
        styles: { 
            fontSize: 8.5, 
            cellPadding: 4, 
            textColor: textColor as any,
            lineColor: [240, 240, 240],
            lineWidth: 0.1
        },
        columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: 'auto' },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'right' },
            5: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 10, right: 10 }
    });

    // --- 4. TOTALES (Destacado) ---
    const finalY = (doc as any).lastAutoTable.finalY + 12;
    
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(pageWidth - 90, finalY - 6, 80, 12, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', pageWidth - 85, finalY + 1.5);
    doc.text(`$ ${invoice.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, pageWidth - 15, finalY + 1.5, { align: 'right' });

    // --- 5. QR CODE Y CAE (Footer) ---
    const footerY = doc.internal.pageSize.getHeight() - 45;
    
    doc.setDrawColor(230, 230, 230);
    doc.line(10, footerY - 5, pageWidth - 10, footerY - 5);

    // QR - Browser compatible base64
    const qrJson = {
        ver: 1,
        fecha: new Date(invoice.createdAt).toISOString().split('T')[0],
        cuit: parseInt(issuer.cuit),
        ptoVta: invoice.pointOfSale,
        tipoCmp: 11,
        nroCmp: invoice.voucherNumber,
        importe: invoice.totalAmount,
        moneda: 'PES',
        ctz: 1,
        tipoDocRec: invoice.docType,
        nroDocRec: parseInt(invoice.docNumber) || 0,
        tipoCodAut: 'E',
        codAut: parseInt(invoice.cae)
    };
    
    const qrText = JSON.stringify(qrJson);
    const qrBase64 = btoa(unescape(encodeURIComponent(qrText)));
    const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`;
    
    try {
        const qrImage = await QRCode.toDataURL(qrUrl);
        doc.addImage(qrImage, 'PNG', 12, footerY, 32, 32);
    } catch (err) {}
    
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`CAE: ${invoice.cae}`, pageWidth - 12, footerY + 15, { align: 'right' });
    doc.text(`Vencimiento CAE: ${new Date(invoice.caeExpiration).toLocaleDateString('es-AR')}`, pageWidth - 12, footerY + 22, { align: 'right' });
    
    doc.setFontSize(7);
    doc.setTextColor(200, 200, 200);
    doc.text('Comprobante generado automáticamente por Ishtar Atelier CRM', pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });

    // Nombre de archivo profesional: FC-0003-00000001-Nombre-Apellido.pdf
    const clientName = (invoice.order.client?.name || 'Consumidor-Final').replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-');
    const fileName = `FC-${invoice.pointOfSale.toString().padStart(4, '0')}-${invoice.voucherNumber.toString().padStart(8, '0')}-${clientName}.pdf`;
    
    doc.save(fileName);
}
