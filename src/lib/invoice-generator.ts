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
    
    // --- 1. CABECERA ---
    doc.setDrawColor(0);
    doc.rect(10, 10, pageWidth - 20, 45);
    doc.line(pageWidth / 2, 10, pageWidth / 2, 55);
    
    doc.setFillColor(255, 255, 255);
    doc.rect((pageWidth / 2) - 8, 10, 16, 12, 'FD');
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('C', (pageWidth / 2) - 4, 20);
    doc.setFontSize(8);
    doc.text('CÓD. 011', (pageWidth / 2) - 6, 25);

    if (logo) {
        doc.addImage(`data:image/png;base64,${logo}`, 'PNG', 15, 15, 40, 15);
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(issuer.name, 15, 35);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Razón Social: ${issuer.name}`, 15, 40);
    doc.text(`Domicilio Comercial: ${issuer.address}`, 15, 45);
    doc.text(`Condición frente al IVA: ${issuer.ivaCondition}`, 15, 50);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURA', (pageWidth / 2) + 10, 20);
    doc.setFontSize(10);
    doc.text(`Punto de Venta: ${invoice.pointOfSale.toString().padStart(4, '0')}`, (pageWidth / 2) + 10, 30);
    doc.text(`Comp. Nro: ${invoice.voucherNumber.toString().padStart(8, '0')}`, (pageWidth / 2) + 45, 30);
    
    const fecha = new Date(invoice.createdAt).toLocaleDateString('es-AR');
    doc.text(`Fecha de Emisión: ${fecha}`, (pageWidth / 2) + 10, 37);
    doc.text(`CUIT: ${issuer.cuit}`, (pageWidth / 2) + 10, 44);
    doc.text(`Fecha de Inicio de Actividades: ${issuer.activityStart}`, (pageWidth / 2) + 10, 54);

    // --- 2. DATOS DEL RECEPTOR ---
    doc.rect(10, 60, pageWidth - 20, 25);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const docLabel = invoice.docType === 80 ? 'CUIT' : invoice.docType === 96 ? 'DNI' : 'Doc';
    doc.text(`${docLabel}: ${invoice.docNumber}`, 15, 67);
    doc.text(`Apellido y Nombre / Razón Social: ${invoice.order.client?.name || 'Consumidor Final'}`, 15, 74);
    doc.text(`Condición frente al IVA: Consumidor Final`, 15, 81);
    doc.text(`Condición de venta: Contado`, (pageWidth / 2) + 10, 67);

    // --- 3. TABLA DE ÍTEMS ---
    const tableItems = invoice.order.items.map((it: any) => [
        it.product?.id?.slice(-4).toUpperCase() || '-',
        `${it.product?.brand || ''} ${it.product?.model || it.product?.name || 'Producto'}`.trim(),
        it.quantity,
        'unidades',
        it.price.toLocaleString('es-AR', { minimumFractionDigits: 2 }),
        '0.00',
        (it.price * it.quantity).toLocaleString('es-AR', { minimumFractionDigits: 2 })
    ]);

    autoTable(doc, {
        startY: 90,
        head: [['Código', 'Producto/Servicio', 'Cant.', 'U. Medida', 'Precio Unit.', '% Bonif.', 'Subtotal']],
        body: tableItems,
        headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 8 },
    });

    // --- 4. TOTALES ---
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Importe Total: $', pageWidth - 80, finalY + 10);
    doc.text(invoice.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 }), pageWidth - 20, finalY + 10, { align: 'right' });

    // --- 5. QR CODE Y CAE ---
    const footerY = doc.internal.pageSize.getHeight() - 45;
    
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
        doc.addImage(qrImage, 'PNG', 10, footerY, 35, 35);
    } catch (err) {}
    
    doc.setFontSize(10);
    doc.text(`CAE: ${invoice.cae}`, pageWidth - 80, footerY + 20);
    doc.text(`Fecha de Vto. de CAE: ${new Date(invoice.caeExpiration).toLocaleDateString('es-AR')}`, pageWidth - 80, footerY + 27);

    doc.save(`Factura-${invoice.pointOfSale}-${invoice.voucherNumber}.pdf`);
}
