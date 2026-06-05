import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PricingService } from '@/services/PricingService';

export async function generateOrderPDF(order: any, contact: any): Promise<{ base64: string, filename: string }> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const isSale = order.orderType === 'SALE';
    
    // --- COLORES Y CONFIGURACIÓN ---
    const primaryColor = [166, 139, 124]; // #A68B7C (Brand Sand)
    const secondaryColor = [212, 195, 181]; // #D4C3B5 (Brand Beige)
    const textColor = [28, 25, 23];      // #1c1917 (Dark)
    const systemEmerald = [16, 185, 129]; // #10b981
    
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    // --- 1. CABECERA ---
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(10, 10, pageWidth - 10, 10);
    
    // Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(isSale ? 'ORDEN DE VENTA' : 'PRESUPUESTO', 12, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`V2.0`, 12, 28);
    
    // Right Side Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('ATELIER ÓPTICA', pageWidth - 12, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text('José Luis de Tejeda 4380', pageWidth - 12, 23, { align: 'right' });
    doc.text('Cerro de las Rosas, Córdoba', pageWidth - 12, 27, { align: 'right' });
    doc.text('WhatsApp: 351 1234567', pageWidth - 12, 31, { align: 'right' });

    // Order Meta
    let dateStr = '';
    try {
        dateStr = format(new Date(order.createdAt), "dd 'de' MMMM, yyyy", { locale: es });
    } catch (e) {
        dateStr = new Date().toLocaleDateString('es-AR');
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`#${order.id.slice(-6).toUpperCase()} · ${dateStr}`, 12, 36);

    // --- 2. DATOS DEL CLIENTE ---
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setLineWidth(0.3);
    doc.line(10, 42, pageWidth - 10, 42);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('CLIENTE', 12, 47);
    
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(contact?.name || 'Cliente Final', 12, 53);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`WhatsApp: ${contact?.phone || '-'}`, 12, 59);

    // --- 3. TABLA DE ÍTEMS ---
    const markupFactor = 1 + ((order.markup || 0) / 100);
    
    const tableItems = (order.items || []).map((it: any) => {
        const itemPrice = Math.round(it.price * markupFactor);
        const desc = `${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}`.trim() + (it.eye ? ` (Lado: ${it.eye})` : '');
        return [
            desc,
            it.quantity,
            `$${itemPrice.toLocaleString('es-AR')}`,
            `$${(itemPrice * it.quantity).toLocaleString('es-AR')}`
        ];
    });

    autoTable(doc, {
        startY: 65,
        head: [['Descripción', 'Cant.', 'Precio Unit.', 'Subtotal']],
        body: tableItems,
        headStyles: { 
            fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]], 
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            fontSize: 9
        },
        alternateRowStyles: { fillColor: [252, 251, 249] },
        styles: { 
            fontSize: 9, 
            cellPadding: 4, 
            textColor: textColor as any,
            lineColor: [secondaryColor[0], secondaryColor[1], secondaryColor[2]],
            lineWidth: 0.1
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { halign: 'center', cellWidth: 20 },
            2: { halign: 'right', cellWidth: 30 },
            3: { halign: 'right', fontStyle: 'bold', cellWidth: 30 }
        },
        margin: { left: 10, right: 10 }
    });

    // --- 4. TOTALES ---
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    
    const financials = PricingService.calculateOrderFinancials(order);
    const rawSubtotalInflated = (order.items || []).reduce((sum: number, it: any) => sum + (Math.round(it.price * markupFactor) * (it.quantity || 1)), 0);
    const promoFrameDiscount = order.appliedPromoDiscount || 0;
    const promoFrameInflated = Math.round(promoFrameDiscount * markupFactor);
    const specialDiscount = order.specialDiscount || 0;

    if (promoFrameInflated > 0 || specialDiscount > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text('Subtotal Items:', pageWidth - 60, finalY);
        doc.text(`$${rawSubtotalInflated.toLocaleString('es-AR')}`, pageWidth - 12, finalY, { align: 'right' });
        finalY += 5;
        
        if (promoFrameInflated > 0) {
            doc.setTextColor(systemEmerald[0], systemEmerald[1], systemEmerald[2]);
            doc.text(`${order.appliedPromoName || 'Bonificación'}:`, pageWidth - 60, finalY);
            doc.text(`-$${promoFrameInflated.toLocaleString('es-AR')}`, pageWidth - 12, finalY, { align: 'right' });
            finalY += 5;
        }
        
        if (specialDiscount > 0) {
            doc.setTextColor(systemEmerald[0], systemEmerald[1], systemEmerald[2]);
            doc.text('Descuento Especial:', pageWidth - 60, finalY);
            doc.text(`-$${specialDiscount.toLocaleString('es-AR')}`, pageWidth - 12, finalY, { align: 'right' });
            finalY += 5;
        }
    }

    // Precio Lista Final
    finalY += 2;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('PRECIO DE LISTA FINAL:', pageWidth - 70, finalY);
    doc.text(`$${financials.listPrice.toLocaleString('es-AR')}`, pageWidth - 12, finalY, { align: 'right' });
    
    // Totales por Método de Pago
    finalY += 15;
    
    if (!financials.hasBalance) {
        doc.setFillColor(240, 253, 244); // bg-emerald-50
        doc.rect(10, finalY, pageWidth - 20, 20, 'F');
        doc.setTextColor(16, 185, 129); // text-emerald-600
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('ORDEN PAGADA EN SU TOTALIDAD', pageWidth / 2, finalY + 12, { align: 'center' });
    } else {
        doc.setFontSize(10);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text('OPCIONES DE PAGO', 12, finalY);
        finalY += 8;
        
        // Efectivo
        doc.setFillColor(252, 251, 249);
        doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.rect(10, finalY, (pageWidth - 30) / 3, 25, 'FD');
        doc.setFontSize(8);
        doc.text(`EFECTIVO (-${financials.discountCash}%)`, 15, finalY + 6);
        doc.setFontSize(12);
        doc.text(`$${financials.totalCash.toLocaleString('es-AR')}`, 15, finalY + 14);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Saldo: $${financials.remainingCash.toLocaleString('es-AR')}`, 15, finalY + 20);
        
        // Transferencia
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.rect(10 + (pageWidth - 30) / 3 + 5, finalY, (pageWidth - 30) / 3, 25, 'FD');
        doc.setFontSize(8);
        doc.text(`TRANSFERENCIA (-${financials.discountTransfer}%)`, 15 + (pageWidth - 30) / 3 + 5, finalY + 6);
        doc.setFontSize(12);
        doc.text(`$${financials.totalTransfer.toLocaleString('es-AR')}`, 15 + (pageWidth - 30) / 3 + 5, finalY + 14);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Saldo: $${financials.remainingTransfer.toLocaleString('es-AR')}`, 15 + (pageWidth - 30) / 3 + 5, finalY + 20);
        
        // Tarjeta
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.rect(10 + ((pageWidth - 30) / 3) * 2 + 10, finalY, (pageWidth - 30) / 3, 25, 'FD');
        doc.setFontSize(8);
        doc.text(`TARJETAS (Lista)`, 15 + ((pageWidth - 30) / 3) * 2 + 10, finalY + 6);
        doc.setFontSize(12);
        doc.text(`$${financials.totalCard.toLocaleString('es-AR')}`, 15 + ((pageWidth - 30) / 3) * 2 + 10, finalY + 14);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`3 cuotas: $${financials.installment3.toLocaleString('es-AR')}`, 15 + ((pageWidth - 30) / 3) * 2 + 10, finalY + 19);
        doc.text(`6 cuotas: $${financials.installment6.toLocaleString('es-AR')}`, 15 + ((pageWidth - 30) / 3) * 2 + 10, finalY + 23);
    }
    
    // --- 5. FOOTER ---
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.line(10, footerY - 5, pageWidth - 10, footerY - 5);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Comprobante generado automáticamente por Ishtar Atelier CRM', pageWidth / 2, footerY, { align: 'center' });

    // Output
    const safeName = (contact?.name || 'Cliente').replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-');
    const filename = `${isSale ? 'Venta' : 'Presupuesto'}_${order.id.slice(-4).toUpperCase()}_${safeName}.pdf`;
    
    // Retornamos el base64 listo para enviar
    const base64String = doc.output('datauristring').split(',')[1];
    
    return { base64: base64String, filename };
}
